// Ninho: monte de carne com casulos que brota do chão no começo da onda e solta um zumbi a cada 6 a 8 segundos
// até ser destruído (ou até soltar 7). Os casulos incham quando um zumbi vai nascer, e uma luz vermelha pulsa
// em cima (a luz é criada já no carregamento, apagada, para o shader não ser recompilado no meio do jogo).
// Destruir o ninho vale 100 pontos; a onda só acaba quando não sobra ninho.
import * as THREE from "three";
import { som } from "../core/Som.js";

export const NINHO = { hp: 240, intervalo: [6, 8], primeiro: 3, maxSoltos: 7, pontos: 100 };

const rnd = (a, b) => a + Math.random() * (b - a);
const suave = (t) => t * t * (3 - 2 * t);

function criarModelo() {
  const g = new THREE.Group();
  const carne = new THREE.MeshLambertMaterial({ color: 0x3b2230, emissive: 0x1a0508 });
  const casulo = new THREE.MeshLambertMaterial({ color: 0x7a3438, emissive: 0x6a1414, emissiveIntensity: 0.5 });
  const veia = new THREE.MeshLambertMaterial({ color: 0x4a1c28, emissive: 0x2a0610 });
  // monte: esfera achatada com a superfície irregular (as ondulações são fixas, calculadas por seno)
  const geo = new THREE.SphereGeometry(1.25, 20, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.1 * Math.sin(v.x * 5.1 + v.y * 3.3) + 0.07 * Math.sin(v.z * 6.7 - v.y * 4.1);
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const monte = new THREE.Mesh(geo, carne);
  monte.scale.y = 0.6;
  // casulos em volta do topo
  const geoCasulo = new THREE.SphereGeometry(0.3, 12, 10);
  const casulos = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.3;
    const c = new THREE.Mesh(geoCasulo, casulo);
    c.position.set(Math.cos(a) * 0.62, 0.62 + (i % 2) * 0.12, Math.sin(a) * 0.62);
    c.scale.set(0.8, 1.35, 0.8);
    c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    casulos.push(c);
  }
  // raízes deitadas no chão, saindo do monte
  const raizes = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const comp = 1.2 + (i % 3) * 0.5;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.025, comp, 6), veia);
    const a = i * 0.785 + 0.2;
    r.rotation.set(0, -a, Math.PI / 2);
    r.position.set(Math.cos(a) * (1 + comp / 2), 0.05, Math.sin(a) * (1 + comp / 2));
    raizes.add(r);
  }
  // mancha escura no chão
  const mancha = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 28),
    new THREE.MeshLambertMaterial({ color: 0x161014, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  mancha.rotation.x = -Math.PI / 2;
  mancha.position.y = 0.02;
  // esporos subindo
  const n = 26;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pts.set([rnd(-1.4, 1.4), rnd(0, 2.5), rnd(-1.4, 1.4)], i * 3);
  const esporosGeo = new THREE.BufferGeometry();
  esporosGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const esporos = new THREE.Points(
    esporosGeo,
    new THREE.PointsMaterial({ color: 0xff8a70, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  g.add(monte, ...casulos, raizes, mancha, esporos);
  [monte, ...casulos].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  g.userData = { monte, casulos, esporos, carne, casulo };
  return g;
}

export class Ninho {
  constructor(scene) {
    this.g = criarModelo();
    this.g.visible = false;
    this.g.userData.ninho = this; // o raio do tiro chega no ninho a partir da malha atingida
    this.luz = new THREE.PointLight(0xff4a30, 0, 11, 2);
    scene.add(this.g, this.luz);
    this.ativo = false;
    this.hp = 0;
  }

  get vivo() {
    return this.ativo && this.hp > 0;
  }

  brotar(x, z) {
    Object.assign(this, { ativo: true, hp: NINHO.hp, t: 0, espera: NINHO.primeiro, soltos: 0, inchar: 0, flash: 0 });
    this.g.position.set(x, 0, z);
    this.g.scale.set(1, 0.05, 1);
    this.g.visible = true;
    this.luz.position.set(x, 1.6, z);
    som.ninho("brota", this.g.position);
  }

  ferir(dano) {
    if (!this.vivo) return false;
    this.hp -= dano;
    this.flash = 0.12;
    if (this.hp > 0) {
      som.ninho("acerto", this.g.position);
      return false;
    }
    this.t = 0;
    som.ninho("destruido", this.g.position);
    return true;
  }

  desativar() {
    this.ativo = false;
    this.hp = 0;
    this.g.visible = false;
    this.luz.intensity = 0;
  }

  update(dt, ctx) {
    if (!this.ativo) return;
    this.t += dt;
    const u = this.g.userData;
    if (this.hp <= 0) {
      // destruído: murcha e afunda em 1 s
      const k = Math.min(1, this.t / 1);
      this.g.scale.set(1 + k * 0.2, Math.max(0.02, 1 - suave(k)), 1 + k * 0.2);
      this.luz.intensity = 14 * (1 - k);
      if (k >= 1) this.desativar();
      return;
    }
    const nasce = suave(Math.min(1, this.t / 1.6));
    this.flash = Math.max(0, this.flash - dt);
    this.inchar = Math.max(0, this.inchar - dt * 1.2);
    const pulso = 1 + 0.035 * Math.sin(this.t * 3.2) + this.inchar * 0.1;
    this.g.scale.set(pulso, nasce * pulso, pulso);
    u.casulos.forEach((c, i) => c.scale.set(0.8, 1.35 + 0.12 * Math.sin(this.t * 4 + i) + this.inchar * 0.4, 0.8));
    u.casulo.emissiveIntensity = 0.5 + this.inchar * 1.5 + this.flash * 8;
    u.carne.emissive.setRGB(0.1 + this.flash * 4, 0.02 + this.flash * 2, 0.03 + this.flash * 2);
    this.luz.intensity = nasce * (9 + 3 * Math.sin(this.t * 3.2) + this.inchar * 12);
    // esporos sobem e voltam para baixo
    const p = u.esporos.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.3 + (i % 4) * 0.1);
      if (y > 2.6) y = 0.2;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    // solta um zumbi de tempos em tempos (se ainda cabe zumbi na orla)
    this.espera -= dt;
    if (nasce >= 1 && this.espera <= 0 && this.soltos < NINHO.maxSoltos) {
      if (ctx.soltarDoNinho(this)) {
        this.soltos++;
        this.inchar = 1;
        this.espera = rnd(...NINHO.intervalo);
        som.ninho("solta", this.g.position);
      } else this.espera = 1;
    }
  }
}
