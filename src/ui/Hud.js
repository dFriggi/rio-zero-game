// HUD e telas do jogo, na identidade visual do Rio Zero (Space Grotesk nos números e títulos, Montserrat no texto,
// verde #b7ff3b de destaque, faixas escuras com o filete verde à esquerda).
//   HUD: vida, pontos, combo, onda, ninhos, zumbis restantes, arma e munição, mira que abre com a dispersão,
//        marcador de acerto (branco no corpo, verde na cabeça, maior no abate), indicador de onde veio o golpe,
//        avisos de pontos (+15 na cabeça ×1,5) e de coleta, faixa da onda.
//   Telas: menu inicial, pausa (Esc) e resultado (vitória ou derrota), todas com o recomeço.
// Os textos só são reescritos quando mudam (o HUD roda a cada quadro).
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
const dec = (n) => n.toFixed(2).replace(".", ",").replace(/,?0+$/, "");

export function criarHud({ aoJogar, aoContinuar, aoRecomecar, aoMenu }) {
  const raiz = document.createElement("div");
  raiz.id = "jogo-ui";
  raiz.innerHTML = `
    <div id="hud" hidden>
      <div class="hud-topo">
        <span class="hud-chip" id="hud-onda">Onda 1/3</span>
        <span class="hud-chip" id="hud-ninhos">Ninhos 0</span>
        <span class="hud-chip" id="hud-restam">Zumbis 0</span>
      </div>
      <div class="hud-pontos">
        <span class="hud-rotulo">Pontos</span>
        <b class="hud-num" id="hud-pontos">0</b>
        <span class="hud-combo" id="hud-combo"><b id="hud-mult">×1</b><i id="hud-combo-barra"></i></span>
      </div>
      <div class="hud-vida" id="hud-vida">
        <span class="hud-rotulo">Vida</span>
        <div class="hud-barra"><i id="hud-vida-barra"></i></div>
        <b class="hud-num" id="hud-vida-num">100</b>
      </div>
      <div class="hud-arma">
        <span class="hud-rotulo" id="hud-arma-nome">Besta</span>
        <b class="hud-num" id="hud-municao">1</b><small class="hud-num" id="hud-reserva">/ 20</small>
        <span class="hud-dica" id="hud-dica"></span>
      </div>
      <div class="hud-mira" id="hud-mira"><i></i><i></i><i></i><i></i></div>
      <div class="hud-marca" id="hud-marca"><i></i><i></i><i></i><i></i></div>
      <div class="hud-golpe" id="hud-golpe"></div>
      <div class="hud-feed" id="hud-feed"></div>
      <div class="hud-banner" id="hud-banner"><strong></strong><span></span></div>
      <div class="hud-dano" id="hud-dano"></div>
    </div>

    <section class="tela" id="tela-menu" hidden>
      <img class="tela-logo" src="src/ui/logo/logo-rio-zero.svg" alt="Rio Zero" width="340" />
      <p class="tela-rotulo">Fase 1 · Copacabana</p>
      <p class="tela-texto">A orla foi tomada. Aguente três ondas de Caminhantes e destrua os ninhos que brotam na areia.</p>
      <button type="button" class="tela-botao" data-acao="jogar">Jogar <kbd>Enter</kbd></button>
      <dl class="tela-controles">
        <div><dt>WASD</dt><dd>andar</dd></div><div><dt>Mouse</dt><dd>olhar e mirar</dd></div>
        <div><dt>Clique</dt><dd>atirar</dd></div><div><dt>Botão direito</dt><dd>mirar</dd></div>
        <div><dt>Espaço</dt><dd>pular</dd></div><div><dt>Shift</dt><dd>agachar · correndo, desliza (esquiva)</dd></div>
        <div><dt>F</dt><dd>empurrar com a coronha</dd></div><div><dt>R</dt><dd>recarregar</dd></div>
        <div><dt>1 · 2 · Q · roda</dt><dd>trocar de arma</dd></div><div><dt>C</dt><dd>1ª ou 3ª pessoa</dd></div>
        <div><dt>Esc</dt><dd>pausa</dd></div><div><dt>H</dt><dd>modo apresentação (painel)</dd></div>
      </dl>
      <p class="tela-recorde" id="menu-recorde"></p>
    </section>

    <section class="tela" id="tela-pausa" hidden>
      <p class="tela-rotulo">Pausa</p>
      <h2 class="tela-titulo">Respira, Rafael</h2>
      <div class="tela-botoes">
        <button type="button" class="tela-botao" data-acao="continuar">Continuar</button>
        <button type="button" class="tela-botao secundario" data-acao="recomecar">Recomeçar <kbd>R</kbd></button>
        <button type="button" class="tela-botao secundario" data-acao="menu">Menu</button>
      </div>
      <p class="tela-texto">H abre o painel da demonstração (câmeras, luzes e texturas).</p>
    </section>

    <section class="tela" id="tela-fim" hidden>
      <p class="tela-rotulo" id="fim-rotulo"></p>
      <h2 class="tela-titulo" id="fim-titulo"></h2>
      <div class="fim-pontos"><span>Pontos</span><b class="hud-num" id="fim-pontos">0</b><em id="fim-recorde"></em></div>
      <dl class="fim-stats" id="fim-stats"></dl>
      <div class="tela-botoes">
        <button type="button" class="tela-botao" data-acao="recomecar">Jogar de novo <kbd>R</kbd></button>
        <button type="button" class="tela-botao secundario" data-acao="menu">Menu</button>
      </div>
    </section>`;
  document.body.append(raiz);

  const $ = (id) => document.getElementById(id);
  const acoes = { jogar: aoJogar, continuar: aoContinuar, recomecar: aoRecomecar, menu: aoMenu };
  raiz.querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", () => acoes[b.dataset.acao]()));

  const el = {
    hud: $("hud"), onda: $("hud-onda"), ninhos: $("hud-ninhos"), restam: $("hud-restam"), pontos: $("hud-pontos"),
    combo: $("hud-combo"), mult: $("hud-mult"), comboBarra: $("hud-combo-barra"), vida: $("hud-vida"),
    vidaBarra: $("hud-vida-barra"), vidaNum: $("hud-vida-num"), armaNome: $("hud-arma-nome"), municao: $("hud-municao"),
    reserva: $("hud-reserva"), dica: $("hud-dica"), mira: $("hud-mira"), marca: $("hud-marca"), golpe: $("hud-golpe"),
    feed: $("hud-feed"), banner: $("hud-banner"), dano: $("hud-dano"),
  };
  const telas = { menu: $("tela-menu"), pausa: $("tela-pausa"), fim: $("tela-fim") };
  const cache = {};
  const texto = (chave, alvo, valor) => {
    if (cache[chave] !== valor) {
      cache[chave] = valor;
      alvo.textContent = valor;
    }
  };
  let tempoMarca = 0;
  let tempoBanner = 0;
  let tempoGolpe = 0;
  let clarao = 0;

  function mostrarTela(nome) {
    for (const [k, t] of Object.entries(telas)) t.hidden = k !== nome;
    if (nome) el.banner.classList.remove("visivel"); // o letreiro da onda não fica por trás da tela
  }

  function linhaFeed(html) {
    const d = document.createElement("div");
    d.className = "hud-feed-linha";
    d.innerHTML = html;
    el.feed.prepend(d);
    while (el.feed.children.length > 4) el.feed.lastChild.remove();
    setTimeout(() => d.classList.add("saindo"), 1400);
    setTimeout(() => d.remove(), 1700);
  }

  return {
    mostrarHud(v) {
      el.hud.hidden = !v;
    },
    mostrarMenu(recorde) {
      $("menu-recorde").textContent = recorde > 0 ? `Recorde: ${fmt(recorde)} pontos` : "";
      mostrarTela("menu");
    },
    mostrarPausa() {
      mostrarTela("pausa");
    },
    esconderTelas() {
      mostrarTela(null);
    },
    get telaAberta() {
      return Object.entries(telas).find(([, t]) => !t.hidden)?.[0] ?? null;
    },
    mostrarFim(r) {
      $("fim-rotulo").textContent = r.vitoria ? "Vitória" : "Derrota";
      $("fim-titulo").textContent = r.vitoria ? "Copacabana resistiu" : "O Rafael caiu";
      $("fim-pontos").textContent = fmt(r.pontos);
      $("fim-recorde").textContent = r.novoRecorde ? "Novo recorde!" : `Recorde: ${fmt(r.recorde)}`;
      const min = Math.floor(r.tempo / 60);
      const seg = String(Math.floor(r.tempo % 60)).padStart(2, "0");
      const stats = [
        ["Ondas", `${r.vitoria ? r.totalOndas : Math.max(0, r.onda - 1)} / ${r.totalOndas}`],
        ["Abates", r.abates],
        ["Na cabeça", r.cabecas],
        ["Ninhos", r.ninhos],
        ["Precisão", `${Math.round(r.precisao * 100)}%`],
        ["Maior combo", `×${dec(Math.min(3, 1 + 0.25 * Math.max(0, r.maiorCombo - 1)))}`],
        ["Esquivas", r.esquivas],
        ["Tempo", `${min}:${seg}`],
      ];
      $("fim-stats").innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd class="hud-num">${v}</dd></div>`).join("");
      telas.fim.dataset.resultado = r.vitoria ? "vitoria" : "derrota";
      mostrarTela("fim");
    },

    banner(titulo, sub) {
      el.banner.querySelector("strong").textContent = titulo;
      el.banner.querySelector("span").textContent = sub;
      el.banner.classList.add("visivel");
      tempoBanner = 2.6;
    },
    feed(pts, tag, mult = 1) {
      const m = mult > 1 ? ` <em>×${dec(mult)}</em>` : "";
      linhaFeed(`<b>${pts}</b> ${tag}${m}`);
    },
    coleta(txt) {
      linhaFeed(`<span class="coleta">${txt}</span>`);
    },
    acerto(cabeca, morte) {
      el.marca.dataset.tipo = morte ? "abate" : cabeca ? "cabeca" : "corpo";
      el.marca.classList.add("visivel");
      tempoMarca = morte ? 0.3 : 0.16;
    },
    dano(qtd, ang) {
      clarao = Math.min(1, clarao + qtd / 25);
      el.golpe.style.transform = `translate(-50%, -50%) rotate(${ang}rad)`;
      el.golpe.classList.add("visivel");
      tempoGolpe = 0.9;
    },

    // estado: { jogador, arena, dt }
    atualizar({ jogador: j, arena: a, terceira }, dt) {
      tempoMarca -= dt;
      if (tempoMarca <= 0) el.marca.classList.remove("visivel");
      tempoBanner -= dt;
      if (tempoBanner <= 0) el.banner.classList.remove("visivel");
      tempoGolpe -= dt;
      if (tempoGolpe <= 0) el.golpe.classList.remove("visivel");
      clarao = Math.max(0, clarao - dt * 2);
      const baixa = j.hp / j.maxHp < 0.3 ? 0.35 : 0;
      el.dano.style.opacity = Math.max(clarao, baixa).toFixed(2);

      texto("onda", el.onda, `Onda ${Math.max(1, a.ondas.indice + 1)}/${a.ondas.total}`);
      texto("ninhos", el.ninhos, `Ninhos ${a.ninhosVivos()}`);
      texto("restam", el.restam, `Zumbis ${a.restantes}`);
      texto("pontos", el.pontos, fmt(a.pontos));
      const mult = a.combo > 1 ? Math.min(3, 1 + 0.25 * (a.combo - 1)) : 1;
      texto("mult", el.mult, `×${dec(mult)}`);
      el.combo.classList.toggle("ativo", mult > 1);
      el.comboBarra.style.transform = `scaleX(${(a.comboT / 3.5).toFixed(3)})`;
      const v = Math.ceil(j.hp);
      texto("vida", el.vidaNum, String(v));
      el.vidaBarra.style.transform = `scaleX(${(v / j.maxHp).toFixed(3)})`;
      el.vida.dataset.nivel = v > 50 ? "bom" : v > 25 ? "medio" : "baixo";
      const arma = j.arma;
      texto("arma", el.armaNome, arma.def.nome);
      texto("mun", el.municao, String(arma.municao));
      texto("res", el.reserva, arma.reserva === Infinity ? "/ ∞" : `/ ${arma.reserva}`);
      const dica = arma.recarregando
        ? "Recarregando"
        : arma.municao === 0 && arma.reserva === 0
          ? "Sem virotes: recolha do chão"
          : arma.municao === 0
            ? "R para recarregar"
            : "";
      texto("dica", el.dica, dica);
      // mira: abre com a dispersão da arma; some mirando com a besta (o centro do trilho vira a mira)
      const disp = arma.dispersao(j.mirando, Math.hypot(j.vel.x, j.vel.z) > 1, !j.noChao);
      el.mira.style.setProperty("--abre", `${(6 + disp * 900).toFixed(1)}px`);
      el.mira.hidden = !j.alive || (j.mirando && !terceira);
    },
  };
}
