// Texturas da entrega 3. As imagens ficam em texturas/ e são desenhadas pelo script
// ferramentas/gerar_texturas.py (nada de foto ou arte de terceiros).
//
// Para a textura não esticar, as coordenadas UV dos objetos são calculadas em metros:
// u e v crescem 1 a cada "metros" de superfície, então uma pedrinha do calçadão tem o mesmo
// tamanho em qualquer lugar da orla, e um quadrado da imagem continua quadrado no objeto.
import * as THREE from "three";

// chave → arquivo, quantos metros uma imagem cobre, e se é mapa de relevo (cinza, sem cor)
export const CATALOGO = {
  calcadao: { arquivo: "calcadao.png", metros: 3, nome: "Calçadão de ondas" },
  calcadaoRelevo: { arquivo: "calcadao_relevo.png", metros: 3, nome: "Relevo do calçadão", relevo: true },
  asfalto: { arquivo: "asfalto.jpg", metros: 4, nome: "Asfalto" },
  areia: { arquivo: "areia.jpg", metros: 3, nome: "Areia" },
  reboco: { arquivo: "reboco.jpg", metros: 6.4, nome: "Reboco das fachadas" },
  concreto: { arquivo: "concreto.jpg", metros: 1, nome: "Concreto" },
  concretoRelevo: { arquivo: "concreto_relevo.png", metros: 1, nome: "Relevo do concreto", relevo: true },
  madeira: { arquivo: "madeira.jpg", metros: 1.5, nome: "Madeira" },
  telha: { arquivo: "telha.jpg", metros: 1, nome: "Telha" },
  lataria: { arquivo: "lataria.jpg", metros: 2, nome: "Lataria" },
  tronco: { arquivo: "tronco.jpg", metros: 1, nome: "Tronco de coqueiro" },
  jeans: { arquivo: "jeans.jpg", metros: 0.5, nome: "Jeans" },
  couro: { arquivo: "couro.jpg", metros: 0.5, nome: "Couro" },
  malha: { arquivo: "malha.jpg", metros: 0.5, nome: "Malha" },
  camisaRasgada: { arquivo: "camisa_rasgada.png", metros: 0.6, nome: "Camisa rasgada" },
  rostoRafael: { arquivo: "rosto_rafael.png", metros: null, nome: "Rosto do Rafael" },
  rostoZumbi: { arquivo: "rosto_zumbi.png", metros: null, nome: "Rosto do zumbi" },
  gradeUV: { arquivo: "grade_uv.png", metros: null, nome: "Grade UV" },
};

export async function carregarTexturas(renderer) {
  const loader = new THREE.TextureLoader();
  const anisotropia = renderer.capabilities.getMaxAnisotropy();
  const pares = await Promise.all(
    Object.entries(CATALOGO).map(async ([chave, info]) => {
      const tex = await loader.loadAsync("texturas/" + info.arquivo);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = anisotropia;
      tex.colorSpace = info.relevo ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      tex.name = chave;
      tex.userData.corMedia = corMedia(tex.image);
      return [chave, tex];
    }),
  );
  return Object.fromEntries(pares);
}

// cor média da imagem (usada no modo "sem textura", para comparar com a mesma cor de fundo)
function corMedia(imagem) {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(imagem, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

// ---------------------------------------------------------------------------------------------
// Coordenadas UV em metros
// ---------------------------------------------------------------------------------------------
// Para cada vértice, olha para que lado a face aponta (a normal) e usa as duas coordenadas da
// posição que ficam "deitadas" naquela face. As faces laterais ficam com v para cima, então a
// textura nunca aparece de cabeça para baixo.
export function uvEmMetros(geometria, metros) {
  const pos = geometria.attributes.position;
  const nor = geometria.attributes.normal;
  const uv = geometria.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    let u;
    let v;
    if (ax >= ay && ax >= az) {
      u = nx > 0 ? -z : z;
      v = y;
    } else if (az >= ay) {
      u = nz > 0 ? x : -x;
      v = y;
    } else {
      u = x;
      v = ny > 0 ? -z : z;
    }
    uv.setXY(i, u / metros, v / metros);
  }
  uv.needsUpdate = true;
  return geometria;
}

// Entrega 4: o mesmo cálculo para as caixas arredondadas (RoundedBoxGeometry) dos personagens.
// Na quina arredondada a normal vai virando aos poucos, e escolher o eixo pela normal de cada vértice
// faria a imagem pular no meio da curva. Aqui o eixo vem da face a que o vértice pertence: a geometria
// guarda as seis faces em ordem (+x, -x, +y, -y, +z, -z), com o mesmo número de vértices em cada uma,
// então a imagem continua sem emenda até a beirada da face.
const NORMAIS_FACE = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export function uvPorFace(geometria, metros) {
  const pos = geometria.attributes.position;
  const uv = geometria.attributes.uv;
  const porFace = pos.count / 6;
  for (let i = 0; i < pos.count; i++) {
    const [nx, ny, nz] = NORMAIS_FACE[Math.min(5, Math.floor(i / porFace))];
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u;
    let v;
    if (nx !== 0) {
      u = nx > 0 ? -z : z;
      v = y;
    } else if (nz !== 0) {
      u = nz > 0 ? x : -x;
      v = y;
    } else {
      u = x;
      v = ny > 0 ? -z : z;
    }
    uv.setXY(i, u / metros, v / metros);
  }
  uv.needsUpdate = true;
  return geometria;
}

// Multiplica as coordenadas UV (cápsulas e cilindros: o u dá a volta e o v percorre o comprimento)
export function escalarUV(geometria, su, sv) {
  const uv = geometria.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geometria;
}

// ---------------------------------------------------------------------------------------------
// Materiais texturizados e os modos da demonstração (com textura, sem textura e grade UV)
// ---------------------------------------------------------------------------------------------
const registrados = [];
// modo atual: os zumbis que surgem no meio da partida já nascem no modo escolhido
let modoAtual = "normal";
let gradeAtual = null;

export function materialTexturizado(mapa, { cor = 0xffffff, relevo = null, escalaRelevo = 1 } = {}) {
  const material = new THREE.MeshLambertMaterial({ color: cor, map: mapa, bumpMap: relevo, bumpScale: escalaRelevo });
  material.userData.textura = mapa.name; // o painel de UV usa para achar as faces com esta textura
  const r = { material, mapa, relevo, cor: material.color.clone() };
  registrados.push(r);
  if (modoAtual !== "normal") aplicarModo(r);
  return material;
}

function aplicarModo(r) {
  const m = r.material;
  if (modoAtual === "uv") {
    m.map = gradeAtual;
    m.bumpMap = null;
    m.color.set(0xffffff);
  } else if (modoAtual === "sem") {
    m.map = null;
    m.bumpMap = null;
    m.color.copy(r.cor).multiply(r.mapa.userData.corMedia);
  } else {
    m.map = r.mapa;
    m.bumpMap = r.relevo;
    m.color.copy(r.cor);
  }
  m.needsUpdate = true;
}

export function definirModoTextura(modo, gradeUV) {
  modoAtual = modo;
  gradeAtual = gradeUV;
  for (const r of registrados) aplicarModo(r);
}
