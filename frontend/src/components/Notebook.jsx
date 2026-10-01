import { useEffect, useRef, useState } from 'react'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

/*
  Piezas del "cuaderno vivo" de la presentación (modo claro: papel crema; oscuro: papel de noche):
  - Page: una hoja de papel con borde rasgado arriba y número de sección en el margen.
  - PageTurn: una hoja se levanta desde la esquina inferior derecha y se da vuelta hacia arriba a la izquierda, como en un libro.
  - Clippings: recortes de diario pegados a modo de collage, de fondo.
  - CutFooter: pie de página como una hoja superpuesta con borde recortado.
  - LiveNote / LiveArrow: anotaciones que se escriben o se borran según una condición.
    Al entrar en pantalla se apoya sobre la anterior (efecto de pasar la página).
  - Note: anotación manuscrita que se escribe sola al aparecer.
  - Scribble: flecha o trazo a mano que se dibuja al aparecer.
  - Sketch: bocetos a lápiz (compás, órbita, red) de fondo.
  Todo lo decorativo es aria-hidden y respeta reduced-motion.
*/

const reduced = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Borde rasgado: puntos irregulares pero fijos (semilla), para que no cambie en cada render
export const TEAR = (() => {
  let s = 7
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  let d = 'M0 20 L0 12'
  for (let x = 0; x <= 1440; x += 6 + r() * 10) d += ` L${x.toFixed(0)} ${(5 + r() * 9 + Math.sin(x / 90) * 2).toFixed(1)}`
  return d + ' L1440 10 L1440 20 Z'
})()

function useInView(opts = '0px 0px -12% 0px') {
  const ref = useRef(null)
  const [inView, setIn] = useState(() => typeof window === 'undefined' || !('IntersectionObserver' in window) || reduced())
  useEffect(() => {
    if (inView) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect() } }, { rootMargin: opts })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [inView, opts])
  return [ref, inView]
}

export function Page({ n, paper = 'cream', first = false, turn = true, as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null)

  // Pasar la página: la hoja entra levantada y se apoya. La transformación se borra al terminar,
  // así no afecta a los elementos sticky de adentro.
  useEffect(() => {
    const el = ref.current
    if (first || !turn || reduced()) return
    let raf = 0, done = false
    const update = () => {
      raf = 0
      const top = el.getBoundingClientRect().top
      const p = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * .55)))
      if (p >= 1) { if (!done) { el.style.transform = ''; el.style.removeProperty('--lift'); done = true } return }
      done = false
      const e = 1 - (1 - p) ** 3
      el.style.transform = `perspective(1400px) rotateX(${((1 - e) * 9).toFixed(2)}deg) translateY(${((1 - e) * 40).toFixed(1)}px)`
      el.style.setProperty('--lift', (1 - e).toFixed(3))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [first, turn])

  return (
    <Tag ref={ref} className={`nb-page nb-${paper} ${first ? 'nb-first' : ''} ${className}`} {...rest}>
      {!first && (
        <svg className="nb-tear" viewBox="0 0 1440 20" preserveAspectRatio="none" aria-hidden="true"><path d={TEAR} /></svg>
      )}
      {n && <span className="nb-num" aria-hidden="true">{n}</span>}
      {children}
    </Tag>
  )
}

// Contenedor para ubicar anotaciones y bocetos sobre una sección (ancho del contenido)
export function Margin({ className = '', children }) {
  return <div aria-hidden="true" className={`nb-deco pointer-events-none absolute inset-0 mx-auto max-w-[1180px] ${className}`}>{children}</div>
}

export function Note({ children, style, rotate = -3, delay = 0, size = 1.55, className = '', show }) {
  const [ref, seen] = useInView()
  const inView = show ?? seen
  return (
    <p ref={ref} className={`nb-note ${inView ? 'is-in' : ''} ${className}`}
      style={{ ...style, fontSize: `${size}rem`, '--r': `${rotate}deg`, transitionDelay: `${delay}ms` }}>
      {children}
    </p>
  )
}

