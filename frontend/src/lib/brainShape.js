// Geometría del cerebro de perfil y utilidades para convertir una silueta en una red de partículas.
// Se calcula una sola vez (es lo más costoso) y se reutiliza en cada montaje del componente.

export function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// Generador con mejor reparto (el de arriba deja los pares (x, y) alineados en rectas).
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export const OUT = [[.15,.50],[.09,.38],[.13,.24],[.24,.14],[.38,.09],[.54,.08],[.70,.12],[.83,.21],[.91,.34],[.91,.47],[.86,.55],[.88,.62],[.82,.69],[.71,.71],[.635,.685],[.625,.80],[.575,.86],[.535,.80],[.545,.69],[.44,.67],[.32,.66],[.24,.62],[.20,.56]]
export const GYRI = [
  [[.21,.55],[.32,.50],[.46,.47],[.58,.50],[.66,.47]], [[.52,.09],[.49,.20],[.51,.30],[.47,.40],[.48,.47]],
  [[.43,.10],[.40,.22],[.43,.31],[.39,.44]], [[.61,.11],[.58,.22],[.61,.33],[.57,.46]],
  [[.16,.30],[.25,.26],[.33,.20],[.40,.22]], [[.12,.42],[.22,.40],[.30,.34],[.38,.34]],
  [[.18,.49],[.27,.46],[.35,.43]], [[.63,.29],[.72,.25],[.80,.29]], [[.60,.40],[.70,.37],[.78,.42],[.87,.40]],
  [[.74,.17],[.80,.24],[.84,.33]], [[.28,.59],[.40,.56],[.52,.57],[.62,.55]], [[.33,.63],[.45,.615],[.55,.63]],
  [[.64,.60],[.72,.58],[.80,.575],[.88,.555]], [[.67,.645],[.76,.635],[.85,.61]], [[.69,.68],[.79,.67]],
  [[.25,.19],[.30,.30],[.24,.36]], [[.67,.18],[.66,.28]],
]

export function spline(g, P, closed) {
  const n = P.length, at = (i) => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]
  g.moveTo(P[0][0], P[0][1])
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1])
  }
}

function drawBrain(g) {
  g.beginPath(); spline(g, OUT, true); g.closePath(); g.fill()
  g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = .012
  for (const c of GYRI) { g.beginPath(); spline(g, c, false); g.stroke() }
}

// Muestreo por "Poisson disk" sobre la silueta rasterizada: puntos repartidos sin amontonarse,
// con más densidad en los bordes para que se lea la forma.
function sample(draw, n, minD, seed, edgeShare, good = false) {
  const S = 600, o = document.createElement('canvas'); o.width = S; o.height = S
  const g = o.getContext('2d', { willReadFrequently: true }), r = good ? mulberry(seed) : rng(seed)
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.save(); g.scale(S, S); draw(g); g.restore()
  const d = g.getImageData(0, 0, S, S).data
  const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[((y | 0) * S + (x | 0)) * 4 + 3] >= 128
  const onEdge = (x, y) => !inside(x + 4, y) || !inside(x - 4, y) || !inside(x, y + 4) || !inside(x, y - 4)
  const pts = [], grid = new Map(), key = (x, y) => ((x / minD) | 0) * 1000 + ((y / minD) | 0)
  const near = (x, y, md) => {
    const cx = (x / minD) | 0, cy = (y / minD) | 0
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = grid.get((cx + i) * 1000 + cy + j)
      if (a) for (const p of a) if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < md * md) return true
    }
    return false
  }
  let tries = 0, md = minD
  while (pts.length < n && tries < 220000) {
    tries++; if (tries % 60000 === 0) md *= .8
    const x = r() * S, y = r() * S
    if (!inside(x, y)) continue
    if (pts.length < n * edgeShare && tries < 100000 && !onEdge(x, y)) continue
    if (near(x, y, md)) continue
    pts.push([x, y]); const k = key(x, y); (grid.get(k) || grid.set(k, []).get(k)).push([x, y])
  }
  return { pts: pts.map(([x, y]) => ({ x: x / S, y: y / S })), inside: (u, v) => inside(u * S, v * S) }
}

