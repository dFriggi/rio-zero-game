// Arena da fase 1 (Copacabana): junta o Rafael, os zumbis, os ninhos, os virotes, as ondas e a pontuação.
// Regras (cada uma com consequência):
//   • tiro na cabeça: dano ×2 e pontos ×1,5
//   • combo: abates seguidos (até 3,5 s um do outro) multiplicam os pontos (+0,25 por abate, até ×3).
//     Levar um golpe zera o combo.
//   • barulho: a pistola é ouvida a 26 m e acorda os zumbis; a besta é quase silenciosa (7 m)
//   • virotes contados: o que não for recolhido do chão faz falta depois
//   • aviso do golpe: o zumbi ergue os braços antes de bater. Dá para sair do alcance, deslizar (esquiva, +5 pontos)
//     ou empurrar com a coronha (F), que cancela o golpe
//   • ninhos soltam zumbis até serem destruídos (+100); cada onda concluída vale 50 × número da onda
//   • a vida não volta sozinha
// Vitória: limpar as 3 ondas. Derrota: a vida chega a zero. Nos dois casos, R recomeça.
import * as THREE from "three";
import { Zombie } from "../entities/Zombie.js";
import { Ninho, NINHO } from "../entities/Ninho.js";
import { Virotes } from "../entities/Projectile.js";
import { animarRafael } from "../entities/animacao.js";
import { WaveSystem } from "../systems/WaveSystem.js";
import { Efeitos } from "../world/Efeitos.js";
import { PHASES } from "../data/phases.js";
import { ALJAVA } from "../data/armas.js";
import { som } from "../core/Som.js";

const COMBO_JANELA = 3.5;
const FACHADA_Z = -29.8; // frente dos prédios: o tiro bate e o virote crava
const CHAVE_RECORDE = "rz-entrega4-recorde";
const rnd = (a, b) => a + Math.random() * (b - a);

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _b = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _p = new THREE.Vector3();

// distância (no chão) do ponto p até o segmento a-b
function distSegmento2D(p, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2)) : 0;
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

export function lerRecorde() {
  try {
    return Number(localStorage.getItem(CHAVE_RECORDE)) || 0;
  } catch {
    return 0;
  }
}

export class ArenaScene {
  constructor({ scene, colisao, limites, jogador, rafael, tex, hud, obterCamera, aoTremer, aoFim }) {
    Object.assign(this, { scene, colisao, limites, jogador, rafael, hud, obterCamera, aoTremer, aoFim });
    this.fase = PHASES[0];
    this.efeitos = new Efeitos(scene);
    this.virotes = new Virotes(scene, 30);
    // reserva de zumbis (todos criados agora; o máximo vivo é 12, os outros cobrem os que estão caindo)
    this.zumbis = Array.from({ length: 18 }, (_, i) => {
      const z = new Zombie("caminhante", tex, i);
      scene.add(z.obj);
      return z;
    });
    this.ninhos = Array.from({ length: 3 }, () => new Ninho(scene));
    this.ondas = new WaveSystem(this.fase);
    this.raio = new THREE.Raycaster();
    this.candidatos = [];
    this.besta = jogador.armas.find((a) => a.id === "besta");
    this.passada = { fase: 0, quanto: 0 };
    this.reiniciar();
  }

  reiniciar() {
    this.zumbis.forEach((z) => z.desativar());
    this.ninhos.forEach((n) => n.desativar());
    this.virotes.reiniciar();
    this.ondas.reiniciar();
    this.jogador.reiniciar(0, 1, 0); // de frente para a avenida
    this.rafael.rotation.set(0, Math.PI, 0);
    Object.assign(this, { pontos: 0, combo: 0, comboT: 0, tempo: 0, etapa: "intro", espera: 1.2, encerrado: false });
    this.stats = { abates: 0, cabecas: 0, disparos: 0, acertos: 0, ninhos: 0, esquivas: 0, maiorCombo: 0 };
  }

  // --- consultas usadas pelas ondas, ninhos, zumbis e virotes ---------------------------------
  vivos() {
    return this.zumbis.reduce((n, z) => n + (z.vivo ? 1 : 0), 0);
  }
  ninhosVivos() {
    return this.ninhos.reduce((n, x) => n + (x.vivo ? 1 : 0), 0);
  }
  get restantes() {
    return this.ondas.fila.length + this.vivos();
  }
  chaoEm(z) {
    return z > 6 ? "terra" : "pedra"; // areia ou calçadão/avenida, para o som do passo
  }
  _livre() {
    return this.zumbis.find((z) => !z.ativo);
  }

