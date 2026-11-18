// Som do jogo, todo gerado em código com a Web Audio (nenhum arquivo de áudio).
// Mixagem em canais, nunca volume por som:
//   musica ─┐
//   sfx ────┼→ abafar (passa-baixa: vida baixa abafa tudo) → master → limitador → saída
//   ambiente┤
//   reverb (eco da noite, recebe envio dos efeitos) ┘          ui → master (não abafa)
// Volumes em dB. Cada efeito varia um pouco a cada vez (altura e volume), para não soar repetido.
// Efeitos com posição passam por um PannerNode: o ouvinte é a câmera (som.ouvir(camera) a cada quadro), então o
// zumbi que grita à esquerda soa à esquerda e o de longe soa baixo.
// O navegador só libera o áudio depois de um clique ou tecla: som.iniciar() é chamado sozinho no primeiro.
// M liga e desliga o som (fica guardado no navegador).
export const db = (v) => Math.pow(10, v / 20);
const rnd = (a, b) => a + Math.random() * (b - a);
const varia = (semitons = 1) => Math.pow(2, rnd(-semitons, semitons) / 12);

// formantes das vogais (Hz), para a voz dos zumbis
const VOGAIS = { a: [800, 1200], e: [450, 1900], i: [320, 2300], o: [500, 880], u: [350, 700] };
const VOZES = { caminhante: { f0: 95, vogal: "o", rasgo: 0.4 } };

class Som {
  constructor() {
    this.ctx = null;
    this.mudo = false;
    try {
      this.mudo = localStorage.getItem("rz-som-mudo") === "1";
    } catch {
      /* sem storage */
    }
    this.vozesZumbi = 0;
    this.passosDe = new WeakMap();
  }

