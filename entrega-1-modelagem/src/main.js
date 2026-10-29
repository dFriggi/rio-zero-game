import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { criarCenario, criarLuzes } from "./cenario/cenario.js";
import { criarRafael } from "./personagens/Rafael.js";
import { criarZumbi } from "./personagens/Zumbi.js";
import { Input } from "./teclado.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  400,
);
camera.position.set(0, 18, 22);
const controles = new OrbitControls(camera, renderer.domElement);
controles.target.set(0, 1, 2);
controles.maxPolarAngle = Math.PI / 2.1;

criarLuzes(scene);
const METADE = 16;
criarCenario(scene, METADE);

// Personagens
const rafael = criarRafael();
rafael.position.set(0, 0, 4);
rafael.rotation.y = Math.PI;
scene.add(rafael);

const zumbi1 = criarZumbi(0);
zumbi1.position.set(-3, 0, -3);
zumbi1.rotation.y = 0.4; // virado para o Rafael
const zumbi2 = criarZumbi(1);
zumbi2.position.set(4, 0, -1);
zumbi2.rotation.y = -0.6;
scene.add(zumbi1, zumbi2);

// Ajudas visuais (G), grade de 1 m e eixos (X vermelho, Y verde, Z azul)
const grade = new THREE.GridHelper(METADE * 2, METADE * 2, 0x000000, 0x555555);
grade.position.y = 0.02;
const eixos = new THREE.AxesHelper(3);
eixos.position.y = 0.03;
const ajudas = [grade, eixos];
ajudas.forEach((a) => {
  a.visible = false;
  scene.add(a);
});

const input = new Input();
const relogio = new THREE.Clock();

function atualizar(dt) {
  if (input.wasPressed("KeyG")) ajudas.forEach((a) => (a.visible = !a.visible));
  if (input.wasPressed("KeyC")) {
    controles.target.set(rafael.position.x, 1.2, rafael.position.z);
    camera.position.set(rafael.position.x + 2.5, 2.2, rafael.position.z - 4);
  }

  // Rafael desloca com WASD no plano XZ
  const ax =
    (input.isDown("KeyD", "ArrowRight") ? 1 : 0) -
    (input.isDown("KeyA", "ArrowLeft") ? 1 : 0);
  const az =
    (input.isDown("KeyS", "ArrowDown") ? 1 : 0) -
    (input.isDown("KeyW", "ArrowUp") ? 1 : 0);
  if (ax || az) {
    const len = Math.hypot(ax, az);
    rafael.position.x = THREE.MathUtils.clamp(
      rafael.position.x + (ax / len) * 6 * dt,
      -METADE + 0.6,
      METADE - 0.6,
    );
    rafael.position.z = THREE.MathUtils.clamp(
      rafael.position.z + (az / len) * 6 * dt,
      -METADE + 0.6,
      METADE - 0.6,
    );
    rafael.rotation.y = Math.atan2(ax, az);
  }
  input.endFrame();
}

function loop() {
  atualizar(Math.min(relogio.getDelta(), 0.05));
  controles.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