// Flechas a mano. d = trazo, h = punta. Cajas pensadas para tamaño chico.
const ARROWS = {
  downLeft: { w: 90, h: 80, d: 'M80 6 C 60 10, 30 30, 16 70', h2: 'M8 58 L16 72 L28 62' },
  downRight: { w: 90, h: 80, d: 'M8 6 C 30 12, 62 32, 74 70', h2: 'M62 64 L75 72 L78 56' },
  upLeft: { w: 110, h: 80, d: 'M100 72 C 70 66, 34 48, 18 10', h2: 'M10 22 L17 8 L30 16' },
  left: { w: 120, h: 50, d: 'M112 24 C 84 34, 46 34, 12 22', h2: 'M24 12 L10 22 L24 34' },
  curl: { w: 110, h: 90, d: 'M8 20 C 40 0, 80 10, 70 40 C 62 64, 30 60, 40 42 C 52 22, 96 50, 98 80', h2: 'M88 72 L98 82 L104 68' },
  underline: { w: 220, h: 20, d: 'M4 12 C 50 4, 120 18, 216 8', h2: '' },
}

export function Scribble({ kind = 'downLeft', style, delay = 0, scale = 1, className = '', show }) {
  const [ref, seen] = useInView()
  const inView = show ?? seen
  const a = ARROWS[kind]
  return (
    <svg ref={ref} className={`nb-scribble ${inView ? 'is-in' : ''} ${className}`} style={{ ...style, width: a.w * scale, height: a.h * scale, '--d': `${delay}ms` }}
      viewBox={`0 0 ${a.w} ${a.h}`} aria-hidden="true">
      <path d={a.d} pathLength="1" />
      {a.h2 && <path d={a.h2} pathLength="1" className="nb-head" />}
    </svg>
  )
}

// Bocetos a lápiz, muy tenues, que se dibujan al aparecer
export function Sketch({ kind = 'compass', style, size = 120, className = '' }) {
  const [ref, inView] = useInView()
  const c = size / 2
  let body = null
  if (kind === 'compass') body = (<>
    <circle cx={c} cy={c} r={c * .78} pathLength="1" />
    <circle cx={c} cy={c} r={c * .42} pathLength="1" className="nb-dash" />
    <path d={`M${c} 2 L${c} ${size - 2} M2 ${c} L${size - 2} ${c}`} pathLength="1" />
    <path d={`M${c} ${c} L${c + c * .62} ${c - c * .5}`} pathLength="1" />
    <circle cx={c} cy={c} r="2" pathLength="1" />
  </>)
  if (kind === 'orbit') body = (<>
    <ellipse cx={c} cy={c} rx={c * .96} ry={c * .7} pathLength="1" className="nb-dash" />
    <ellipse cx={c} cy={c} rx={c * .8} ry={c * .56} pathLength="1" transform={`rotate(-14 ${c} ${c})`} />
  </>)
  if (kind === 'nodes') body = (<>
    <path d={`M${size * .1} ${size * .7} L${size * .35} ${size * .35} L${size * .62} ${size * .55} L${size * .88} ${size * .18} M${size * .35} ${size * .35} L${size * .5} ${size * .1} M${size * .62} ${size * .55} L${size * .7} ${size * .9}`} pathLength="1" />
    {[[.1, .7], [.35, .35], [.62, .55], [.88, .18], [.5, .1], [.7, .9]].map(([x, y], i) => <circle key={i} cx={size * x} cy={size * y} r="3.2" pathLength="1" />)}
  </>)
  if (kind === 'axes') body = (<>
    <path d={`M8 ${size - 8} L8 6 M8 ${size - 8} L${size - 4} ${size - 8}`} pathLength="1" />
    <path d={`M8 ${size - 14} C ${size * .35} ${size - 16}, ${size * .45} ${size * .55}, ${size * .6} ${size * .45} S ${size * .85} ${size * .2}, ${size - 8} ${size * .16}`} pathLength="1" />
  </>)
  return (
    <svg ref={ref} className={`nb-sketch ${inView ? 'is-in' : ''} ${className}`} style={style} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {body}
    </svg>
  )
}

