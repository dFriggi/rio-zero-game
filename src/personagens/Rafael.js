// Rafael, protagonista. Usa humanoide e adiciona: faixa na cabeça, jaqueta, mochila e besta na mão direita.
// Entrega 3: rosto, camisa de malha, calça jeans, jaqueta de couro, mochila e coronha de madeira texturizados.
import * as THREE from "three";
import { criarHumanoide, caixa } from "./Humanoide.js";
import { materialTexturizado } from "../texturas.js";

const mat = (color) => new THREE.MeshLambertMaterial({ color });
const matTex = (textura, cor) => (textura ? materialTexturizado(textura, { cor }) : mat(cor));

// Besta é um cabo e o arco atravessado na ponta
function criarBesta(tex) {
  const besta = new THREE.Group();
  const cabo = caixa(0.08, 0.08, 0.7, matTex(tex.madeira, 0xa06a40));
  cabo.position.z = 0.25;
  const arco = caixa(0.8, 0.05, 0.05, mat(0x2a2a2e));
  arco.position.z = 0.55;
  besta.add(cabo, arco);
  return besta;
}

export function criarRafael(tex = {}) {
  const g = criarHumanoide({
    camisa: 0x3a4250,
    calca: 0x34507f,
    cabelo: 0x2b1b12,
    pele: 0xc99a72,
    texturas: { camisa: tex.malha, calca: tex.jeans, rosto: tex.rostoRafael },
  });
  const u = g.userData;

  // faixa vermelha na cabeça
  const faixa = caixa(0.45, 0.07, 0.45, matTex(tex.malha, 0xc0392b));
  faixa.position.y = 0.15;
  u.cabeca.add(faixa);

  // jaqueta são duas abas sobre o peito
  const jaqueta = matTex(tex.couro, 0xffffff);
  const abaE = caixa(0.26, 0.82, 0.42, jaqueta);
  abaE.position.set(-0.24, 0.4, 0.005);
  const abaD = abaE.clone();
  abaD.position.x = 0.24;
  u.tronco.add(abaE, abaD);
  u.abaJaqueta = abaE;

  // mochila
  const mochila = caixa(0.5, 0.58, 0.24, matTex(tex.malha, 0x6b8a3a));
  mochila.position.set(0, 0.48, -0.33);
  u.tronco.add(mochila);

  // besta na mão direita, apontando na direção do braço
  const besta = criarBesta(tex);
  besta.position.set(0, -0.4, 0.05);
  besta.rotation.x = Math.PI / 2;
  u.bracoD.cotovelo.add(besta);

  return g;
}
