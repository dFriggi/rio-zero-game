// HUD simples do combate: vida, virotes e abates, a mira nas câmeras de 1ª e 3ª pessoa,
// a tela piscando em vermelho quando o Rafael apanha e o aviso quando ele cai.
export function criarHud() {
  const raiz = document.createElement("div");
  raiz.innerHTML = `
    <div id="hud" aria-live="polite">
      <div class="hud-bloco">
        <span class="hud-rotulo">Vida</span>
        <div class="hud-barra"><i id="hud-vida-barra"></i></div>
        <b id="hud-vida">100</b>
      </div>
      <div class="hud-bloco">
        <span class="hud-rotulo">Virotes</span>
        <b id="hud-carregada">1</b><small id="hud-aljava">/ 24</small>
      </div>
      <div class="hud-bloco">
        <span class="hud-rotulo">Abates</span>
        <b id="hud-abates">0</b>
      </div>
    </div>
    <div id="mira" aria-hidden="true"></div>
    <div id="hud-dano" aria-hidden="true"></div>
    <div id="hud-caiu" hidden>
      <h2>Você caiu</h2>
      <p>Aperte <kbd>R</kbd> para recomeçar</p>
    </div>`;
  document.body.append(...raiz.children);

  const $ = (id) => document.getElementById(id);
  const vida = $("hud-vida");
  const barra = $("hud-vida-barra");
  const carregada = $("hud-carregada");
  const aljava = $("hud-aljava");
  const abates = $("hud-abates");
  const mira = $("mira");
  const dano = $("hud-dano");
  const caiu = $("hud-caiu");
  let ultimo = "";
  let clarao = 0;

  return {
    atualizar(estado, modoCamera, dt) {
      if (estado.danoRecebido > 0) {
        clarao = Math.min(1, clarao + estado.danoRecebido / 25);
        estado.danoRecebido = 0;
      }
      clarao = Math.max(0, clarao - dt * 2.5);
      dano.style.opacity = clarao.toFixed(3);

      const v = Math.ceil(estado.vida);
      const chave = `${v}|${estado.carregada}|${estado.aljava}|${estado.abates}|${estado.caido}|${modoCamera}`;
      if (chave === ultimo) return;
      ultimo = chave;
      vida.textContent = v;
      barra.style.transform = `scaleX(${v / 100})`;
      barra.dataset.nivel = v > 50 ? "bom" : v > 25 ? "medio" : "baixo";
      carregada.textContent = estado.carregada;
      aljava.textContent = `/ ${estado.aljava}`;
      abates.textContent = estado.abates;
      mira.hidden = estado.caido || !(modoCamera === "primeira" || modoCamera === "terceira");
      caiu.hidden = !estado.caido;
    },
  };
}
