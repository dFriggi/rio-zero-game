// Virotes da besta: projéteis de verdade, que voam rápido, caem um pouco (gravidade) e cravam onde batem.
// Cravado no chão, num obstáculo ou na fachada, o virote fica ali e o Rafael recolhe passando por cima.
// Cravado num zumbi, vai junto com o corpo e cai no chão quando ele tomba (aí pode ser recolhido).
// Com o tiro perfurante (próxima entrega), atravessa o primeiro zumbi e segue com metade da força.
// São 30 malhas criadas no carregamento e reaproveitadas.
import * as THREE from "three";
import { modeloVirote } from "./modelosArmas.js";

const Z = new THREE.Vector3(0, 0, 1);
const _dir = new THREE.Vector3();
const _ant = new THREE.Vector3();

export class Virotes {
  constructor(scene, n = 30) {
    this.scene = scene;
    this.lista = [];
    for (let i = 0; i < n; i++) {
      const mesh = modeloVirote();
      mesh.traverse((o) => (o.castShadow = true));
      mesh.visible = false;
      scene.add(mesh);
      this.lista.push({ mesh, estado: "livre", vel: new THREE.Vector3(), t: 0, preso: null });
    }
  }

  disparar(origem, dir, def, mods) {
    // pega um livre; sem livre, reaproveita o cravado mais antigo
    let v = this.lista.find((x) => x.estado === "livre");
    if (!v) v = this.lista.filter((x) => x.estado === "cravado" && !x.preso).sort((a, b) => b.t - a.t)[0];
    if (!v) return;
    if (v.mesh.parent !== this.scene) this.scene.attach(v.mesh);
    Object.assign(v, { estado: "voando", t: 0, def, mods, furou: null, preso: null });
    v.mesh.position.copy(origem);
    v.vel.copy(dir).multiplyScalar(def.velocidade);
    v.mesh.quaternion.setFromUnitVectors(Z, dir);
    v.mesh.visible = true;
  }

  update(dt, ctx) {
    for (const v of this.lista) {
      if (v.estado === "voando") this._voar(v, dt, ctx);
      else if (v.estado === "cravado") {
        v.t += dt;
        if (v.preso) continue;
        const p = v.mesh.position;
        const j = ctx.jogador;
        if (j.vivo && Math.hypot(p.x - j.pos.x, p.z - j.pos.z) < 1.4 && Math.abs(p.y - j.pos.y) < 1.8 && ctx.podeColetar()) {
          ctx.coletar(p);
          this._livrar(v);
        } else if (v.t > 60) this._livrar(v);
      }
    }
  }

  _voar(v, dt, ctx) {
    v.t += dt;
    const p = v.mesh.position;
    _ant.copy(p);
    v.vel.y -= v.def.gravidade * dt;
    p.addScaledVector(v.vel, dt);
    _dir.copy(v.vel).normalize();
    v.mesh.quaternion.setFromUnitVectors(Z, _dir);
    const hit = ctx.tracar(_ant, p, v.furou);
    if (hit) {
      if (hit.zumbi) {
        ctx.acertarZumbi(hit, v.def, _dir, v.mods, v.furou ? 0.5 : 1, "besta");
        if (v.mods.perfura && !v.furou) {
          v.furou = hit.zumbi;
          return;
        }
      } else if (hit.ninho) ctx.acertarNinho(hit, v.def.dano, _dir);
      else ctx.impacto(hit, "besta");
      this._cravar(v, hit, _dir);
      return;
    }
    if (v.t > 4 || Math.abs(p.x) > 200 || p.z > 90) this._livrar(v);
  }

  _cravar(v, hit, dir) {
    v.estado = "cravado";
    v.t = 0;
    v.mesh.position.copy(hit.ponto).addScaledVector(dir, -0.16); // a ponta entra um pouco
    v.mesh.quaternion.setFromUnitVectors(Z, dir);
    v.preso = hit.zumbi ?? hit.ninho ?? null;
    if (v.preso && hit.objeto) hit.objeto.parent.attach(v.mesh);
  }

  // o zumbi tombou (ou o ninho caiu): os virotes cravados nele vão para o chão, deitados, e podem ser recolhidos
  soltar(dono) {
    for (const v of this.lista) {
      if (v.preso !== dono) continue;
      this.scene.attach(v.mesh);
      _dir.copy(Z).applyQuaternion(v.mesh.quaternion).setY(0);
      if (_dir.lengthSq() < 1e-4) _dir.set(1, 0, 0);
      v.mesh.quaternion.setFromUnitVectors(Z, _dir.normalize());
      v.mesh.position.y = 0.05;
      v.preso = null;
      v.t = 0;
    }
  }

  _livrar(v) {
    if (v.mesh.parent !== this.scene) this.scene.attach(v.mesh);
    v.estado = "livre";
    v.preso = null;
    v.mesh.visible = false;
  }

  reiniciar() {
    this.lista.forEach((v) => this._livrar(v));
  }
}