  soltarDaBorda(tipo) {
    const z = this._livre();
    if (!z) return;
    const j = this.jogador.pos;
    const longe = this.fase.entradas.filter((e) => Math.hypot(e.x - j.x, e.z - j.z) > 18);
    const lista = longe.length ? longe : this.fase.entradas;
    const e = lista[Math.floor(Math.random() * lista.length)];
    z.surgir(e.x + rnd(-1.5, 1.5), e.z, e.de === "mar" ? "mar" : "borda");
  }

  soltarDoNinho(n) {
    if (this.vivos() >= this.fase.maxVivos) return false;
    const z = this._livre();
    if (!z) return false;
    const a = Math.random() * Math.PI * 2;
    z.surgir(n.g.position.x + Math.cos(a) * 1.8, n.g.position.z + Math.sin(a) * 1.8, "ninho");
    return true;
  }

  _brotarNinhos(qtd) {
    const j = this.jogador.pos;
    const lugares = this.fase.ninhos
      .filter((p) => Math.hypot(p.x - j.x, p.z - j.z) > 12)
      .sort(() => Math.random() - 0.5)
      .slice(0, qtd);
    lugares.forEach((p, i) => this.ninhos[i].brotar(p.x, p.z));
  }

  _iniciarOnda(i) {
    const onda = this.ondas.iniciar(i);
    this._brotarNinhos(onda.ninhos);
    this.etapa = "onda";
    const n = onda.ninhos;
    this.hud.banner(`Onda ${i + 1}`, `${n} ${n === 1 ? "ninho brotou" : "ninhos brotaram"} na orla`);
    som.stinger("onda");
  }

  aoConcluir(i) {
    const bonus = 50 * (i + 1);
    this.pontos += bonus;
    if (i + 1 < this.ondas.total) {
      this.etapa = "intervalo";
      this.espera = 5;
      this.hud.banner("Onda concluída", `+${bonus} pontos · próxima onda em 5 s`);
      som.stinger("concluida");
    } else {
      this.hud.banner("Copacabana limpa", `+${bonus} pontos`);
      this._encerrar(true);
    }
  }

  // --- tiro -----------------------------------------------------------------------------------
  // o primeiro alvo entre a e b: zumbi (com cabeça ou não), ninho, obstáculo, fachada ou chão
  tracar(a, b, ignorar = null) {
    _seg.subVectors(b, a);
    const len = _seg.length();
    if (len < 1e-6) return null;
    _seg.divideScalar(len);
    let melhor = null;
    let dist = len;
    if (b.y < 0 && a.y >= 0) {
      dist = (a.y / (a.y - b.y)) * len;
      melhor = { tipo: "chao" };
    }
    if (b.z < FACHADA_Z && a.z >= FACHADA_Z) {
      const t = ((a.z - FACHADA_Z) / (a.z - b.z)) * len;
      if (t < dist) {
        dist = t;
        melhor = { tipo: "parede" };
      }
    }
    const ob = this.colisao.segmento(a, b);
    if (ob && ob.t * len < dist) {
      dist = ob.t * len;
      melhor = { tipo: "obstaculo" };
    }
    // zumbis e ninhos perto da linha do tiro: raio contra as malhas (a cabeça é o grupo "cabeca" do humanoide)
    const c = this.candidatos;
    c.length = 0;
    for (const z of this.zumbis) if (z.vivo && z !== ignorar && distSegmento2D(z.pos, a, b) < 1.4) c.push(z.obj);
    for (const n of this.ninhos) if (n.vivo && distSegmento2D(n.g.position, a, b) < 3) c.push(n.g);
    if (c.length) {
      this.raio.set(a, _seg);
      this.raio.far = dist;
      for (const h of this.raio.intersectObjects(c, true)) {
        if (!h.object.isMesh) continue;
        let o = h.object;
        while (o && !o.userData.zumbi && !o.userData.ninho) o = o.parent;
        if (!o) continue;
        if (o.userData.ninho) {
          const u = o.userData;
          if (h.object !== u.monte && !u.casulos.includes(h.object)) continue; // mancha e raízes não contam
          melhor = { tipo: "ninho", ninho: u.ninho, objeto: h.object };
        } else {
          const z = o.userData.zumbi;
          let cabeca = false;
          for (let k = h.object; k && k !== o; k = k.parent) if (k === o.userData.cabeca) cabeca = true;
          melhor = { tipo: "zumbi", zumbi: z, cabeca, objeto: h.object };
        }
        dist = h.distance;
        break;
      }
    }
    if (!melhor) return null;
    melhor.ponto = new THREE.Vector3().copy(a).addScaledVector(_seg, dist);
    melhor.dist = dist;
    return melhor;
  }

