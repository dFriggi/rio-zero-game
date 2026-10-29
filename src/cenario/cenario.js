// arena é um quadrado de 32 x 32 m centrado na origem.
import * as THREE from "three";

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function caixa(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function criarQuiosque(scene, x, z, rotY) {
  const g = new THREE.Group();
  g.add(caixa(3, 2.2, 3, mat(0x9a6a3a), 0, 1.1, 0));
  const telhado = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 1.2, 4),
    mat(0xc0392b),
  );
  telhado.position.y = 2.8;
  telhado.rotation.y = Math.PI / 4;
  g.add(telhado);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function criarCarro(scene, x, z, rotY) {
  const g = new THREE.Group();
  const lataria = mat(0x8a1c1c);
  g.add(caixa(1.8, 0.8, 4.2, lataria, 0, 0.6, 0));
  g.add(caixa(1.6, 0.6, 2.2, lataria, 0, 1.3, -0.2));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function criarBarricada(scene, x, z, rotY) {
  const g = new THREE.Group();
  const concreto = mat(0x8d8f94);
  for (let i = 0; i < 3; i++)
    g.add(caixa(1, 0.9, 0.8, concreto, -1.1 + i * 1.1, 0.45, 0));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function criarPoste(scene, x, z) {
  const poste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 5, 8),
    mat(0x2b2d33),
  );
  poste.position.set(x, 2.5, z);
  scene.add(poste);
}

export function criarCenario(scene, metade = 16) {
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(metade * 2, metade * 2),
    mat(0xbdbdbd),
  );
  piso.rotation.x = -Math.PI / 2;
  scene.add(piso);

  const muro = mat(0x777777);
  scene.add(
    caixa(metade * 2 + 2, 1.1, 1, muro, 0, 0.55, -metade - 0.5),
    caixa(metade * 2 + 2, 1.1, 1, muro, 0, 0.55, metade + 0.5),
    caixa(1, 1.1, metade * 2 + 2, muro, -metade - 0.5, 0.55, 0),
    caixa(1, 1.1, metade * 2 + 2, muro, metade + 0.5, 0.55, 0),
  );

  criarQuiosque(scene, -9, -7, 0);
  criarQuiosque(scene, 10, 8, Math.PI);
  criarCarro(scene, 8, -6, 0.6);
  criarBarricada(scene, -6, 6, -0.3);
  criarBarricada(scene, 3, -11, 0.2);
  [
    [-14, -14],
    [14, -14],
    [-14, 14],
    [14, 14],
  ].forEach(([x, z]) => criarPoste(scene, x, z));
}

export function criarLuzes(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(-10, 20, 10);
  scene.add(sol);
}
