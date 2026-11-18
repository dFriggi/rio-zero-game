// Entrega 4: jogabilidade, interação e pontuação.
// A orla de Copacabana das entregas 2 e 3 (luzes, câmeras, texturas) virou fase jogável em primeira pessoa:
// o Rafael anda, pula, agacha, desliza, atira com a besta e a pistola, empurra com a coronha e recolhe virotes;
// os Caminhantes chegam em três ondas, com ninhos que soltam mais zumbis até serem destruídos; pontos com combo,
// vitória e derrota com recomeço, e som gerado em código.
// Estados: menu → jogando ⇄ pausa (Esc) ⇄ painel (H, modo apresentação) → fim (vitória ou derrota) → jogando (R).
import * as THREE from "three";
import { carregarTexturas, CATALOGO, definirModoTextura } from "./world/texturas.js";
import { criarCenario } from "./world/orla.js";
import { criarColisao } from "./world/colisao.js";
import { criarLuzes } from "./world/lights.js";
import { criarCameras } from "./core/CameraRig.js";
import { Input } from "./core/Input.js";
import { som } from "./core/Som.js";
import { criarPainel } from "./ui/Painel.js";
import { criarHud } from "./ui/Hud.js";
import { criarRafael } from "./entities/Rafael.js";
import { criarModeloZumbi, ESCALA } from "./entities/Zombie.js";
import { animarZumbi } from "./entities/animacao.js";
import { Player } from "./entities/Player.js";
import { ArenaScene, lerRecorde } from "./scenes/ArenaScene.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const tex = await carregarTexturas(renderer);
document.getElementById("carregando")?.remove();

const scene = new THREE.Scene();
const colisao = criarColisao();
const cenario = criarCenario(scene, tex, colisao);

// Rafael: o corpo fica na camada 1 (as câmeras de fora veem; a de 1ª pessoa não)
const rafael = criarRafael(tex);
rafael.scale.setScalar(ESCALA);
rafael.traverse((o) => {
  if (o.isMesh) o.layers.set(1);
});
scene.add(rafael);

const input = new Input(renderer.domElement);
input.livre = new URLSearchParams(location.search).has("teste"); // testes automáticos: atira sem travar o mouse
const jogador = new Player(tex);
const cameras = criarCameras(renderer, rafael, jogador, colisao);
const camFps = cameras.modos[0].camera;
scene.add(camFps);
jogador.armas.forEach((a) => camFps.add(a.pivo));
const preenche = new THREE.PointLight(0xffe8c8, 0.8, 2.2, 2); // luz fraca para as mãos não sumirem no escuro
camFps.add(preenche);

const luzes = criarLuzes(scene, { postes: cenario.postes, fogueira: cenario.fogueira, rafael });

let estado = "menu";
const hud = criarHud({
  aoJogar: comecar,
  aoContinuar: retomar,
  aoRecomecar: comecar,
  aoMenu: irAoMenu,
});
const arena = new ArenaScene({
  scene,
  colisao,
  limites: cenario.limites,
  jogador,
  rafael,
  tex,
  hud,
  obterCamera: () => cameras.modo.camera,
  aoTremer: (k) => cameras.tremer(k),
  aoFim: (r) => {
    if (estado !== "jogando") return;
    estado = "fim";
    input.soltar();
    hud.mostrarFim(r);
  },
});

// Zumbi da vitrine: aparece na frente do Rafael só no modo apresentação, para o painel de texturas e de tamanho
const vitrine = criarModeloZumbi("caminhante", 1, tex);
vitrine.visible = false;
animarZumbi(vitrine, { fase: 0, quanto: 0 });
scene.add(vitrine);