  iniciar() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    const g = (v = 0) => {
      const n = c.createGain();
      n.gain.value = db(v);
      return n;
    };
    const lim = c.createDynamicsCompressor(); // rede de segurança no fim, não é ele que mixa
    lim.threshold.value = -10;
    lim.knee.value = 8;
    lim.ratio.value = 6;
    lim.attack.value = 0.005;
    lim.release.value = 0.3;
    lim.connect(c.destination);
    this.master = g(-7);
    this.master.connect(lim);
    this.abafar = c.createBiquadFilter();
    this.abafar.type = "lowpass";
    this.abafar.frequency.value = 20000;
    this.abafar.connect(this.master);
    this.bus = { musica: g(-13), sfx: g(-8), ambiente: g(-16), ui: g(-13) };
    this.bus.musica.connect(this.abafar);
    this.bus.sfx.connect(this.abafar);
    this.bus.ambiente.connect(this.abafar);
    this.bus.ui.connect(this.master);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulso(2.4);
    this.reverb.connect(g(-6)).connect(this.abafar);
    this.ruidos = { branco: this._ruido("branco"), rosa: this._ruido("rosa"), marrom: this._ruido("marrom") };
    this.master.gain.value = this.mudo ? 0 : db(-7);
    this._ambiente();
  }

  get pronto() {
    return !!this.ctx && this.ctx.state === "running";
  }

  alternarMudo() {
    this.mudo = !this.mudo;
    try {
      localStorage.setItem("rz-som-mudo", this.mudo ? "1" : "0");
    } catch {
      /* sem storage */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.mudo ? 0 : db(-7), this.ctx.currentTime, 0.05);
    return this.mudo;
  }

  // vida baixa: abafa a mistura e o coração bate (frac = 0..1, 1 = vida cheia)
  vida(frac) {
    if (!this.ctx) return;
    const alvo = frac < 0.3 ? 900 + frac * 6000 : 20000;
    this.abafar.frequency.setTargetAtTime(alvo, this.ctx.currentTime, 0.25);
    const agora = this.ctx.currentTime;
    if (frac > 0 && frac < 0.3 && agora > (this.proxBatida ?? 0)) {
      this.proxBatida = agora + 0.55 + frac * 1.2;
      this._batida(agora, 0);
      this._batida(agora + 0.17, -4);
    }
  }

  ouvir(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = camera.matrixWorld.elements;
    const [px, py, pz] = [e[12], e[13], e[14]];
    const [fx, fy, fz] = [-e[8], -e[9], -e[10]];
    const [ux, uy, uz] = [e[4], e[5], e[6]];
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(px, t);
      l.positionY.setValueAtTime(py, t);
      l.positionZ.setValueAtTime(pz, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(ux, t);
      l.upY.setValueAtTime(uy, t);
      l.upZ.setValueAtTime(uz, t);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  // --- peças --------------------------------------------------------------------------------
  _ruido(tipo) {
    const c = this.ctx;
    const n = c.sampleRate * 2;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, ult = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (tipo === "branco") d[i] = w;
      else if (tipo === "rosa") {
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2;
      } else {
        ult = (ult + 0.02 * w) / 1.02;
        d[i] = ult * 3.5;
      }
    }
    return b;
  }

  _impulso(seg) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * seg);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * (i < c.sampleRate * 0.012 ? 0.3 : 1);
    }
    return b;
  }

  // saída de um som: com posição passa pelo panner (some com a distância); eco opcional
  _saida({ pos = null, bus = "sfx", eco = 0, alcance = 40, ref = 2, dur = 2 } = {}) {
    const c = this.ctx;
    const entrada = c.createGain();
    let destino = entrada;
    if (pos) {
      const p = c.createPanner();
      p.panningModel = "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = ref;
      p.maxDistance = alcance;
      p.rolloffFactor = 1.3;
      const y = pos.y ?? 1.5;
      if (p.positionX) {
        p.positionX.value = pos.x;
        p.positionY.value = y;
        p.positionZ.value = pos.z;
      } else p.setPosition(pos.x, y, pos.z);
      entrada.connect(p);
      destino = p;
    }
    destino.connect(this.bus[bus]);
    let envio = null;
    if (eco > 0) {
      envio = c.createGain();
      envio.gain.value = eco;
      destino.connect(envio).connect(this.reverb);
    }
    setTimeout(() => {
      entrada.disconnect();
      destino.disconnect();
      envio?.disconnect();
    }, (dur + 3) * 1000);
    return entrada;
  }

  // ruído com filtro e envelope
  _ruidoEnv(saida, t, { tipo = "branco", filtro = "bandpass", freq = 1000, freqFim = null, q = 1, ataque = 0.002, dur = 0.2, pico = 1 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.ruidos[tipo];
    const f = c.createBiquadFilter();
    f.type = filtro;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqFim) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqFim), t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(pico, t + ataque);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gn).connect(saida);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // oscilador com envelope e glide de frequência
  _tom(saida, t, { tipo = "sine", freq = 440, freqFim = null, ataque = 0.002, dur = 0.2, pico = 1 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFim) o.frequency.exponentialRampToValueAtTime(Math.max(10, freqFim), t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(pico, t + ataque);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(saida);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _batida(t, dbv) {
    const s = this._saida({ bus: "ui", dur: 0.4 });
    s.gain.value = db(dbv - 2);
    this._tom(s, t, { freq: 62, freqFim: 40, dur: 0.16, pico: 0.9, ataque: 0.01 });
  }

  // mar quebrando (ruído grave que sobe e desce devagar) e vento, em laço
  _ambiente() {
    const c = this.ctx;
    const laco = (tipo, freq, filtro, vol, lfo) => {
      const src = c.createBufferSource();
      src.buffer = this.ruidos[tipo];
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = filtro;
      f.frequency.value = freq;
      const gn = c.createGain();
      gn.gain.value = vol;
      const o = c.createOscillator();
      o.frequency.value = lfo;
      const prof = c.createGain();
      prof.gain.value = vol * 0.8;
      o.connect(prof).connect(gn.gain);
      src.connect(f).connect(gn).connect(this.bus.ambiente);
      src.start();
      o.start();
    };
    laco("marrom", 420, "lowpass", 0.9, 0.09); // ondas
    laco("rosa", 900, "bandpass", 0.25, 0.05); // vento
  }

  // --- armas --------------------------------------------------------------------------------
  tiro(id) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    if (id === "besta") {
      const s = this._saida({ eco: 0.15, dur: 0.6 });
      this._tom(s, t, { tipo: "triangle", freq: 230 * varia(1), freqFim: 170, dur: 0.18, pico: 0.6 });
      this._ruidoEnv(s, t, { freq: 3000, q: 2, dur: 0.03, pico: 0.6 });
      this._ruidoEnv(s, t + 0.02, { freq: 1200, freqFim: 400, q: 1.5, dur: 0.35, pico: 0.25, ataque: 0.03 });
      return;
    }
    // pistola: estalo, baque grave e o ronco que fica no ar
    const k = varia(0.8);
    const s = this._saida({ eco: 0.35, dur: 0.85 });
    s.gain.value = db(-3 + rnd(-1, 1));
    this._ruidoEnv(s, t, { freq: 1700 * k * 0.8, q: 0.9, dur: 0.09, pico: 0.75 });
    this._ruidoEnv(s, t, { filtro: "highpass", freq: 3500, dur: 0.02, pico: 0.25 });
    this._tom(s, t, { freq: 150 * 2.2 * k, freqFim: 150 * 0.45, dur: 0.14, pico: 0.9 });
    this._ruidoEnv(s, t + 0.01, { tipo: "marrom", filtro: "lowpass", freq: 700, freqFim: 120, dur: 0.35, pico: 0.55, ataque: 0.01 });
  }

  vazio() {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.2 });
    this._ruidoEnv(s, this.ctx.currentTime, { filtro: "highpass", freq: 3000, dur: 0.02, pico: 0.5 });
  }

  sacar() {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.4 });
    const t = this.ctx.currentTime;
    s.gain.value = db(-8);
    this._ruidoEnv(s, t, { freq: 900, q: 0.8, dur: 0.12, pico: 0.5, ataque: 0.03 });
    this._ruidoEnv(s, t + 0.1, { freq: 2600, q: 4, dur: 0.04, pico: 0.6 });
  }

  // etapas: "sai" (tira o pente), "entra" (põe), "trava" (engatilha)
  recarga(id, etapa) {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.6, eco: 0.05 });
    const t = this.ctx.currentTime;
    s.gain.value = db(-5);
    const clique = (tt, f, pico = 0.6) => {
      this._ruidoEnv(s, tt, { freq: f, q: 5, dur: 0.035, pico });
      this._tom(s, tt, { freq: f * 0.5, dur: 0.03, pico: pico * 0.4 });
    };
    if (id === "besta") {
      if (etapa === "entra") this._tom(s, t, { tipo: "sawtooth", freq: 70, freqFim: 140, dur: 0.4, pico: 0.12, ataque: 0.1 });
      if (etapa === "trava") clique(t, 900, 0.8);
      return;
    }
    if (etapa === "sai") {
      this._ruidoEnv(s, t, { freq: 2400, q: 3, dur: 0.08, pico: 0.5 });
      clique(t + 0.06, 1300);
    }
    if (etapa === "entra") clique(t, 1700, 0.8);
    if (etapa === "trava") {
      clique(t, 2600);
      clique(t + 0.08, 2000, 0.8);
    }
  }

  // --- corpo do Rafael ----------------------------------------------------------------------
  passo(material = "pedra", forca = 1) {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.3 });
    const t = this.ctx.currentTime;
    s.gain.value = db(-14 + forca * 4 + rnd(-2, 2));
    const k = varia(2);
    if (material === "terra") this._ruidoEnv(s, t, { filtro: "lowpass", freq: 900 * k, dur: 0.1, pico: 0.8 });
    else {
      this._ruidoEnv(s, t, { freq: 1500 * k, q: 1.2, dur: 0.06, pico: 0.7 });
      this._ruidoEnv(s, t, { filtro: "highpass", freq: 5000, dur: 0.03, pico: 0.15 });
    }
    this._tom(s, t, { freq: 90 * k, freqFim: 50, dur: 0.06, pico: 0.5 });
  }

  // chamado a cada quadro: um passo a cada ~2 m andados no chão
  passos(dono, pos, noChao, material, dt) {
    if (!this.pronto) return;
    let e = this.passosDe.get(dono);
    if (!e) {
      e = { x: pos.x, z: pos.z, acum: 0 };
      this.passosDe.set(dono, e);
    }
    const d = Math.hypot(pos.x - e.x, pos.z - e.z);
    e.x = pos.x;
    e.z = pos.z;
    if (!noChao || d > 2) return;
    e.acum += d;
    if (e.acum > 2.1 && d / Math.max(dt, 1e-4) > 1) {
      e.acum = 0;
      this.passo(material, Math.min(1, d / Math.max(dt, 1e-4) / 8));
    }
  }

  pouso(forca) {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.4 });
    const t = this.ctx.currentTime;
    s.gain.value = db(-10 + forca * 6);
    this._tom(s, t, { freq: 110, freqFim: 45, dur: 0.12, pico: 0.9 });
    this._ruidoEnv(s, t, { filtro: "lowpass", freq: 1200, dur: 0.12, pico: 0.7 });
  }

  deslize() {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.8 });
    s.gain.value = db(-9);
    this._ruidoEnv(s, this.ctx.currentTime, { freq: 1800, freqFim: 600, q: 0.6, dur: 0.6, pico: 0.6, ataque: 0.04 });
  }

  // empurrão com a coronha: vulto do golpe e a pancada
  empurrao(acertou) {
    if (!this.pronto) return;
    const s = this._saida({ dur: 0.5 });
    const t = this.ctx.currentTime;
    this._ruidoEnv(s, t, { freq: 600, freqFim: 2200, q: 1, dur: 0.16, pico: 0.45, ataque: 0.04 });
    if (acertou) {
      this._tom(s, t + 0.08, { freq: 120, freqFim: 55, dur: 0.12, pico: 0.9 });
      this._ruidoEnv(s, t + 0.08, { filtro: "lowpass", freq: 900, dur: 0.1, pico: 0.8 });
    }
  }

  // --- acerto e dano ------------------------------------------------------------------------
  // marcador de acerto (interface) + impacto no zumbi (com posição); o combo sobe a altura
  acerto({ pos, cabeca = false, morte = false, combo = 1 }) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const ui = this._saida({ bus: "ui", dur: 0.5 });
    const sobe = Math.pow(2, Math.min(6, Math.max(0, combo - 1)) / 12);
    if (cabeca) {
      this._tom(ui, t, { freq: 2100 * sobe, dur: 0.16, pico: 0.3 });
      this._tom(ui, t, { freq: 3150 * sobe, dur: 0.1, pico: 0.12 });
    } else this._tom(ui, t, { freq: 1500 * sobe, dur: 0.045, pico: 0.22 });
    if (morte) this._tom(ui, t + 0.03, { tipo: "triangle", freq: 220, freqFim: 110, dur: 0.16, pico: 0.6 });
    const s = this._saida({ pos, dur: 0.6, eco: 0.1 });
    this._ruidoEnv(s, t, { filtro: "lowpass", freq: 900 * varia(2), dur: 0.08, pico: 0.8 });
    this._tom(s, t, { freq: 140, freqFim: 70, dur: 0.07, pico: 0.5 });
  }

  dano(forca = 1) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const s = this._saida({ bus: "ui", dur: 0.6 });
    s.gain.value = db(-4 + forca * 2);
    this._tom(s, t, { freq: 90, freqFim: 40, dur: 0.22, pico: 0.9 });
    this._ruidoEnv(s, t, { filtro: "lowpass", freq: 500, dur: 0.18, pico: 0.7 });
    this._voz(this._saida({ bus: "ui", dur: 0.6 }), t + 0.02, { f0: 120 * varia(1), vogal: "u", dur: 0.22, rasgo: 0.3, pico: 0.25 });
  }

  morteJogador() {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const s = this._saida({ bus: "ui", dur: 3 });
    this._tom(s, t, { tipo: "sawtooth", freq: 70, freqFim: 35, dur: 2.5, pico: 0.12, ataque: 0.3 });
    this._voz(s, t, { f0: 110, vogal: "o", dur: 0.7, rasgo: 0.4, pico: 0.3, subida: 0.7 });
  }

  // virote cravando: "tunc" seco e curto, com a haste vibrando
  cravar(pos) {
    if (!this.pronto) return;
    const s = this._saida({ pos, eco: 0.2, alcance: 25, dur: 0.3 });
    const t = this.ctx.currentTime;
    this._tom(s, t, { freq: 210, freqFim: 90, dur: 0.07, pico: 0.7 });
    this._ruidoEnv(s, t, { filtro: "lowpass", freq: 1800, dur: 0.05, pico: 0.5 });
    this._tom(s, t + 0.01, { tipo: "triangle", freq: 900, freqFim: 820, dur: 0.12, pico: 0.06 });
  }

  // --- vozes dos zumbis ---------------------------------------------------------------------
  // dente de serra com vibrato passando por dois formantes (a vogal), um pouco de ar e rouquidão
  _voz(saida, t, { f0, vogal = "o", dur = 1, rasgo = 0.4, pico = 0.5, subida = 1 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * subida), t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = rnd(4.5, 7.5);
    const prof = c.createGain();
    prof.gain.value = f0 * 0.035;
    lfo.connect(prof).connect(o.frequency);
    const dist = c.createWaveShaper();
    const curva = new Float32Array(256);
    const k = 1 + rasgo * 7;
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curva[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    dist.curve = curva;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(pico, t + Math.min(0.12, dur * 0.3));
    env.gain.setValueAtTime(pico, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const [f1, f2] = VOGAIS[vogal] ?? VOGAIS.o;
    const soma = c.createGain();
    [[f1, 6, 1], [f2, 8, 0.5]].forEach(([f, q, ganho]) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f * rnd(0.92, 1.08);
      bp.Q.value = q;
      const gg = c.createGain();
      gg.gain.value = ganho * 2.2;
      dist.connect(bp).connect(gg).connect(soma);
    });
    o.connect(dist);
    soma.connect(env).connect(saida);
    this._ruidoEnv(saida, t, { freq: f1 * 1.5, q: 1.5, dur, pico: pico * 0.25 * (0.5 + rasgo), ataque: 0.08 });
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  // evento: "gemido" (vagando) | "grito" (viu o Rafael) | "rosnado" (vai bater) | "dor" | "morte"
  zumbi(tipo, evento, pos) {
    if (!this.pronto) return;
    const v = VOZES[tipo] ?? VOZES.caminhante;
    if (this.vozesZumbi >= (evento === "gemido" ? 4 : 7)) return; // não deixa virar um coral
    const cfg = {
      gemido: { mult: 1, dur: rnd(0.7, 1.5), pico: 0.25, subida: rnd(0.85, 1.1), alcance: 26 },
      grito: { mult: 1.45, dur: rnd(0.5, 0.75), pico: 0.5, subida: 1.2, alcance: 45, rasgo: 0.15 },
      rosnado: { mult: 0.85, dur: 0.45, pico: 0.55, subida: 1.1, alcance: 22, rasgo: 0.35 },
      dor: { mult: 1.35, dur: 0.2, pico: 0.45, subida: 0.85, alcance: 24 },
      morte: { mult: 1.1, dur: rnd(0.8, 1.1), pico: 0.5, subida: 0.55, alcance: 30 },
    }[evento];
    if (!cfg) return;
    const t = this.ctx.currentTime;
    const s = this._saida({ pos, eco: 0.25, alcance: cfg.alcance, dur: cfg.dur });
    this.vozesZumbi++;
    setTimeout(() => this.vozesZumbi--, cfg.dur * 1000);
    this._voz(s, t, { f0: v.f0 * cfg.mult * varia(2), vogal: v.vogal, dur: cfg.dur, rasgo: Math.min(1, v.rasgo + (cfg.rasgo ?? 0)), pico: cfg.pico, subida: cfg.subida });
    if (evento === "morte") {
      this._tom(s, t + cfg.dur * 0.6, { freq: 80, freqFim: 35, dur: 0.2, pico: 0.7 });
      this._ruidoEnv(s, t + cfg.dur * 0.6, { filtro: "lowpass", freq: 600, dur: 0.25, pico: 0.6 });
    }
  }

  // gorgolejo: ruído num filtro estreito que pula de frequência
  _borbulha(saida, t, dur) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.ruidos.branco;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 12;
    for (let k = 0; k < dur; k += 0.045) f.frequency.setValueAtTime(rnd(250, 900), t + k);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gn).connect(saida);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ninho: "brota" (ronco subindo do chão), "solta" (casulo abrindo), "acerto", "destruido"
  ninho(evento, pos) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const s = this._saida({ pos, eco: 0.3, alcance: 40, ref: 3, dur: 1.6 });
    if (evento === "brota") {
      this._ruidoEnv(s, t, { tipo: "marrom", filtro: "lowpass", freq: 160, freqFim: 420, dur: 1.4, pico: 0.9, ataque: 0.3 });
      this._borbulha(s, t + 0.3, 1);
    } else if (evento === "solta") {
      this._borbulha(s, t, 0.6);
      this._tom(s, t, { freq: 70, freqFim: 40, dur: 0.3, pico: 0.6 });
    } else if (evento === "acerto") {
      this._ruidoEnv(s, t, { filtro: "lowpass", freq: 700 * varia(2), dur: 0.09, pico: 0.8 });
    } else if (evento === "destruido") {
      this._ruidoEnv(s, t, { freq: 1200, freqFim: 180, q: 0.7, dur: 0.6, pico: 1 });
      this._tom(s, t, { freq: 80, freqFim: 30, dur: 0.5, pico: 0.9 });
      this._borbulha(s, t + 0.1, 0.8);
    }
  }

  // --- música curta (vinhetas) e interface ---------------------------------------------------
  // "onda" (começa uma onda), "concluida", "vitoria", "derrota"
  stinger(nome) {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const s = this._saida({ bus: "musica", eco: 0.4, dur: 3 });
    const nota = (i, f, d = 0.9, tipo = "triangle") => this._tom(s, t + i, { tipo, freq: f, dur: d, pico: 0.5, ataque: 0.02 });
    if (nome === "onda") {
      nota(0, 110, 1.2, "sawtooth");
      nota(0, 164.8, 1.2);
      nota(0.35, 103.8, 1.4, "sawtooth");
      nota(0.35, 155.6, 1.4);
    } else if (nome === "concluida") [440, 554.4, 659.3].forEach((f, i) => nota(i * 0.09, f, 0.7));
    else if (nome === "vitoria") [392, 493.9, 587.3, 784].forEach((f, i) => nota(i * 0.12, f, 1.4));
    else if (nome === "derrota") [220, 207.7, 196, 164.8].forEach((f, i) => nota(i * 0.28, f, 1.1, "sawtooth"));
  }

  ui(tipo) {
    if (!this.pronto) return;
    const s = this._saida({ bus: "ui", dur: 0.5 });
    const t = this.ctx.currentTime;
    if (tipo === "mover") this._tom(s, t, { freq: 1300, dur: 0.035, pico: 0.25 });
    else if (tipo === "confirmar") {
      this._tom(s, t, { tipo: "triangle", freq: 660, dur: 0.1, pico: 0.4 });
      this._tom(s, t + 0.07, { tipo: "triangle", freq: 990, dur: 0.16, pico: 0.4 });
    } else if (tipo === "pegar") {
      this._tom(s, t, { tipo: "triangle", freq: 520, dur: 0.06, pico: 0.3 });
      this._tom(s, t + 0.05, { tipo: "triangle", freq: 780, dur: 0.09, pico: 0.3 });
    } else if (tipo === "esquiva") {
      this._ruidoEnv(s, t, { freq: 2400, freqFim: 900, q: 1, dur: 0.2, pico: 0.4 });
    }
  }
}

export const som = new Som();

// o navegador só libera o áudio depois de um gesto do jogador
if (typeof window !== "undefined") {
  const liberar = () => som.iniciar();
  window.addEventListener("pointerdown", liberar, { capture: true });
  window.addEventListener(
    "keydown",
    (e) => {
      liberar();
      if (e.code === "KeyM" && !e.repeat) som.alternarMudo();
    },
    { capture: true },
  );
}
