// Cenário da fase 1: a orla de Copacabana à noite.
// O eixo x corre ao longo da praia; -z vai para a cidade (prédios e avenida) e +z para o mar.
// Os objetos da entrega 1 (quiosque, carro, barricada e poste) continuam aqui, agora no lugar deles na orla.
import * as THREE from "three";
import { CATALOGO, escalarUV, materialTexturizado, uvEmMetros } from "../texturas.js";

// Texturas carregadas (criarCenario recebe) e um objeto de exemplo de cada uma, para o painel
// mostrar as coordenadas UV.
let T = null;
const exemplos = {};
const lembrar = (chave, mesh) => {
  if (!exemplos[chave]) exemplos[chave] = mesh;
  return mesh;
};

// Material texturizado, um por combinação de textura e cor (a cor tinge as texturas em cinza)
const materiaisTex = new Map();
function matT(chave, cor = 0xffffff, relevo = null, escalaRelevo = 1) {
  const k = `${chave}:${cor}`;
  if (!materiaisTex.has(k)) {
    materiaisTex.set(k, materialTexturizado(T[chave], { cor, relevo: relevo && T[relevo], escalaRelevo }));
  }
  return materiaisTex.get(k);
}

// Caixa texturizada: as coordenadas UV são recalculadas em metros (a textura não estica)
function caixaT(w, h, d, chave, cor, x, y, z, relevo = null) {
  const geo = uvEmMetros(new THREE.BoxGeometry(w, h, d), CATALOGO[chave].metros);
  const m = new THREE.Mesh(geo, matT(chave, cor, relevo, 2));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Gerador pseudoaleatório com semente: o cenário sai igual toda vez (bom para comparar prints).
function semente(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const aleatorio = semente(2026);

// Um material por cor, reaproveitado por todos os objetos daquela cor.
const materiais = new Map();
const mat = (color) => {
  if (!materiais.has(color)) materiais.set(color, new THREE.MeshLambertMaterial({ color }));
  return materiais.get(color);
};

function caixa(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sombras(grupo) {
  grupo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// Faixas do chão, de um lado ao outro da orla, com a textura repetindo a cada "metros" do catálogo.
const LARGURA = 420;
function faixa(z0, z1, chave, cor = 0xffffff, y = 0, relevo = null) {
  const geo = uvEmMetros(new THREE.PlaneGeometry(LARGURA, z1 - z0), CATALOGO[chave].metros);
  const m = new THREE.Mesh(geo, matT(chave, cor, relevo, 1.5));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return lembrar(chave, m);
}

// Onde cada parte da orla começa e termina (em z).
export const ZONAS = {
  fachada: -30,
  calcadaPredios: [-30, -26],
  avenida: [-26, -14],
  calcadao: [-14, 6],
  areia: [6, 46],
  mar: 43,
};

// ---------------------------------------------------------------------------------------------
// Céu, estrelas e morros ao fundo
// ---------------------------------------------------------------------------------------------
export const COR_HORIZONTE = 0x1b2440;

function criarCeu(scene) {
  // esfera por dentro, com degradê do horizonte (mais claro, brilho da cidade) para o topo (quase preto)
  const geo = new THREE.SphereGeometry(500, 32, 16);
  const pos = geo.attributes.position;
  const topo = new THREE.Color(0x03050c);
  const horizonte = new THREE.Color(COR_HORIZONTE);
  const embaixo = new THREE.Color(0x07080c); // abaixo do horizonte (só aparece na vista ortográfica)
  const c = new THREE.Color();
  const cores = [];
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 500;
    if (h >= 0) c.copy(horizonte).lerp(topo, Math.pow(h, 0.55));
    else c.copy(horizonte).lerp(embaixo, Math.pow(-h, 0.3));
    cores.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
  const ceu = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  ceu.renderOrder = -1;
  scene.add(ceu);

  const n = 700;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ang = aleatorio() * Math.PI * 2;
    const y = 0.12 + aleatorio() * 0.88;
    const r = Math.sqrt(1 - y * y);
    p.set([Math.cos(ang) * r * 470, y * 470, Math.sin(ang) * r * 470], i * 3);
  }
  const geoEstrelas = new THREE.BufferGeometry();
  geoEstrelas.setAttribute("position", new THREE.BufferAttribute(p, 3));
  scene.add(
    new THREE.Points(
      geoEstrelas,
      new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }),
    ),
  );
}

function criarMorros(scene) {
  // silhuetas escuras sem névoa: Arpoador e Forte de um lado, Leme do outro, e os morros atrás dos prédios
  const material = new THREE.MeshBasicMaterial({ color: 0x090d16, fog: false });
  const morro = (x, z, r, h, sx) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), material);
    m.scale.set(sx, h / r, 1);
    m.position.set(x, 0, z);
    scene.add(m);
  };
  morro(-250, 40, 55, 50, 1.2);
  morro(-300, -70, 80, 85, 1.0);
  morro(260, 20, 55, 72, 0.9);
  morro(320, -90, 90, 110, 1.1);
  morro(-90, -230, 90, 95, 1.6);
  morro(100, -250, 100, 125, 1.4);
}

