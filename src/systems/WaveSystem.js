// Ondas da fase (data/phases.js). Em cada onda os zumbis de "chegam" entram pelas bordas aos poucos (um a cada
// 1 a 2 segundos, respeitando o máximo de zumbis vivos na orla) e brotam os ninhos da onda. A onda acaba quando
// já entraram todos, não sobra ninho e não sobra zumbi de pé.
const rnd = (a, b) => a + Math.random() * (b - a);

export class WaveSystem {
  constructor(fase) {
    this.fase = fase;
    this.reiniciar();
  }

  get total() {
    return this.fase.waves.length;
  }

  reiniciar() {
    this.indice = -1;
    this.estado = "espera";
    this.fila = [];
  }

  // começa a onda i (0, 1, 2); devolve a definição dela
  iniciar(i) {
    const onda = this.fase.waves[i];
    this.indice = i;
    this.estado = "ativa";
    this.fila = [];
    for (const [tipo, n] of Object.entries(onda.chegam)) for (let k = 0; k < n; k++) this.fila.push(tipo);
    this.proxima = 1.5;
    return onda;
  }

  update(dt, ctx) {
    if (this.estado !== "ativa") return;
    this.proxima -= dt;
    if (this.fila.length && this.proxima <= 0) {
      if (ctx.vivos() < this.fase.maxVivos) {
        ctx.soltarDaBorda(this.fila.shift());
        this.proxima = rnd(1, 2.2) - this.indice * 0.2;
      } else this.proxima = 0.5;
    }
    if (!this.fila.length && ctx.ninhosVivos() === 0 && ctx.vivos() === 0) {
      this.estado = "concluida";
      ctx.aoConcluir(this.indice);
    }
  }
}
