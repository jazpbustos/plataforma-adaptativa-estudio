import { buildBrain } from '../components/BrainStory.jsx'

/*
  Geometría del "mundo" de partículas de la presentación (modo oscuro).
  Son 1500 partículas, las mismas del cerebro 3D. Cada escena define una forma distinta con
  el mismo número de puntos y cada partícula recibe un destino en cada forma. El destino se
  empareja por orden espacial (izquierda con izquierda, arriba con arriba), así al transformarse
  el viaje es corto y ordenado en lugar de un caos.

  Formas: sources (apunte + código + chat), fragments (herramientas sueltas), brain, path (la ruta)
  y cloud (solo para la entrada inicial).
*/

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

/* ---------- siluetas de los tres íconos (mismas que el hero clásico) ---------- */
function drawDoc(g) {
  g.beginPath(); g.moveTo(.2, .08); g.lineTo(.62, .08); g.lineTo(.8, .26); g.lineTo(.8, .92); g.lineTo(.2, .92); g.closePath(); g.fill()
  g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineWidth = .04
  g.beginPath(); g.moveTo(.6, .1); g.lineTo(.6, .28); g.lineTo(.78, .28); g.stroke()
  ;[[.3, .40, .52], [.3, .52, .70], [.3, .64, .70], [.3, .76, .56]].forEach(([a, y, b]) => { g.beginPath(); g.moveTo(a, y); g.lineTo(b, y); g.stroke() })
}
function drawCode(g) {
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = .11
  g.beginPath(); g.moveTo(.32, .26); g.lineTo(.1, .5); g.lineTo(.32, .74); g.stroke()
  g.beginPath(); g.moveTo(.68, .26); g.lineTo(.9, .5); g.lineTo(.68, .74); g.stroke()
  g.beginPath(); g.moveTo(.57, .18); g.lineTo(.43, .82); g.stroke()
}
function drawChat(g) {
  g.beginPath(); g.roundRect(.08, .18, .84, .52, .12); g.fill()
  g.beginPath(); g.moveTo(.26, .66); g.lineTo(.22, .88); g.lineTo(.46, .68); g.fill()
  g.globalCompositeOperation = 'destination-out'
  ;[.32, .5, .68].forEach((x) => { g.beginPath(); g.arc(x, .44, .06, 0, 7); g.fill() })
}

// Puntos repartidos sobre una silueta (mitad sobre el borde para que se lea la forma).
// "Best candidate": de varios candidatos al azar se elige el más alejado de los ya puestos.
function maskPoints(draw, n, seed) {
  const S = 220, o = document.createElement('canvas'); o.width = o.height = S
  const g = o.getContext('2d', { willReadFrequently: true }), r = rng(seed)
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.save(); g.scale(S, S); draw(g); g.restore()
  const d = g.getImageData(0, 0, S, S).data
  const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[((y | 0) * S + (x | 0)) * 4 + 3] >= 128
  const inner = [], edge = []
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!inside(x, y)) continue
    ;(!inside(x + 3, y) || !inside(x - 3, y) || !inside(x, y + 3) || !inside(x, y - 3) ? edge : inner).push([x, y])
  }
  const pts = [], nEdge = Math.round(n * .5)
  for (let i = 0; i < n; i++) {
    const pool = i < nEdge && edge.length ? edge : inner
    let best = null, bd = -1
    for (let k = 0; k < 7; k++) {
      const c = pool[(r() * pool.length) | 0]; let md = 1e9
      for (const p of pts) { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (dd < md) md = dd; if (md < bd) break }
      if (md > bd) { bd = md; best = c }
    }
    pts.push(best)
  }
  return pts.map(([x, y]) => [x / S, y / S])
}

function icon(draw, n, seed, P) {
  const r = rng(seed + 1), cz = Math.cos(P.rz), sz = Math.sin(P.rz), cy = Math.cos(P.ry), sy = Math.sin(P.ry)
  return maskPoints(draw, n, seed).map(([u, v]) => {
    const x = (u - .5) * P.s, y = -(v - .5) * P.s, z = (r() - .5) * .08
    const x1 = x * cz - y * sz, y1 = x * sz + y * cz
    return [x1 * cy + z * sy + P.x, y1 + P.y, -x1 * sy + z * cy + P.z]
  })
}

function sources(N) {
  const a = Math.floor(N / 3)
  return [
    ...icon(drawDoc, a, 21, { x: -.8, y: .5, z: .1, s: 1.6, ry: -.05, rz: -.1 }),
    ...icon(drawCode, a, 22, { x: .15, y: -.6, z: .35, s: 1.3, ry: -.25, rz: .04 }),
    ...icon(drawChat, N - 2 * a, 23, { x: 1.15, y: .4, z: -.25, s: 1.3, ry: -.45, rz: .1 }),
  ]
}

// Herramientas sueltas: siete nubes chicas esparcidas (cada una resuelve "una parte").
function fragments(N) {
  const r = rng(31), g = () => (r() + r() + r() - 1.5) * .9
  const C = [[-2.3, .7, .3, .42], [-1.3, -1.1, -.7, .34], [-.25, 1.2, .6, .38], [.85, -.25, -.95, .4], [1.85, .95, .2, .36], [2.25, -.95, .7, .33], [.2, -1.55, .9, .3]]
  return [...Array(N)].map((_, i) => { const c = C[i % C.length]; return [c[0] + g() * c[3] * 1.5, c[1] + g() * c[3] * 1.1, c[2] + g() * c[3]] })
}