  disparar(j, arma) {
    const cam = this.obterCamera();
    cam.getWorldPosition(_o);
    cam.getWorldDirection(_d);
    const disp = arma.dispersao(j.mirando, Math.hypot(j.vel.x, j.vel.z) > 1, !j.noChao);
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * disp;
    _d.x += g();
    _d.y += g();
    _d.z += g();
    _d.normalize();
    this.stats.disparos++;
    j.pitch = Math.min(1.45, j.pitch + arma.def.recuo * 0.5);
    this.aoTremer(arma.id === "pistola" ? 0.12 : 0.05);
    // barulho: quem está vagando no raio de ruído da arma escuta e vem
    for (const z of this.zumbis) {
      if (z.vivo && z.estado === "vagando" && z.pos.distanceTo(j.pos) < arma.def.ruido) z.alertar(Math.random() < 0.3);
    }
    if (arma.def.tipo === "projetil") {
      _p.copy(_o).addScaledVector(_d, 0.35);
      this.virotes.disparar(_p, _d, arma.def, j.mods);
      return;
    }
    arma.boca.getWorldPosition(_b);
    const fim = _p.copy(_o).addScaledVector(_d, arma.def.alcance);
    let hit = this.tracar(_o, fim);
    let fator = 1;
    const ate = hit ? hit.ponto.clone() : fim.clone();
    for (let i = 0; hit && i < 2; i++) {
      if (hit.zumbi) {
        this.acertarZumbi(hit, arma.def, _d, j.mods, fator, "pistola");
        if (!j.mods.perfura || i > 0) break;
        fator = 0.5; // perfurante: segue para o de trás com metade da força
        hit = this.tracar(hit.ponto, fim, hit.zumbi);
      } else {
        if (hit.ninho) this.acertarNinho(hit, arma.def.dano * fator, _d);
        else this.impacto(hit, "pistola");
        break;
      }
    }
    this.efeitos.rastro(_b, ate);
  }

  acertarZumbi(hit, def, dir, mods, fator, arma) {
    const z = hit.zumbi;
    const dano = def.dano * (hit.cabeca ? def.cabeca : 1) * fator;
    this.stats.acertos++;
    this.efeitos.pedacos(hit.ponto, dir, hit.cabeca);
    const morreu = z.ferir(dano, dir, { cabeca: hit.cabeca, arma });
    if (!morreu && mods.queima) z.queimar(3);
    som.acerto({ pos: hit.ponto, cabeca: hit.cabeca, morte: morreu, combo: this.combo });
    this.hud.acerto(hit.cabeca, morreu);
    return morreu;
  }

  acertarNinho(hit, dano, dir) {
    const n = hit.ninho;
    this.stats.acertos++;
    this.efeitos.pedacos(hit.ponto, dir, false);
    this.hud.acerto(false, false);
    if (!n.ferir(dano)) return;
    this.pontos += NINHO.pontos;
    this.stats.ninhos++;
    this.hud.feed(`+${NINHO.pontos}`, "ninho destruído");
    this.efeitos.estouro(n.g.position);
    this.virotes.soltar(n);
    this.aoTremer(0.3);
  }

  impacto(hit, arma) {
    if (hit.tipo === "chao") this.efeitos.poeira(hit.ponto);
    else this.efeitos.faisca(hit.ponto);
    if (arma === "besta") som.cravar(hit.ponto);
  }

  // empurrão com a coronha: quem está colado na frente vai para trás e perde o golpe
  empurrar(j) {
    j.direcao(_d).setY(0).normalize();
    let acertou = false;
    for (const z of this.zumbis) {
      if (!z.vivo) continue;
      _p.subVectors(z.pos, j.pos).setY(0);
      const d = _p.length();
      if (d > 2.1 || _p.dot(_d) < d * 0.45) continue;
      z.empurrar(_p.normalize());
      z.ferir(8, null, { arma: "coronha" });
      this.efeitos.poeira(z.pos);
      acertou = true;
    }
    som.empurrao(acertou);
    if (acertou) this.aoTremer(0.15);
  }

  // --- eventos dos zumbis ---------------------------------------------------------------------
  aoGritar(z) {
    for (const o of this.zumbis) if (o !== z && o.vivo && o.estado === "vagando" && o.pos.distanceTo(z.pos) < z.def.grito) o.alertar(false);
  }

