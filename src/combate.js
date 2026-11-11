// Combate básico: a besta do Rafael dispara virotes (projéteis com um pouco de gravidade), que
// ferem os zumbis (o dobro na cabeça) ou ficam cravados no chão para serem recolhidos.
// O Rafael tem vida, que volta devagar quando ele passa um tempo sem apanhar.
import * as THREE from "three";

const VELOCIDADE = 48; // m/s
const GRAVIDADE = 3;
const DANO = 70; // dois virotes no corpo, um na cabeça
const RECARGA = 1.05; // s
const ALJAVA_MAX = 24;
const CIMA = new THREE.Vector3(0, 1, 0);

function criarModeloVirote() {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.7, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5a3a }),
  );
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }));
  ponta.position.y = 0.39;
  const pena = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.12, 0.004),
    new THREE.MeshLambertMaterial({ color: 0xc0392b }),
  );
  pena.position.y = -0.3;
  const pena2 = pena.clone();
  pena2.rotation.y = Math.PI / 2;
  g.add(haste, ponta, pena, pena2);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

export function criarCombate({ scene, rafael, zumbis, posicaoInicial }) {
  const estado = {
    vida: 100,
    carregada: 1,
    aljava: ALJAVA_MAX,
    recarga: 0,
    abates: 0,
    acertos: 0,
    caido: false,
    tempoCaido: 0,
    semDano: 0,
    danoRecebido: 0, // o HUD lê e zera, para piscar a tela
  };
  rafael.rotation.order = "YXZ";
  const modelo = criarModeloVirote();
  const virotes = [];
  const origem = new THREE.Vector3();
  const passo = new THREE.Vector3();
  const direcao = new THREE.Vector3();

  function atirar() {
    if (estado.caido || estado.carregada === 0) return false;
    estado.carregada = 0;
    estado.recarga = RECARGA;
    // sai na frente do Rafael, na linha da mira (o meio do corpo), e não da mão direita: a mão fica
    // 46 cm para o lado, e o virote passaria ao lado de um zumbi que está bem no centro da mira
    const ry = rafael.rotation.y;
    const s = Math.sin(ry);
    const c = Math.cos(ry);
    origem.set(rafael.position.x + s * 1.2, 1.6, rafael.position.z + c * 1.2);
    const vel = new THREE.Vector3(s, 0, c).multiplyScalar(VELOCIDADE);
    const mesh = modelo.clone();
    mesh.position.copy(origem);
    scene.add(mesh);
    virotes.push({ mesh, vel, preso: false, tempo: 0 });
    zumbis.alertarPerto(rafael.position, 14);
    return true;
  }

  function remover(i) {
    scene.remove(virotes[i].mesh);
    virotes.splice(i, 1);
  }

  function voar(v, dt, i) {
    const n = Math.ceil((v.vel.length() * dt) / 0.25); // passos curtos para não atravessar ninguém
    for (let k = 0; k < n; k++) {
      v.vel.y -= (GRAVIDADE * dt) / n;
      passo.copy(v.vel).multiplyScalar(dt / n);
      v.mesh.position.add(passo);
      const p = v.mesh.position;
      for (const z of zumbis.estados) {
        if (z.morto) continue;
        const zp = z.obj.position;
        const dx = p.x - zp.x;
        const dz = p.z - zp.z;
        if (dx * dx + dz * dz < 0.45 * 0.45 && p.y > 0.1 && p.y < 2.5) {
          const naCabeca = p.y > 1.92;
          direcao.copy(v.vel).setY(0).normalize();
          zumbis.ferir(z, naCabeca ? DANO * 2 : DANO, direcao);
          estado.acertos++;
          remover(i);
          return;
        }
      }
      if (p.y <= 0.03 || p.z < -29.8) {
        // cravou no chão ou na fachada: fica ali para ser recolhido
        p.y = Math.max(p.y, 0.03);
        v.preso = true;
        return;
      }
      if (Math.abs(p.x) > 200 || p.z > 60) {
        remover(i);
        return;
      }
    }
    v.mesh.quaternion.setFromUnitVectors(CIMA, direcao.copy(v.vel).normalize());
  }

  function atualizar(dt) {
    if (estado.carregada === 0 && estado.aljava > 0) {
      estado.recarga -= dt;
      if (estado.recarga <= 0) {
        estado.carregada = 1;
        estado.aljava--;
      }
    }
    for (let i = virotes.length - 1; i >= 0; i--) {
      const v = virotes[i];
      if (!v.preso) {
        voar(v, dt, i);
        continue;
      }
      v.tempo += dt;
      const perto = Math.hypot(v.mesh.position.x - rafael.position.x, v.mesh.position.z - rafael.position.z) < 1.2;
      if (perto && !estado.caido && estado.aljava < ALJAVA_MAX) {
        estado.aljava++;
        remover(i);
      } else if (v.tempo > 30) {
        remover(i);
      }
    }
    if (estado.caido) {
      // cai de costas
      estado.tempoCaido += dt;
      const t = Math.min(1, estado.tempoCaido / 0.7);
      rafael.rotation.x = (-Math.PI / 2) * t * t * (3 - 2 * t);
      rafael.position.y = 0.2 * t;
    } else {
      estado.semDano += dt;
      if (estado.semDano > 4 && estado.vida < 100) estado.vida = Math.min(100, estado.vida + 4 * dt);
    }
  }

  function ferirRafael(dano) {
    if (estado.caido) return;
    estado.vida = Math.max(0, estado.vida - dano);
    estado.semDano = 0;
    estado.danoRecebido += dano;
    if (estado.vida === 0) {
      estado.caido = true;
      estado.tempoCaido = 0;
    }
  }

  function reiniciar() {
    while (virotes.length) remover(0);
    Object.assign(estado, {
      vida: 100,
      carregada: 1,
      aljava: ALJAVA_MAX,
      recarga: 0,
      abates: 0,
      acertos: 0,
      caido: false,
      tempoCaido: 0,
      semDano: 0,
    });
    rafael.position.copy(posicaoInicial);
    rafael.rotation.set(0, Math.PI, 0);
    zumbis.reiniciar();
  }

  return {
    estado,
    ALJAVA_MAX,
    atirar,
    atualizar,
    ferirRafael,
    contarAbate() {
      estado.abates++;
    },
    reiniciar,
  };
}
