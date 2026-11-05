// Câmeras da cena: quatro pontos de vista, todos com projeção perspectiva, e uma câmera ortográfica
// que só serve para comparação (tecla P), para mostrar o que a perspectiva muda.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// =============================================================================================
// PROJEÇÃO PERSPECTIVA: onde a matriz é DEFINIDA
// =============================================================================================
// A matriz de projeção leva um ponto do espaço da câmera (olhando para -z) para o espaço de recorte.
// Com f = 1 / tan(fov / 2):
//
//   | f/aspecto  0   0                          0                        |
//   | 0          f   0                          0                        |
//   | 0          0   (longe+perto)/(perto-longe)  2·longe·perto/(perto-longe) |
//   | 0          0   -1                         0                        |
//
// A última linha faz w = -z (a distância até a câmera). Depois do vértice, a GPU divide x, y e z por w:
// é essa divisão que deixa menor o que está longe.
export function matrizPerspectiva(fovGraus, aspecto, perto, longe, zoom = 1, destino = new THREE.Matrix4()) {
  const f = zoom / Math.tan(THREE.MathUtils.degToRad(fovGraus) / 2);
  return destino.set(
    f / aspecto, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (longe + perto) / (perto - longe), (2 * longe * perto) / (perto - longe),
    0, 0, -1, 0,
  );
}

// Câmera perspectiva que monta a própria matriz com a função acima, em vez da do three.js.
// O three.js chama updateProjectionMatrix() ao criar a câmera; nós chamamos de novo quando o fov
// ou o aspecto mudam (redimensionar a janela, teclas - e +).
export class CameraPerspectiva extends THREE.PerspectiveCamera {
  updateProjectionMatrix() {
    matrizPerspectiva(this.fov, this.aspect, this.near, this.far, this.zoom, this.projectionMatrix);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

// Confere a nossa matriz com a que o three.js calcularia (Matrix4.makePerspective), para o painel.
const referencia = new THREE.Matrix4();
export function conferirComThree(camera) {
  const topo = (camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / camera.zoom;
  const altura = 2 * topo;
  const largura = camera.aspect * altura;
  referencia.makePerspective(-largura / 2, largura / 2, topo, topo - altura, camera.near, camera.far);
  let maior = 0;
  for (let i = 0; i < 16; i++) {
    maior = Math.max(maior, Math.abs(referencia.elements[i] - camera.projectionMatrix.elements[i]));
  }
  return maior < 1e-9;
}

// =============================================================================================
// As quatro câmeras
// =============================================================================================
export function criarCameras(renderer, rafael) {
  // (se a aba abrir escondida, a janela tem 0 × 0 e o aspecto vira NaN até o primeiro resize)
  const aspecto = () => (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9);

  // 1) Geral: orbital, como na entrega 1 (arrastar gira, roda aproxima)
  const geral = new CameraPerspectiva(55, aspecto(), 0.1, 700);
  geral.position.set(13, 10, 26);
  const orbita = new OrbitControls(geral, renderer.domElement);
  orbita.target.set(0, 2.5, -6);
  orbita.maxPolarAngle = Math.PI / 2.08;
  orbita.minDistance = 3;
  orbita.maxDistance = 160;
  orbita.enableDamping = true;
  orbita.dampingFactor = 0.08;
  orbita.update();

  // 2) Terceira pessoa: atrás e acima do Rafael, seguindo com suavidade
  const terceira = new CameraPerspectiva(60, aspecto(), 0.1, 700);
  // 3) Primeira pessoa: nos olhos do Rafael
  const primeira = new CameraPerspectiva(75, aspecto(), 0.05, 700);
  // 4) Posto 4: câmera fixa no alto do posto de salva-vidas, olhando ao longo da orla
  const posto = new CameraPerspectiva(42, aspecto(), 0.1, 700);
  posto.position.set(-43, 7.4, 16.8);
  posto.lookAt(4, 1.2, -4);

  const modos = [
    { id: "geral", nome: "Geral", detalhe: "Orbital: arraste para girar, roda para aproximar.", camera: geral },
    { id: "terceira", nome: "3ª pessoa", detalhe: "Atrás do Rafael. A e D giram, W e S andam.", camera: terceira },
    { id: "primeira", nome: "1ª pessoa", detalhe: "Pelos olhos do Rafael. A e D giram, W e S andam.", camera: primeira },
    { id: "posto", nome: "Posto 4", detalhe: "Fixa no posto de salva-vidas, ao longo da orla.", camera: posto },
  ];
  modos.forEach((m) => (m.fovPadrao = m.camera.fov));

  // Comparação: câmera ortográfica no mesmo lugar e com o mesmo enquadramento no ponto de foco
  const ortografica = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  let indice = 0;
  let orto = false;

  const desejada = new THREE.Vector3();
  const olhar = new THREE.Vector3();
  const foco = new THREE.Vector3();

  function seguirRafael(dt, instantaneo = false) {
    const ry = rafael.rotation.y;
    const s = Math.sin(ry);
    const c = Math.cos(ry);
    const p = rafael.position;
    desejada.set(p.x - s * 7, p.y + 4.5, p.z - c * 7);
    terceira.position.lerp(desejada, instantaneo ? 1 : 1 - Math.exp(-6 * dt));
    terceira.lookAt(olhar.set(p.x + s * 3, p.y + 1.6, p.z + c * 3));
    primeira.position.set(p.x + s * 0.32, p.y + 2.2, p.z + c * 0.32);
    primeira.lookAt(olhar.set(p.x + s * 10, p.y + 1.6, p.z + c * 10));
  }
  seguirRafael(0, true);

  function distanciaFoco() {
    const m = modos[indice];
    if (m.id === "geral") return geral.position.distanceTo(orbita.target);
    if (m.id === "primeira") return 10;
    return m.camera.position.distanceTo(foco.copy(rafael.position).setY(1.2));
  }

  function atualizarOrto() {
    const cam = modos[indice].camera;
    ortografica.position.copy(cam.position);
    ortografica.quaternion.copy(cam.quaternion);
    const meiaAltura = distanciaFoco() * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    ortografica.top = meiaAltura;
    ortografica.bottom = -meiaAltura;
    ortografica.left = -meiaAltura * cam.aspect;
    ortografica.right = meiaAltura * cam.aspect;
    ortografica.near = cam.near;
    ortografica.far = cam.far;
    ortografica.updateProjectionMatrix();
  }

  return {
    modos,
    orbita,
    get indice() {
      return indice;
    },
    get modo() {
      return modos[indice];
    },
    get ortografico() {
      return orto;
    },
    // a câmera que vai para renderer.render()
    get camera() {
      return orto ? ortografica : modos[indice].camera;
    },
    selecionar(i) {
      indice = (i + modos.length) % modos.length;
      orbita.enabled = modos[indice].id === "geral";
      if (orto) atualizarOrto();
    },
    proxima() {
      this.selecionar(indice + 1);
    },
    alternarOrto(valor = !orto) {
      orto = valor;
      if (orto) atualizarOrto();
    },
    definirFov(graus) {
      const cam = modos[indice].camera;
      cam.fov = THREE.MathUtils.clamp(Math.round(graus), 15, 110);
      cam.updateProjectionMatrix();
    },
    resize() {
      for (const m of modos) {
        m.camera.aspect = aspecto();
        m.camera.updateProjectionMatrix();
      }
    },
    atualizar(dt) {
      seguirRafael(dt);
      if (orbita.enabled) orbita.update();
      if (orto) atualizarOrto();
    },
  };
}
