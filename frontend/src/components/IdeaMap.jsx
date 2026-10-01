/*
  Mapa de ideas dibujado a mano (SVG, coordenadas de la doble página: 1620 × 1000).
  Un tema en el centro y las ideas que se van conectando con trazos de lapicera; los trazos de las
  tres fuentes (`threads`) cruzan el lomo y llegan al tema. Los trazos se dibujan solos y, al terminar,
  unos puntitos de tinta viajan por las conexiones.
*/
const rnd = (seed) => { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const f = (n) => n.toFixed(1)

// Contorno a mano: elipse irregular que no cierra del todo
function blob(cx, cy, rx, ry, seed) {
  const r = rnd(seed), n = 14, a0 = r() * 6.28, pts = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * 6.28 * 1.07, k = 1 + (r() - .5) * .07 + (i / n) * .035
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

// Trazo entre dos ideas, de borde a borde, con curvita y temblor de mano
function link(a, b, bend, seed) {
  const r = rnd(seed), dx = b.x - a.x, dy = b.y - a.y
  const ka = 1 / Math.hypot(dx / a.rx, dy / a.ry), kb = 1 / Math.hypot(dx / b.rx, dy / b.ry)
  const s = [a.x + dx * ka * 1.12, a.y + dy * ka * 1.12], e = [b.x - dx * kb * 1.16, b.y - dy * kb * 1.16]
  const L = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1, px = -(e[1] - s[1]) / L, py = (e[0] - s[0]) / L
  const j = () => (r() - .5) * 10
  const c1 = [s[0] + (e[0] - s[0]) * .33 + px * bend * .8 + j(), s[1] + (e[1] - s[1]) * .33 + py * bend * .8 + j()]
  const c2 = [s[0] + (e[0] - s[0]) * .66 + px * bend * .5 + j(), s[1] + (e[1] - s[1]) * .66 + py * bend * .5 + j()]
  return `M${f(s[0])} ${f(s[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(e[0])} ${f(e[1])}`
}

const W = (t, size = 44) => 26 + t.length * size * .23
const node = (x, y, text, size, color, seed) => ({ x, y, text, size, color, seed, rx: W(text, size), ry: size * .78 })

const CENTER = node(1170, 520, 'recursión', 66, 'var(--ink-hand)', 3)
const NODES = [
  node(1010, 320, 'caso base', 46, 'var(--blue)', 5),
  node(1385, 335, 'paso recursivo', 46, 'var(--green)', 6),
  node(1420, 650, 'pila de llamadas', 46, 'var(--pink)', 7),
  node(1330, 800, 'factorial', 46, 'var(--orange)', 8),
  node(1120, 905, '¿cuándo termina?', 44, 'var(--blue)', 9),
]
const LINKS = NODES.map((n, i) => ({ d: link(CENTER, n, [-40, 30, 40, -30, 34][i], 20 + i), color: n.color, delay: 2.9 + i * .35 }))
const CROSS = [link(NODES[1], NODES[2], 60, 41), link(NODES[3], NODES[4], -40, 42)]
// las tres fuentes llegan al tema
const START = [[672, 700], [704, 796], [712, 892]], END = [[CENTER.x - CENTER.rx - 8, 492], [CENTER.x - CENTER.rx - 14, 524], [CENTER.x - CENTER.rx - 8, 556]]
const THREADS = START.map(([sx, sy], i) => {
  const [ex, ey] = END[i], c1 = [sx + 210, sy - 10 * i], c2 = [ex - 190, ey + (i - 1) * 20]
  const ang = Math.atan2(ey - c2[1], ex - c2[0]), h = (t) => `M${f(ex - Math.cos(ang + t) * 24)} ${f(ey - Math.sin(ang + t) * 24)}L${f(ex)} ${f(ey)}`
  return { d: `M${sx} ${sy}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(ex)} ${f(ey)}`, head: h(.5) + h(-.5), color: ['var(--blue)', 'var(--green)', 'var(--pink)'][i], delay: 1.9 + i * .3 }
})

export default function IdeaMap({ threads = true }) {
  const reduce = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <g>
      {threads && THREADS.map((t, i) => (
        <g key={i} style={{ color: t.color }} {...stroke} stroke="currentColor" strokeWidth="2.6">
          <path className="hb-draw" pathLength="1" style={{ '--d': `${t.delay}s` }} d={t.d} />
          <path className="hb-draw" pathLength="1" style={{ '--d': `${t.delay + 1.3}s` }} d={t.head} />
        </g>
      ))}
      {LINKS.map((l, i) => <path key={i} className="hb-draw" pathLength="1" style={{ '--d': `${l.delay}s`, color: l.color }} {...stroke} stroke="currentColor" strokeWidth="2.6" d={l.d} />)}
      {CROSS.map((d, i) => <path key={i} className="hb-fade" style={{ '--d': `${4.8 + i * .3}s` }} {...stroke} stroke="var(--ink-hand)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="3 11" d={d} />)}

      {[CENTER, ...NODES].map((n, i) => (
        <g key={n.text} className="hb-fade" style={{ '--d': `${i === 0 ? 2.6 : 3.1 + i * .35}s`, color: n.color }}>
          <path d={blob(n.x, n.y, n.rx, n.ry, n.seed)} fill="currentColor" fillOpacity={i === 0 ? '.14' : '.09'} stroke="currentColor" strokeWidth={i === 0 ? 3.4 : 2.6} strokeLinejoin="round" strokeLinecap="round" />
          <text x={n.x} y={n.y + n.size * .3} textAnchor="middle" fontSize={n.size} fill="currentColor">{n.text}</text>
        </g>
      ))}
      <text className="hb-fade" style={{ '--d': '6s' }} x="1462" y="900" transform="rotate(-3 1462 900)" fontSize="26" fill="var(--ink-hand)" fillOpacity=".55" fontFamily="var(--font-mono)" textAnchor="middle">n! = n · (n−1)!</text>

      {!reduce && [...LINKS.map((l) => ({ d: l.d, c: l.color })), ...(threads ? THREADS.map((t) => ({ d: t.d, c: t.color })) : [])].map((p, i) => (
        <circle key={i} r="5.5" fill={p.c} opacity="0">
          <animateMotion dur="5.5s" begin={`${6.5 + i * .7}s`} repeatCount="indefinite" path={p.d} />
          <animate attributeName="opacity" values="0;.85;.85;0" keyTimes="0;.12;.85;1" dur="5.5s" begin={`${6.5 + i * .7}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}
