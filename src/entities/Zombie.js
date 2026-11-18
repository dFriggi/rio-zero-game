// Zumbi: o modelo (humanoide arredondado com o visual do tipo, em data/zombies.js) e o comportamento.
// Modelo do Caminhante: pele esverdeada, olhos vermelhos que brilham, camisa com a barra em tiras e um rasgo no
// peito, manga direita arrancada (o antebraço fica de fora), feridas de sangue seco e um pé descalço.
// Comportamento:
//   surgindo → sobe do chão ao lado do ninho; ainda não ataca
//   vagando  → anda à toa rumo ao meio da orla e geme de vez em quando. Se vê o Rafael (cone de visão na frente,
//              ou bem perto em qualquer direção, sem nada alto no meio) ou ouve um tiro, grita e passa a caçar.
//              O grito chama os vizinhos que estão no raio "grito". Quem vaga demais acaba sentindo o cheiro.
//   caçando  → vai atrás do Rafael desviando de obstáculos. Perto, ERGUE OS BRAÇOS (o aviso: dá tempo de recuar,
//              deslizar ou empurrar) e só então golpeia. Levar tiro dá um tranco que atrasa o passo.
//   morto    → cai de costas, para longe do tiro, afunda no chão e volta para a reserva.
// Os zumbis são criados todos no carregamento e reaproveitados (nada de montar malha no meio do jogo).
import * as THREE from "three";
import { criarHumanoide, arred, caixa, mat, compactarHumanoide } from "./Humanoid.js";
import { animarZumbi } from "./animacao.js";
import { ZOMBIES } from "../data/zombies.js";
import { som } from "../core/Som.js";

export const ESCALA = 0.76; // Rafael e zumbis com cerca de 1,9 m

const anguloAte = (de, para) => Math.atan2(Math.sin(para - de), Math.cos(para - de));
const suave = (t) => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);
const LIMITE = { xMin: -46, xMax: 48, zMin: -28.5, zMax: 47 };

export function criarModeloZumbi(tipo, variacao = 0, tex = {}) {
  const look = ZOMBIES[tipo].look;
  const g = criarHumanoide({
    pele: look.skin,
    camisa: look.shirts[variacao % look.shirts.length],
    calca: look.pants,
    sapato: look.shoes,
    cabelo: look.hair,
    olhos: look.eyes,
    escala: ESCALA,
    texturas: { camisa: tex.camisaRasgada, calca: tex.jeans, rosto: tex.rostoZumbi },
  });
  const u = g.userData;
  const m = u.mats;
  m.olhos.emissive.setHex(look.eyes);
  m.olhos.emissiveIntensity = 0.6;
  const seco = mat(0x3a2b24);
  // manga direita arrancada: antebraço de fora e duas tiras de pano penduradas no cotovelo
  u.bracoD.ante.material = m.pele;
  [-1, 1].forEach((l) => {
    const tira = caixa(0.06, 0.12, 0.02, m.camisa, l * 0.05, -0.06, 0.09);
    tira.rotation.z = l * 0.3;
    u.bracoD.cotovelo.add(tira);
  });
  // barra da camisa em tiras
  [-0.22, -0.06, 0.12, 0.24].forEach((x, i) => {
    const tira = caixa(0.1, 0.1 + (i % 2) * 0.07, 0.03, m.camisa, x, 0.06 - (i % 2) * 0.035, 0.185);
    tira.rotation.z = (i - 1.5) * 0.15;
    u.tronco.add(tira);
  });
  // rasgo no peito mostrando a pele, sangue seco na camisa e no rosto
  u.tronco.add(
    arred(0.16, 0.14, 0.03, 0.02, m.pele, 0.15, 0.58, 0.19),
    arred(0.2, 0.15, 0.02, 0.01, seco, -0.14, 0.42, 0.205),
    arred(0.1, 0.12, 0.02, 0.01, seco, 0.2, 0.25, 0.185),
  );
  u.cabeca.add(caixa(0.1, 0.05, 0.02, seco, 0.1, -0.13, 0.222));
  u.pernaE.pe.material = m.pele; // descalço
  return compactarHumanoide(g);
}

const _olho = new THREE.Vector3();
const _alvo = new THREE.Vector3();

