// Movimento dos personagens: caminhada pelas articulações do humanoide (quadril, joelhos, ombros,
// tronco e cabeça) e o comportamento dos zumbis, que vagam perto de onde estão e vão atrás do Rafael
// quando ele chega perto. Ainda não há ataque: isso entra junto com o combate.
import * as THREE from "three";

// fase = posição no ciclo do passo; quanto = 0 (parado) a 1 (andando)
export function animarCaminhada(personagem, fase, quanto, { bracos = true, cambaleio = 0 } = {}) {
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
  if (bracos) {
    u.bracoE.pivo.rotation.x = -1.4 + s * 0.15 * quanto;
    u.bracoD.pivo.rotation.x = -1.4 - s * 0.15 * quanto;
  }
}

const anguloAte = (de, para) => Math.atan2(Math.sin(para - de), Math.cos(para - de));

export function criarComportamentoZumbis(zumbis, rafael, barricadas) {
  let s = 77;
  const aleatorio = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  const estados = zumbis.map((obj) => ({
    obj,
    casa: obj.position.clone(),
    alvo: obj.position.clone(),
    espera: aleatorio() * 2,
    fase: aleatorio() * Math.PI * 2,
    quanto: 0,
    velocidade: 0.7 + aleatorio() * 0.45,
  }));
  const passo = new THREE.Vector3();

  function novoPontoPerto(z) {
    const ang = aleatorio() * Math.PI * 2;
    const r = 1 + aleatorio() * 3;
    z.alvo.set(z.casa.x + Math.cos(ang) * r, 0, z.casa.z + Math.sin(ang) * r);
  }

  return function atualizar(dt) {
    for (const z of estados) {
      const p = z.obj.position;
      const distRafael = Math.hypot(rafael.position.x - p.x, rafael.position.z - p.z);
      let andar = false;

      if (distRafael < 12) {
        // viu o Rafael: vai até ele, sem se afastar mais de 7 m de onde estava
        z.cacando = true;
        z.alvo.copy(rafael.position);
        andar = distRafael > 2.4;
      } else if (z.cacando) {
        // perdeu o Rafael de vista: volta a vagar perto de casa
        z.cacando = false;
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
        passo.set(Math.sin(z.obj.rotation.y), 0, Math.cos(z.obj.rotation.y)).multiplyScalar(z.velocidade * dt);
        p.add(passo);
        // coleira em volta de casa e as barricadas, que eles não atravessam
        const dx = p.x - z.casa.x;
        const dz = p.z - z.casa.z;
        const d = Math.hypot(dx, dz);
        if (d > 7) p.set(z.casa.x + (dx / d) * 7, 0, z.casa.z + (dz / d) * 7);
        if (z.casa.x > barricadas.leste) p.x = Math.max(p.x, barricadas.leste + 1);
        if (z.casa.x < barricadas.oeste) p.x = Math.min(p.x, barricadas.oeste - 1);
      }

      z.quanto += ((andar ? 1 : 0) - z.quanto) * Math.min(1, dt * 4);
      z.fase += dt * (2 + z.velocidade * 2.5) * Math.max(z.quanto, 0.25);
      animarCaminhada(z.obj, z.fase, z.quanto, { cambaleio: 1 });
    }
  };
}
