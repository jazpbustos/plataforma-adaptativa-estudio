import { useEffect, useRef, useState } from 'react'
import { MODULES } from '../lib/format.js'

/*
  Historia con scroll fijo: un cerebro 3D de partículas (Canvas 2D, proyección en perspectiva hecha a mano)
  que se ensambla y enciende una región por módulo a medida que se scrollea. Se puede arrastrar para girarlo.
  Las regiones son una metáfora visual, no anatomía.
*/
const CHAPTERS = [
  { n: '', kicker: 'Los módulos', title: 'Tres maneras de hacer que una idea', accent: 'lleve a la siguiente.', desc: 'Se desbloquean en orden y cada uno suma a tu nivel de dominio del tema.', color: 'var(--violet)', intro: true },
  ...Object.values(MODULES).map((m) => ({ n: m.n, kicker: m.label, title: m.verb.split(', ')[0] + ',', accent: m.verb.split(', ')[1], desc: m.desc, color: m.color })),
  { n: '04', kicker: 'Dominio', title: 'Tu red,', accent: null, desc: 'Cada módulo suma a tu nivel de dominio del tema. Lo ves crecer mientras avanzás.', color: 'var(--violet)', pct: true },
]

const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

// Geometría: elipsoides por "lóbulo"; las partículas se concentran en surcos para dibujar circunvoluciones.
let cache = null
function buildBrain() {
  if (cache) return cache
  const comps = []
  for (const s of [-1, 1]) {
    comps.push({ c: [0, .08, s * .36], r: [1.0, .66, .40], w: 3 })
    comps.push({ c: [.52, -.02, s * .31], r: [.52, .52, .36], w: 1.2 })
    comps.push({ c: [-.55, .02, s * .33], r: [.48, .52, .36], w: 1.2 })
    comps.push({ c: [-.08, -.36, s * .43], r: [.56, .26, .24], w: 1 })
    comps.push({ c: [.62, -.54, s * .22], r: [.34, .20, .26], w: .7 })
  }
  comps.push({ c: [.30, -.76, 0], r: [.12, .30, .12], w: .25 })
  const N = 1500, r = rng(99), P = [], wsum = comps.reduce((a, k) => a + k.w, 0)
  let guard = 0
  while (P.length < N && guard++ < 400000) {
    let u = r() * wsum, k = comps[0]
    for (const q of comps) { if ((u -= q.w) <= 0) { k = q; break } }
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1)
    const x = k.c[0] + Math.sin(ph) * Math.cos(th) * k.r[0], y = k.c[1] + Math.sin(ph) * Math.sin(th) * k.r[1], z = k.c[2] + Math.cos(ph) * k.r[2]
    if (comps.some((q) => q !== k && ((x - q.c[0]) / (q.r[0] * .985)) ** 2 + ((y - q.c[1]) / (q.r[1] * .985)) ** 2 + ((z - q.c[2]) / (q.r[2] * .985)) ** 2 < 1)) continue
    if (Math.abs(z) < .035 && y > -.3) continue // cisura entre hemisferios
    const g = Math.sin(x * 9 + Math.sin(y * 5 + z * 3) * 1.8) * Math.cos(y * 8 + Math.sin(z * 6 + x * 2) * 1.6)
    if (r() > .18 + .82 * (1 - Math.abs(g)) ** 4) continue
    const cb = k.w === .7 || k.w === .25
    const reg = cb ? 4 : y < -.12 && x < .45 ? 3 : x < -.3 ? 1 : x < .5 ? 2 : 4
    P.push({ x, y, z, reg, ph: r() * 6.28, r: .8 + r() * .9, col: [0, 0, 0], sx: 0, sy: 0, d: 0, scatter: [(r() - .3) * 2.4, (r() - .5) * 1.8, (r() - .5) * 1.2] })
  }
  const E = [], NB = P.map(() => []), cell = .09, G = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  P.forEach((p, i) => { const k = key(p.x, p.y, p.z); (G.get(k) || G.set(k, []).get(k)).push(i) })
  P.forEach((p, i) => {
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell), c = []
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      const L = G.get(`${cx + a},${cy + b},${cz + d}`)
      if (L) for (const j of L) { if (j <= i) continue; const dd = (p.x - P[j].x) ** 2 + (p.y - P[j].y) ** 2 + (p.z - P[j].z) ** 2; if (dd < cell * cell) c.push([j, dd]) }
    }
    c.sort((a, b) => a[1] - b[1]).slice(0, 3).forEach(([j]) => { E.push(i, j); NB[i].push(j); NB[j].push(i) })
  })
  cache = { P, E, NB }
  return cache
}