  aoGolpe(z, dano) {
    const j = this.jogador;
    if (j.deslize > 0) {
      // esquiva: deslizando, o golpe passa por cima
      this.pontos += 5;
      this.stats.esquivas++;
      this.hud.feed("+5", "esquiva");
      som.ui("esquiva");
      return;
    }
    if (!j.takeDamage(dano)) return;
    this.combo = 0;
    this.comboT = 0;
    som.dano(dano / 15);
    this.aoTremer(0.45);
    // de onde veio o golpe, em relação ao olhar (0 = da frente, π/2 = da direita)
    const ang = Math.atan2(z.pos.x - j.pos.x, z.pos.z - j.pos.z) - (j.yaw + Math.PI);
    this.hud.dano(dano, -ang);
    if (!j.alive) {
      som.morteJogador();
      this._encerrar(false);
    }
  }

  aoMorrer(z, info) {
    this.stats.abates++;
    if (info.cabeca) this.stats.cabecas++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_JANELA;
    this.stats.maiorCombo = Math.max(this.stats.maiorCombo, this.combo);
    const mult = Math.min(3, 1 + 0.25 * (this.combo - 1));
    const pts = Math.round(z.def.score * mult * (info.cabeca ? 1.5 : 1));
    this.pontos += pts;
    this.hud.feed(`+${pts}`, info.cabeca ? "na cabeça" : info.fonte === "fogo" ? "queimado" : "abate", mult);
  }

  aoCair(z) {
    this.virotes.soltar(z);
  }

  // --- virotes recolhidos ---------------------------------------------------------------------
  podeColetar() {
    return this.besta.virotes < ALJAVA.maximo;
  }

  coletar(p) {
    this.besta.reserva++;
    this.efeitos.coleta(p);
    this.hud.coleta("+1 virote");
    som.ui("pegar");
  }

  // --- fim da partida -------------------------------------------------------------------------
  _encerrar(vitoria) {
    if (this.encerrado) return;
    this.encerrado = true;
    som.stinger(vitoria ? "vitoria" : "derrota");
    const anterior = lerRecorde();
    const novo = this.pontos > anterior;
    if (novo) {
      try {
        localStorage.setItem(CHAVE_RECORDE, String(this.pontos));
      } catch {
        /* sem storage: o recorde vale só nesta partida */
      }
    }
    const s = this.stats;
    const resultado = {
      vitoria,
      pontos: this.pontos,
      recorde: Math.max(anterior, this.pontos),
      novoRecorde: novo,
      onda: this.ondas.indice + 1,
      totalOndas: this.ondas.total,
      tempo: this.tempo,
      ...s,
      precisao: s.disparos ? s.acertos / s.disparos : 0,
    };
    setTimeout(() => this.aoFim(resultado), vitoria ? 1800 : 2300);
  }

  // --- quadro ---------------------------------------------------------------------------------
  update(dt, input) {
    const j = this.jogador;
    if (!this.encerrado) this.tempo += dt;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT === 0) this.combo = 0;

    if (this.etapa === "intro" || this.etapa === "intervalo") {
      this.espera -= dt;
      if (this.espera <= 0) this._iniciarOnda(this.ondas.indice + 1);
    }
    j.update(dt, input, this);
    for (const z of this.zumbis) z.update(dt, this);
    for (const n of this.ninhos) n.update(dt, this);
    this.virotes.update(dt, this);
    this.ondas.update(dt, this);
    this.efeitos.update(dt);
    // sobrou pouca gente: todos vêm atrás do Rafael, para a onda não travar procurando zumbi perdido
    if (this.etapa === "onda" && !this.ondas.fila.length && this.ninhosVivos() === 0 && this.vivos() <= 3) {
      for (const z of this.zumbis) if (z.vivo && z.estado === "vagando") z.alertar(false);
    }
    som.vida(j.hp / j.maxHp);
    this._corpo(dt);
  }

  // o corpo do Rafael acompanha o jogador (aparece nas câmeras de fora)
  _corpo(dt) {
    const j = this.jogador;
    const r = this.rafael;
    r.position.copy(j.pos);
    r.rotation.y = j.yaw + Math.PI;
    const vel = Math.hypot(j.vel.x, j.vel.z);
    const pa = this.passada;
    pa.quanto += ((j.noChao && vel > 0.5 ? 1 : 0) - pa.quanto) * Math.min(1, dt * 8);
    pa.fase += dt * (4 + vel * 1.2) * pa.quanto;
    animarRafael(r, {
      fase: pa.fase,
      quanto: pa.quanto,
      pitch: j.pitch,
      agachado: j.agachado ? 1 : 0,
      deslize: j.deslize > 0 ? 1 : 0,
      noAr: j.noChao ? 0 : 1,
    });
    // caído: tomba de lado
    r.rotation.z = (-Math.PI / 2) * j.deadT;
    r.position.y += 0.2 * j.deadT;
  }
}
