// Rafael Duarte, o protagonista: humanoide arredondado com a jaqueta de couro aberta por cima da camisa de malha,
// calça jeans, faixa vermelha na cabeça e a mochila com alças. Entrega 4: duas armas. A que está em uso fica na
// mão direita (a lanterna vai junto); a outra fica guardada no corpo, a besta atravessada nas costas e a pistola
// no coldre do quadril. Na câmera de primeira pessoa o corpo some e entram as mãos de entities/Arma.js.
import * as THREE from "three";
import { criarHumanoide, arred, caixa, mat } from "./Humanoid.js";
import { materialTexturizado } from "../world/texturas.js";
import { modeloBesta, modeloPistola } from "./modelosArmas.js";

const matTex = (textura, cor) => (textura ? materialTexturizado(textura, { cor }) : mat(cor));

export function criarRafael(tex = {}) {
  const g = criarHumanoide({
    camisa: 0x3a4250,
    calca: 0x34507f,
    cabelo: 0x2b1b12,
    pele: 0xc99a72,
    jaqueta: 0xffffff,
    texturas: { camisa: tex.malha, calca: tex.jeans, rosto: tex.rostoRafael, jaqueta: tex.couro },
  });
  const u = g.userData;

  // faixa vermelha na cabeça, com as pontas do nó caindo atrás
  const faixa = matTex(tex.malha, 0xc0392b);
  u.cabeca.add(arred(0.47, 0.07, 0.47, 0.03, faixa, 0, 0.15, 0));
  [-0.05, 0.05].forEach((x, i) => {
    const ponta = caixa(0.05, 0.16, 0.02, faixa, x, 0.06, -0.25);
    ponta.rotation.z = (i ? -1 : 1) * 0.25;
    u.cabeca.add(ponta);
  });

  // mochila com bolso e as duas alças passando pelos ombros
  const lona = matTex(tex.malha, 0x6b8a3a);
  const alca = mat(0x2e3a22);
  u.tronco.add(
    arred(0.5, 0.58, 0.24, 0.06, lona, 0, 0.5, -0.36),
    arred(0.36, 0.22, 0.08, 0.03, lona, 0, 0.36, -0.5),
    ...[-1, 1].flatMap((l) => [caixa(0.07, 0.04, 0.5, alca, l * 0.17, 0.86, -0.02), caixa(0.07, 0.5, 0.03, alca, l * 0.17, 0.6, 0.245)]),
  );

  // armas: uma na mão, a outra guardada
  const naMao = { besta: modeloBesta(tex), pistola: modeloPistola() };
  const mao = u.bracoD.cotovelo;
  for (const arma of Object.values(naMao)) {
    arma.position.set(0, -0.4, 0.02);
    arma.rotation.x = Math.PI / 2; // o cano (+z do modelo) vai ao longo do antebraço
    mao.add(arma);
  }
  const costas = new THREE.Group(); // besta atravessada nas costas, por cima da mochila
  costas.position.set(0, 0.5, -0.52);
  costas.rotation.z = 0.7;
  const bestaGuardada = modeloBesta(tex);
  bestaGuardada.rotation.x = -Math.PI / 2;
  bestaGuardada.position.y = -0.15;
  costas.add(bestaGuardada);
  u.tronco.add(costas);
  const coldre = new THREE.Group(); // pistola no coldre do quadril direito
  coldre.position.set(0.37, -0.02, 0.02);
  const pistolaGuardada = modeloPistola();
  pistolaGuardada.rotation.x = Math.PI / 2;
  coldre.add(pistolaGuardada, arred(0.06, 0.2, 0.09, 0.02, mat(0x3a2a1e), 0, -0.06, 0.0));
  u.quadril.add(coldre);
  const guardadas = { besta: costas, pistola: pistolaGuardada };

  // a lanterna (luz de verdade, em world/lights.js) fica presa neste ponto, que acompanha a arma da mão
  const ponta = new THREE.Object3D();
  mao.add(ponta);

  u.armas = naMao;
  u.ponta = ponta;
  u.mostrarArma = (id) => {
    for (const [nome, modelo] of Object.entries(naMao)) modelo.visible = nome === id;
    for (const [nome, guardada] of Object.entries(guardadas)) guardada.visible = nome !== id;
    // a ponta vai para a frente da arma em uso: o ponto (0, y, z) da arma vira (0, -0,4 - z, 0,02 + y) no antebraço
    const p = naMao[id].userData.ponta.position;
    ponta.position.set(0, -0.4 - p.z, 0.02 + p.y);
  };
  u.mostrarArma("besta");
  return g;
}