// ---------- Anotaciones que se prenden y se apagan desde afuera (p. ej. según la fase de una animación) ----------
export function LiveNote({ on, children, style, rotate = -3, size = 1.5, delay = 0 }) {
  return (
    <p className={`nb-note ${on ? 'is-in' : ''}`}
      style={{ ...style, fontSize: `${size}rem`, '--r': `${rotate}deg`, opacity: on ? 1 : 0, transitionProperty: 'clip-path, opacity', transitionDuration: '1.1s, .5s', transitionDelay: on ? `${delay}ms, ${delay}ms` : '0ms, 0ms' }}>
      {children}
    </p>
  )
}
export function LiveArrow({ on, kind = 'downRight', style, scale = 1, delay = 0 }) {
  const a = ARROWS[kind]
  return (
    <svg className={`nb-scribble ${on ? 'is-in' : ''}`} style={{ ...style, width: a.w * scale, height: a.h * scale, '--d': `${delay}ms`, opacity: on ? 1 : 0, transition: 'opacity .4s' }} viewBox={`0 0 ${a.w} ${a.h}`} aria-hidden="true">
      <path d={a.d} pathLength="1" />
      {a.h2 && <path d={a.h2} pathLength="1" className="nb-head" />}
    </svg>
  )
}

// ---------- Collage de recortes de diario (fondo del hero) ----------
const CLIPS = [
  { k: 'a', x: '36%', y: '3%', w: 280, r: 1.6, cut: 'polygon(0 2%, 99% 0, 100% 97%, 2% 100%)', body: (<>
    <b className="nb-cl-head">EL DIARIO DEL ESTUDIANTE</b><i className="nb-cl-date">Miércoles · Nº 214</i>
    <h5>Las ideas no viven solas</h5>
    <p>Estudiar no es juntar páginas: es descubrir cómo se conectan entre sí los conceptos que ya tenés.</p>
    <p>Un resumen ordenado, una pregunta a tiempo y un ejemplo concreto valen más que diez lecturas.</p></>) },
  { k: 'b', x: '59%', y: '1%', w: 190, r: -2.4, cut: 'polygon(1% 0, 100% 3%, 98% 100%, 0 96%)', body: (<>
    <h5>Explicar es aprender dos veces</h5>
    <p>Al enseñar un tema aparecen los huecos que la lectura escondía.</p>
    <p className="nb-cl-2">Por eso explicar, aun a un compañero imaginario, ordena lo que se sabe y marca lo que falta repasar.</p></>) },
  { k: 'img', x: '89%', y: '55%', w: 135, r: 3.4, cut: 'polygon(0 0, 100% 2%, 97% 100%, 3% 97%)', body: (<>
    <div className="nb-halftone" /><em>Fig. 1 — Una red de conceptos.</em></>) },
  { k: 'c', x: '80%', y: '79%', w: 165, r: 2.2, cut: 'polygon(0 3%, 97% 0, 100% 98%, 2% 100%)', body: (<>
    <b className="nb-cl-head">CLASIFICADOS</b>
    <p><strong>SE BUSCA:</strong> resumen claro, con ejemplos.</p>
    <p><strong>OFREZCO:</strong> media hora diaria de práctica.</p></>) },
  { k: 'strip', x: '60%', y: '88%', w: 250, r: -1.4, cut: 'polygon(0 10%, 100% 0, 99% 100%, 1% 92%)', body: (<h5>MEMORIA Y REPASO: VOLVER ANTES DE OLVIDAR</h5>) },
  { k: 'd', x: '41%', y: '80%', w: 215, r: -2.2, cut: 'polygon(2% 0, 100% 2%, 98% 100%, 0 97%)', body: (<>
    <h5>Un paso a la vez</h5>
    <p>Primero entender, después practicar, al final explicar. Cada etapa prepara a la siguiente y deja un registro del avance.</p></>) },
  { k: 'cross', x: '2%', y: '60%', w: 118, r: 3.2, cut: 'polygon(0 0, 100% 3%, 97% 100%, 2% 98%)', body: (<>
    <div className="nb-cross">{Array.from({ length: 25 }, (_, i) => <i key={i} className={[0, 4, 6, 12, 18, 20, 24].includes(i) ? 'is-b' : ''} />)}</div></>) },
  { k: 'e', x: '13%', y: '82%', w: 225, r: -1.2, cut: 'polygon(0 4%, 99% 0, 100% 100%, 1% 96%)', body: (<>
    <h5>La constancia pesa más que la intensidad</h5>
    <p>Media hora diaria con un objetivo claro rinde más que una tarde entera sin rumbo.</p></>) },
  { k: 'f', x: '19%', y: '-2%', w: 150, r: -2.2, cut: 'polygon(1% 0, 100% 4%, 98% 100%, 0 95%)', body: (<>
    <b className="nb-cl-head">ÚLTIMA HORA</b><p>Nueva forma de estudiar con material propio.</p></>) },
]
export function Clippings() {
  return (
    <div aria-hidden="true" className="nb-clippings">
      {CLIPS.map((c) => (
        <div key={c.k} className="nb-clip-wrap" style={{ left: c.x, top: c.y, width: c.w, transform: `rotate(${c.r}deg)` }}>
          <div className={`nb-clip nb-clip-${c.k}`} style={{ clipPath: c.cut }}>{c.body}</div>
        </div>
      ))}
    </div>
  )
}