// ---------------------------------------------------------------------------------------------
// Prédios da Avenida Atlântica, com janelas acesas e apagadas
// ---------------------------------------------------------------------------------------------
function criarPredios(scene) {
  const cores = [0xb3a58f, 0x8f979e, 0xc19f86, 0x858893, 0xa39583, 0xcbbfa8, 0x9c8b7a];
  const acesas = [];
  const apagadas = [];
  const m4 = new THREE.Matrix4();
  const frente = ZONAS.fachada;
  let x = -205;
  let i = 0;
  while (x < 205) {
    const larg = 10 + aleatorio() * 9;
    const alt = 15 + aleatorio() * 32;
    const prof = 14;
    // a caixa sobe para começar no chão: assim o y local é a altura de verdade e as faixas das
    // lajes na textura (a cada 3,2 m) caem entre as janelas em todos os prédios
    const geo = new THREE.BoxGeometry(larg, alt, prof).translate(0, alt / 2, 0);
    uvEmMetros(geo, CATALOGO.reboco.metros);
    const predio = new THREE.Mesh(geo, matT("reboco", cores[i % cores.length]));
    predio.position.set(x + larg / 2, 0, frente - prof / 2);
    predio.receiveShadow = true;
    if (x > -12 && x < 8) lembrar("reboco", predio);
    scene.add(predio);

    // a cidade está quase sem energia: alguns prédios apagados, outros com poucas janelas acesas
    const chanceAcesa = aleatorio() < 0.3 ? 0 : 0.06 + aleatorio() * 0.22;
    const colunas = Math.floor((larg - 1.6) / 2.4);
    const andares = Math.floor((alt - 4) / 3.2);
    const margem = (larg - colunas * 2.4) / 2;
    for (let a = 0; a < andares; a++) {
      for (let c = 0; c < colunas; c++) {
        m4.makeTranslation(x + margem + 1.2 + c * 2.4, 3.6 + a * 3.2, frente + 0.02);
        (aleatorio() < chanceAcesa ? acesas : apagadas).push(m4.clone());
      }
    }
    x += larg + 1 + aleatorio() * 2.5;
    i++;
  }

  const geo = new THREE.PlaneGeometry(1.2, 1.7);
  const grupos = [
    [acesas, new THREE.MeshBasicMaterial({ color: 0xffc46b })],
    [apagadas, new THREE.MeshLambertMaterial({ color: 0x1b2230 })],
  ];
  for (const [lista, material] of grupos) {
    const inst = new THREE.InstancedMesh(geo, material, lista.length);
    lista.forEach((m, k) => inst.setMatrixAt(k, m));
    scene.add(inst);
  }
}

