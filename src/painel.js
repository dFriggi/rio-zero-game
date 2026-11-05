// Painel da demonstração: troca de câmera, projeção (fov, matriz e tamanho na tela) e as luzes.
// Tudo o que ele faz também tem tecla (veja a barra de ajuda no index.html).
import * as THREE from "three";
import { conferirComThree } from "./cameras.js";

const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const num = (v, casas = 1) => v.toFixed(casas).replace(".", ",");

export function criarPainel({ cameras, luzes, medir }) {
  const el = document.getElementById("painel");
  el.innerHTML = `
    <h1>Rio <span>Zero</span> · Entrega 2</h1>
    <p class="sub">Câmeras, projeção perspectiva e iluminação na orla de Copacabana, a primeira fase.</p>

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

    <h2>Luzes <kbd>1</kbd>–<kbd>5</kbd></h2>
    <p class="nota">Shift + número deixa só ela acesa. <kbd>0</kbd> acende todas.</p>
    <div id="p-luzes"></div>
    <div class="botoes">
      <button type="button" id="p-todas">Acender todas</button>
      <button type="button" id="p-helpers">Mostrar as fontes <kbd>L</kbd></button>
    </div>
  `;

  const $ = (id) => el.querySelector("#" + id);

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
  }

  // números que mudam a cada quadro (atualizados 8 vezes por segundo)
  const base = new THREE.Vector3();
  const topo = new THREE.Vector3();
  const centro = new THREE.Vector3();
  let espera = 0;
  function atualizar(dt) {
    espera -= dt;
    if (espera > 0 || el.classList.contains("oculto")) return;
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
    alternarVisivel() {
      el.classList.toggle("oculto");
    },
  };
}