// Texturas: o modo de exibição e um objeto de exemplo de cada textura, com a explicação do UV
let modoTextura = "normal";
const ex = cenario.exemplos;
const pR = rafael.userData.pecas;
const pZ = vitrine.userData.pecas;
const listaTexturas = [
  { rotulo: "Calçadão", chave: "calcadao", mesh: ex.calcadao, como: "Plano de 420 × 20 m. u = x ÷ 3 m e v = y ÷ 3 m: a imagem se repete a cada 3 m, e o mapa de relevo usa as mesmas coordenadas." },
  { rotulo: "Avenida", chave: "asfalto", mesh: ex.asfalto, como: "Plano de 420 × 12 m. u = x ÷ 4 m e v = y ÷ 4 m." },
  { rotulo: "Areia", chave: "areia", mesh: ex.areia, como: "Plano de 420 × 34 m. u = x ÷ 3 m e v = y ÷ 3 m." },
  { rotulo: "Fachada", chave: "reboco", mesh: ex.reboco, como: "Caixa do prédio com a base no chão: v = altura ÷ 6,4 m, então as faixas das lajes caem entre as janelas em todos os prédios. A cor de cada prédio tinge a imagem." },
  { rotulo: "Barricada", chave: "concreto", mesh: ex.barricada, como: "Bloco de 1 × 0,9 × 0,8 m. Cada face usa as duas coordenadas que ficam deitadas nela, divididas por 1 m." },
  { rotulo: "Quiosque", chave: "madeira", mesh: ex.madeira, como: "Caixa de 3 × 2,2 × 3 m. Tábuas verticais em todas as faces, a cada 1,5 m de imagem." },
  { rotulo: "Telhado", chave: "telha", mesh: ex.telha, como: "Cone de 4 lados: u dá a volta (4 × 3,96 m) e v sobe pela água do telhado (3,05 m)." },
  { rotulo: "Carro", chave: "lataria", mesh: ex.lataria, como: "Caixa da lataria em metros, a cada 2 m. A imagem é cinza; a cor de cada carro vem do material." },
  { rotulo: "Coqueiro", chave: "tronco", mesh: ex.tronco, como: "Cilindro: u dá a volta no tronco (perímetro ÷ 1 m) e v sobe pelo gomo (1,6 m)." },
  { rotulo: "Rosto do Rafael", chave: "rostoRafael", mesh: pR.cranio, deFrente: true, como: "Cabeça arredondada (RoundedBoxGeometry). Ela guarda as seis faces na ordem da caixa; só a da frente usa esta imagem, com o UV de 0 a 1 da própria geometria." },
  { rotulo: "Jaqueta", chave: "couro", mesh: rafael.userData.abaJaqueta, deFrente: true, como: "Painel da frente da jaqueta (caixa arredondada de 0,3 × 0,74 × 0,06 m). UV em metros por face (uvPorFace), a cada 50 cm." },
  { rotulo: "Calça", chave: "jeans", mesh: pR.coxa, deFrente: true, como: "Cápsula da coxa: u dá a volta na perna (perímetro ÷ 0,5 m) e v percorre o comprimento ÷ 0,5 m." },
  { rotulo: "Rosto do zumbi", chave: "rostoZumbi", mesh: pZ.cranio, deFrente: true, como: "Mesma cabeça e mesmo UV do Rafael, com outra imagem: o modelo é um só e a textura muda o personagem." },
  { rotulo: "Camisa do zumbi", chave: "camisaRasgada", mesh: pZ.peito, deFrente: true, como: "Peito (caixa arredondada de 0,72 × 0,44 × 0,4 m), UV em metros por face. A imagem é cinza; a cor da camisa vem do material." },
];
const painel = criarPainel({
  cameras,
  luzes,
  medir: [
    { nome: "Zumbi da vitrine", obj: vitrine },
    { nome: "Rafael", obj: rafael },
  ],
  texturas: {
    lista: listaTexturas,
    catalogo: CATALOGO,
    tex,
    get modo() {
      return modoTextura;
    },
    definirModo(modo) {
      modoTextura = modo;
      definirModoTextura(modo, tex.gradeUV);
    },
    focar(mesh) {
      const item = listaTexturas.find((i) => i.mesh === mesh);
      cameras.focar(mesh, item?.deFrente);
    },
  },
});
painel.alternarVisivel(false);
const ajuda = document.getElementById("ajuda");

