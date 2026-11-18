// Detecção de colisão da fase.
// Os obstáculos são prismas em pé no chão: círculos (postes, fogueira, coqueiros, ninhos) e retângulos
// girados (quiosques, carros, barricadas), cada um com uma altura. Os personagens são círculos no plano
// do chão (x, z) e são empurrados para fora do que invadirem. Os tiros são segmentos em 3D testados
// contra os mesmos prismas, então um virote passa por cima de uma barricada baixa mas crava no quiosque.
//
//   círculo: { tipo: "circulo", x, z, r, altura }
//   caixa:   { tipo: "caixa", x, z, mx, mz, ang, altura }   (mx e mz são meia largura e meia profundidade
//            no eixo da própria caixa; ang é a rotação em torno de y, igual à do objeto no three.js)

export function criarColisao() {
  const lista = [];

  // ponto do mundo → eixos da caixa (desfaz a rotação em y)
  function paraLocal(ob, x, z) {
    const c = Math.cos(ob.ang);
    const s = Math.sin(ob.ang);
    const dx = x - ob.x;
    const dz = z - ob.z;
    return [dx * c - dz * s, dx * s + dz * c];
  }
  // vetor nos eixos da caixa → mundo
  function paraMundo(ob, lx, lz) {
    const c = Math.cos(ob.ang);
    const s = Math.sin(ob.ang);
    return [lx * c + lz * s, -lx * s + lz * c];
  }

  // Empurra um personagem (círculo de raio "raio", pés na altura "pe") para fora dos obstáculos.
  // Quem está com os pés acima do topo passa por cima (pulou na barricada). Devolve se encostou em algo.
  function empurrar(pos, raio, pe = 0) {
    let encostou = false;
    for (const ob of lista) {
      if (pe >= ob.altura - 0.05) continue;
      if (ob.tipo === "circulo") {
        const dx = pos.x - ob.x;
        const dz = pos.z - ob.z;
        const d = Math.hypot(dx, dz);
        const min = raio + ob.r;
        if (d < min) {
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          pos.x = ob.x + nx * min;
          pos.z = ob.z + nz * min;
          encostou = true;
        }
      } else {
        const [lx, lz] = paraLocal(ob, pos.x, pos.z);
        const cx = Math.max(-ob.mx, Math.min(ob.mx, lx));
        const cz = Math.max(-ob.mz, Math.min(ob.mz, lz));
        let px = lx - cx;
        let pz = lz - cz;
        const d = Math.hypot(px, pz);
        if (d >= raio) continue;
        if (d > 1e-6) {
          // fora da caixa, mas perto demais: afasta na direção do ponto mais próximo
          px = (px / d) * (raio - d);
          pz = (pz / d) * (raio - d);
        } else {
          // o centro entrou na caixa: sai pelo lado mais perto
          const sx = ob.mx - Math.abs(lx);
          const sz = ob.mz - Math.abs(lz);
          if (sx < sz) {
            px = Math.sign(lx || 1) * (sx + raio);
            pz = 0;
          } else {
            px = 0;
            pz = Math.sign(lz || 1) * (sz + raio);
          }
        }
        const [wx, wz] = paraMundo(ob, px, pz);
        pos.x += wx;
        pos.z += wz;
        encostou = true;
      }
    }
    return encostou;
  }

  // Altura do chão embaixo do ponto: o topo do obstáculo mais alto que está embaixo dos pés
  // (só conta se os pés já estão acima dele, então dá para subir pulando, mas não andando).
  function chao(pos, pe) {
    let h = 0;
    for (const ob of lista) {
      if (ob.altura > pe + 0.12 || ob.altura <= h) continue;
      let dentro;
      if (ob.tipo === "circulo") dentro = Math.hypot(pos.x - ob.x, pos.z - ob.z) < ob.r;
      else {
        const [lx, lz] = paraLocal(ob, pos.x, pos.z);
        dentro = Math.abs(lx) < ob.mx && Math.abs(lz) < ob.mz;
      }
      if (dentro) h = ob.altura;
    }
    return h;
  }

  // Segmento de a até b (pontos em 3D) contra os obstáculos. Devolve o primeiro toque
  // { t (0 a 1 ao longo do segmento), x, y, z, ob } ou null.
  function segmento(a, b, ignorar = null) {
    let melhor = null;
    for (const ob of lista) {
      if (ob === ignorar || ob.semTiro) continue;
      const t = ob.tipo === "circulo" ? segCirculo(ob, a, b) : segCaixa(ob, a, b);
      if (t !== null && (!melhor || t < melhor.t)) melhor = { t, ob };
    }
    if (!melhor) return null;
    melhor.x = a.x + (b.x - a.x) * melhor.t;
    melhor.y = a.y + (b.y - a.y) * melhor.t;
    melhor.z = a.z + (b.z - a.z) * melhor.t;
    return melhor;
  }

  // método das placas: o segmento entra na caixa quando já passou pelas três "placas" (x, y e z)
  function segCaixa(ob, a, b) {
    const [ax, az] = paraLocal(ob, a.x, a.z);
    const [bx, bz] = paraLocal(ob, b.x, b.z);
    const ini = [ax, a.y, az];
    const dir = [bx - ax, b.y - a.y, bz - az];
    const min = [-ob.mx, 0, -ob.mz];
    const max = [ob.mx, ob.altura, ob.mz];
    let t0 = 0;
    let t1 = 1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dir[k]) < 1e-9) {
        if (ini[k] < min[k] || ini[k] > max[k]) return null;
        continue;
      }
      let ta = (min[k] - ini[k]) / dir[k];
      let tb = (max[k] - ini[k]) / dir[k];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
    return t0;
  }

  // círculo no chão (cilindro em pé): interseção do segmento com o círculo e confere a altura
  function segCirculo(ob, a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const fx = a.x - ob.x;
    const fz = a.z - ob.z;
    const A = dx * dx + dz * dz;
    const C = fx * fx + fz * fz - ob.r * ob.r;
    let t;
    if (C <= 0) t = 0; // começou dentro
    else {
      if (A < 1e-12) return null;
      const B = 2 * (fx * dx + fz * dz);
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t < 0 || t > 1) return null;
    }
    const y = a.y + (b.y - a.y) * t;
    return y >= 0 && y <= ob.altura ? t : null;
  }

  return {
    lista,
    circulo(x, z, r, altura, extra = {}) {
      const ob = { tipo: "circulo", x, z, r, altura, ...extra };
      lista.push(ob);
      return ob;
    },
    caixa(x, z, largura, profundidade, ang, altura, extra = {}) {
      const ob = { tipo: "caixa", x, z, mx: largura / 2, mz: profundidade / 2, ang, altura, ...extra };
      lista.push(ob);
      return ob;
    },
    remover(ob) {
      const i = lista.indexOf(ob);
      if (i >= 0) lista.splice(i, 1);
    },
    empurrar,
    chao,
    segmento,
    // há algo alto entre os dois pontos? (os zumbis só enxergam o Rafael com a linha livre)
    livre(a, b) {
      const toque = segmento(a, b);
      return !toque || toque.ob.altura < 1.2;
    },
  };
}
