// Movimento dos personagens: caminhada pelas articulações do humanoide (quadril, joelhos, ombros,
// tronco e cabeça) e o comportamento dos zumbis. Eles vagam perto de onde estão até perceberem o
// Rafael (quando ele encosta neles, atira perto deles ou acerta um deles); aí vão atrás e atacam.
import * as THREE from "three";

// fase = posição no ciclo do passo; quanto = 0 (parado) a 1 (andando)
export function animarCaminhada(personagem, fase, quanto, { bracos = true, cambaleio = 0, golpe = 0 } = {}) {
  const u = personagem.userData;
  const s = Math.sin(fase);
  u.pernaE.pivo.rotation.x = s * 0.55 * quanto;
  u.pernaD.pivo.rotation.x = -s * 0.55 * quanto;
  // o joelho dobra quando a perna está atrás do corpo
  u.pernaE.joelho.rotation.x = Math.max(0, s) * 0.75 * quanto;
  u.pernaD.joelho.rotation.x = Math.max(0, -s) * 0.75 * quanto;
  u.quadril.position.y = 0.95 + Math.abs(Math.cos(fase)) * 0.05 * quanto;
  u.tronco.rotation.y = s * 0.08 * quanto;
  // zumbi: o corpo pende para os lados e a cabeça tomba
  u.tronco.rotation.z = Math.sin(fase * 0.5) * 0.09 * cambaleio;
  u.cabeca.rotation.z = Math.sin(fase * 0.5 + 0.8) * 0.18 * cambaleio;
  // golpe: o tronco avança e os braços descem num tapa
  u.tronco.rotation.x = 0.35 * golpe;
  if (bracos) {
    u.bracoE.pivo.rotation.x = -1.4 + s * 0.15 * quanto + 0.7 * golpe;
    u.bracoD.pivo.rotation.x = -1.4 - s * 0.15 * quanto + 0.7 * golpe;
  }
}

const anguloAte = (de, para) => Math.atan2(Math.sin(para - de), Math.cos(para - de));
const suavizar = (t) => t * t * (3 - 2 * t);

