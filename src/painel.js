// Painel da demonstração, em três abas: texturas (modos, objetos e coordenadas UV), câmeras e
// projeção (fov, matriz e tamanho na tela) e luzes. Tudo também tem tecla (veja a barra de ajuda).
import * as THREE from "three";
import { conferirComThree } from "./cameras.js";

const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const num = (v, casas = 1) => v.toFixed(casas).replace(".", ",");

export function criarPainel({ cameras, luzes, medir, texturas }) {
  const el = document.getElementById("painel");
  el.innerHTML = `
    <h1>Rio <span>Zero</span> · Entrega 3</h1>
    <p class="sub">Texturas e mapeamento UV na orla de Copacabana, com as luzes da entrega 2.</p>
    <div class="abas" role="tablist">
      <button type="button" role="tab" data-aba="texturas">Texturas</button>
      <button type="button" role="tab" data-aba="cameras">Câmeras</button>
      <button type="button" role="tab" data-aba="luzes">Luzes</button>
    </div>

    <section data-aba="texturas">
    <h2>Modo <kbd>T</kbd> <kbd>U</kbd></h2>
    <div class="botoes">
      <button type="button" data-modo="normal">Com textura</button>
      <button type="button" data-modo="sem">Sem textura</button>
      <button type="button" data-modo="uv">Grade UV</button>
    </div>
    <p class="nota" id="p-modo-nota"></p>
    <h2>Objetos texturizados</h2>
    <div class="lista-tex" id="p-tex-lista"></div>
    <h2>Coordenadas UV</h2>
    <p class="nota" id="p-uv-titulo"></p>
    <canvas id="p-uv" width="288" height="288" aria-label="Coordenadas UV do objeto escolhido sobre a textura"></canvas>
    <div id="p-uv-dados"></div>
    <p class="nota" id="p-uv-como"></p>
    </section>

    <section data-aba="cameras" hidden>
    <h2>Câmera <kbd>C</kbd></h2>
    <div class="botoes" id="p-cameras"></div>
    <p class="nota" id="p-cam-detalhe"></p>

    <h2>Projeção <kbd>P</kbd></h2>
    <div class="botoes">
      <button type="button" id="p-persp">Perspectiva</button>
      <button type="button" id="p-orto">Ortográfica (comparação)</button>
    </div>
    <label class="linha" for="p-fov-r"><span>Campo de visão vertical <kbd>-</kbd> <kbd>+</kbd></span><b id="p-fov"></b></label>
    <input type="range" id="p-fov-r" min="15" max="110" step="1" />
    <div class="linha"><span>aspecto · perto · longe</span><b id="p-params"></b></div>
    <div class="matriz" id="p-matriz" aria-label="Matriz de projeção"></div>
    <p class="nota" id="p-matriz-nota"></p>
    <h3>O mesmo zumbi (2,5 m de altura) perto e longe</h3>
    <div id="p-tamanhos"></div>
    </section>

    <section data-aba="luzes" hidden>
    <h2>Luzes <kbd>1</kbd>–<kbd>5</kbd></h2>
    <p class="nota">Shift + número deixa só ela acesa. <kbd>0</kbd> acende todas. As texturas continuam
    recebendo cada luz: apague as outras e veja a lanterna passar pelo relevo do calçadão e das barricadas.</p>
    <div id="p-luzes"></div>
    <div class="botoes">
      <button type="button" id="p-todas">Acender todas</button>
      <button type="button" id="p-helpers">Mostrar as fontes <kbd>L</kbd></button>
    </div>
    </section>
  `;

  const $ = (id) => el.querySelector("#" + id);

  // abas
  let aba = "texturas";
  const botoesAba = [...el.querySelectorAll(".abas button")];
  function mostrarAba(nome) {
    aba = nome;
    botoesAba.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === nome)));
    el.querySelectorAll("section[data-aba]").forEach((s) => (s.hidden = s.dataset.aba !== nome));
  }
  botoesAba.forEach((b) => b.addEventListener("click", () => mostrarAba(b.dataset.aba)));
  mostrarAba(aba);

  // ---------------------------------------------------------------------------------------------
  // Texturas: modo de exibição, lista de objetos e o desenho das coordenadas UV
  // ---------------------------------------------------------------------------------------------
  const notasModo = {
    normal: "Cada objeto com a sua imagem, repetindo na escala certa e recebendo as cinco luzes.",
    sem: "Só a cor média de cada textura: dá para ver o que a imagem acrescenta.",
    uv: "A mesma grade em tudo: cada quadrado é 1/8 da imagem. Quadrados iguais e sem entortar mostram que o mapeamento não estica.",
  };
  const botoesModo = [...el.querySelectorAll("[data-modo]")];
  botoesModo.forEach((b) =>
    b.addEventListener("click", () => {
      texturas.definirModo(b.dataset.modo);
      sincronizar();
    }),
  );

  let escolhido = 0;
  const botoesTex = texturas.lista.map((item, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item-tex";
    const info = texturas.catalogo[item.chave];
    b.innerHTML = `<img src="texturas/${info.arquivo}" alt="" width="34" height="34"><span><b>${item.rotulo}</b><small>${info.arquivo}</small></span>`;
    b.addEventListener("click", () => {
      escolhido = i;
      texturas.focar(item.mesh);
      desenharUV();
      sincronizar();
    });
    $("p-tex-lista").append(b);
    return b;
  });

  const tela = $("p-uv");
  const ctx = tela.getContext("2d");
  const ponto = (atr, i) => [atr.getX(i), atr.getY(i)];

  function desenharUV() {
    const item = texturas.lista[escolhido];
    const info = texturas.catalogo[item.chave];
    const imagem = texturas.tex[item.chave].image;
    const geo = item.mesh.geometry;
    const uv = geo.attributes.uv;
    const indice = geo.index;
    const mats = Array.isArray(item.mesh.material) ? item.mesh.material : null;
    let grupos = geo.groups.length ? geo.groups : [{ start: 0, count: indice ? indice.count : uv.count, materialIndex: 0 }];
    // cilindro e cone: só a lateral (as tampas ficam escondidas e embolariam o desenho)
    const lateral = geo.type === "CylinderGeometry" || geo.type === "ConeGeometry";
    if (lateral) grupos = grupos.slice(0, 1);

    // triângulos que usam esta textura (na cabeça, só a face da frente)
    const tris = [];
    for (const g of grupos) {
      if (mats && mats[g.materialIndex].userData.textura !== item.chave) continue;
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const a = indice ? indice.getX(k) : k;
        const b = indice ? indice.getX(k + 1) : k + 1;
        const c = indice ? indice.getX(k + 2) : k + 2;
        tris.push([ponto(uv, a), ponto(uv, b), ponto(uv, c)]);
      }
    }
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const t of tris) {
      for (const [u, v] of t) {
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }
    }
    // janela em número inteiro de repetições da imagem. Se o objeto inteiro couber em até 16
    // repetições, aparece inteiro; os planos enormes do chão mostram só um trecho de 3 × 3.
    const u0 = Math.floor(minU + 1e-6);
    const v0 = Math.floor(minV + 1e-6);
    let du = Math.max(1, Math.ceil(maxU - 1e-6) - u0);
    let dv = Math.max(1, Math.ceil(maxV - 1e-6) - v0);
    const cortado = Math.max(du, dv) > 16;
    if (cortado) du = dv = 3;
    const S = tela.width;
    const escala = S / Math.max(du, dv);
    const px = (u) => (u - u0) * escala;
    const py = (v) => S - (v - v0) * escala;

    ctx.clearRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < du; i++) {
      for (let j = 0; j < dv; j++) ctx.drawImage(imagem, i * escala, S - (j + 1) * escala, escala, escala);
    }
    // limites de cada repetição da imagem
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 1; i < du; i++) {
      ctx.moveTo(i * escala, S);
      ctx.lineTo(i * escala, S - dv * escala);
    }
    for (let j = 1; j < dv; j++) {
      ctx.moveTo(0, S - j * escala);
      ctx.lineTo(du * escala, S - j * escala);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // as arestas dos triângulos, no lugar onde cada vértice cai na imagem
    for (const [larg, cor] of [[3.5, "rgba(0,0,0,0.65)"], [1.5, "#b7ff3b"]]) {
      ctx.strokeStyle = cor;
      ctx.lineWidth = larg;
      ctx.beginPath();
      for (const t of tris) {
        ctx.moveTo(px(t[0][0]), py(t[0][1]));
        ctx.lineTo(px(t[1][0]), py(t[1][1]));
        ctx.lineTo(px(t[2][0]), py(t[2][1]));
        ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#b7ff3b";
    for (const t of tris) for (const [u, v] of t) ctx.fillRect(px(u) - 2, py(v) - 2, 4, 4);

    $("p-uv-titulo").textContent = `${item.rotulo}: ${info.arquivo} (${imagem.width} × ${imagem.height} px)`;
    $("p-uv-dados").innerHTML = `
      <div class="linha"><span>u vai de</span><b>${num(minU, 2)} a ${num(maxU, 2)}</b></div>
      <div class="linha"><span>v vai de</span><b>${num(minV, 2)} a ${num(maxV, 2)}</b></div>
      <div class="linha"><span>triângulos com esta textura${lateral ? " (lateral)" : ""}</span><b>${tris.length}</b></div>
      <div class="linha"><span>${info.metros ? "uma imagem cobre" : "mapeamento"}</span><b>${info.metros ? num(info.metros, info.metros % 1 ? 1 : 0) + " m" : "a face inteira"}</b></div>
      ${cortado ? '<p class="nota">O objeto é maior que a janela: aparecem só 3 × 3 repetições da imagem.</p>' : ""}`;
    $("p-uv-como").textContent = item.como;
  }
  desenharUV();

  // câmeras
  const botoesCamera = cameras.modos.map((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m.nome;
    b.addEventListener("click", () => {
      cameras.selecionar(i);
      sincronizar();
    });
    $("p-cameras").append(b);
    return b;
  });

  // projeção
  $("p-persp").addEventListener("click", () => {
    cameras.alternarOrto(false);
    sincronizar();
  });
  $("p-orto").addEventListener("click", () => {
    cameras.alternarOrto(true);
    sincronizar();
  });
  $("p-fov-r").addEventListener("input", (e) => {
    cameras.definirFov(Number(e.target.value));
    sincronizar();
  });
  const celulas = Array.from({ length: 16 }, () => {
    const s = document.createElement("span");
    $("p-matriz").append(s);
    return s;
  });

  // tamanho na tela de cada zumbi medido
  const linhasTamanho = medir.map(() => {
    const d = document.createElement("div");
    d.className = "linha";
    $("p-tamanhos").append(d);
    return d;
  });

  // luzes
  const linhasLuz = luzes.fontes.map((f, i) => {
    const linha = document.createElement("div");
    linha.className = "luz";
    linha.innerHTML = `
      <span class="cor" style="background:${hex(f.cor)}"></span>
      <div class="nome"><b>${i + 1} · ${f.nome}</b><small>${f.tipo}</small><small class="papel">${f.papel}</small></div>
      <button type="button" class="liga"></button>
      <button type="button" class="so" title="Deixar só esta acesa">Só ela</button>`;
    linha.querySelector(".liga").addEventListener("click", () => {
      luzes.alternar(i);
      sincronizar();
    });
    linha.querySelector(".so").addEventListener("click", () => {
      luzes.solo(i);
      sincronizar();
    });
    $("p-luzes").append(linha);
    return linha;
  });
  $("p-todas").addEventListener("click", () => {
    luzes.todas();
    sincronizar();
  });
  $("p-helpers").addEventListener("click", () => {
    luzes.alternarHelpers();
    sincronizar();
  });

  // estado dos botões e textos que só mudam quando o usuário mexe em algo
  function sincronizar() {
    const modo = cameras.modo;
    botoesCamera.forEach((b, i) => b.setAttribute("aria-pressed", String(i === cameras.indice)));
    $("p-cam-detalhe").textContent = modo.detalhe;
    $("p-persp").setAttribute("aria-pressed", String(!cameras.ortografico));
    $("p-orto").setAttribute("aria-pressed", String(cameras.ortografico));
    $("p-fov").textContent = `${modo.camera.fov}°`;
    $("p-fov-r").value = modo.camera.fov;
    $("p-fov-r").disabled = cameras.ortografico;
    linhasLuz.forEach((linha, i) => {
      const f = luzes.fontes[i];
      const b = linha.querySelector(".liga");
      b.textContent = f.ligada ? "Ligada" : "Desligada";
      b.setAttribute("aria-pressed", String(f.ligada));
      linha.classList.toggle("apagada", !f.ligada);
    });
    $("p-helpers").setAttribute("aria-pressed", String(luzes.helpersVisiveis));
    botoesModo.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === texturas.modo)));
    $("p-modo-nota").textContent = notasModo[texturas.modo];
    botoesTex.forEach((b, i) => b.setAttribute("aria-pressed", String(i === escolhido)));
  }

  // números que mudam a cada quadro (atualizados 8 vezes por segundo)
  const base = new THREE.Vector3();
  const topo = new THREE.Vector3();
  const centro = new THREE.Vector3();
  let espera = 0;
  function atualizar(dt) {
    espera -= dt;
    if (espera > 0 || el.classList.contains("oculto") || aba !== "cameras") return;
    espera = 0.125;

    const cam = cameras.camera;
    const persp = cameras.modo.camera;
    // matriz: o three.js guarda por coluna, então o elemento (linha l, coluna c) fica em [c * 4 + l]
    const e = cam.projectionMatrix.elements;
    const chaves = cameras.ortografico ? [0, 5, 10, 14, 15] : [0, 5, 10, 14, 11];
    for (let l = 0; l < 4; l++) {
      for (let c = 0; c < 4; c++) {
        const k = c * 4 + l;
        const v = Math.abs(e[k]) < 5e-4 ? 0 : e[k];
        celulas[l * 4 + c].textContent = v.toFixed(3);
        celulas[l * 4 + c].classList.toggle("chave", chaves.includes(k));
      }
    }
    $("p-params").textContent = `${num(persp.aspect, 2)} · ${num(persp.near, 2)} · ${persp.far}`;
    $("p-matriz-nota").innerHTML = cameras.ortografico
      ? "Última linha (0, 0, 0, 1): w = 1, não há divisão. O tamanho na tela não depende da distância."
      : `Última linha (0, 0, −1, 0): w = −z, a GPU divide por w e o que está longe encolhe. Montada em <code>matrizPerspectiva()</code>, em src/cameras.js${conferirComThree(persp) ? ', <span class="ok">igual à do three.js</span>' : ""}.`;

    // altura na tela = distância entre os pés e o topo da cabeça depois da projeção.
    // A perspectiva divide pela profundidade (o -z no espaço da câmera), não pela distância em linha reta.
    const alturaTela = window.innerHeight;
    medir.forEach(({ nome, obj }, i) => {
      base.copy(obj.position);
      topo.copy(obj.position).setY(obj.position.y + 2.5);
      centro.copy(obj.position).setY(1.25).applyMatrix4(cam.matrixWorldInverse);
      const profundidade = -centro.z;
      centro.applyMatrix4(cam.projectionMatrix);
      base.project(cam);
      topo.project(cam);
      const naTela = Math.abs(centro.x) <= 1 && Math.abs(centro.y) <= 1 && profundidade > 0;
      const px = Math.round((Math.abs(topo.y - base.y) / 2) * alturaTela);
      linhasTamanho[i].innerHTML =
        profundidade > 0
          ? `<span>${nome}, ${num(profundidade)} m de profundidade</span><b>${px} px${naTela ? "" : " (fora da tela)"}</b>`
          : `<span>${nome}</span><b>atrás da câmera</b>`;
    });
  }

  sincronizar();
  return {
    sincronizar,
    atualizar,
    mostrarAba,
    alternarVisivel() {
      el.classList.toggle("oculto");
    },
  };
}
