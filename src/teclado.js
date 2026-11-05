const BLOCKED = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.pressedShift = new Set(); // teclas apertadas junto com Shift neste quadro

    window.addEventListener("keydown", (e) => {
      if (BLOCKED.has(e.code) && e.preventDefault) e.preventDefault();
      if (!this.down.has(e.code)) {
        this.pressed.add(e.code);
        if (e.shiftKey) this.pressedShift.add(e.code);
      }
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
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

  endFrame() {
    this.pressed.clear();
    this.pressedShift.clear();
  }
}