// Conecta cada punto con sus vecinos más cercanos (sin cruzar surcos).
function graph(pts, radius, maxK, ok) {
  const nb = pts.map(() => []), edges = []
  for (let i = 0; i < pts.length; i++) {
    const c = []
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue
      const dd = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2
      if (dd < radius * radius) c.push([j, dd])
    }
    c.sort((a, b) => a[1] - b[1])
    for (const [j] of c.slice(0, maxK)) {
      if (nb[i].includes(j)) continue
      if (ok && !ok((pts[i].x + pts[j].x) / 2, (pts[i].y + pts[j].y) / 2)) continue
      nb[i].push(j); nb[j].push(i); edges.push(i, j)
    }
  }
  return { nb, edges }
}

let cache = null
export function getBrain() {
  if (cache) return cache
  const shape = sample(drawBrain, 900, 7, 7, .62)
  const r = rng(11)
  shape.pts.forEach((p) => {
    const dx = (p.x - .5) / .42, dy = (p.y - .45) / .32
    p.z = (r() * 2 - 1) * Math.sqrt(Math.max(.05, 1 - dx * dx - dy * dy)) * .22 // profundidad falsa para el giro
  })
  const { nb, edges } = graph(shape.pts, .03, 3, shape.inside)
  cache = { pts: shape.pts, nb, edges }
  return cache
}

// Versión densa para el cerebro "vivo" del hero: más puntos y más conexiones.
let denseCache = null
export function getDenseBrain() {
  if (denseCache) return denseCache
  const shape = sample((g) => { g.beginPath(); spline(g, OUT, true); g.closePath(); g.fill() }, 4200, 2.6, 13, .3, true), r = mulberry(17)
  shape.pts.forEach((p) => {
    const dx = (p.x - .5) / .42, dy = (p.y - .45) / .32
    // profundidad continua (una cúpula con leve ruido): los vecinos quedan juntos también al girar
    p.z = Math.sqrt(Math.max(.02, 1 - dx * dx - dy * dy)) * .2 + (r() - .5) * .02
  })
  const { nb, edges } = graph(shape.pts, .034, 4, null)
  denseCache = { pts: shape.pts, nb, edges }
  return denseCache
}

/* ---------- las tres fuentes dispersas: apunte, código y chat ---------- */
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

let morphCache = null
// Para cada partícula del cerebro devuelve su posición de origen dentro de uno de los tres íconos,
// más las aristas que dibujan cada ícono como red. Se emparejan por posición horizontal para que
// el viaje de ícono → cerebro sea corto y ordenado.
export function getMorph() {
  if (morphCache) return morphCache
  const brain = getBrain(), N = brain.pts.length, per = Math.floor(N / 3), r = rng(11)
  const icons = [sample(drawDoc, per, 9, 21, .55), sample(drawCode, per, 8, 22, .55), sample(drawChat, N - 2 * per, 9, 23, .55)]
  const place = [{ x: .02, y: .10, s: .34, rot: -.12 }, { x: .30, y: .52, s: .36, rot: .05 }, { x: .66, y: .06, s: .34, rot: .1 }]
  const srcPts = [], srcEdges = [], srcG = []
  icons.forEach((ic, gi) => {
    const P = place[gi], c = Math.cos(P.rot), s = Math.sin(P.rot), base = srcPts.length
    const need = gi < 2 ? per : N - 2 * per, loc = ic.pts
    while (loc.length < need) loc.push({ ...loc[(r() * loc.length) | 0] })
    loc.length = need
    const gg = graph(loc, .07, 3, ic.inside)
    for (const e of gg.edges) srcEdges.push(e + base)
    loc.forEach((p) => { srcG.push(gi); const u = p.x - .5, v = p.y - .5; srcPts.push({ x: P.x + P.s * (.5 + u * c - v * s), y: P.y + P.s * (.5 + u * s + v * c) }) })
  })
  const bi = brain.pts.map((_, i) => i).sort((a, b) => brain.pts[a].x - brain.pts[b].x)
  const si = srcPts.map((_, i) => i).sort((a, b) => srcPts[a].x - srcPts[b].x)
  const source = new Array(N), srcToPart = new Array(N), group = new Array(N)
  bi.forEach((b, k) => { source[b] = srcPts[si[k]]; srcToPart[si[k]] = b; group[b] = srcG[si[k]] })
  morphCache = { source, group, edges: srcEdges.map((e) => srcToPart[e]) }
  return morphCache
}
