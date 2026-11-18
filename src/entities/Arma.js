// Arma na mão do Rafael: pente, recarga, cadência, dispersão e o modelo em primeira pessoa (arma e as duas mãos,
// presos na câmera), que balança ao andar, chuta no recuo, abaixa na recarga, centraliza ao mirar e avança no
// empurrão. A besta gasta virotes da aljava (reserva); a pistola tem munição de sobra fora do pente.
// O modelo vai na camada 2 da cena: só a câmera de 1ª pessoa enxerga (nas outras câmeras aparece o corpo inteiro).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ARMAS, ALJAVA } from "../data/armas.js";
import { MODELOS } from "./modelosArmas.js";
import { materialTexturizado } from "../world/texturas.js";
import { som } from "../core/Som.js";

// posição da arma na tela: no quadril (direita, embaixo) e mirando (centro)
const QUADRIL = new THREE.Vector3(0.24, -0.24, -0.5);
const MIRA = { besta: new THREE.Vector3(0, -0.1, -0.42), pistola: new THREE.Vector3(0, -0.13, -0.42) };
const CIMA = new THREE.Vector3(0, 1, 0);

// Mãos: palma, polegar e o antebraço na manga da jaqueta, em coordenadas do modelo da arma (cano em +z, origem
// na empunhadura). O modelo é girado meia volta para o cano apontar para dentro da tela, então o x troca de lado:
// o braço direito vai para x negativo do modelo.
const MAOS = {
  besta: {
    direita: { palma: [0, -0.05, -0.01], cotovelo: [-0.1, -0.21, -0.38] },
    esquerda: { palma: [0, -0.08, 0.3], cotovelo: [0.24, -0.25, 0.02] },
  },
  pistola: {
    direita: { palma: [0, -0.04, -0.02], cotovelo: [-0.07, -0.21, -0.36] },
    esquerda: { palma: [0.045, -0.06, -0.005], cotovelo: [0.23, -0.23, -0.3] },
  },
};

let texturaClarao = null;
function clarao() {
  if (!texturaClarao) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,250,220,1)");
    r.addColorStop(0.35, "rgba(255,190,90,0.8)");
    r.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    texturaClarao = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texturaClarao, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
  );
  s.scale.setScalar(0.32);
  return s;
}

function membro(material, r, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, d.length() - 2 * r), 4, 10), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(CIMA, d.normalize());
  return m;
}

export class Arma {
  constructor(id, tex = {}) {
    this.id = id;
    this.def = ARMAS[id];
    this.pivo = new THREE.Group(); // preso na câmera de 1ª pessoa
    this.modelo = MODELOS[id](tex);
    this.modelo.rotation.y = Math.PI;
    this.pivo.add(this.modelo);
    const u = this.modelo.userData;
    this.boca = u.boca;

    const pele = new THREE.MeshLambertMaterial({ color: 0xc99a72 });
    const manga = tex.couro ? materialTexturizado(tex.couro) : new THREE.MeshLambertMaterial({ color: 0x3b2a20 });
    const palma = new RoundedBoxGeometry(0.085, 0.1, 0.11, 2, 0.03);
    for (const lado of Object.values(MAOS[id])) {
      const p = new THREE.Vector3(...lado.palma);
      const c = new THREE.Vector3(...lado.cotovelo);
      const mao = new THREE.Mesh(palma, pele);
      mao.position.copy(p);
      const punho = p.clone().lerp(c, 0.18);
      this.modelo.add(mao, membro(pele, 0.032, p, punho), membro(manga, 0.05, punho, c));
    }

    this.clarao = clarao();
    this.clarao.position.copy(this.boca.position);
    this.luz = new THREE.PointLight(0xffc070, 0, 7, 2); // luz do disparo: criada já, acesa só no tiro
    this.luz.position.copy(this.boca.position);
    this.modelo.add(this.clarao, this.luz);
    this.pivo.traverse((o) => {
      if (o.isLight) return;
      o.layers.set(2);
      o.castShadow = false;
      o.frustumCulled = false;
    });
    this.pivo.position.copy(QUADRIL);
    this.pivo.visible = false;
    this.reiniciar();
  }

  reiniciar() {
    this.municao = this.def.pente;
    this.reserva = this.id === "besta" ? ALJAVA.inicio : Infinity;
    this.espera = 0;
    this.recarga = 0;
    this.calor = 0; // aumenta a dispersão com tiros seguidos
    this.coice = 0;
    this.troca = 1; // 1 = acabou de sacar (sobe de baixo)
    this.golpe = 0; // empurrão com a coronha
  }

  get recarregando() {
    return this.recarga > 0;
  }

  get progressoRecarga() {
    return this.recarregando ? 1 - this.recarga / this.duracaoRecarga : null;
  }

  // total de virotes (no trilho + na aljava), para o limite de coleta
  get virotes() {
    return this.municao + this.reserva;
  }