// ---------------------------------------------------------------------------------------------
// Chão: calçada, avenida, calçadão, areia e mar
// ---------------------------------------------------------------------------------------------
function criarChao(scene) {
  scene.add(faixa(...ZONAS.calcadaPredios, "concreto", 0x9a948b));
  scene.add(faixa(...ZONAS.avenida, "asfalto"));
  scene.add(faixa(...ZONAS.calcadao, "calcadao", 0xffffff, 0, "calcadaoRelevo"));
  scene.add(faixa(5.4, 6, "concreto", 0x8a847b, 0.003)); // borda do calçadão
  scene.add(faixa(6, 40, "areia"));
  scene.add(faixa(40, 46, "areia", 0x9c8c70, 0.001)); // areia molhada

  // linha dupla amarela no meio da avenida e o tracejado branco das faixas
  for (const dz of [-0.18, 0.18]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(LARGURA, 0.14), mat(0xc9a227));
    l.rotation.x = -Math.PI / 2;
    l.position.set(0, 0.012, -20 + dz);
    l.receiveShadow = true;
    scene.add(l);
  }
  const porLinha = Math.ceil(LARGURA / 8);
  const tracos = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.14), mat(0xd2d2d2), porLinha * 2);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (const z of [-23, -17]) {
    for (let i = 0; i < porLinha; i++) {
      m4.makeRotationX(-Math.PI / 2).setPosition(-LARGURA / 2 + i * 8, 0.012, z);
      tracos.setMatrixAt(k++, m4);
    }
  }
  tracos.receiveShadow = true;
  scene.add(tracos);

  // meio-fio dos dois lados da avenida
  scene.add(caixaT(LARGURA, 0.18, 0.35, "concreto", 0xc4c0b8, 0, 0.09, ZONAS.avenida[1]));
  scene.add(caixaT(LARGURA, 0.18, 0.35, "concreto", 0xc4c0b8, 0, 0.09, ZONAS.avenida[0]));
}

function criarMar(scene) {
  // malha com ondas: a lua brilha diferente em cada pedaço inclinado da água
  const geo = new THREE.PlaneGeometry(1000, 520, 140, 70);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, ZONAS.mar + 260);
  const base = geo.attributes.position.array.slice();
  const mar = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({ color: 0x0b2038, specular: 0x8ea6d6, shininess: 55 }),
  );
  scene.add(mar);

  const espuma = new THREE.Mesh(
    new THREE.PlaneGeometry(LARGURA, 0.9),
    new THREE.MeshLambertMaterial({ color: 0xd6dde6, transparent: true, opacity: 0.45 }),
  );
  espuma.rotation.x = -Math.PI / 2;
  espuma.position.set(0, 0.01, 45.4);
  scene.add(espuma);

  function ondular(t) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      p.array[i * 3 + 1] =
        -0.42 +
        0.18 * Math.sin(x * 0.09 + t * 0.8) +
        0.12 * Math.sin(z * 0.13 - t * 1.1) +
        0.06 * Math.sin((x + z) * 0.31 + t * 1.7);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    espuma.position.z = 45.4 + 0.5 * Math.sin(t * 0.7);
    espuma.material.opacity = 0.3 + 0.15 * Math.sin(t * 0.7 + 1);
  }
  ondular(0);
  return ondular;
}

// ---------------------------------------------------------------------------------------------
// Objetos da entrega 1, agora na orla
// ---------------------------------------------------------------------------------------------
function criarQuiosque(scene, x, z, rotY) {
  const g = new THREE.Group();
  g.add(lembrar("madeira", caixaT(3, 2.2, 3, "madeira", 0xffffff, 0, 1.1, 0)));
  // no cone, o u dá a volta (4 lados de 3,96 m) e o v sobe pela água do telhado (3,05 m)
  const geoTelhado = escalarUV(new THREE.ConeGeometry(2.8, 1.2, 4), 4 * 3.96, Math.hypot(2.8, 1.2));
  const telhado = lembrar("telha", new THREE.Mesh(geoTelhado, matT("telha")));
  telhado.position.y = 2.8;
  telhado.rotation.y = Math.PI / 4;
  g.add(telhado);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  sombras(g);
  scene.add(g);
}

