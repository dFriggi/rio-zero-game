// Efeitos de impacto: partículas (faíscas, poeira, pedaços, brasas) e o rastro do tiro da pistola.
// Cada tipo de material é um InstancedMesh só (um desenho por quadro para todas as partículas daquele tipo),
// com as partículas criadas no carregamento e reaproveitadas. Partícula parada fica com escala 0.
import * as THREE from "three";

const rnd = (a, b) => a + Math.random() * (b - a);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);

function criarGrupo(scene, material, n) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) {
    mesh.setMatrixAt(i, _m);
    mesh.setColorAt(i, _c.set(0xffffff));
  }
  scene.add(mesh);
  const parts = Array.from({ length: n }, () => ({ vida: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), tam: 0.05, grav: 9 }));
  return { mesh, parts, prox: 0 };
}

export class Efeitos {
  constructor(scene) {
    this.brilho = criarGrupo(scene, new THREE.MeshBasicMaterial({ toneMapped: false }), 160);
    this.solido = criarGrupo(scene, new THREE.MeshLambertMaterial(), 200);
    // rastros da pistola: caixas finas e esticadas do cano até o ponto de impacto
    this.rastros = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    this.proxRastro = 0;
  }

  _emitir(grupo, pos, n, { cor, vel = 3, sobe = 1, vida = 0.5, tam = 0.05, grav = 9, dir = null }) {
    for (let k = 0; k < n; k++) {
      const p = grupo.parts[grupo.prox];
      const i = grupo.prox;
      grupo.prox = (grupo.prox + 1) % grupo.parts.length;
      p.p.copy(pos);
      p.v.set(rnd(-1, 1), rnd(0, 1) * sobe, rnd(-1, 1)).multiplyScalar(vel);
      if (dir) p.v.addScaledVector(dir, vel * 0.8);
      p.vida = p.max = vida * rnd(0.7, 1.2);
      p.tam = tam * rnd(0.6, 1.3);
      p.grav = grav;
      grupo.mesh.setColorAt(i, _c.set(Array.isArray(cor) ? cor[k % cor.length] : cor));
    }
    grupo.mesh.instanceColor.needsUpdate = true;
  }

  faisca(pos) {
    this._emitir(this.brilho, pos, 7, { cor: [0xffd27a, 0xffa040], vel: 5, vida: 0.22, tam: 0.03, grav: 14 });
  }
  poeira(pos) {
    this._emitir(this.solido, pos, 6, { cor: [0x8a8070, 0x6f675a], vel: 1.4, sobe: 1.6, vida: 0.6, tam: 0.09, grav: 1 });
  }
  // pedaços escuros quando o tiro acerta o zumbi (nada de sangue vermelho)
  pedacos(pos, dir, muitos = false) {
    this._emitir(this.solido, pos, muitos ? 14 : 7, { cor: [0x2e2420, 0x4a5a3c, 0x3a2b24], vel: 2.6, vida: 0.7, tam: 0.06, grav: 12, dir });
  }
  brasa(pos) {
    _s.set(pos.x + rnd(-0.3, 0.3), pos.y + rnd(0.6, 1.6), pos.z + rnd(-0.3, 0.3));
    this._emitir(this.brilho, _s, 1, { cor: [0xff7a20, 0xffb040], vel: 0.6, sobe: 2, vida: 0.7, tam: 0.05, grav: -1.5 });
  }
  estouro(pos) {
    _s.copy(pos).setY(0.8);
    this._emitir(this.solido, _s, 30, { cor: [0x3b2230, 0x7a3438, 0x4a1c28], vel: 5, sobe: 1.4, vida: 1, tam: 0.12, grav: 12 });
    this._emitir(this.brilho, _s, 16, { cor: [0xff6a4a, 0xff9a70], vel: 2, sobe: 2, vida: 1.2, tam: 0.05, grav: -0.5 });
  }
  coleta(pos) {
    this._emitir(this.brilho, pos, 6, { cor: 0xb7ff3b, vel: 1, sobe: 2, vida: 0.4, tam: 0.03, grav: -2 });
  }

  rastro(de, ate) {
    const m = this.rastros[this.proxRastro];
    this.proxRastro = (this.proxRastro + 1) % this.rastros.length;
    m.position.copy(de);
    m.lookAt(ate);
    m.scale.set(0.012, 0.012, de.distanceTo(ate));
    m.material.opacity = 0.85;
    m.visible = true;
  }

  update(dt) {
    for (const g of [this.brilho, this.solido]) {
      let mudou = false;
      g.parts.forEach((p, i) => {
        if (p.vida <= 0) return;
        mudou = true;
        p.vida -= dt;
        p.v.y -= p.grav * dt;
        p.p.addScaledVector(p.v, dt);
        if (p.p.y < 0.02) {
          p.p.y = 0.02;
          p.v.multiplyScalar(0.4);
        }
        const k = p.vida > 0 ? p.tam * Math.min(1, (p.vida / p.max) * 2) : 0;
        _m.compose(p.p, _q.setFromAxisAngle(Y, i), _s.setScalar(k));
        g.mesh.setMatrixAt(i, _m);
      });
      if (mudou) g.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const r of this.rastros) {
      if (!r.visible) continue;
      r.material.opacity -= dt * 14;
      if (r.material.opacity <= 0) r.visible = false;
    }
  }
}