  dispersao(mirando, movendo, noAr) {
    const [quadril, mira] = this.def.dispersao;
    return (mirando ? mira : quadril) * (1 + this.calor) + (movendo ? 0.012 : 0) + (noAr ? 0.03 : 0);
  }

  // tenta atirar; devolve true se saiu o tiro. Sem munição no pente, recarrega sozinha (ou estala vazia)
  atirar(mods) {
    if (this.espera > 0 || this.recarregando || this.troca > 0.3) return false;
    if (this.municao <= 0) {
      if (this.reserva <= 0) {
        som.vazio();
        this.espera = 0.35;
      } else this.recarregar(mods);
      return false;
    }
    this.municao -= 1;
    this.espera = this.def.intervalo / mods.cadencia;
    this.calor = Math.min(2, this.calor + 0.45);
    this.coice = 1;
    this.luz.intensity = this.id === "besta" ? 4 : 30;
    this.clarao.material.opacity = this.id === "besta" ? 0 : 1;
    this.clarao.material.rotation = Math.random() * 6.28;
    som.tiro(this.id);
    return true;
  }

  recarregar(mods) {
    if (this.recarregando || this.municao >= this.def.pente || this.reserva <= 0) return;
    this.duracaoRecarga = this.def.recarga * mods.recarga;
    this.recarga = this.duracaoRecarga;
    this.etapaSom = 0;
    som.recarga(this.id, "sai");
  }

  sacar() {
    this.troca = 1;
    som.sacar();
  }

  update(dt, mods) {
    this.espera -= dt;
    this.calor = Math.max(0, this.calor - dt * 2.2);
    if (this.recarregando) {
      this.recarga -= dt;
      const pr = 1 - this.recarga / this.duracaoRecarga;
      if (this.etapaSom === 0 && pr > 0.55) {
        this.etapaSom = 1;
        som.recarga(this.id, "entra");
      }
      if (this.etapaSom === 1 && pr > 0.88) {
        this.etapaSom = 2;
        som.recarga(this.id, "trava");
      }
      if (this.recarga <= 0) {
        this.recarga = 0;
        const n = Math.min(this.def.pente - this.municao, this.reserva);
        this.municao += n;
        this.reserva -= n;
      }
    } else if (this.municao <= 0 && this.espera <= 0) {
      this.recarregar(mods);
    }
  }

  // anima o modelo preso na câmera. balanco vem do passo; olhar = movimento do mouse neste quadro
  animar(dt, { mirando, balanco, andando, olharX, olharY }) {
    const k = (v) => 1 - Math.exp(-v * dt);
    this.coice -= this.coice * k(14);
    this.troca = Math.max(0, this.troca - dt * 3.2);
    this.golpe = Math.max(0, this.golpe - dt * 4);
    const g = this.pivo;
    const base = mirando ? MIRA[this.id] : QUADRIL;
    const bob = mirando ? 0.15 : 1;
    const empurra = Math.sin(this.golpe * Math.PI);
    const alvoX = base.x + Math.cos(balanco) * 0.012 * andando * bob - olharX * 0.0006 - empurra * 0.08;
    const alvoY = base.y + Math.abs(Math.sin(balanco)) * 0.014 * andando * bob + olharY * 0.0006 - this.troca * 0.35;
    const alvoZ = base.z + this.coice * 0.07 - empurra * 0.16;
    g.position.x += (alvoX - g.position.x) * k(18);
    g.position.y += (alvoY - g.position.y) * k(18);
    g.position.z += (alvoZ - g.position.z) * k(this.golpe > 0 ? 40 : 30);
    // recarga: a arma abaixa e gira para o lado e volta no fim
    const r = this.progressoRecarga;
    const giro = r === null ? 0 : Math.sin(r * Math.PI);
    g.rotation.x = this.coice * 0.16 - giro * 0.55 - this.troca * 0.6 - empurra * 0.3;
    g.rotation.z = giro * 0.5 + (mirando ? 0 : 0.04) + empurra * 0.4;
    g.rotation.y = -olharX * 0.0004;
    // besta: a corda solta no tiro e é puxada de novo na recarga, com o virote novo no trilho
    const u = this.modelo.userData;
    if (u.esticar) {
      const tensao = this.municao > 0 ? 1 : r === null ? 0 : Math.min(1, r * 1.6);
      if (tensao !== this.tensao) u.esticar((this.tensao = tensao));
      u.virote.visible = this.municao > 0 || (r !== null && r > 0.6);
    }
    // pistola: o ferrolho corre para trás no tiro e fica aberto com o pente vazio
    if (u.ferrolho) u.ferrolho.position.z = u.ferrolhoZ - (this.municao <= 0 && r === null ? 0.045 : this.coice * 0.045);
    // clarão do tiro some rápido
    this.luz.intensity *= Math.exp(-dt * 40);
    this.clarao.material.opacity *= Math.exp(-dt * 45);
  }
}
