// Tipos de zumbi. Para criar um novo, basta adicionar uma entrada aqui e usar o nome nas ondas (data/phases.js).
// Entrega 4: só o Caminhante, o zumbi da fase 1 (Copacabana). Os outros tipos chegam com as próximas fases.
//   hp: vida  |  vaga: velocidade andando à toa (m/s)  |  speed: velocidade caçando o Rafael
//   damage: dano do golpe  |  attackInterval: segundos entre golpes  |  windup: segundos com os braços erguidos
//   antes do golpe (o aviso para o jogador sair de perto)  |  reach: alcance do golpe (m)
//   visao: metros que ele enxerga  |  grito: raio em que ele chama os vizinhos quando vê o Rafael
//   radius: raio do corpo na colisão  |  score: pontos pelo abate
export const ZOMBIES = {
  caminhante: {
    nome: "Caminhante",
    hp: 60,
    vaga: 1.5,
    speed: 3.0,
    damage: 12,
    attackInterval: 1.2,
    windup: 0.45,
    reach: 1.5,
    visao: 15,
    grito: 9,
    radius: 0.42,
    score: 10,
    apresentacao:
      "Turista que não voltou da praia. Lento e distraído, mas nunca anda sozinho: quando um te vê, grita e o resto vem.",
    look: {
      skin: 0x8fa391,
      shirts: [0xff6f91, 0xf2c14e, 0x4fb3bf],
      pants: 0x2a9d8f,
      shoes: 0xd9c9a3,
      hair: 0x3b2f2f,
      eyes: 0xaa0000,
    },
  },
};
