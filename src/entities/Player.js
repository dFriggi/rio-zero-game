// Rafael Duarte em primeira pessoa: anda com WASD na direção do olhar, mira com o mouse, pula, agacha e desliza.
// O movimento tem aceleração e atrito (arrancada rápida, freio curto) e controle no ar.
// Deslizar (Shift correndo) dá um embalo e serve de esquiva: durante o deslize o golpe do zumbi passa direto.
// Colisão: o corpo é um círculo empurrado para fora de quiosques, carros, barricadas, postes e coqueiros
// (world/colisao.js); dá para subir pulando nas barricadas, que são baixas.
import * as THREE from "three";
import { Arma } from "./Arma.js";
import { ARMAS_INICIAIS } from "../data/armas.js";
import { som } from "../core/Som.js";

const GRAVIDADE = 24;
const PULO = 8.2;
const ACEL_CHAO = 11; // quanto da velocidade desejada é alcançado por segundo
const ACEL_AR = 2.2;
const ATRITO = 9;
const ATRITO_DESLIZE = 1.1;
const SENSIBILIDADE = 0.0022;
const OLHO = { pe: 1.65, agachado: 1.1, deslizando: 0.95 };

export class Player {
  constructor(tex) {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = 0.45;
    this.maxHp = 100;
    this.velocidade = 7.5;
    this.armas = ARMAS_INICIAIS.map((id) => new Arma(id, tex));
    this.reiniciar();
  }