export function criarComportamentoZumbis(zumbis, rafael, barricadas, eventos) {
  let s = 77;
  const aleatorio = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  const estados = zumbis.map((obj) => {
    obj.rotation.order = "YXZ"; // a queda gira em torno do eixo x do próprio zumbi
    const mats = [...new Set(Object.values(obj.userData.mats))];
    return {
      obj,
      mats,
      casa: obj.position.clone(),
      rotacaoInicial: obj.rotation.y,
      alvo: obj.position.clone(),
      espera: aleatorio() * 2,
      fase: aleatorio() * Math.PI * 2,
      quanto: 0,
      velocidade: 0.7 + aleatorio() * 0.45,
      vida: 100,
      alerta: false,
      morto: false,
      tempoMorto: 0,
      recarga: 0,
      golpe: 0,
      clarao: 0,
    };
  });
  const passo = new THREE.Vector3();

  function novoPontoPerto(z) {
    const ang = aleatorio() * Math.PI * 2;
    const r = 1 + aleatorio() * 2;
    z.alvo.set(z.casa.x + Math.cos(ang) * r, 0, z.casa.z + Math.sin(ang) * r);
  }

  function pintarClarao(z) {
    const k = Math.max(0, z.clarao) / 0.15;
    for (const m of z.mats) m.emissive?.setRGB(0.55 * k, 0.02 * k, 0.02 * k);
  }

  function renascer(z) {
    z.obj.position.copy(z.casa);
    z.obj.rotation.set(0, z.rotacaoInicial, 0);
    z.alvo.copy(z.casa);
    Object.assign(z, { vida: 100, alerta: false, morto: false, tempoMorto: 0, recarga: 0, golpe: 0, clarao: 0 });
    pintarClarao(z);
  }

  function atualizarMorto(z, dt) {
    z.tempoMorto += dt;
    const queda = suavizar(Math.min(1, z.tempoMorto / 0.6));
    z.obj.rotation.x = -Math.PI / 2 * queda; // cai de costas
    if (z.tempoMorto < 8) z.obj.position.y = 0.2 * queda;
    else z.obj.position.y = 0.2 - (z.tempoMorto - 8) * 0.3; // afunda no chão antes de sumir
    if (z.tempoMorto > 11) {
      // some e só volta quando o Rafael estiver longe de onde ele nasce
      z.obj.visible = false;
      if (rafael.position.distanceTo(z.casa) > 12) {
        renascer(z);
        z.obj.visible = true;
      }
    }
  }

  function atualizar(dt, rafaelVivo) {
    for (const z of estados) {
      if (z.clarao > 0) {
        z.clarao -= dt;
        pintarClarao(z);
      }
      if (z.morto) {
        atualizarMorto(z, dt);
        continue;
      }
      const p = z.obj.position;
      const distRafael = Math.hypot(rafael.position.x - p.x, rafael.position.z - p.z);
      if (distRafael < 2.5 && rafaelVivo) z.alerta = true; // o Rafael encostou nele
      if (!rafaelVivo || distRafael > 30) z.alerta = false;
      z.recarga -= dt;
      z.golpe = Math.max(0, z.golpe - dt * 3);

      let andar = false;
      if (z.alerta) {
        z.cacando = true;
        z.alvo.copy(rafael.position);
        andar = distRafael > 1.3;
        if (distRafael < 1.8 && z.recarga <= 0) {
          z.recarga = 1.3;
          z.golpe = 1;
          eventos.aoAtacar?.(10);
        }
      } else if (z.cacando) {
        z.cacando = false; // perdeu o Rafael: volta a vagar perto de casa
        novoPontoPerto(z);
      } else if (z.espera > 0) {
        z.espera -= dt;
      } else if (Math.hypot(z.alvo.x - p.x, z.alvo.z - p.z) < 0.3) {
        z.espera = 1 + aleatorio() * 3;
        novoPontoPerto(z);
      } else {
        andar = true;
      }

      // vira devagar para onde vai
      if (Math.hypot(z.alvo.x - p.x, z.alvo.z - p.z) > 0.3) {
        const alvoAng = Math.atan2(z.alvo.x - p.x, z.alvo.z - p.z);
        z.obj.rotation.y += anguloAte(z.obj.rotation.y, alvoAng) * Math.min(1, dt * 3);
      }

      if (andar) {
        const vel = z.velocidade * (z.alerta ? 1.6 : 1);
        passo.set(Math.sin(z.obj.rotation.y), 0, Math.cos(z.obj.rotation.y)).multiplyScalar(vel * dt);
        p.add(passo);
        // coleira em volta de casa (maior quando está caçando) e as barricadas, que eles não atravessam
        const coleira = z.alerta ? 16 : 7;
        const dx = p.x - z.casa.x;
        const dz = p.z - z.casa.z;
        const d = Math.hypot(dx, dz);
        if (d > coleira) p.set(z.casa.x + (dx / d) * coleira, 0, z.casa.z + (dz / d) * coleira);
        if (z.casa.x > barricadas.leste) p.x = Math.max(p.x, barricadas.leste + 1);
        if (z.casa.x < barricadas.oeste) p.x = Math.min(p.x, barricadas.oeste - 1);
      }

      z.quanto += ((andar ? 1 : 0) - z.quanto) * Math.min(1, dt * 4);
      z.fase += dt * (2 + z.velocidade * 2.5) * Math.max(z.quanto, 0.25);
      animarCaminhada(z.obj, z.fase, z.quanto, { cambaleio: 1, golpe: z.golpe });
    }
  }

  // um virote acertou: tira vida, empurra para trás e acende o clarão vermelho
  function ferir(z, dano, direcao) {
    if (z.morto) return false;
    z.vida -= dano;
    z.alerta = true;
    z.clarao = 0.15;
    z.obj.position.addScaledVector(direcao, 0.35);
    if (z.vida <= 0) {
      z.morto = true;
      z.tempoMorto = 0;
      z.obj.rotation.y = Math.atan2(-direcao.x, -direcao.z); // cai para longe do tiro
      eventos.aoMorrer?.();
      return true;
    }
    return false;
  }

  // barulho de tiro: os zumbis que estão perto percebem o Rafael
  function alertarPerto(ponto, raio) {
    for (const z of estados) if (!z.morto && z.obj.position.distanceTo(ponto) < raio) z.alerta = true;
  }

  return {
    estados,
    atualizar,
    ferir,
    alertarPerto,
    reiniciar() {
      estados.forEach((z) => {
        renascer(z);
        z.obj.visible = true;
      });
    },
  };
}