function criarCarro(scene, x, z, rotY, cor = 0x8a1c1c) {
  const g = new THREE.Group();
  g.add(lembrar("lataria", caixaT(1.8, 0.8, 4.2, "lataria", cor, 0, 0.6, 0)));
  g.add(caixaT(1.6, 0.6, 2.2, "lataria", cor, 0, 1.3, -0.2));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function criarBarricada(scene, x, z, rotY) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(lembrar("barricada", caixaT(1, 0.9, 0.8, "concreto", 0xc8c9cc, -1.1 + i * 1.1, 0.45, 0, "concretoRelevo")));
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

// Poste: a haste da entrega 1 ganhou braço e luminária. A lâmpada usa um material só para todos,
// e é ele que apaga quando a luz dos postes é desligada.
function criarPoste(scene, x, z, materialLampada) {
  const g = new THREE.Group();
  const corpo = mat(0x2b2d33);
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 8), corpo);
  haste.position.y = 2.5;
  haste.castShadow = true;
  g.add(haste);
  g.add(caixa(0.12, 0.12, 1.4, corpo, 0, 5.0, 0.62));
  g.add(caixa(0.5, 0.18, 0.7, corpo, 0, 4.92, 1.3));
  const lampada = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.5), materialLampada);
  lampada.position.set(0, 4.8, 1.3);
  g.add(lampada);
  g.position.set(x, 0, z);
  scene.add(g);
  return { x, z, pontoLuz: new THREE.Vector3(x, 4.55, z + 1.3) };
}

// ---------------------------------------------------------------------------------------------
// Objetos novos desta entrega
// ---------------------------------------------------------------------------------------------
function criarCoqueiro(scene, x, z, inclinacao, rotY) {
  const g = new THREE.Group();
  const tronco = matT("tronco");
  const folha = mat(0x2e5a2a);
  let px = 0;
  let py = 0;
  let ang = 0;
  for (let i = 0; i < 5; i++) {
    const h = 1.6;
    ang += inclinacao / 5;
    // u dá a volta no tronco (perímetro de ~1,1 m) e v sobe pelo gomo (1,6 m)
    const raio = 0.2 - i * 0.015;
    const geoGomo = escalarUV(new THREE.CylinderGeometry(raio - 0.03, raio, h, 7), 2 * Math.PI * raio, h);
    const gomo = lembrar("tronco", new THREE.Mesh(geoGomo, tronco));
    gomo.position.set(px + (Math.sin(ang) * h) / 2, py + (Math.cos(ang) * h) / 2, 0);
    gomo.rotation.z = -ang;
    px += Math.sin(ang) * h;
    py += Math.cos(ang) * h;
    g.add(gomo);
  }
  for (let k = 0; k < 8; k++) {
    const pivo = new THREE.Group();
    pivo.position.set(px, py, 0);
    pivo.rotation.y = (k * Math.PI) / 4 + aleatorio() * 0.3;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 2.6), folha);
    f.position.set(0, -0.35, 1.2);
    f.rotation.x = 0.45;
    pivo.add(f);
    g.add(pivo);
  }
  for (let k = 0; k < 3; k++) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0x4a3a22));
    coco.position.set(px + Math.cos(k * 2.1) * 0.22, py - 0.25, Math.sin(k * 2.1) * 0.22);
    g.add(coco);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  sombras(g);
  scene.add(g);
}

