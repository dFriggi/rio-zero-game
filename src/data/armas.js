// Armas do Rafael. Cada uma tem um papel: a besta é silenciosa e forte, mas lenta e com virotes contados; a
// pistola é rápida e tem munição de sobra, mas o estampido chama os zumbis de longe.
//   tipo: "projetil" (voa e cai, pode ser recolhido) ou "hitscan" (acerta na hora)
//   dano: por tiro  |  cabeca: multiplicador do tiro na cabeça  |  intervalo: segundos entre tiros
//   pente: tiros por carregador  |  recarga: segundos  |  dispersao: [quadril, mirando] em radianos
//   recuo: chute da câmera por tiro  |  fovMira: lente ao mirar  |  ruido: metros em que os zumbis escutam
export const ARMAS = {
  besta: {
    nome: "Besta improvisada",
    tipo: "projetil",
    dano: 70,
    cabeca: 2,
    intervalo: 0.3,
    pente: 1,
    recarga: 1.05,
    velocidade: 70,
    gravidade: 3,
    dispersao: [0.008, 0],
    recuo: 0.04,
    fovMira: 46,
    ruido: 7,
  },
  pistola: {
    nome: "Pistola 9 mm",
    tipo: "hitscan",
    dano: 24,
    cabeca: 2,
    intervalo: 0.15,
    pente: 12,
    recarga: 1.3,
    alcance: 70,
    dispersao: [0.018, 0.003],
    recuo: 0.028,
    fovMira: 60,
    ruido: 26,
  },
};

export const ARMAS_INICIAIS = ["besta", "pistola"];

// A besta gasta virotes de verdade: os que cravam no chão, na parede ou no zumbi podem ser recolhidos.
// A pistola tem munição de sobra (só o pente e a recarga pesam).
export const ALJAVA = { inicio: 20, maximo: 30 };
