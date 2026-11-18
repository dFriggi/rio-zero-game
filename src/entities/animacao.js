// Animação dos personagens pelas articulações do humanoide (quadril, joelhos, ombros, tronco e cabeça).
//   animarCaminhada: o passo de qualquer personagem (pernas, joelho que dobra atrás, quadril que sobe e desce)
//   animarZumbi: o Caminhante curvado, com os braços para a frente e a cabeça tombando. No aviso do golpe ele
//                endireita e ergue os braços acima da cabeça; no golpe os braços descem de uma vez.
//   animarRafael: o corpo do Rafael nas câmeras de fora (3ª pessoa, geral e posto): os dois braços apontam a arma
//                 para onde ele olha, e as pernas mostram o agachar, o deslize e o pulo.
// Rotação em x positiva leva a peça para trás (o personagem olha para +z); os braços apontam para a frente em -π/2.
const FRENTE = -Math.PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// fase = posição no ciclo do passo; quanto = 0 (parado) a 1 (andando)
export function animarCaminhada(p, fase, quanto) {
  const u = p.userData;
  const s = Math.sin(fase);
  u.pernaE.pivo.rotation.x = s * 0.55 * quanto;
  u.pernaD.pivo.rotation.x = -s * 0.55 * quanto;
  u.pernaE.joelho.rotation.x = Math.max(0, s) * 0.75 * quanto;
  u.pernaD.joelho.rotation.x = Math.max(0, -s) * 0.75 * quanto;
  u.quadril.position.y = 0.95 + Math.abs(Math.cos(fase)) * 0.05 * quanto;
  u.tronco.rotation.y = s * 0.08 * quanto;
}

// ergue: 0 a 1 durante o aviso do golpe  |  golpe: 1 no instante do golpe, voltando a 0
export function animarZumbi(z, { fase, quanto, ergue = 0, golpe = 0 }) {
  animarCaminhada(z, fase, quanto);
  const u = z.userData;
  u.tronco.rotation.x = 0.24 - 0.2 * ergue + 0.4 * golpe; // curvado; endireita para erguer e avança no golpe
  u.tronco.rotation.z = Math.sin(fase * 0.5) * 0.09;
  u.cabeca.rotation.z = Math.sin(fase * 0.5 + 0.8) * 0.18;
  u.cabeca.rotation.x = -0.18 + 0.1 * golpe;
  const balanco = Math.sin(fase) * 0.14 * Math.max(quanto, 0.3);
  const acima = -2.75; // braços acima da cabeça
  u.bracoE.pivo.rotation.x = lerp(FRENTE + 0.2 + balanco, acima, ergue) + 0.9 * golpe;
  u.bracoD.pivo.rotation.x = lerp(FRENTE + 0.2 - balanco, acima + 0.15, ergue) + 0.9 * golpe;
  u.bracoE.pivo.rotation.z = -0.12;
  u.bracoD.pivo.rotation.z = 0.12;
}

// pose: { fase, quanto, pitch, agachado (0..1), deslize (0..1), noAr (0..1), morto (0..1) }
export function animarRafael(r, { fase, quanto, pitch = 0, agachado = 0, deslize = 0, noAr = 0 }) {
  animarCaminhada(r, fase, quanto * (1 - deslize));
  const u = r.userData;
  const pE = u.pernaE;
  const pD = u.pernaD;
  // agachado: coxas para a frente, canelas para trás e o quadril desce
  pE.pivo.rotation.x = lerp(pE.pivo.rotation.x, -1.15 + Math.sin(fase) * 0.25 * quanto, agachado);
  pD.pivo.rotation.x = lerp(pD.pivo.rotation.x, -1.15 - Math.sin(fase) * 0.25 * quanto, agachado);
  pE.joelho.rotation.x = lerp(pE.joelho.rotation.x, 1.95, agachado);
  pD.joelho.rotation.x = lerp(pD.joelho.rotation.x, 1.95, agachado);
  // no ar: joelhos encolhidos
  pE.pivo.rotation.x = lerp(pE.pivo.rotation.x, -0.55, noAr);
  pD.pivo.rotation.x = lerp(pD.pivo.rotation.x, -0.25, noAr);
  pE.joelho.rotation.x = lerp(pE.joelho.rotation.x, 0.9, noAr);
  pD.joelho.rotation.x = lerp(pD.joelho.rotation.x, 0.6, noAr);
  // deslize: uma perna esticada na frente, a outra dobrada por baixo, corpo deitando para trás
  pE.pivo.rotation.x = lerp(pE.pivo.rotation.x, -1.35, deslize);
  pE.joelho.rotation.x = lerp(pE.joelho.rotation.x, 0.15, deslize);
  pD.pivo.rotation.x = lerp(pD.pivo.rotation.x, -0.5, deslize);
  pD.joelho.rotation.x = lerp(pD.joelho.rotation.x, 1.7, deslize);
  u.quadril.position.y -= 0.36 * agachado * (1 - deslize) + 0.5 * deslize;
  // tronco e cabeça acompanham o olhar; os braços apontam a arma na altura da mira
  const p = Math.max(-1.2, Math.min(1.2, pitch));
  u.tronco.rotation.x = 0.18 * agachado - 0.35 * deslize - p * 0.3;
  u.cabeca.rotation.x = -p * 0.55;
  // (a rotação em z puxa o braço para dentro: o esquerdo cruza para segurar a arma por baixo)
  u.bracoD.pivo.rotation.set(FRENTE - p * 0.7, 0, -0.08);
  u.bracoE.pivo.rotation.set(FRENTE + 0.15 - p * 0.7, 0, 0.42);
  u.bracoE.cotovelo.rotation.x = -0.35;
}