// Posto de salva-vidas: a câmera fixa "Posto 4" fica no alto dele.
function criarPosto(scene, x, z) {
  const g = new THREE.Group();
  const escuro = mat(0x3a3f46);
  const vermelho = mat(0xb8322a);
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    g.add(caixa(0.2, 4.2, 0.2, escuro, dx, 2.1, dz));
  }
  g.add(caixa(3.4, 0.2, 3.4, escuro, 0, 4.2, 0));
  g.add(caixaT(3, 2, 3, "madeira", 0xe6e0d4, 0, 5.3, 0));
  g.add(caixa(3.04, 0.45, 3.04, vermelho, 0, 4.55, 0));
  g.add(caixaT(3.6, 0.25, 3.6, "telha", 0xffffff, 0, 6.42, 0));
  g.position.set(x, 0, z);
  scene.add(g);
}

// Fogueira num tambor, dos sobreviventes. A luz dela fica em luzes.js; aqui só o tambor e as chamas.
function criarFogueira(scene, x, z) {
  const g = new THREE.Group();
  const geoTambor = escalarUV(new THREE.CylinderGeometry(0.42, 0.4, 0.95, 14), (2 * Math.PI * 0.41) / 2, 0.95 / 2);
  const tambor = new THREE.Mesh(geoTambor, matT("lataria", 0x7a5a40));
  tambor.position.y = 0.475;
  tambor.castShadow = true;
  tambor.receiveShadow = true;
  g.add(tambor);
  const chamas = [0xff5a1f, 0xff8a2a, 0xffc04a].map((cor, i) => {
    const chama = new THREE.Mesh(
      new THREE.ConeGeometry(0.32 - i * 0.08, 0.9 - i * 0.15, 8),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    chama.position.y = 0.95 + 0.42 - i * 0.07;
    g.add(chama);
    return chama;
  });
  g.position.set(x, 0, z);
  scene.add(g);
  return { chamas, pontoLuz: new THREE.Vector3(x, 1.7, z) };
}

// ---------------------------------------------------------------------------------------------
// Monta a orla inteira
// ---------------------------------------------------------------------------------------------
export function criarCenario(scene, texturas) {
  T = texturas;
  scene.background = new THREE.Color(COR_HORIZONTE);
  scene.fog = new THREE.Fog(COR_HORIZONTE, 45, 260);

  criarCeu(scene);
  criarMorros(scene);
  criarPredios(scene);
  criarChao(scene);
  const ondular = criarMar(scene);

  // postes a cada 12 m ao longo de toda a orla: iguais, então mostram bem a perspectiva
  const materialLampada = new THREE.MeshBasicMaterial({ color: 0xffd59a });
  const postes = [];
  for (let x = -204; x <= 204; x += 12) postes.push(criarPoste(scene, x, -13.4, materialLampada));

  criarQuiosque(scene, -13, 2.5, 0);
  criarQuiosque(scene, 17, 2.5, Math.PI);
  criarCarro(scene, 8, -19, 0.35);
  criarCarro(scene, -15, -22.5, -0.25, 0xd8b02a);
  criarCarro(scene, 36, -17, 1.2, 0x2f4f6f);

  // barricadas fechando o trecho do calçadão onde o Rafael está
  for (const x of [-23.5, 25.5]) {
    for (let z = -12; z <= 4; z += 3.6) criarBarricada(scene, x, z, Math.PI / 2);
  }
  criarBarricada(scene, 3, -14.8, 0);

  [
    [-38, 31, 0.5, 0.3], [-8, 19, 0.35, 2.1], [-20, 33, 0.6, 4.0], [34, 20, 0.4, 1.0],
    [54, 15, 0.55, 5.2], [-56, 17, 0.45, 2.9], [78, 18, 0.5, 0.6], [-82, 14, 0.6, 3.6],
  ].forEach(([x, z, inc, rot]) => criarCoqueiro(scene, x, z, inc, rot));

  criarPosto(scene, -44, 18);
  const fogueira = criarFogueira(scene, -5.5, 1.5);

  return {
    postes: { lista: postes, materialLampada },
    fogueira,
    exemplos,
    limites: { xMin: -21.5, xMax: 23.5, zMin: -25, zMax: 40 },
    atualizar(t) {
      ondular(t);
    },
  };
}
