// Construtor de humanoides (Rafael e zumbis), todo em código.
// Entrega 4: as caixas da entrega 1 viraram formas arredondadas (RoundedBoxGeometry e cápsulas) e a roupa ganhou
// camadas: camisa por baixo, cinto com fivela, barra da calça, sapato com sola, mão com quatro dedos e polegar e,
// quando pedida, a jaqueta aberta por cima (dois painéis da frente, costas, lapelas, bolsos e gola).
// A hierarquia é a mesma da entrega 1 (quadril → tronco → cabeça e braços; quadril → pernas → joelho), então a
// caminhada, as câmeras e a lanterna continuam presas nos mesmos grupos. As texturas da entrega 3 continuam:
// o UV das caixas arredondadas é calculado em metros por face (uvPorFace), o das cápsulas dá a volta no membro,
// e a cabeça usa o UV da própria geometria, com a imagem do rosto inteira na face da frente.
// As geometrias são criadas uma vez e divididas entre todos os personagens (pesa menos com muitos zumbis).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { escalarUV, materialTexturizado, uvEmMetros, uvPorFace } from "../world/texturas.js";

const TECIDO = 0.5; // os tecidos repetem a cada 50 cm

const GEO = new Map();
const geo = (chave, fazer) => {
  if (!GEO.has(chave)) GEO.set(chave, fazer());
  return GEO.get(chave);
};

export const mat = (cor, extra = {}) => new THREE.MeshLambertMaterial({ color: cor, ...extra });
export const escurecer = (cor, k) => new THREE.Color(cor).multiplyScalar(k);

function peca(geometria, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometria, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.peca = true;
  return m;
}

// Junta as peças paradas de cada articulação numa malha só por material: um zumbi cai de uns 60 desenhos por
// quadro para uns 25. As articulações (quadril, tronco, cabeça, ombros, cotovelos, joelhos) continuam separadas e
// animam igual. Peças marcadas com userData.manter (as do painel de UV) e as de vários materiais ficam de fora.
export function compactarHumanoide(g) {
  const nos = [];
  g.traverse((o) => {
    if (o.children.some((c) => c.isMesh && c.userData.peca)) nos.push(o);
  });
  for (const no of nos) {
    const grupos = new Map();
    for (const c of no.children) {
      if (!c.isMesh || !c.userData.peca || c.userData.manter || Array.isArray(c.material)) continue;
      if (!grupos.has(c.material)) grupos.set(c.material, []);
      grupos.get(c.material).push(c);
    }
    for (const [material, pecas] of grupos) {
      if (pecas.length < 2) continue;
      const chave =
        "j" +
        pecas
          .map((p) => {
            p.updateMatrix();
            return p.geometry.uuid + p.matrix.elements.map((v) => v.toFixed(3)).join(",");
          })
          .join("|");
      // (a caixa arredondada vem sem índice e a cápsula com: tudo vira sem índice para poder juntar)
      const junta = geo(chave, () =>
        mergeGeometries(
          pecas.map((p) => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()).applyMatrix4(p.matrix)),
          false,
        ),
      );
      if (!junta) continue;
      pecas.forEach((p) => no.remove(p));
      no.add(peca(junta, material));
    }
  }
  return g;
}
// caixa de cantos arredondados (r = raio da quina)
export const arred = (w, h, d, r, material, x, y, z) =>
  peca(geo(`a${w},${h},${d},${r}`, () => uvPorFace(new RoundedBoxGeometry(w, h, d, 3, r), TECIDO)), material, x, y, z);
// cápsula: o u dá a volta (perímetro) e o v percorre o comprimento, então o tecido não estica
export const capsula = (r, comp, material, x, y, z) =>
  peca(
    geo(`c${r},${comp}`, () => escalarUV(new THREE.CapsuleGeometry(r, comp, 4, 10), (2 * Math.PI * r) / TECIDO, (comp + 2 * r) / TECIDO)),
    material,
    x,
    y,
    z,
  );
// caixa reta, para os detalhes pequenos (fivela, olhos, lapela)
export const caixa = (w, h, d, material, x, y, z) =>
  peca(geo(`b${w},${h},${d}`, () => uvEmMetros(new THREE.BoxGeometry(w, h, d), TECIDO)), material, x, y, z);

