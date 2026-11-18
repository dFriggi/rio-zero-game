// Câmeras da cena: quatro pontos de vista, todos com projeção perspectiva, e uma câmera ortográfica que só serve
// para comparação (tecla P), para mostrar o que a perspectiva muda.
// Entrega 4: a câmera do jogo passou a ser a de 1ª pessoa (FPS), com as mãos e a arma (camada 2, que só ela vê).
// A de 3ª pessoa vai por cima do ombro direito e não atravessa obstáculos. As duas seguem o olhar do Rafael
// (yaw e pitch do mouse). Geral e Posto ficam para o modo apresentação (tecla H, com o jogo pausado).
// Camadas: 0 = cena, 1 = corpo do Rafael (some na 1ª pessoa, para a câmera não ver o próprio rosto), 2 = arma na mão.
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
  for (let i = 0; i < 16; i++) maior = Math.max(maior, Math.abs(referencia.elements[i] - camera.projectionMatrix.elements[i]));
  return maior < 1e-9;
}

// =============================================================================================
// As quatro câmeras
// =============================================================================================
export function criarCameras(renderer, rafael, jogador, colisao) {
  const aspecto = () => (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9);

  // 1) Primeira pessoa (a do jogo): nos olhos do Rafael, vê a arma na mão (camada 2)
  const primeira = new CameraPerspectiva(78, aspecto(), 0.03, 700);
  primeira.rotation.order = "YXZ";
  primeira.layers.enable(2);
  // 2) Terceira pessoa: por cima do ombro direito, vê o corpo (camada 1)
  const terceira = new CameraPerspectiva(78, aspecto(), 0.05, 700);
  terceira.rotation.order = "YXZ";
  terceira.layers.enable(1);
  // 3) Geral: orbital, como na entrega 1 (arrastar gira, roda aproxima)
  const geral = new CameraPerspectiva(55, aspecto(), 0.1, 700);
  geral.position.set(13, 10, 26);
  geral.layers.enable(1);
  const orbita = new OrbitControls(geral, renderer.domElement);
  orbita.target.set(0, 2.5, -6);
  orbita.maxPolarAngle = Math.PI / 2.08;
  orbita.minDistance = 3;
  orbita.maxDistance = 160;
  orbita.enableDamping = true;
  orbita.dampingFactor = 0.08;
  orbita.enabled = false;
  orbita.update();
  // 4) Posto 4: fixa no alto do posto de salva-vidas, olhando ao longo da orla
  const posto = new CameraPerspectiva(42, aspecto(), 0.1, 700);
  posto.position.set(-43, 7.4, 16.8);
  posto.lookAt(4, 1.2, -4);
  posto.layers.enable(1);

  const modos = [
    { id: "primeira", nome: "1ª pessoa", detalhe: "Pelos olhos do Rafael, com as mãos e a arma. É a câmera do jogo.", camera: primeira, jogo: true },
    { id: "terceira", nome: "3ª pessoa", detalhe: "Por cima do ombro direito; a mira continua no centro da tela.", camera: terceira, jogo: true },
    { id: "geral", nome: "Geral", detalhe: "Orbital: arraste para girar, roda para aproximar.", camera: geral },
    { id: "posto", nome: "Posto 4", detalhe: "Fixa no posto de salva-vidas, ao longo da orla.", camera: posto },
  ];
  modos.forEach((m) => {
    m.fovPadrao = m.camera.fov;
    m.fovExtra = 0; // ajuste do painel por cima da lente do jogo (que muda ao mirar e ao deslizar)
  });

  const ortografica = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  ortografica.layers.enable(1);
  let indice = 0;
  let orto = false;
  let tremor = 0;

  const olho = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const desejada = new THREE.Vector3();
  const foco = new THREE.Vector3();

  function seguirRafael(dt, instantaneo = false) {
    const p = jogador.pos;
    const morto = jogador.deadT;
    olho.set(p.x, p.y + jogador.alturaOlho * (1 - 0.72 * morto), p.z);
    tremor = Math.max(0, tremor - dt * 2.5);
    const t = tremor * tremor * 0.045;
    primeira.position.copy(olho);
    primeira.rotation.set(jogador.pitch + (Math.random() - 0.5) * t, jogador.yaw + (Math.random() - 0.5) * t, morto * 0.9);
    // 3ª pessoa: atrás e à direita do olho, encurtando se bater num obstáculo
    jogador.direcao(dir);
    const cy = Math.cos(jogador.yaw);
    const sy = Math.sin(jogador.yaw);
    desejada.set(olho.x + cy * 0.7 - dir.x * 2.8, olho.y + 0.25 - dir.y * 2.8, olho.z - sy * 0.7 - dir.z * 2.8);
    desejada.y = Math.max(0.3, desejada.y);
    const toque = colisao.segmento(olho, desejada);
    if (toque) desejada.lerpVectors(olho, desejada, Math.max(0.15, toque.t - 0.08));
    terceira.position.lerp(desejada, instantaneo ? 1 : 1 - Math.exp(-20 * dt));
    terceira.rotation.copy(primeira.rotation);
    // lente: a do jogo (mirar fecha, deslizar abre) mais o ajuste do painel
    for (const m of modos.slice(0, 2)) {
      const alvo = jogador.fovAlvo + m.fovExtra;
      const novo = instantaneo ? alvo : m.camera.fov + (alvo - m.camera.fov) * (1 - Math.exp(-12 * dt));
      if (Math.abs(novo - m.camera.fov) > 0.01) {
        m.camera.fov = novo;
        m.camera.updateProjectionMatrix();
      }
    }
  }
  seguirRafael(0, true);

  function distanciaFoco() {
    const m = modos[indice];
    if (m.id === "geral") return geral.position.distanceTo(orbita.target);
    if (m.id === "primeira") return 10;
    return m.camera.position.distanceTo(foco.copy(rafael.position).setY(1));
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
    tremer(k) {
      tremor = Math.min(1, tremor + k);
    },
    // leva a câmera geral até um objeto (painel de texturas). Peças de personagem são vistas de frente;
    // os planos enormes do chão mostram só um trecho perto do Rafael.
    focar(objeto, deFrente = false) {
      orto = false;
      this.selecionar(2);
      objeto.updateWorldMatrix(true, false);
      const caixa = new THREE.Box3().setFromObject(objeto);
      const centro = caixa.getCenter(new THREE.Vector3());
      let raio = caixa.getSize(new THREE.Vector3()).length() / 2;
      if (raio > 40) {
        centro.set(rafael.position.x + 3, 0, rafael.position.z - 2);
        raio = 3;
      }
      const dist = THREE.MathUtils.clamp(raio * 3.2, 1.2, 30);
      const d = deFrente
        ? objeto.getWorldDirection(new THREE.Vector3()).setY(0).normalize().add(new THREE.Vector3(0, 0.35, 0))
        : new THREE.Vector3(0.55, 0.5, 0.7);
      orbita.target.copy(centro);
      geral.position.copy(centro).addScaledVector(d.normalize(), dist);
      orbita.update();
    },
    definirFov(graus) {
      const m = modos[indice];
      const g = THREE.MathUtils.clamp(Math.round(graus), 15, 110);
      if (m.jogo) m.fovExtra = g - jogador.fovAlvo;
      m.camera.fov = g;
      m.camera.updateProjectionMatrix();
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
