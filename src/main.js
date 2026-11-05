// Entrega 2: câmeras, projeção perspectiva e iluminação.
// Os personagens e objetos da entrega 1 agora estão na orla de Copacabana à noite, com quatro
// câmeras (tecla C) e cinco fontes de luz que ligam e desligam (teclas 1 a 5).
import * as THREE from "three";
import { criarCenario } from "./cenario/cenario.js";
import { criarLuzes } from "./cenario/luzes.js";
import { criarCameras } from "./cameras.js";
import { criarPainel } from "./painel.js";
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

const scene = new THREE.Scene();
const cenario = criarCenario(scene);

// Personagens da entrega 1, sem mudança no modelo
const rafael = criarRafael();
rafael.position.set(0, 0, 1);
rafael.rotation.y = Math.PI; // de frente para a avenida, de onde os zumbis vêm
scene.add(rafael);

// Os dois zumbis da entrega 1 perto dele e outros iguais cada vez mais longe, ao longo da orla:
// como o modelo é o mesmo, a diferença de tamanho na tela é só efeito da perspectiva.
const zumbis = [
  [0, -3, -6],
  [1, 4, -4],
  [0, 13, -10],
  [1, 30, -8],
  [0, 52, -11],
  [1, -34, -19],
  [0, 84, -9],
].map(([variacao, x, z]) => {
  const zumbi = criarZumbi(variacao);
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

const atualizarZumbis = criarComportamentoZumbis(zumbis, rafael, { oeste: -23.5, leste: 25.5 });

const luzes = criarLuzes(scene, { postes: cenario.postes, fogueira: cenario.fogueira, rafael });
const cameras = criarCameras(renderer, rafael);
const painel = criarPainel({
  cameras,
  luzes,
  medir: [
    { nome: "Zumbi perto", obj: zumbis[0] },
    { nome: "Zumbi longe", obj: zumbis[4] },
  ],
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
// Teclas
// ---------------------------------------------------------------------------------------------
const input = new Input();
const TECLAS_LUZ = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
const TECLAS_LUZ_NUM = ["Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5"];

function lerTeclas() {
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
  moverRafael(dt);
  atualizarZumbis(dt);
  cenario.atualizar(t);
  luzes.atualizar(t);
  cameras.atualizar(dt);
  painel.atualizar(dt);
  input.endFrame();

  // [PROJEÇÃO] onde a matriz é APLICADA: o render envia camera.projectionMatrix para o shader de
  // vértice de cada material, que calcula gl_Position = projectionMatrix * modelViewMatrix * posição.
  renderer.render(scene, cameras.camera);
  requestAnimationFrame(loop);
}
loop();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameras.resize();
  painel.sincronizar();
});