// ---------- Pie de página como hoja superpuesta con borde recortado (tijera "dentada") ----------
const CUT = (() => {
  const pts = []
  const n = 64
  for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${(18 - i / n * 10 + (i % 2 ? 7 : 0)).toFixed(1)}px`)
  return `polygon(${pts.join(',')},100% 100%,0 100%)`
})()
export function CutFooter({ children }) {
  return (
    <div className="nb-cut">
      <svg className="nb-cuttear" viewBox="0 0 1440 20" preserveAspectRatio="none" aria-hidden="true"><path d={TEAR} /></svg>
      <div className="nb-cutpaper">{children}</div>
    </div>
  )
}

// Texto suelto y sutil de fondo: fragmentos de apuntes, código y preguntas
const LOOSE = [
  ['h', 'apunte.pdf', 66, 11, 2.0, -5, 0],
  ['m', 'def conectar(ideas):', 80, 24, .8, 2, 250],
  ['h', 'ejercicio.py', 68, 34, 1.9, 3, 500],
  ['m', '¿por qué funciona?', 86, 43, .78, -2, 150],
  ['h', 'chat con IA', 70, 52, 2.0, -3, 700],
  ['m', 'for nodo in grafo:', 58, 62, .78, 2, 400],
  ['h', 'repasar →', 88, 70, 1.8, 4, 900],
  ['m', 'caso base + paso recursivo', 62, 78, .76, -1, 600],
  ['h', 'explicalo con tus palabras', 60, 86, 1.7, -3, 1000],
  ['m', 'resumen · clase 04', 92, 5, .72, 1, 300],
  ['m', 'return dominio == 100', 42, 94, .74, -2, 800],
  ['h', 'un tema, un paso', 80, 92, 1.6, 2, 1100],
]
export function LooseText() {
  const [ref, inView] = useInView('0px')
  return (
    <div ref={ref} aria-hidden="true" className={`nb-loose ${inView ? 'is-in' : ''}`}>
      {LOOSE.map(([k, t, x, y, sz, r, d]) => (
        <span key={t} className={k} style={{ left: `${x}%`, top: `${y}%`, fontSize: `${sz}rem`, '--r': `${r}deg`, '--d': `${d}ms` }}>{t}</span>
      ))}
    </div>
  )
}

// ---------- Página que se da vuelta desde la esquina inferior derecha hacia arriba a la izquierda ----------
function useFlipOK() {
  const q = '(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)'
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q), f = () => setOk(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return ok
}

// Recorta un polígono convexo con el semiplano sign·(q − s) ≥ 0 (Sutherland–Hodgman)
function clipHalf(poly, q, s, sign) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], fa = sign * (q(A) - s), fb = sign * (q(B) - s)
    if (fa >= 0) out.push(A)
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]) }
  }
  return out
}
const poly = (P) => (P.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${P.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`)

/*
  a: contenido de la primera hoja. b: función (progreso 0..1) que devuelve el contenido de la segunda.
  La hoja a se levanta desde la esquina inferior derecha; el doblez avanza en diagonal hacia arriba a la
  izquierda mostrando el dorso del papel y dejando ver la hoja b por debajo. En pantallas chicas, poca
  altura o reduced-motion se muestran las dos hojas apiladas, sin efecto.
*/
export function PageTurn({ a, b, paperA = 'cream', paperB = 'lined', nA, nB, runway = 400 }) {
  const ok = useFlipOK()
  const box = useRef(null), stage = useRef(null), front = useRef(null), flap = useRef(null), flapShade = useRef(null), under = useRef(null)
  const [showA, setShowA] = useState(true)
  const [p2, setP2] = useState(0)

  useEffect(() => {
    if (!ok) return
    let raf = 0, shown = true, lastW = -1
    const update = () => {
      raf = 0
      const W = stage.current.clientWidth, H = stage.current.clientHeight
      const r = box.current.getBoundingClientRect(), total = box.current.offsetHeight - innerHeight
      const p = clamp(-r.top / Math.max(1, total))
      const t = clamp((p - .08) / .42), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const th = 36 * Math.PI / 180, nx = Math.cos(th), ny = Math.sin(th), cx = W / 2, cy = H / 2
      const q = ([x, y]) => (x - cx) * nx + (y - cy) * ny
      const R = Math.abs(cx * nx) + Math.abs(cy * ny)
      const s = R + 30 + (-2 * R - 60) * e
      const rect = [[0, 0], [W, 0], [W, H], [0, H]]
      const fr = clipHalf(rect, q, s, -1), bk = clipHalf(rect, q, s, 1)
      const refl = bk.map(([x, y]) => { const d = 2 * (q([x, y]) - s); return [x - d * nx, y - d * ny] })
      const f = front.current, fl = flap.current, sh = flapShade.current, un = under.current
      if (f) f.style.clipPath = e <= 0 ? 'none' : poly(fr)
      fl.style.display = e <= 0 || e >= 1 || bk.length < 3 ? 'none' : 'block'
      fl.firstElementChild.style.clipPath = poly(refl)
      // sombreado: el dorso se oscurece hacia el doblez; la hoja de abajo recibe la sombra del doblez
      const L = W * nx + H * ny, pos = (v) => `${(v + L / 2).toFixed(0)}px`, ang = `${(Math.atan2(nx, -ny) * 180 / Math.PI).toFixed(1)}deg`
      sh.style.backgroundImage = `linear-gradient(${ang}, transparent ${pos(s - 360)}, var(--fold-lo) ${pos(s - 90)}, var(--fold-hi) ${pos(s - 14)}, var(--fold-lo) ${pos(s)})`
      un.style.backgroundImage = `linear-gradient(${ang}, var(--fold-cast) ${pos(s)}, transparent ${pos(s + 260)})`
      const vis = e < 1
      if (vis !== shown) { shown = vis; setShowA(vis); raf = requestAnimationFrame(update) }
      const w = Math.round(clamp((p - .52) / .38) * 100) / 100
      if (w !== lastW) { lastW = w; setP2(w) }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [ok])

  if (!ok) return (
    <>
      <Page n={nA} paper={paperA} first>{a}</Page>
      <Page n={nB} paper={paperB}>{b(1)}</Page>
    </>
  )
  return (
    <div ref={box} className="relative" style={{ height: `${runway}vh` }}>
      <div ref={stage} className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0 isolate"><Page n={nB} paper={paperB} first className="h-full overflow-hidden">{b(p2)}</Page></div>
        <div ref={under} className="pointer-events-none absolute inset-0" />
        {showA && (
          <div ref={front} className="absolute inset-0"><Page n={nA} paper={paperA} first className="h-full overflow-hidden">{a}</Page></div>
        )}
        <div ref={flap} className="pointer-events-none absolute inset-0" style={{ display: 'none', filter: 'drop-shadow(0 8px 12px var(--fold-drop))' }} aria-hidden="true">
          <div className="nb-back absolute inset-0"><div ref={flapShade} className="absolute inset-0" /></div>
        </div>
      </div>
    </div>
  )
}