// Ajudas visuais (G): grade de 1 m e eixos (X vermelho, Y verde, Z azul), como na entrega 1
const grade = new THREE.GridHelper(60, 60, 0x000000, 0x555555);
grade.position.y = 0.03;
const eixos = new THREE.AxesHelper(3);
eixos.position.y = 0.04;
const ajudas = [grade, eixos];
ajudas.forEach((a) => {
  a.visible = false;
  scene.add(a);
});

// ---------------------------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------------------------
function comecar() {
  arena.reiniciar();
  estado = "jogando";
  if (!cameras.modo.jogo) cameras.selecionar(0);
  hud.esconderTelas();
  hud.mostrarHud(true);
  som.ui("confirmar");
  input.travar();
}

function retomar() {
  estado = "jogando";
  hud.esconderTelas();
  hud.mostrarHud(true);
  input.travar();
}

function pausar() {
  estado = "pausa";
  input.soltar();
  hud.mostrarPausa();
}

function irAoMenu() {
  estado = "menu";
  input.soltar();
  hud.mostrarHud(false);
  hud.mostrarMenu(lerRecorde());
}

// modo apresentação: jogo parado, painel aberto, ponteiro solto e o zumbi da vitrine na frente do Rafael
let soltandoParaPainel = false;
function alternarPainel() {
  if (estado === "painel") {
    painel.alternarVisivel(false);
    ajuda.hidden = true;
    vitrine.visible = false;
    cameras.alternarOrto(false);
    if (!cameras.modo.jogo) cameras.selecionar(0);
    pausar();
    return;
  }
  if (estado !== "jogando" && estado !== "pausa") return;
  estado = "painel";
  soltandoParaPainel = true;
  input.soltar();
  hud.esconderTelas();
  hud.mostrarHud(false);
  painel.alternarVisivel(true);
  painel.sincronizar();
  ajuda.hidden = false;
  const d = jogador.direcao(new THREE.Vector3()).setY(0).normalize();
  vitrine.position.set(jogador.pos.x + d.x * 3, 0, jogador.pos.z + d.z * 3);
  vitrine.rotation.y = Math.atan2(-d.x, -d.z);
  vitrine.visible = true;
}

document.addEventListener("pointerlockchange", () => {
  if (input.travado) return;
  if (soltandoParaPainel) soltandoParaPainel = false;
  else if (estado === "jogando") pausar();
});
renderer.domElement.addEventListener("click", () => {
  if (estado === "jogando" && !input.travado) input.travar();
});

// ---------------------------------------------------------------------------------------------
// Teclas
// ---------------------------------------------------------------------------------------------
const TECLAS_LUZ = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
const TECLAS_LUZ_NUM = ["Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5"];

