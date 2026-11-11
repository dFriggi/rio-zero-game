// Entrega 3: texturas e mapeamento UV.
// A orla de Copacabana da entrega 2 agora tem textura no chão, nas fachadas, nos objetos e nos
// personagens, com as mesmas quatro câmeras e as cinco luzes. Também entra o começo do combate:
// a besta dispara, os zumbis caem e o Rafael tem vida.
import * as THREE from "three";
import { carregarTexturas, CATALOGO, definirModoTextura } from "./texturas.js";
import { criarCenario } from "./cenario/cenario.js";
import { criarLuzes } from "./cenario/luzes.js";
import { criarCameras } from "./cameras.js";
import { criarPainel } from "./painel.js";
import { criarCombate } from "./combate.js";
import { criarHud } from "./hud.js";
import { criarRafael } from "./personagens/Rafael.js";
import { criarZumbi } from "./personagens/Zumbi.js";
import { animarCaminhada, criarComportamentoZumbis } from "./personagens/movimento.js";
import { Input } from "./teclado.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// as imagens de texturas/ são carregadas antes de montar a cena
const tex = await carregarTexturas(renderer);
document.getElementById("carregando")?.remove();

const scene = new THREE.Scene();
const cenario = criarCenario(scene, tex);

// Personagens da entrega 1, agora com rosto e roupas texturizados
const INICIO = new THREE.Vector3(0, 0, 1);
const rafael = criarRafael(tex);
rafael.position.copy(INICIO);
rafael.rotation.y = Math.PI; // de frente para a avenida, de onde os zumbis vêm
scene.add(rafael);

// Os dois zumbis da entrega 1 perto dele e outros iguais cada vez mais longe, ao longo da orla
const zumbis = [
  [0, -3, -6],
  [1, 4, -4],
  [0, 13, -10],
  [1, 30, -8],
  [0, 52, -11],
  [1, -34, -19],
  [0, 84, -9],
].map(([variacao, x, z]) => {
  const zumbi = criarZumbi(variacao, tex);
  zumbi.position.set(x, 0, z);
  zumbi.rotation.y = Math.atan2(rafael.position.x - x, rafael.position.z - z); // virado para o Rafael
  scene.add(zumbi);
  return zumbi;
});

for (const p of [rafael, ...zumbis]) {
  p.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// Combate: os zumbis avisam quando atacam e quando morrem; o combate cuida da vida e dos virotes
let combate = null;
const comportamento = criarComportamentoZumbis(zumbis, rafael, { oeste: -23.5, leste: 25.5 }, {
  aoAtacar: (dano) => combate.ferirRafael(dano),
  aoMorrer: () => combate.contarAbate(),
});
combate = criarCombate({ scene, rafael, zumbis: comportamento, posicaoInicial: INICIO });
const hud = criarHud();

const luzes = criarLuzes(scene, { postes: cenario.postes, fogueira: cenario.fogueira, rafael });
const cameras = criarCameras(renderer, rafael);

// Texturas: o modo de exibição e um objeto de exemplo de cada textura, com a explicação do UV
let modoTextura = "normal";
const ex = cenario.exemplos;
const pR = rafael.userData.pecas;
const pZ = zumbis[1].userData.pecas;
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
  { rotulo: "Rosto do Rafael", chave: "rostoRafael", mesh: pR.cranio, deFrente: true, como: "Só a face da frente da cabeça usa esta imagem, com o UV padrão da caixa: os cantos vão de (0, 0) a (1, 1) e a imagem inteira cobre a face." },
  { rotulo: "Jaqueta", chave: "couro", mesh: rafael.userData.abaJaqueta, deFrente: true, como: "Aba da jaqueta (caixa de 0,26 × 0,82 × 0,42 m). UV em metros, a cada 50 cm." },
  { rotulo: "Calça", chave: "jeans", mesh: pR.coxa, deFrente: true, como: "Cápsula da coxa: u dá a volta na perna (perímetro ÷ 0,5 m) e v percorre o comprimento ÷ 0,5 m." },
  { rotulo: "Rosto do zumbi", chave: "rostoZumbi", mesh: pZ.cranio, deFrente: true, como: "Mesma cabeça e mesmo UV do Rafael, com outra imagem: o modelo é um só e a textura muda o personagem." },
  { rotulo: "Camisa do zumbi", chave: "camisaRasgada", mesh: pZ.peito, deFrente: true, como: "Peito (caixa de 0,72 × 0,42 × 0,4 m), a cada 60 cm. A imagem é cinza; a cor da camisa vem do material." },
];
const painel = criarPainel({
  cameras,
  luzes,
  medir: [
    { nome: "Zumbi perto", obj: zumbis[0] },
    { nome: "Zumbi longe", obj: zumbis[4] },
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
// Teclas e mouse
// ---------------------------------------------------------------------------------------------
const input = new Input();
const TECLAS_LUZ = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
const TECLAS_LUZ_NUM = ["Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5"];

// clique atira nas câmeras de 1ª e 3ª pessoa (nas outras o mouse gira a câmera)
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button === 0 && (cameras.modo.id === "primeira" || cameras.modo.id === "terceira")) combate.atirar();
});

