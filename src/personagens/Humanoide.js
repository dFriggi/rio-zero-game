import * as THREE from "three";
import { escalarUV, materialTexturizado, uvEmMetros } from "../texturas.js";

const mat = (color) => new THREE.MeshLambertMaterial({ color });

// Tecidos repetem a cada 50 cm. Nas caixas, o UV é calculado em metros; nas cápsulas, o u dá a
// volta no membro (perímetro) e o v percorre o comprimento, então o tecido não estica.
const TECIDO = 0.5;
export const caixa = (w, h, d, material) =>
  new THREE.Mesh(uvEmMetros(new THREE.BoxGeometry(w, h, d), TECIDO), material);
export const capsula = (r, comp, material) =>
  new THREE.Mesh(
    escalarUV(new THREE.CapsuleGeometry(r, comp, 4, 8), (2 * Math.PI * r) / TECIDO, (comp + 2 * r) / TECIDO),
    material,
  );

// Material de uma peça: com textura (tingida pela cor da peça) ou só a cor, como na entrega 1
const materialPeca = (cor, textura) => (textura ? materialTexturizado(textura, { cor }) : mat(cor));
export const esfera = (r, material) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material);
export const cilindro = (rt, rb, h, material, lados = 10) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, lados), material);

export function criarHumanoide(o = {}) {
  const {
    pele = 0xe0b48c,
    camisa = 0x4a5568,
    calca = 0x2b3a67,
    sapato = 0x1a1a1a,
    cabelo = 0x2b1b12,
    olhos = 0x111111,
    escala = 1,
    texturas = {}, // { camisa, calca, rosto }
  } = o;

  const m = {
    pele: mat(pele),
    camisa: materialPeca(camisa, texturas.camisa),
    calca: materialPeca(calca, texturas.calca),
    sapato: mat(sapato),
    cabelo: mat(cabelo),
    olhos: mat(olhos),
  };
  const g = new THREE.Group();

  // Quadril é a raiz do corpo, a 0.95 m do chão
  const quadril = new THREE.Group();
  quadril.position.y = 0.95;
  g.add(quadril);
  const bacia = caixa(0.62, 0.22, 0.36, m.calca);
  quadril.add(bacia);

  // Pernas são coxa e canela em cápsulas, joelho como pivô
  const perna = (x) => {
    const pivo = new THREE.Group();
    pivo.position.set(x, -0.05, 0);
    const coxa = capsula(0.13, 0.28, m.calca);
    coxa.position.y = -0.22;
    const joelho = new THREE.Group();
    joelho.position.y = -0.45;
    const canela = capsula(0.11, 0.26, m.calca);
    canela.position.y = -0.2;
    const pe = caixa(0.2, 0.1, 0.34, m.sapato);
    pe.position.set(0, -0.42, 0.06);
    joelho.add(canela, pe);
    pivo.add(coxa, joelho);
    quadril.add(pivo);
    return { pivo, joelho, pe, coxa };
  };

  // Tronco é uma caixa um pouco mais larga em cima
  const tronco = new THREE.Group();
  tronco.position.y = 0.1;
  quadril.add(tronco);
  const barriga = caixa(0.6, 0.4, 0.34, m.camisa);
  barriga.position.y = 0.2;
  const peito = caixa(0.72, 0.42, 0.4, m.camisa);
  peito.position.y = 0.58;
  tronco.add(barriga, peito);

  // Cabeça
  const pescoco = cilindro(0.08, 0.09, 0.14, m.pele, 8);
  pescoco.position.y = 0.85;
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.12;
  // O crânio usa o UV padrão da caixa (cada face vai de 0 a 1), e a face da frente (+z, a 5ª da
  // lista de materiais) recebe a textura do rosto inteira; as outras faces ficam com a pele.
  m.rosto = texturas.rosto ? materialTexturizado(texturas.rosto) : m.pele;
  const cranio = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.42), [
    m.pele,
    m.pele,
    m.pele,
    m.pele,
    m.rosto,
    m.pele,
  ]);
  const topoCabelo = caixa(0.46, 0.14, 0.46, m.cabelo);
  topoCabelo.position.y = 0.25;
  const nucaCabelo = caixa(0.46, 0.3, 0.1, m.cabelo);
  nucaCabelo.position.set(0, 0.08, -0.19);
  const olhoE = esfera(0.04, m.olhos);
  olhoE.position.set(-0.1, 0.04, 0.21);
  const olhoD = olhoE.clone();
  olhoD.position.x = 0.1;
  const nariz = caixa(0.07, 0.1, 0.07, m.pele);
  nariz.position.set(0, -0.04, 0.23);
  const orelhaE = caixa(0.05, 0.12, 0.08, m.pele);
  orelhaE.position.set(-0.23, 0, 0);
  const orelhaD = orelhaE.clone();
  orelhaD.position.x = 0.23;
  cabeca.add(
    cranio,
    topoCabelo,
    nucaCabelo,
    olhoE,
    olhoD,
    nariz,
    orelhaE,
    orelhaD,
  );
  tronco.add(pescoco, cabeca);

  // Braços são ombro (esfera), braço, cotovelo, antebraço, mão
  const braco = (x) => {
    const pivo = new THREE.Group();
    pivo.position.set(x, 0.72, 0);
    const ombro = esfera(0.12, m.camisa);
    const sup = capsula(0.09, 0.24, m.camisa);
    sup.position.y = -0.2;
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -0.4;
    const ante = capsula(0.08, 0.22, m.pele);
    ante.position.y = -0.17;
    const mao = caixa(0.13, 0.15, 0.1, m.pele);
    mao.position.y = -0.38;
    cotovelo.add(ante, mao);
    pivo.add(ombro, sup, cotovelo);
    tronco.add(pivo);
    return { pivo, cotovelo };
  };

  const pernaE = perna(-0.16),
    pernaD = perna(0.16);
  const bracoE = braco(-0.46),
    bracoD = braco(0.46);

  bracoE.pivo.rotation.x = bracoD.pivo.rotation.x = -1.4;

  g.scale.setScalar(escala);
  g.userData = {
    quadril,
    tronco,
    cabeca,
    pernaE,
    pernaD,
    bracoE,
    bracoD,
    mats: m,
    pecas: { cranio, peito, coxa: pernaE.coxa }, // exemplos para o painel de coordenadas UV
  };
  return g;
}
