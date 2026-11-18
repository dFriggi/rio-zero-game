// Modelos das armas, em código. O mesmo modelo vai na mão do Rafael (terceira pessoa e câmeras de fora) e na
// vista em primeira pessoa (entities/Arma.js). Convenção: o cano aponta para +z e a origem fica onde a mão
// direita segura, então encaixar na mão é só pôr o grupo no lugar da mão.
//   besta: coronha de madeira, trilho, arco de duas lâminas, corda que estica e solta, virote carregado e a
//          lanterna presa embaixo (a luz de verdade fica em world/lights.js)
//   pistola: ferrolho que corre para trás no tiro, armação, cabo inclinado e as massas de mira
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { materialTexturizado, uvPorFace } from "../world/texturas.js";

const mat = (cor, extra = {}) => new THREE.MeshLambertMaterial({ color: cor, ...extra });

function peca(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const arred = (w, h, d, r, material, x = 0, y = 0, z = 0) =>
  peca(uvPorFace(new RoundedBoxGeometry(w, h, d, 2, r), 0.5), material, x, y, z);
const caixa = (w, h, d, material, x = 0, y = 0, z = 0) => peca(new THREE.BoxGeometry(w, h, d), material, x, y, z);
const cilindro = (r, comp, material, x = 0, y = 0, z = 0) => {
  const m = peca(new THREE.CylinderGeometry(r, r, comp, 10), material, x, y, z);
  m.rotation.x = Math.PI / 2; // deitado ao longo de z
  return m;
};

// Virote (também usado pelos projéteis): haste, ponta de metal e duas penas. Comprimento ao longo de +z.
export function modeloVirote() {
  const g = new THREE.Group();
  const haste = cilindro(0.012, 0.46, mat(0x7a5a3a), 0, 0, 0);
  const ponta = peca(new THREE.ConeGeometry(0.026, 0.08, 6), mat(0x9aa0a8), 0, 0, 0.27);
  ponta.rotation.x = Math.PI / 2;
  const pena = caixa(0.004, 0.05, 0.1, mat(0xc0392b), 0, 0, -0.18);
  const pena2 = pena.clone();
  pena2.rotation.z = Math.PI / 2;
  g.add(haste, ponta, pena, pena2);
  return g;
}

export function modeloBesta(tex = {}) {
  const g = new THREE.Group();
  const madeira = tex.madeira ? materialTexturizado(tex.madeira, { cor: 0xb07a4a }) : mat(0xa06a40);
  const metal = mat(0x2a2a2e);
  const metalClaro = mat(0x6a6e76);
  // coronha e trilho
  g.add(arred(0.07, 0.09, 0.62, 0.02, madeira, 0, 0, 0.12));
  g.add(arred(0.06, 0.1, 0.12, 0.02, madeira, 0, -0.07, -0.02)); // empunhadura
  g.add(caixa(0.032, 0.014, 0.5, metal, 0, 0.052, 0.2));
  g.add(caixa(0.018, 0.04, 0.03, metalClaro, 0, -0.05, 0.06)); // gatilho
  g.add(caixa(0.02, 0.03, 0.02, metal, 0, 0.075, 0.0)); // mira de trás
  // arco: duas lâminas que varrem para trás, presas na ponta
  const laminas = [-1, 1].map((l) => {
    const lam = arred(0.3, 0.032, 0.045, 0.012, metal, l * 0.15, 0.04, 0.4);
    lam.rotation.y = l * 0.32;
    g.add(lam);
    return lam;
  });
  g.add(arred(0.08, 0.06, 0.06, 0.015, metalClaro, 0, 0.04, 0.44)); // encaixe do arco
  // corda: dois segmentos das pontas das lâminas até o meio (que vai para trás quando a besta está armada)
  const pontas = laminas.map((_, i) => new THREE.Vector3((i ? 1 : -1) * 0.29, 0.045, 0.35));
  const matCorda = mat(0xd8d2c4);
  const segmentos = pontas.map(() => {
    const s = caixa(0.006, 0.006, 1, matCorda);
    g.add(s);
    return s;
  });
  const meio = new THREE.Vector3();
  function esticar(tensao) {
    meio.set(0, 0.045, THREE.MathUtils.lerp(0.35, 0.1, tensao));
    segmentos.forEach((s, i) => {
      const p = pontas[i];
      s.position.copy(p).add(meio).multiplyScalar(0.5);
      s.scale.z = p.distanceTo(meio);
      s.rotation.set(0, Math.atan2(meio.x - p.x, meio.z - p.z), 0); // o eixo z da caixa aponta da ponta ao meio
    });
  }
  // virote carregado, deitado no trilho
  const virote = modeloVirote();
  virote.position.set(0, 0.07, 0.34);
  g.add(virote);
  // lanterna embaixo da ponta
  const lanterna = cilindro(0.028, 0.12, metal, 0, -0.065, 0.36);
  const lente = cilindro(0.024, 0.01, mat(0xfff4dc, { emissive: 0xfff4dc, emissiveIntensity: 0.6 }), 0, -0.065, 0.425);
  g.add(lanterna, lente);
  // pontos de referência: boca (de onde sai o virote) e ponta (onde a luz da lanterna fica)
  const boca = new THREE.Object3D();
  boca.position.set(0, 0.07, 0.6);
  const ponta = new THREE.Object3D();
  ponta.position.set(0, -0.065, 0.44);
  g.add(boca, ponta);
  esticar(1);
  g.userData = { boca, ponta, virote, esticar, lente };
  return g;
}

export function modeloPistola() {
  const g = new THREE.Group();
  const metal = mat(0x26272b);
  const cabo = mat(0x3a3530);
  const ferrolho = arred(0.046, 0.05, 0.2, 0.01, metal, 0, 0.075, 0.07);
  g.add(ferrolho);
  g.add(arred(0.04, 0.035, 0.17, 0.008, mat(0x34363c), 0, 0.035, 0.06));
  const empunhadura = arred(0.042, 0.12, 0.066, 0.012, cabo, 0, -0.03, -0.01);
  empunhadura.rotation.x = -0.25;
  g.add(empunhadura);
  g.add(caixa(0.012, 0.012, 0.06, metal, 0, -0.005, 0.07)); // guarda-mato
  g.add(caixa(0.01, 0.025, 0.01, metal, 0, 0.01, 0.045)); // gatilho
  ferrolho.add(caixa(0.008, 0.014, 0.01, mat(0xd8d2c4), 0, 0.03, 0.09)); // massa da frente
  ferrolho.add(caixa(0.03, 0.012, 0.01, metal, 0, 0.03, -0.09)); // alça de mira
  const boca = new THREE.Object3D();
  boca.position.set(0, 0.075, 0.18);
  const ponta = new THREE.Object3D();
  ponta.position.set(0, 0.02, 0.16);
  g.add(boca, ponta);
  g.userData = { boca, ponta, ferrolho, ferrolhoZ: 0.07 };
  return g;
}

export const MODELOS = { besta: modeloBesta, pistola: modeloPistola };