export class Zombie {
  constructor(tipo, tex, variacao = 0) {
    this.tipo = tipo;
    this.def = ZOMBIES[tipo];
    this.obj = criarModeloZumbi(tipo, variacao, tex);
    this.obj.rotation.order = "YXZ"; // a queda gira em torno do x do próprio zumbi
    this.obj.visible = false;
    this.obj.userData.zumbi = this; // o raio do tiro chega no zumbi a partir da malha atingida
    const m = this.obj.userData.mats;
    this.mats = [m.pele, m.camisa, m.calca, m.barra, m.gola, m.sapato, m.cabelo];
    this.olhos = m.olhos;
    this.pos = this.obj.position;
    this.ativo = false;
    this.estado = "inativo";
    this.ctx = null;
  }

  get vivo() {
    return this.ativo && this.estado !== "morto";
  }

  // modo: "borda" (entra andando), "mar" (sai da água) ou "ninho" (sobe do chão e já sai caçando)
  surgir(x, z, modo = "borda") {
    Object.assign(this, {
      ativo: true,
      estado: modo === "ninho" ? "surgindo" : "vagando",
      hp: this.def.hp,
      t: 0,
      fase: Math.random() * 6.28,
      quanto: 0,
      recarga: 0,
      preparo: 0,
      golpe: 0,
      tranco: 0,
      flash: 0,
      queima: 0,
      fome: rnd(0, 6),
      olhar: Math.random() * 0.25,
      gemido: rnd(2, 8),
      espera: 0,
      desvio: 0,
      progresso: 1,
      ultimaDist: Infinity,
      rumo: new THREE.Vector3(rnd(-16, 18), 0, rnd(-18, 32)),
      info: null,
    });
    this.obj.visible = true;
    this.obj.rotation.set(0, Math.atan2(-x, 6 - z), 0); // de frente para o meio da orla
    this.pos.set(x, modo === "borda" ? 0 : modo === "mar" ? -1.3 : -1.9, z);
    this._pintar(0, 0, 0);
    this.olhos.emissiveIntensity = 0.6;
  }

  desativar() {
    this.ativo = false;
    this.estado = "inativo";
    this.obj.visible = false;
    this.obj.rotation.set(0, 0, 0);
  }

  // passa a caçar; com grito, chama os vizinhos (ArenaScene.aoGritar)
  alertar(gritar = true) {
    if (!this.vivo || this.estado === "cacando" || this.estado === "surgindo") return;
    this.estado = "cacando";
    this.ultimaDist = Infinity;
    if (gritar) {
      som.zumbi(this.tipo, "grito", this.pos);
      this.ctx?.aoGritar(this);
    } else if (Math.random() < 0.4) {
      som.zumbi(this.tipo, "rosnado", this.pos);
    }
  }

  // dano de tiro ou de fogo; devolve true se morreu. info = { cabeca, fonte } vai junto para a pontuação
  ferir(dano, dir = null, info = {}) {
    if (!this.vivo) return false;
    this.hp -= dano;
    this.flash = 0.12;
    if (dir) {
      this.pos.x += dir.x * 0.16;
      this.pos.z += dir.z * 0.16;
      this.tranco = 0.3;
    }
    if (this.hp <= 0) {
      this._morrer(dir, info);
      return true;
    }
    if (Math.random() < 0.5) som.zumbi(this.tipo, "dor", this.pos);
    if (this.estado === "vagando") this.alertar(true);
    return false;
  }

  queimar(seg) {
    if (this.vivo) this.queima = Math.max(this.queima, seg);
  }

  // empurrão com a coronha: joga para trás e cancela o golpe que estava vindo
  empurrar(dir, forca = 1.4) {
    if (!this.vivo) return;
    this.pos.x += dir.x * forca;
    this.pos.z += dir.z * forca;
    this.preparo = 0;
    this.recarga = Math.max(this.recarga, 0.7);
    this.tranco = 0.7;
    this.flash = 0.08;
    if (this.estado === "vagando") this.alertar(false);
  }

  _morrer(dir, info) {
    this.estado = "morto";
    this.t = 0;
    this.preparo = 0;
    this.queima = 0;
    this.caiu = false;
    if (dir) this.obj.rotation.y = Math.atan2(-dir.x, -dir.z); // de frente para o tiro, cai de costas
    this.olhos.emissiveIntensity = 0;
    som.zumbi(this.tipo, "morte", this.pos);
    this.ctx?.aoMorrer(this, info);
  }