  reiniciar(x = 0, z = 1, yaw = 0) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.noChao = true;
    this.agachado = false;
    this.deslize = 0;
    this.esperaDeslize = 0;
    this.esperaEmpurrao = 0;
    this.alturaOlho = OLHO.pe;
    this.hp = this.maxHp;
    this.alive = true;
    this.deadT = 0;
    this.invuln = 0;
    this.mirando = false;
    this.fovAlvo = 78;
    this.slot = 0;
    // modificadores (as habilidades entre ondas chegam na próxima entrega e mexem aqui)
    this.mods = { cadencia: 1, recarga: 1, velocidade: 1, danoRecebido: 1, perfura: false, queima: false };
    this.armas.forEach((a) => a.reiniciar());
  }

  get vivo() {
    return this.alive;
  }

  get arma() {
    return this.armas[this.slot];
  }

  // direção do olhar (para a frente, com a inclinação da cabeça)
  direcao(alvo = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return alvo.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  takeDamage(n) {
    if (!this.alive || this.invuln > 0) return false;
    this.hp = Math.max(0, this.hp - n * this.mods.danoRecebido);
    this.invuln = 0.35;
    if (this.hp <= 0) this.alive = false;
    return true;
  }

  curar(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  trocarArma(slot) {
    if (slot === this.slot || !this.armas[slot]) return;
    this.slot = slot;
    this.arma.sacar();
  }

  update(dt, input, ctx) {
    if (!this.alive) {
      this.deadT = Math.min(1, this.deadT + dt * 1.6);
      this.vel.set(0, 0, 0);
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.deslize = Math.max(0, this.deslize - dt);
    this.esperaDeslize = Math.max(0, this.esperaDeslize - dt);
    this.esperaEmpurrao = Math.max(0, this.esperaEmpurrao - dt);

    // olhar
    const sens = SENSIBILIDADE * (this.mirando ? 0.6 : 1);
    this.yaw -= input.mouse.dx * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - input.mouse.dy * sens));

    // trocar de arma: 1 e 2, Q ou a rodinha
    for (let i = 0; i < this.armas.length; i++) if (input.wasPressed("Digit" + (i + 1))) this.trocarArma(i);
    const n = this.armas.length;
    if (input.wasPressed("KeyQ") || input.mouse.roda > 0) this.trocarArma((this.slot + 1) % n);
    if (input.mouse.roda < 0) this.trocarArma((this.slot - 1 + n) % n);

    // direção desejada, relativa ao olhar
    const frente = (input.isDown("KeyW", "ArrowUp") ? 1 : 0) - (input.isDown("KeyS", "ArrowDown") ? 1 : 0);
    const lado = (input.isDown("KeyD", "ArrowRight") ? 1 : 0) - (input.isDown("KeyA", "ArrowLeft") ? 1 : 0);
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    let wx = -sy * frente + cy * lado;
    let wz = -cy * frente - sy * lado;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }

    const agachar = input.isDown("ShiftLeft", "ShiftRight", "KeyC");
    const velH = Math.hypot(this.vel.x, this.vel.z);
    if (agachar && !this.agachado && this.noChao && velH > 5.5 && this.esperaDeslize <= 0) {
      const f = Math.max(velH, 12) / velH; // embalo na direção em que já está indo
      this.vel.x *= f;
      this.vel.z *= f;
      this.deslize = 0.75;
      this.esperaDeslize = 1;
      som.deslize();
    }
    this.agachado = agachar;

    const desejada =
      this.velocidade * this.mods.velocidade * (this.mirando ? 0.72 : 1) * (this.agachado && this.deslize <= 0 ? 0.5 : 1);
    if (this.noChao) {
      const atrito = this.deslize > 0 ? ATRITO_DESLIZE : ATRITO;
      const v = Math.hypot(this.vel.x, this.vel.z);
      if (v > 0) {
        const nova = Math.max(0, v - v * atrito * dt - (v < 1 ? 4 * dt : 0));
        this.vel.x *= nova / v;
        this.vel.z *= nova / v;
      }
      if (this.deslize <= 0 && wl > 0) this._acelerar(wx, wz, desejada, ACEL_CHAO, dt);
      if (input.wasPressed("Space")) {
        this.vel.y = PULO;
        this.noChao = false;
        this.deslize = 0;
      }
    } else {
      if (wl > 0) this._acelerar(wx, wz, Math.min(desejada, 1.6), ACEL_AR * 6, dt);
      this.vel.y -= GRAVIDADE * dt;
    }

    this.pos.addScaledVector(this.vel, dt);
    // colisão: obstáculos mais baixos que os pés não empurram (dá para andar em cima da barricada)
    ctx.colisao.empurrar(this.pos, this.radius, this.pos.y + 0.25);
    const piso = ctx.colisao.chao(this.pos, this.pos.y + 0.3) || 0;
    if (this.pos.y <= piso && this.vel.y <= 0) {
      if (!this.noChao) som.pouso(Math.min(1, -this.vel.y / 14));
      this.pos.y = piso;
      this.vel.y = 0;
      this.noChao = true;
    } else if (this.noChao && this.pos.y > piso + 0.05) {
      this.noChao = false; // saiu da beirada
    }
    const L = ctx.limites;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, L.xMin, L.xMax);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, L.zMin, L.zMax);
    som.passos(this, this.pos, this.noChao && this.deslize <= 0, ctx.chaoEm(this.pos.z), dt);

    const olho = this.deslize > 0 ? OLHO.deslizando : this.agachado ? OLHO.agachado : OLHO.pe;
    this.alturaOlho += (olho - this.alturaOlho) * (1 - Math.exp(-14 * dt));

    // arma: mirar (direito), recarregar (R), atirar (esquerdo), empurrar com a coronha (F)
    const arma = this.arma;
    this.mirando = input.mouseDown(2) && !arma.recarregando && arma.troca < 0.3;
    this.fovAlvo = this.mirando ? arma.def.fovMira : this.deslize > 0 ? 86 : 78;
    if (input.wasPressed("KeyR")) arma.recarregar(this.mods);
    if (input.wasPressed("KeyF") && this.esperaEmpurrao <= 0) {
      this.esperaEmpurrao = 0.8;
      arma.golpe = 1;
      ctx.empurrar(this);
    }
    if ((input.travado || input.livre) && input.mouseClicked(0) && arma.atirar(this.mods)) ctx.disparar(this, arma);
    arma.update(dt, this.mods);
  }

  // aceleração: só soma o que falta para chegar na velocidade desejada naquela direção
  _acelerar(wx, wz, desejada, acel, dt) {
    const atual = this.vel.x * wx + this.vel.z * wz;
    const falta = desejada - atual;
    if (falta <= 0) return;
    const soma = Math.min(acel * desejada * dt, falta);
    this.vel.x += wx * soma;
    this.vel.z += wz * soma;
  }
}