// Material de uma peça: com textura (tingida pela cor da peça) ou só a cor
const materialPeca = (cor, textura) => (textura ? materialTexturizado(textura, { cor }) : mat(cor));

export function criarHumanoide(o = {}) {
  const {
    pele = 0xe0b48c,
    camisa = 0x4a5568,
    calca = 0x2b3a67,
    sapato = 0x1a1a1a,
    cabelo = 0x2b1b12,
    olhos = 0x111111,
    escala = 1,
    jaqueta = null, // cor da jaqueta aberta por cima da camisa (null: só a camisa)
    texturas = {}, // { camisa, calca, rosto, jaqueta }
  } = o;

  const m = {
    pele: mat(pele),
    camisa: materialPeca(camisa, texturas.camisa),
    calca: materialPeca(calca, texturas.calca),
    barra: mat(escurecer(calca, 0.62)),
    gola: mat(escurecer(camisa, 0.7)),
    sapato: mat(sapato),
    sola: mat(0x2a2622),
    cinto: mat(0x3a2a1e),
    metal: mat(0xb8a468),
    cabelo: mat(cabelo),
    olhos: mat(olhos),
  };
  if (jaqueta !== null) {
    m.jaqueta = materialPeca(jaqueta, texturas.jaqueta);
    m.jaquetaEscura = materialPeca(escurecer(jaqueta, 0.7).getHex(), texturas.jaqueta);
  }
  const manga = m.jaqueta ?? m.camisa;
  const g = new THREE.Group();

  // Quadril é a raiz do corpo, a 0,95 m do chão
  const quadril = new THREE.Group();
  quadril.position.y = 0.95;
  g.add(quadril);
  quadril.add(arred(0.64, 0.24, 0.38, 0.08, m.calca, 0, 0.02, 0));

  // Pernas: coxa → joelho (pivô) → canela, barra da calça, sapato e sola
  const perna = (x) => {
    const pivo = new THREE.Group();
    pivo.position.set(x, -0.05, 0);
    const coxa = capsula(0.14, 0.24, m.calca, 0, -0.22, 0);
    const joelho = new THREE.Group();
    joelho.position.y = -0.45;
    const pe = arred(0.26, 0.12, 0.4, 0.045, m.sapato, 0, -0.37, 0.05);
    joelho.add(
      capsula(0.12, 0.22, m.calca, 0, -0.18, 0),
      arred(0.27, 0.06, 0.28, 0.02, m.barra, 0, -0.29, 0),
      pe,
      arred(0.28, 0.04, 0.42, 0.015, m.sola, 0, -0.44, 0.05),
    );
    pivo.add(coxa, joelho);
    quadril.add(pivo);
    return { pivo, joelho, pe, coxa };
  };

  // Tronco: cinto com fivela, cintura, peito e gola da camisa
  const tronco = new THREE.Group();
  tronco.position.y = 0.1;
  quadril.add(tronco);
  const peito = arred(0.72, 0.44, 0.4, 0.1, m.camisa, 0, 0.6, 0);
  tronco.add(
    arred(0.66, 0.07, 0.4, 0.03, m.cinto, 0, 0.07, 0),
    caixa(0.09, 0.06, 0.02, m.metal, 0, 0.07, 0.205),
    arred(0.6, 0.32, 0.36, 0.09, m.camisa, 0, 0.26, 0),
    peito,
    arred(0.36, 0.06, 0.3, 0.02, m.gola, 0, 0.84, 0.02),
  );
  let abaJaqueta = null;
  if (m.jaqueta) {
    // jaqueta aberta: dois painéis na frente (aberta no meio), costas, lapelas, bolsos e gola alta
    [-1, 1].forEach((l) => {
      const painel = arred(0.3, 0.74, 0.06, 0.025, m.jaqueta, l * 0.23, 0.48, 0.2);
      if (l < 0) abaJaqueta = painel;
      const lapela = caixa(0.1, 0.24, 0.02, m.jaquetaEscura, l * 0.13, 0.72, 0.235);
      lapela.rotation.z = l * 0.35;
      tronco.add(painel, lapela, arred(0.13, 0.11, 0.02, 0.01, m.jaquetaEscura, l * 0.24, 0.32, 0.235));
    });
    tronco.add(arred(0.78, 0.74, 0.06, 0.025, m.jaqueta, 0, 0.48, -0.2));
    tronco.add(arred(0.42, 0.08, 0.36, 0.03, m.jaquetaEscura, 0, 0.86, -0.02));
  }

  // Cabeça: crânio arredondado com o rosto na face da frente, queixo, cabelo, olhos, nariz e orelhas
  const pescoco = capsula(0.085, 0.08, m.pele, 0, 0.88, 0);
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.12;
  // A RoundedBoxGeometry guarda as seis faces na ordem da BoxGeometry (+x, -x, +y, -y, +z, -z): a quinta
  // (+z, a frente) recebe a imagem do rosto inteira, com o UV de 0 a 1 que a própria geometria calcula.
  m.rosto = texturas.rosto ? materialTexturizado(texturas.rosto) : m.pele;
  const cranio = peca(geo("cranio", () => new RoundedBoxGeometry(0.44, 0.46, 0.44, 3, 0.09)), [
    m.pele,
    m.pele,
    m.pele,
    m.pele,
    m.rosto,
    m.pele,
  ]);
  const olhoE = caixa(0.07, 0.06, 0.04, m.olhos, -0.1, 0.03, 0.215);
  const olhoD = caixa(0.07, 0.06, 0.04, m.olhos, 0.1, 0.03, 0.215);
  const topoCabelo = arred(0.48, 0.15, 0.48, 0.06, m.cabelo, 0, 0.23, -0.005);
  const nucaCabelo = arred(0.48, 0.32, 0.12, 0.05, m.cabelo, 0, 0.07, -0.19);
  cabeca.add(
    cranio,
    arred(0.36, 0.1, 0.38, 0.04, m.pele, 0, -0.22, 0.01),
    topoCabelo,
    nucaCabelo,
    olhoE,
    olhoD,
    arred(0.07, 0.1, 0.07, 0.025, m.pele, 0, -0.04, 0.235),
    arred(0.05, 0.12, 0.08, 0.02, m.pele, -0.235, 0, 0),
    arred(0.05, 0.12, 0.08, 0.02, m.pele, 0.235, 0, 0),
  );
  tronco.add(pescoco, cabeca);

  // Braços: ombro → braço → cotovelo (pivô) → antebraço → punho → mão com quatro dedos e polegar
  const braco = (x) => {
    const lado = Math.sign(x);
    const pivo = new THREE.Group();
    pivo.position.set(x, 0.72, 0);
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -0.4;
    const mao = new THREE.Group();
    mao.position.y = -0.38;
    mao.add(arred(0.14, 0.12, 0.15, 0.035, m.pele, 0, 0, 0));
    for (let i = 0; i < 4; i++) mao.add(capsula(0.019, 0.06, m.pele, 0, -0.09, -0.055 + i * 0.037));
    const polegar = capsula(0.022, 0.05, m.pele, -lado * 0.07, -0.04, 0.05);
    polegar.rotation.z = lado * 0.5;
    mao.add(polegar);
    const ante = capsula(0.09, 0.2, manga, 0, -0.15, 0);
    cotovelo.add(ante, capsula(0.095, 0.02, m.jaquetaEscura ?? m.gola, 0, -0.29, 0), mao);
    const ombro = arred(0.24, 0.17, 0.27, 0.07, manga, 0, -0.02, 0);
    const sup = capsula(0.1, 0.22, manga, 0, -0.2, 0);
    pivo.add(ombro, sup, cotovelo);
    tronco.add(pivo);
    return { pivo, cotovelo, ombro, sup, ante, mao };
  };

  const pernaE = perna(-0.16);
  const pernaD = perna(0.16);
  const bracoE = braco(-0.46);
  const bracoD = braco(0.46);
  bracoE.pivo.rotation.x = bracoD.pivo.rotation.x = -1.4;

  // as peças que o painel de UV mostra ficam inteiras (não entram na junção)
  [peito, pernaE.coxa, abaJaqueta].forEach((p) => p && (p.userData.manter = true));

  g.scale.setScalar(escala);
  g.userData = {
    quadril,
    tronco,
    cabeca,
    pescoco,
    pernaE,
    pernaD,
    bracoE,
    bracoD,
    olhos: [olhoE, olhoD],
    cabelo: { topo: topoCabelo, nuca: nucaCabelo },
    mats: m,
    abaJaqueta,
    pecas: { cranio, peito, coxa: pernaE.coxa }, // exemplos para o painel de coordenadas UV
  };
  return g;
}
