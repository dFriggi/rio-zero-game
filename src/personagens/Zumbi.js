// Usa a humanoide, com pele esverdeada, olhos vermelhos, camisa rasgada, sangue e um pé sem chinelo.
// Entrega 3: rosto de zumbi, camisa rasgada e manchada e calça jeans texturizados.
import * as THREE from "three";
import { criarHumanoide, caixa } from "./Humanoide.js";

const mat = (color) => new THREE.MeshLambertMaterial({ color });

export function criarZumbi(variacao = 0, tex = {}) {
  const camisas = [0xff6f91, 0xf2c14e];
  const g = criarHumanoide({
    pele: 0x8fa391,
    camisa: camisas[variacao % camisas.length],
    calca: 0x2a9d8f,
    sapato: 0xd9c9a3,
    cabelo: 0x3b2f2f,
    olhos: 0xaa0000,
    texturas: { camisa: tex.camisaRasgada, calca: tex.jeans, rosto: tex.rostoZumbi },
  });
  const u = g.userData;

  // camisa rasgada são tiras soltas na barra e um buraco mostrando a pele
  [-0.22, -0.05, 0.14, 0.25].forEach((x, i) => {
    const tira = caixa(0.1, 0.12 + (i % 2) * 0.08, 0.03, u.mats.camisa);
    tira.position.set(x, -0.02 - (i % 2) * 0.04, 0.17);
    tira.rotation.z = (i - 1.5) * 0.15;
    u.tronco.add(tira);
  });
  const buraco = caixa(0.16, 0.14, 0.02, u.mats.pele);
  buraco.position.set(0.14, 0.55, 0.205);
  u.tronco.add(buraco);

  // ferida no rosto e sangue seco na camisa
  const sangue = mat(0x5a0d0d);
  const ferida = caixa(0.1, 0.06, 0.02, sangue);
  ferida.position.set(0.1, -0.12, 0.215);
  u.cabeca.add(ferida);
  const mancha = caixa(0.22, 0.18, 0.02, sangue);
  mancha.position.set(-0.15, 0.4, 0.205);
  u.tronco.add(mancha);

  // chinelo no pé direito, o pé esquerdo fica com a cor da pele
  u.pernaE.pe.material = u.mats.pele;

  return g;
}