export default function BrainStory({ mastery = 68 }) {
  const storyRef = useRef(null), canvasRef = useRef(null), pctRef = useRef(null)
  const [ch, setCh] = useState(0)

  useEffect(() => {
    const story = storyRef.current, cv = canvasRef.current, ctx = cv.getContext('2d'), root = document.documentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const { P, E, NB } = buildBrain()
    let C = {}, W = 0, H = 0, S = 0, CX = 0, CY = 0, raf = 0, cur = -1, syn = [], pctShown = 0
    const rot = { yaw: -.6, pitch: .12, vy: 0, vp: 0 }, hover = { x: 0, y: 0 }
    let drag = null

    const readColors = () => {
      const css = (n) => getComputedStyle(root).getPropertyValue(n)
      C = { p1: hex(css('--p1')), p2: hex(css('--p2')), p3: hex(css('--p3')), blue: hex(css('--blue')), green: hex(css('--green')), pink: hex(css('--pink')),
        violet: hex(css('--violet')), dim: hex(css('--node-dim')), pulse: css('--pulse').trim(), dark: getComputedStyle(root).colorScheme === 'dark' }
    }
    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mob = !(W >= 1024 && W >= H)
      S = mob ? Math.min(W * .32, H * .21) : Math.min(W * .21, H * .33); CX = mob ? W / 2 : W * .7; CY = mob ? H * .33 : H * .52
    }
    const progress = () => { const r = story.getBoundingClientRect(), total = story.offsetHeight - innerHeight; return { p: clamp(-r.top / Math.max(1, total)), vis: r.bottom > 0 && r.top < innerHeight } }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const { p, vis } = progress()
      if (!vis && !reduce) return
      const t = reduce ? 0 : now / 1000
      const c = Math.min(4, Math.floor(p * 5)), local = clamp(p * 5 - c)
      if (c !== cur) { cur = c; setCh(c) }
      pctShown = c === 4 ? pctShown + (mastery * clamp(local * 2.2) - pctShown) * .12 : pctShown * .8
      if (pctRef.current) pctRef.current.textContent = `${Math.round(pctShown)}%`

      if (!drag) { rot.vy *= .94; rot.vp *= .9; rot.yaw += rot.vy + (reduce ? 0 : .0016); rot.pitch += (.12 + hover.y * .12 - rot.pitch) * .02 }
      const yaw = rot.yaw + p * Math.PI * 1.4 + hover.x * .12, pitch = rot.pitch
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const asm = c > 0 ? 1 : ease(clamp(local * 1.8 + .08))
      const cols = [C.dim, C.blue, C.green, C.pink, C.violet], lit = [true, c >= 1, c >= 2, c >= 3, c >= 4]
      ctx.clearRect(0, 0, W, H)
      for (const q of P) {
        let x = q.x + q.scatter[0] * (1 - asm), y = q.y + q.scatter[1] * (1 - asm), z = q.z + q.scatter[2] * (1 - asm)
        x += Math.sin(t * .8 + q.ph) * .006; y += Math.cos(t * .7 + q.ph) * .006
        const X = x * cyw + z * syw, Z0 = -x * syw + z * cyw, Y = y * cp - Z0 * sp, Z = y * sp + Z0 * cp
        const f = 3.4 / Math.max(1.2, 3.4 + Z); q.sx = CX + X * S * f; q.sy = CY - Y * S * f; q.d = f
        let target
        if (c === 0) target = mix(C.dim, C.violet, .55)
        else if (c === 4) target = mix(mix(C.p3, C.p1, clamp((x + 1.1) / .9)), C.p2, clamp((x - .1) / .9) * .8 + clamp(-y * .6) * .3)
        else target = q.reg && lit[q.reg] ? (q.reg === c ? cols[q.reg] : mix(cols[q.reg], C.dim, .55)) : mix(C.dim, C.violet, .25)
        q.col = mix(q.col, target, reduce ? 1 : .06)
      }
      for (const front of [false, true]) {
        ctx.lineWidth = front ? .7 : .5; ctx.strokeStyle = rgba(C.violet, (C.dark ? .2 : .34) * (front ? 1 : .45) * asm ** 4); ctx.beginPath()
        for (let k = 0; k < E.length; k += 2) { const a = P[E[k]], b = P[E[k + 1]]; if ((a.d > 1) !== front) continue; ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy) }
        ctx.stroke()
      }
      for (const q of P) {
        const rr = Math.min(3.2, q.r * q.d ** 3 * (S / 260))
        ctx.globalAlpha = clamp((q.d - .72) * 2.4) * clamp(.35 + asm); ctx.fillStyle = rgba(q.col, 1)
        ctx.beginPath(); ctx.arc(q.sx, q.sy, Math.max(.5, rr), 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1
      // señales: más rápidas y frecuentes en Practicar, del color de la región activa
      if (!reduce && asm > .95) {
        const rate = c === 2 ? .25 : .08
        if (syn.length < (c === 2 ? 16 : 8) && Math.random() < rate) {
          let s0 = (Math.random() * P.length) | 0
          if (c >= 1 && c <= 3) { const idx = []; P.forEach((q, i) => { if (q.reg === c) idx.push(i) }); s0 = idx[(Math.random() * idx.length) | 0] }
          if (NB[s0]?.length) syn.push({ path: [s0], cur: s0, next: NB[s0][0], t: 0, hops: 6 + ((Math.random() * 10) | 0) })
        }
      }
      syn = syn.filter((s) => {
        s.t += c === 2 ? .16 : .1
        const A = P[s.cur], B = P[s.next], x = A.sx + (B.sx - A.sx) * Math.min(1, s.t), y = A.sy + (B.sy - A.sy) * Math.min(1, s.t)
        const pts = s.path.map((i) => ({ x: P[i].sx, y: P[i].sy })).concat([{ x, y }])
        const col = c >= 1 && c <= 3 ? rgba(cols[c], 1) : C.pulse
        ctx.lineWidth = 1.2; ctx.strokeStyle = col
        for (let i = 1; i < pts.length; i++) { ctx.globalAlpha = (i / pts.length) * .9; ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke() }
        ctx.fillStyle = col; ctx.globalAlpha = .22; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill()
        if (s.t >= 1) {
          s.path.push(s.next); if (s.path.length > 6) s.path.shift(); s.hops--
          const o = NB[s.next].filter((j) => !s.path.includes(j))
          if (!s.hops || !o.length) return false
          s.cur = s.next; s.next = o[(Math.random() * o.length) | 0]; s.t = 0
        }
        return true
      })
      ctx.globalAlpha = 1
    }

    const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId) }
    const onMove = (e) => {
      const r = cv.getBoundingClientRect(); hover.x = ((e.clientX - r.left) / W - .5) * 2; hover.y = ((e.clientY - r.top) / H - .5) * 2
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; rot.vy = dx * .006; rot.vp = dy * .004; rot.yaw += rot.vy; rot.pitch = clamp(rot.pitch + rot.vp, -.9, .9); drag = { x: e.clientX, y: e.clientY } }
    }
    const onUp = () => { drag = null }
    const onLeave = () => { hover.x = hover.y = 0 }
    const ro = new ResizeObserver(layout)
    const mo = new MutationObserver(() => requestAnimationFrame(readColors))
    const mq = matchMedia('(prefers-color-scheme: dark)')

    readColors(); layout()
    ro.observe(cv); mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] }); mq.addEventListener('change', readColors)
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', readColors)
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('pointerleave', onLeave)
    }
  }, [mastery])

  const active = CHAPTERS[ch]
  return (
    <div ref={storyRef} className="relative h-[520vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* brillo suave del color del capítulo detrás del cerebro */}
        <div aria-hidden="true" className="absolute top-[30%] left-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[.16] blur-[100px] transition-[background-color] duration-700 wide:top-1/2 wide:left-[70%]"
          style={{ backgroundColor: active.color }} />

        <canvas ref={canvasRef} aria-label="Cerebro 3D de partículas. Se puede arrastrar para girarlo." className="absolute inset-0 size-full cursor-grab touch-pan-y active:cursor-grabbing" />

        <div className="pointer-events-none relative mx-auto grid h-full w-full max-w-[1180px] content-end px-4 pb-10 sm:px-10 wide:content-center wide:pb-0">
          <div className="grid max-w-[480px] gap-8">
            <div className="relative min-h-[250px] wide:min-h-[300px]">
              {CHAPTERS.map((c, i) => (
                <div key={c.n + c.kicker} aria-hidden={i !== ch}
                  className={`absolute inset-x-0 bottom-0 grid content-end gap-4 transition-all duration-500 wide:top-0 wide:bottom-auto wide:content-start ${i === ch ? 'translate-y-0 opacity-100' : i < ch ? '-translate-y-4 opacity-0' : 'translate-y-4 opacity-0'}`}>
                  <span className="label flex items-center gap-3">{c.n ? <span style={{ color: c.color }}>{c.n}</span> : <i className="size-1.5 rounded-full" style={{ background: c.color }} />}<i className="h-px w-8 bg-rule" />{c.kicker}</span>
                  <h2 className={`display ${c.intro ? 'text-[clamp(2rem,3.8vw,3.1rem)]' : 'text-[clamp(2.4rem,4.8vw,4rem)]'}`}>
                    {c.title}{c.intro ? <br /> : ' '}
                    {c.pct ? <><span ref={pctRef} style={{ color: c.color }}>0%</span> conectada.</> : <span style={{ color: c.color }}>{c.accent}</span>}
                  </h2>
                  <p className="max-w-[40ch] text-muted">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* riel de módulos: marca en qué parte estás */}
            <ol className="flex flex-wrap gap-2" aria-label="Progreso de la sección">
              {CHAPTERS.slice(1).map((c, j) => {
                const i = j + 1, on = i === ch, done = i < ch
                return (
                  <li key={c.kicker} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300"
                    style={{ borderColor: on ? c.color : 'var(--border)', color: on || done ? c.color : 'var(--text-secondary)',
                      background: on ? `color-mix(in srgb, ${c.color} 16%, transparent)` : 'transparent' }}>
                    <i className="size-1.5 rounded-full transition-colors" style={{ background: on || done ? c.color : 'var(--rule)' }} />{c.kicker}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
