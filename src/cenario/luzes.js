// Cinco fontes de luz, cada uma com um papel na orla à noite.
// Ligar e desligar mexe só na intensidade (a luz continua na cena): o shader não precisa ser
// recompilado e a diferença aparece na hora. Cada fonte também tem um sinal visível (o disco da lua,
// as lâmpadas, as chamas, a lente da lanterna) que apaga junto, para ficar claro de onde a luz vem.
import * as THREE from "three";

export function criarLuzes(scene, { postes, fogueira, rafael }) {
  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fontes = [];
  const helpers = new THREE.Group();
  helpers.visible = false;
  scene.add(helpers);

  const registrar = (fonte) => {
    fonte.ligada = true;
    fonte.base = fonte.luzes.map((l) => l.intensity);
    fontes.push(fonte);
  };

  // 1) Céu noturno: HemisphereLight, luz difusa azulada de cima e um reflexo quente do chão
  const ceu = new THREE.HemisphereLight(0x6b7fb8, 0x2a2118, 0.55);
  ceu.position.set(0, 14, 0);
  scene.add(ceu);
  helpers.add(new THREE.HemisphereLightHelper(ceu, 2));
  registrar({
    id: "ceu",
    nome: "Céu noturno",
    tipo: "HemisphereLight",
    cor: 0x6b7fb8,
    papel: "Difusa, vem do céu inteiro. Sem ela, o que não recebe luz direta fica preto.",
    luzes: [ceu],
  });

  // 2) Lua: DirectionalLight, raios paralelos e frios vindos do mar, com sombra
  const direcaoLua = new THREE.Vector3(-0.32, 0.55, 0.77).normalize();
  const lua = new THREE.DirectionalLight(0xa9bfff, 0.75);
  lua.position.copy(direcaoLua).multiplyScalar(40);
  lua.castShadow = true;
  lua.shadow.mapSize.set(2048, 2048);
  Object.assign(lua.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 });
  lua.shadow.bias = -0.0005;
  lua.shadow.normalBias = 0.02;
  scene.add(lua, lua.target);
  const disco = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }),
  );
  disco.position.copy(direcaoLua).multiplyScalar(440);
  scene.add(disco);
  const helperLua = new THREE.DirectionalLightHelper(lua, 4);
  helpers.add(helperLua);
  registrar({
    id: "lua",
    nome: "Lua",
    tipo: "DirectionalLight",
    cor: 0xa9bfff,
    papel: "Raios paralelos vindos do mar. Faz as sombras e o brilho na água.",
    luzes: [lua],
    aoMudar: (ligada) => disco.material.color.setHex(ligada ? 0xeef2ff : 0x2e3340),
  });

  // 3) Postes: PointLight nas lâmpadas perto do Rafael (as distantes só brilham, para não pesar)
  const luzesPostes = postes.lista
    .filter((p) => Math.abs(p.x) <= 36)
    .map((p) => {
      const l = new THREE.PointLight(0xffb45e, 60, 24, 2);
      l.position.copy(p.pontoLuz);
      scene.add(l);
      helpers.add(new THREE.PointLightHelper(l, 0.35));
      return l;
    });
  registrar({
    id: "postes",
    nome: "Postes da orla",
    tipo: `PointLight × ${luzesPostes.length}`,
    cor: 0xffb45e,
    papel: "Lâmpadas de sódio: luz quente em todas as direções, que enfraquece com a distância.",
    luzes: luzesPostes,
    aoMudar: (ligada) => postes.materialLampada.color.setHex(ligada ? 0xffd59a : 0x2b2b2b),
  });

  // 4) Fogueira: PointLight laranja que tremula
  const fogo = new THREE.PointLight(0xff7a2e, 28, 16, 2);
  fogo.position.copy(fogueira.pontoLuz);
  scene.add(fogo);
  helpers.add(new THREE.PointLightHelper(fogo, 0.3));
  registrar({
    id: "fogueira",
    nome: "Fogueira",
    tipo: "PointLight",
    cor: 0xff7a2e,
    papel: "Fogo no tambor dos sobreviventes. Laranja e tremendo, ilumina só por perto.",
    luzes: [fogo],
    aoMudar: (ligada) => fogueira.chamas.forEach((c) => (c.visible = ligada)),
  });

  // 5) Lanterna do Rafael: SpotLight presa na ponta da besta, aponta para onde ele mira
  const cotovelo = rafael.userData.bracoD.cotovelo;
  const lanterna = new THREE.SpotLight(0xfff1d6, 90, 32, THREE.MathUtils.degToRad(22), 0.45, 1.6);
  lanterna.position.set(0, -1.0, 0.05);
  lanterna.target.position.set(0, -14, 0.05); // ao longo do braço, que está esticado para a frente
  lanterna.castShadow = true;
  lanterna.shadow.mapSize.set(1024, 1024);
  lanterna.shadow.camera.near = 0.3;
  lanterna.shadow.camera.far = 32;
  lanterna.shadow.bias = -0.0008;
  const lente = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
  lente.position.copy(lanterna.position);
  cotovelo.add(lanterna, lanterna.target, lente);
  const helperLanterna = new THREE.SpotLightHelper(lanterna);
  helpers.add(helperLanterna);
  registrar({
    id: "lanterna",
    nome: "Lanterna do Rafael",
    tipo: "SpotLight",
    cor: 0xfff1d6,
    papel: "Cone de luz preso na besta. Anda e gira junto com o Rafael e também faz sombra.",
    luzes: [lanterna],
    aoMudar: (ligada) => lente.material.color.setHex(ligada ? 0xfff4dc : 0x333333),
  });

  function aplicar(fonte) {
    fonte.luzes.forEach((l, i) => (l.intensity = fonte.ligada ? fonte.base[i] : 0));
    fonte.aoMudar?.(fonte.ligada);
  }

  return {
    fontes,
    get helpersVisiveis() {
      return helpers.visible;
    },
    alternar(i) {
      const f = fontes[i];
      if (!f) return;
      f.ligada = !f.ligada;
      aplicar(f);
    },
    // deixa só uma fonte acesa, para ver a contribuição dela sozinha
    solo(i) {
      fontes.forEach((f, k) => {
        f.ligada = k === i;
        aplicar(f);
      });
    },
    todas() {
      fontes.forEach((f) => {
        f.ligada = true;
        aplicar(f);
      });
    },
    alternarHelpers() {
      helpers.visible = !helpers.visible;
    },
    atualizar(t) {
      const fonteFogo = fontes[3];
      if (fonteFogo.ligada) {
        const tremor = semMovimento
          ? 1
          : 0.82 + 0.1 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 23.7 + 1.3) + 0.04 * Math.sin(t * 41.9);
        fogo.intensity = fonteFogo.base[0] * tremor;
        if (!semMovimento) {
          fogueira.chamas.forEach((c, i) => {
            c.scale.y = 1 + 0.18 * Math.sin(t * (9 + i * 3) + i);
            c.rotation.y = t * (1.5 + i);
          });
        }
      }
      if (helpers.visible) {
        helperLanterna.update();
        helperLua.update();
      }
    },
  };
}
