// Teclado e mouse. Com o ponteiro travado (pointer lock, pedido ao clicar no jogo), o mouse gira a câmera:
// mouse.dx e mouse.dy somam o movimento do quadro, mouseDown(b) diz se o botão está apertado e mouseClicked(b)
// se ele foi apertado neste quadro (0 = esquerdo, 2 = direito). A rodinha troca de arma.
const BLOQUEADAS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"]);

export class Input {
  constructor(alvo) {
    this.alvo = alvo;
    this.down = new Set();
    this.pressed = new Set();
    this.pressedShift = new Set(); // teclas apertadas junto com Shift neste quadro
    this.mouse = { dx: 0, dy: 0, roda: 0, botoes: new Set(), cliques: new Set() };

    window.addEventListener("keydown", (e) => {
      if (BLOQUEADAS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) {
        this.pressed.add(e.code);
        if (e.shiftKey) this.pressedShift.add(e.code);
      }
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => {
      this.down.clear();
      this.mouse.botoes.clear();
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.travado) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    alvo.addEventListener("mousedown", (e) => {
      this.mouse.botoes.add(e.button);
      this.mouse.cliques.add(e.button);
    });
    window.addEventListener("mouseup", (e) => this.mouse.botoes.delete(e.button));
    window.addEventListener("wheel", (e) => {
      if (this.travado) this.mouse.roda += Math.sign(e.deltaY);
    });
    alvo.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  get travado() {
    return document.pointerLockElement === this.alvo;
  }

  travar() {
    try {
      const p = this.alvo.requestPointerLock();
      p?.catch?.(() => {});
    } catch {
      /* navegador sem pointer lock */
    }
  }

  soltar() {
    if (this.travado) document.exitPointerLock();
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasPressedWithShift(code) {
    return this.pressedShift.has(code);
  }

  mouseDown(b) {
    return this.mouse.botoes.has(b);
  }

  mouseClicked(b) {
    return this.mouse.cliques.has(b);
  }

  endFrame() {
    this.pressed.clear();
    this.pressedShift.clear();
    this.mouse.dx = this.mouse.dy = this.mouse.roda = 0;
    this.mouse.cliques.clear();
  }
}