function lerTeclas() {
  let mudou = false;
  if (input.wasPressed("Space")) combate.atirar();
  if (input.wasPressed("KeyR")) combate.reiniciar();
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
  // T liga e desliga as texturas; U troca todas pela grade UV
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
  if (input.wasPressed("KeyH")) painel.alternarVisivel();
  if (mudou) painel.sincronizar();
}

// ---------------------------------------------------------------------------------------------
// Movimento do Rafael
// Nas câmeras Geral e Posto, WASD segue a direção da tela. Em 1ª e 3ª pessoa, A e D giram e W e S andam.
// ---------------------------------------------------------------------------------------------
const VELOCIDADE = 6;
const GIRO = 2.4;
const CIMA = new THREE.Vector3(0, 1, 0);
const frente = new THREE.Vector3();
const lado = new THREE.Vector3();
const passo = new THREE.Vector3();
const passada = { fase: 0, quanto: 0 };

function moverRafael(dt) {
  const ax = (input.isDown("KeyD", "ArrowRight") ? 1 : 0) - (input.isDown("KeyA", "ArrowLeft") ? 1 : 0);
  const ay = (input.isDown("KeyW", "ArrowUp") ? 1 : 0) - (input.isDown("KeyS", "ArrowDown") ? 1 : 0);
  // caminhada: as pernas acompanham o deslocamento; os braços ficam firmes segurando a besta
  const andando = ay !== 0 || (ax !== 0 && cameras.modo.id !== "terceira" && cameras.modo.id !== "primeira");
  passada.quanto += ((andando ? 1 : 0) - passada.quanto) * Math.min(1, dt * 8);
  passada.fase += dt * 9 * passada.quanto;
  animarCaminhada(rafael, passada.fase, passada.quanto, { bracos: false });
  if (!ax && !ay) return;

  const id = cameras.modo.id;
  if (id === "terceira" || id === "primeira") {
    rafael.rotation.y -= ax * GIRO * dt;
    passo.set(Math.sin(rafael.rotation.y), 0, Math.cos(rafael.rotation.y)).multiplyScalar(ay * VELOCIDADE * dt);
  } else {
    cameras.camera.getWorldDirection(frente);
    frente.y = 0;
    frente.normalize();
    lado.crossVectors(frente, CIMA);
    passo.copy(lado).multiplyScalar(ax).addScaledVector(frente, ay).normalize().multiplyScalar(VELOCIDADE * dt);
    rafael.rotation.y = Math.atan2(passo.x, passo.z);
  }
  const { xMin, xMax, zMin, zMax } = cenario.limites;
  rafael.position.x = THREE.MathUtils.clamp(rafael.position.x + passo.x, xMin, xMax);
  rafael.position.z = THREE.MathUtils.clamp(rafael.position.z + passo.z, zMin, zMax);
}

// ---------------------------------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------------------------------
const relogio = new THREE.Clock();

function loop() {
  const dt = Math.min(relogio.getDelta(), 0.05);
  const t = relogio.elapsedTime;
  lerTeclas();
  if (!combate.estado.caido) moverRafael(dt);
  comportamento.atualizar(dt, !combate.estado.caido);
  combate.atualizar(dt);
  cenario.atualizar(t);
  luzes.atualizar(t);
  cameras.atualizar(dt);
  painel.atualizar(dt);
  hud.atualizar(combate.estado, cameras.modo.id, dt);
  input.endFrame();

  // [PROJEÇÃO] onde a matriz é APLICADA: o render envia camera.projectionMatrix para o shader de
  // vértice de cada material, que calcula gl_Position = projectionMatrix * modelViewMatrix * posição.
  // [TEXTURA] no mesmo render, o shader de fragmento de cada material lê a imagem (map) na
  // coordenada UV interpolada entre os vértices e multiplica pela cor e pela luz que chega ali.
  renderer.render(scene, cameras.camera);
  requestAnimationFrame(loop);
}
loop();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameras.resize();
  painel.sincronizar();
});
