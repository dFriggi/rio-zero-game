// Fases da campanha. peso = % da cidade que a fase vale; tempoPar = tempo ideal em segundos.
// Entrega 4: a fase 1, Copacabana, com três ondas. Em cada onda chega um grupo de Caminhantes pela avenida, pelo
// mar e pelas pontas da orla, e brotam ninhos que soltam mais zumbis até serem destruídos. A onda acaba quando
// os ninhos caem e não sobra ninguém de pé; entre uma onda e outra há 5 s de respiro.
//   chegam: { tipo: quantidade } que entram pelas bordas  |  ninhos: quantos ninhos brotam na onda
//   metaAbates: abates que valem 100% na parte de abates do desempenho  |  extra: objetivo extra (10%)
export const PHASES = [
  {
    id: 1,
    nome: "Copacabana",
    peso: 10,
    tempoPar: 300,
    metaAbates: 40,
    maxVivos: 12,
    extra: { tipo: "cabeca", meta: 10, texto: "Derrube 10 zumbis com tiro na cabeça" },
    waves: [
      { chegam: { caminhante: 6 }, ninhos: 1 },
      { chegam: { caminhante: 8 }, ninhos: 2 },
      { chegam: { caminhante: 10 }, ninhos: 3 },
    ],
    // por onde os zumbis entram (fora da área do Rafael): avenida, mar e as pontas da areia e da avenida
    entradas: [
      { x: -18, z: -27, de: "avenida" },
      { x: -4, z: -27.5, de: "avenida" },
      { x: 12, z: -27, de: "avenida" },
      { x: 21, z: -27.5, de: "avenida" },
      { x: -14, z: 44, de: "mar" },
      { x: 2, z: 45, de: "mar" },
      { x: 16, z: 44, de: "mar" },
      { x: -32, z: -20, de: "ponta" },
      { x: 34, z: -19, de: "ponta" },
      { x: -32, z: 22, de: "ponta" },
      { x: 34, z: 24, de: "ponta" },
    ],
    // onde os ninhos podem brotar (longe dos quiosques, carros e barricadas)
    ninhos: [
      { x: -10, z: 23 },
      { x: 12, z: 27 },
      { x: 1, z: 34 },
      { x: -4, z: -20.5 },
      { x: 15, z: -6 },
      { x: -16, z: -6 },
    ],
  },
];