  _pintar(r, g, b) {
    for (const m of this.mats) m.emissive.setRGB(r, g, b);
  }

  update(dt, ctx) {
    if (!this.ativo) return;
    this.ctx = ctx;
    this.t += dt;
    // clarão do acerto (branco) e brasa da munição incendiária (laranja tremendo)
    if (this.flash > 0 || this.queima > 0 || this.pintado) {
      this.flash = Math.max(0, this.flash - dt);
      const f = this.flash / 0.12;
      const k = this.queima > 0 ? 0.4 + 0.25 * Math.sin(this.t * 23) : 0;
      this._pintar(0.5 * f + 0.9 * k, 0.5 * f + 0.32 * k, 0.45 * f + 0.04 * k);
      this.pintado = this.flash > 0 || this.queima > 0;
    }
    if (this.estado === "morto") return this._caido(dt, ctx);

    const d = this.def;
    const j = ctx.jogador;
    const p = this.pos;
    const dx = j.pos.x - p.x;
    const dz = j.pos.z - p.z;
    const dist = Math.hypot(dx, dz);
    this.recarga -= dt;
    this.tranco = Math.max(0, this.tranco - dt);
    this.golpe = Math.max(0, this.golpe - dt * 3.5);

    if (this.queima > 0) {
      this.queima -= dt;
      this.hp -= 10 * dt;
      if (Math.random() < dt * 10) ctx.efeitos.brasa(p);
      if (this.hp <= 0) return this._morrer(null, { fonte: "fogo" });
    }

    if (this.estado === "surgindo") {
      const k = Math.min(1, this.t / 1.4);
      p.y = -1.9 * (1 - suave(k));
      this.obj.rotation.y += anguloAte(this.obj.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 4);
      animarZumbi(this.obj, { fase: this.t * 3, quanto: 0, ergue: 1 - k * 0.6 });
      if (k >= 1) {
        p.y = 0;
        this.estado = "cacando";
        if (Math.random() < 0.5) som.zumbi(this.tipo, "grito", p);
      }
      return;
    }
    if (p.y < 0) p.y = Math.min(0, p.y + dt * 0.55); // saindo do mar

    // gemidos de vez em quando, só perto
    this.gemido -= dt;
    if (this.gemido <= 0) {
      this.gemido = rnd(5, 11);
      if (dist < 28 && this.estado === "vagando") som.zumbi(this.tipo, "gemido", p);
    }

    let vel = 0;
    let alvoX = this.rumo.x;
    let alvoZ = this.rumo.z;
    if (this.estado === "vagando") {
      this.fome += dt;
      this.olhar -= dt;
      if (j.vivo && dist < d.visao && this.olhar <= 0) {
        this.olhar = 0.25;
        const naFrente = Math.abs(anguloAte(this.obj.rotation.y, Math.atan2(dx, dz))) < 1.2;
        _olho.set(p.x, 1.55, p.z);
        _alvo.set(j.pos.x, j.pos.y + j.alturaOlho, j.pos.z);
        if ((naFrente || dist < 4) && ctx.colisao.livre(_olho, _alvo)) this.alertar(true);
      }
      if (this.fome > 24 && j.vivo) this.alertar(false); // sentiu o cheiro
      if (this.espera > 0) this.espera -= dt;
      else if (Math.hypot(alvoX - p.x, alvoZ - p.z) < 1) {
        this.espera = rnd(0.5, 2.2);
        this.rumo.set(
          THREE.MathUtils.clamp(p.x + rnd(-10, 10), -18, 20),
          0,
          THREE.MathUtils.clamp(p.z + rnd(-10, 10), -20, 34),
        );
      } else vel = d.vaga;
    }

    if (this.estado === "cacando") {
      if (!j.vivo) {
        this.estado = "vagando";
        this.rumo.set(p.x + rnd(-8, 8), 0, p.z + rnd(-8, 8));
      }
      alvoX = j.pos.x;
      alvoZ = j.pos.z;
      // preso atrás de algo (não chegou mais perto no último segundo): contorna de lado por um tempo
      this.progresso -= dt;
      if (this.progresso <= 0) {
        this.progresso = 1;
        if (dist > 2.5 && this.ultimaDist - dist < 0.4 && this.desvio <= 0) {
          const lado = Math.random() < 0.5 ? 1 : -1;
          this.desvio = 1.3;
          this.desvioX = p.x + (-dz / dist) * 4 * lado;
          this.desvioZ = p.z + (dx / dist) * 4 * lado;
        }
        this.ultimaDist = dist;
      }
      if (this.desvio > 0) {
        this.desvio -= dt;
        alvoX = this.desvioX;
        alvoZ = this.desvioZ;
      }
      vel = dist > d.radius + j.radius + 0.1 ? d.speed : 0;
      // aviso e golpe
      if (this.preparo > 0) {
        this.preparo -= dt;
        vel *= 0.2;
        alvoX = j.pos.x;
        alvoZ = j.pos.z;
        if (this.preparo <= 0) {
          this.golpe = 1;
          this.recarga = d.attackInterval;
          if (j.vivo && dist < d.reach + 0.35) ctx.aoGolpe(this, d.damage);
        }
      } else if (j.vivo && dist < d.reach && this.recarga <= 0 && Math.abs(j.pos.y) < 1.2) {
        this.preparo = d.windup;
        som.zumbi(this.tipo, "rosnado", p);
      }
    }
    if (this.tranco > 0) vel *= 0.3;

    // vira para onde vai e anda
    const ax = alvoX - p.x;
    const az = alvoZ - p.z;
    if (ax * ax + az * az > 0.01) {
      const giro = this.estado === "cacando" ? 7 : 3;
      this.obj.rotation.y += anguloAte(this.obj.rotation.y, Math.atan2(ax, az)) * Math.min(1, dt * giro);
    }
    if (vel > 0) {
      p.x += Math.sin(this.obj.rotation.y) * vel * dt;
      p.z += Math.cos(this.obj.rotation.y) * vel * dt;
    }
    // não entra nos outros zumbis nem no Rafael, e contorna quiosques, carros e barricadas
    for (const o of ctx.zumbis) {
      if (o === this || !o.vivo) continue;
      const ox = p.x - o.pos.x;
      const oz = p.z - o.pos.z;
      const dd = ox * ox + oz * oz;
      const min = d.radius + o.def.radius;
      if (dd < min * min && dd > 1e-6) {
        const k = ((min - Math.sqrt(dd)) / Math.sqrt(dd)) * 0.5;
        p.x += ox * k;
        p.z += oz * k;
      }
    }
    const minJ = d.radius + j.radius;
    if (dist < minJ && dist > 1e-4 && j.vivo) {
      p.x -= (dx / dist) * (minJ - dist);
      p.z -= (dz / dist) * (minJ - dist);
    }
    ctx.colisao.empurrar(p, d.radius);
    p.x = THREE.MathUtils.clamp(p.x, LIMITE.xMin, LIMITE.xMax);
    p.z = THREE.MathUtils.clamp(p.z, LIMITE.zMin, LIMITE.zMax);

    this.quanto += ((vel > 0.1 ? 1 : 0) - this.quanto) * Math.min(1, dt * 5);
    this.fase += dt * (1.6 + vel * 2.1) * Math.max(this.quanto, 0.3);
    const ergue = this.preparo > 0 ? 1 - this.preparo / d.windup : 0;
    animarZumbi(this.obj, { fase: this.fase, quanto: this.quanto, ergue, golpe: this.golpe });
    this.olhos.emissiveIntensity = 0.6 + ergue * 2.6;
  }

  // caído: tomba de costas em 0,55 s, fica um tempo no chão, afunda e volta para a reserva
  _caido(dt, ctx) {
    const q = suave(Math.min(1, this.t / 0.55));
    this.obj.rotation.x = (-Math.PI / 2) * q;
    this.pos.y = 0.15 * q;
    if (!this.caiu && this.t > 0.55) {
      this.caiu = true;
      ctx.aoCair(this); // os virotes cravados no corpo caem no chão e podem ser recolhidos
    }
    if (this.t > 4) this.pos.y = 0.15 - (this.t - 4) * 0.3;
    if (this.t > 5.5) this.desativar();
  }
}