// La ruta: un camino que serpentea en 3D con nueve nudos (ocho pasos y la meta, más grande).
function pathShape(N) {
  const r = rng(41), g = () => (r() + r() + r() - 1.5) * .7
  const at = (u) => [-3.4 + 6.8 * u, .7 * Math.sin(u * 6.3 + .4), .6 * Math.sin(u * 4.2 + 1.2)]
  const nodes = [...Array(8)].map((_, k) => at(.07 + k * .117)); nodes.push(at(1))
  const pts = []
  nodes.forEach((p, k) => {
    const m = k === 8 ? 170 : 64, rad = k === 8 ? .26 : .11
    for (let i = 0; i < m; i++) pts.push([p[0] + g() * rad * 1.5, p[1] + g() * rad * 1.5, p[2] + g() * rad * 1.5])
  })
  while (pts.length < N) { const p = at(r()); pts.push([p[0] + g() * .06, p[1] + g() * .06, p[2] + g() * .06]) }
  return { pts: pts.slice(0, N), nodes }
}

function cloud(N) {
  const r = rng(51)
  return [...Array(N)].map(() => {
    const u = r() * 6.283, v = Math.acos(2 * r() - 1), d = 1.4 + r() * 2.4
    return [Math.sin(v) * Math.cos(u) * d * 1.5, Math.cos(v) * d * .9, Math.sin(v) * Math.sin(u) * d]
  })
}

// Aristas: cada punto con sus vecinos más cercanos, solo si están cerca de verdad.
function knnEdges(flat, k = 3, mult = 2.1) {
  const n = flat.length / 3, kn = new Array(n), nn = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const xi = flat[i * 3], yi = flat[i * 3 + 1], zi = flat[i * 3 + 2], best = []
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      const dx = flat[j * 3] - xi, dy = flat[j * 3 + 1] - yi, dz = flat[j * 3 + 2] - zi, d = dx * dx + dy * dy + dz * dz
      if (best.length < k || d < best[best.length - 1][0]) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); if (best.length > k) best.pop() }
    }
    kn[i] = best; nn[i] = Math.sqrt(best[0][0])
  }
  const lim = (Array.from(nn).sort((a, b) => a - b)[n >> 1] * mult) ** 2, seen = new Set(), E = []
  for (let i = 0; i < n; i++) for (const [d, j] of kn[i]) {
    if (d > lim) continue
    const key = i < j ? i * n + j : j * n + i
    if (!seen.has(key)) { seen.add(key); E.push(i, j) }
  }
  return E
}

let cache = null
export function getWorld() {
  if (cache) return cache
  const { P, E, NB } = buildBrain(), N = P.length, r = rng(77)
  const key = (x, y, z) => x * .85 + y * .3 + z * .1
  const order = P.map((_, i) => i).sort((a, b) => key(P[a].x, P[a].y, P[a].z) - key(P[b].x, P[b].y, P[b].z))

  // Empareja los destinos de una forma con las partículas por orden espacial
  const assign = (targets) => {
    const idx = targets.map((_, i) => i).sort((a, b) => key(...targets[a]) - key(...targets[b])), out = new Float32Array(N * 3)
    order.forEach((pi, rank) => { const t = targets[idx[rank]]; out[pi * 3] = t[0]; out[pi * 3 + 1] = t[1]; out[pi * 3 + 2] = t[2] })
    return out
  }

  const brain = new Float32Array(N * 3); P.forEach((p, i) => { brain[i * 3] = p.x; brain[i * 3 + 1] = p.y; brain[i * 3 + 2] = p.z })
  const pth = pathShape(N)
  const shapes = { brain, sources: assign(sources(N)), fragments: assign(fragments(N)), path: assign(pth.pts), cloud: assign(cloud(N)) }
  const edges = { brain: E, sources: knnEdges(shapes.sources, 3, 2.3), fragments: knnEdges(shapes.fragments, 3, 2.1), path: knnEdges(shapes.path, 3, 2.4), cloud: [] }

  const sweep = new Float32Array(N); order.forEach((pi, rank) => { sweep[pi] = rank / N })
  const dirs = new Float32Array(N * 3), vort = new Float32Array(N), del = new Float32Array(N), arc = new Float32Array(N), ph = new Float32Array(N), rad = new Float32Array(N)
  const reg = new Uint8Array(N), hub = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const u = r() * 6.283, v = Math.acos(2 * r() - 1)
    dirs[i * 3] = Math.sin(v) * Math.cos(u); dirs[i * 3 + 1] = Math.cos(v); dirs[i * 3 + 2] = Math.sin(v) * Math.sin(u)
    vort[i] = (r() - .5) * 2.4; arc[i] = .3 + r() * .7; ph[i] = r() * 6.283; rad[i] = .7 + r() * .9
    del[i] = r() * .42 + sweep[i] * .28 // desfasaje: parte al azar, parte barrido de izquierda a derecha
    reg[i] = P[i].reg; hub[i] = r() < .07 ? 1 : 0
  }
  // Polvo de fondo: no se transforma, da profundidad y parallax
  const ND = 520, dust = new Float32Array(ND * 3), dph = new Float32Array(ND)
  for (let i = 0; i < ND; i++) {
    const u = r() * 6.283, v = Math.acos(2 * r() - 1), d = 2.3 + r() * 4.2
    dust[i * 3] = Math.sin(v) * Math.cos(u) * d * 1.7; dust[i * 3 + 1] = Math.cos(v) * d * 1.1; dust[i * 3 + 2] = Math.sin(v) * Math.sin(u) * d * .8 - 1; dph[i] = r() * 6.283
  }
  cache = { N, shapes, edges, NB, reg, hub, ph, rad, del, vort, arc, dirs, dust, dph, ND, pathNodes: pth.nodes }
  return cache
}