function lerTeclas() {
  if (input.wasPressed("KeyH")) alternarPainel();
  if (estado === "menu" && input.wasPressed("Enter")) comecar();
  if ((estado === "fim" || estado === "pausa") && input.wasPressed("KeyR")) comecar();
  if (estado === "pausa" && input.wasPressed("Enter")) retomar();
  if (estado === "jogando" && input.wasPressed("Escape")) pausar(); // sem o ponteiro travado (modo de teste)
  if (estado === "jogando" && input.wasPressed("KeyC")) cameras.selecionar(cameras.indice === 0 ? 1 : 0);
  if (estado !== "painel") return;

  // modo apresentação: as teclas das entregas 2 e 3
  let mudou = false;
  if (input.wasPressed("KeyC")) {
    cameras.proxima();
    mudou = true;
  }
  if (input.wasPressed("KeyP")) {
    cameras.alternarOrto();
    mudou = true;
  }
  if (input.wasPressed("Minus") || input.wasPressed("NumpadSubtract")) {
    cameras.definirFov(cameras.modo.camera.fov - 5);
    mudou = true;
  }
  if (input.wasPressed("Equal") || input.wasPressed("NumpadAdd")) {
    cameras.definirFov(cameras.modo.camera.fov + 5);
    mudou = true;
  }
  for (let i = 0; i < 5; i++) {
    const tecla = [TECLAS_LUZ[i], TECLAS_LUZ_NUM[i]].find((k) => input.wasPressed(k));
    if (tecla) {
      if (input.wasPressedWithShift(tecla)) luzes.solo(i);
      else luzes.alternar(i);
      mudou = true;
    }
  }
  if (input.wasPressed("Digit0") || input.wasPressed("Numpad0")) {
    luzes.todas();
    mudou = true;
  }
  if (input.wasPressed("KeyL")) {
    luzes.alternarHelpers();
    mudou = true;
  }
  if (input.wasPressed("KeyT")) {
    painel.mostrarAba("texturas");
    modoTextura = modoTextura === "normal" ? "sem" : "normal";
    definirModoTextura(modoTextura, tex.gradeUV);
    mudou = true;
  }
  if (input.wasPressed("KeyU")) {
    painel.mostrarAba("texturas");
    modoTextura = modoTextura === "uv" ? "normal" : "uv";
    definirModoTextura(modoTextura, tex.gradeUV);
    mudou = true;
  }
  if (input.wasPressed("KeyG")) ajudas.forEach((a) => (a.visible = !a.visible));
  if (mudou) painel.sincronizar();
}

// ---------------------------------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------------------------------
const relogio = new THREE.Clock();
let armaMostrada = null;

function loop() {
  quadro(Math.min(relogio.getDelta(), 0.05), relogio.elapsedTime);
  renderer.render(scene, cameras.camera);
  requestAnimationFrame(loop);
}

function quadro(dt, t) {
  lerTeclas();
  if (estado === "jogando") arena.update(dt, input);
  cenario.atualizar(t);
  luzes.atualizar(t);
  cameras.atualizar(dt);

  // arma na mão: só a da vez aparece; no corpo, a outra vai para as costas ou o coldre
  const arma = jogador.arma;
  jogador.armas.forEach((a) => (a.pivo.visible = a === arma && jogador.alive));
  arma.animar(dt, {
    mirando: jogador.mirando,
    balanco: arena.passada.fase,
    andando: arena.passada.quanto,
    olharX: estado === "jogando" ? input.mouse.dx : 0,
    olharY: estado === "jogando" ? input.mouse.dy : 0,
  });
  if (armaMostrada !== arma.id) rafael.userData.mostrarArma((armaMostrada = arma.id));

  if (estado === "jogando") hud.atualizar({ jogador, arena, terceira: cameras.modo.id === "terceira" }, dt);
  painel.atualizar(dt);
  som.ouvir(cameras.camera);
  input.endFrame();
  // (o render vem logo depois, em loop())
}
// [PROJEÇÃO] onde a matriz é APLICADA: o render envia camera.projectionMatrix para o shader de
// vértice de cada material, que calcula gl_Position = projectionMatrix * modelViewMatrix * posição.
// [TEXTURA] no mesmo render, o shader de fragmento de cada material lê a imagem (map) na
// coordenada UV interpolada entre os vértices e multiplica pela cor e pela luz que chega ali.
irAoMenu();
loop();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameras.resize();
  painel.sincronizar();
});

// para os testes no navegador (inspeção pelo console)
// avancar(s): no modo de teste, roda s segundos de jogo em passos de 1/60 s sem esperar o navegador desenhar
window.rz = {
  arena,
  jogador,
  cameras,
  comecar,
  get estado() {
    return estado;
  },
  avancar(seg) {
    if (!input.livre) return;
    for (let i = 0; i < Math.round(seg * 60); i++) quadro(1 / 60, relogio.elapsedTime);
  },
};
