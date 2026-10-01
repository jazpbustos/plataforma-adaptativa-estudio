import { useEffect, useRef, useState } from 'react'
import { MODULES } from '../lib/format.js'
import { build, mulberry } from './ParticleBrain.jsx'
import { Kicker } from './Doodles.jsx'

/*
  Historia con scroll fijo: un cerebro 3D de partículas (Canvas 2D, proyección en perspectiva hecha a mano)
  que se ensambla y enciende una región por módulo a medida que se scrollea. Se puede arrastrar para girarlo.
  Mismo estilo de granitos que el hero. Las regiones son una metáfora visual, no anatomía.
*/
export const CHAPTERS = [
  { n: '', kicker: 'Los módulos', title: 'Tres maneras de hacer que una idea', accent: 'lleve a la siguiente.', desc: 'Se desbloquean en orden y cada uno suma a tu nivel de dominio del tema.', color: 'var(--violet)', intro: true },
  ...Object.values(MODULES).map((m) => ({ n: m.n, kicker: m.label, title: m.verb.split(', ')[0] + ',', accent: m.verb.split(', ')[1], desc: m.desc, color: m.color })),
  { n: '04', kicker: 'Dominio', title: 'Tu red,', accent: null, desc: 'Cada módulo suma a tu nivel de dominio del tema. Lo ves crecer mientras avanzás.', color: 'var(--violet)', pct: true },
]

const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export default function BrainStory({ mastery = 100, decor = null }) {
  const storyRef = useRef(null), canvasRef = useRef(null), pctRef = useRef(null)
  const [ch, setCh] = useState(0)

  useEffect(() => {
    const story = storyRef.current, cv = canvasRef.current, ctx = cv.getContext('2d'), root = document.documentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const B = build(), N = B.N, rr = mulberry(21)
    // región de cada partícula: 1 Aprender (frente), 2 Practicar (centro), 3 Explicar (lóbulo temporal), 4 el resto
    const reg = new Uint8Array(N), dl = new Float32Array(N), ox = new Float32Array(N), oy = new Float32Array(N), ar = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const x = B.x[i], y = B.y[i]
      reg[i] = B.part[i] ? 4 : y < -.12 && x < .45 ? 3 : x < -.3 ? 1 : x < .5 ? 2 : 4
      dl[i] = rr(); ox[i] = rr(); oy[i] = rr(); ar[i] = rr() * 2 - 1
    }
    const sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N), bk = new Int8Array(N), cl = new Uint8Array(N)
    let C = {}, W = 0, H = 0, S = 0, CX = 0, CY = 0, raf = 0, cur = -1, pctShown = 0
    const rot = { yaw: -.6, pitch: .12, vy: 0, vp: 0 }, hover = { x: 0, y: 0 }
    const L = (() => { const v = [-.5, .62, .62], l = Math.hypot(...v); return v.map((a) => a / l) })()
    const live = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]   // color vivo de cada región (se interpola)
    let drag = null

    const readColors = () => {
      const css = (n) => getComputedStyle(root).getPropertyValue(n)
      C = { p1: hex(css('--p1')), p2: hex(css('--p2')), p3: hex(css('--p3')), blue: hex(css('--blue')), green: hex(css('--green')), pink: hex(css('--pink')),
        violet: hex(css('--violet')), dark: getComputedStyle(root).colorScheme === 'dark' }
      C.ink = C.dark ? [214, 200, 255] : [74, 38, 150]
      C.dim = C.dark ? [150, 136, 200] : [112, 90, 176]
    }
    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mob = !(W >= 1024 && W >= H)
      S = mob ? Math.min(W * .36, H * .23) : Math.min(W * .2, H * .32); CX = mob ? W / 2 : W * .7; CY = mob ? H * .33 : H * .5
    }
    const progress = () => { const r = story.getBoundingClientRect(), total = story.offsetHeight - innerHeight; return { p: clamp(-r.top / Math.max(1, total)), vis: r.bottom > 0 && r.top < innerHeight } }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const { p, vis } = progress()
      if (!vis && !reduce) return
      const t = reduce ? 99 : now / 1000
      const c = Math.min(4, Math.floor(p * 5)), local = clamp(p * 5 - c)
      if (c !== cur) { cur = c; setCh(c) }
      pctShown = c === 4 ? pctShown + (mastery * clamp(local * 2.2) - pctShown) * .12 : pctShown * .8
      if (pctRef.current) pctRef.current.textContent = `${Math.round(pctShown)}%`

      if (!drag) { rot.vy *= .94; rot.vp *= .9; rot.yaw += rot.vy - rot.yaw * .012; rot.pitch += (.12 + hover.y * .1 - rot.pitch) * .02 }
      const yaw = rot.yaw - 1.1 + p * 2.6 + (reduce ? 0 : Math.sin(t * .4) * .08) + hover.x * .12, pitch = rot.pitch + .08
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const asm = reduce || c > 0 ? 1 : clamp(local * 1.7 + .05)     // 0 → 1: la nube de polvo se condensa
      // color objetivo por región según el capítulo
      const tgt = c === 0 ? [C.ink, C.ink, C.ink, C.ink, C.ink]
        : c === 4 ? [C.ink, C.p3, C.p1, [(C.p1[0] + C.p2[0]) / 2, (C.p1[1] + C.p2[1]) / 2, (C.p1[2] + C.p2[2]) / 2], C.p2]
        : [C.ink, ...[C.blue, C.green, C.pink].map((col, k) => (k + 1 === c ? col : C.dim)), C.dim]
      for (let k = 0; k < 5; k++) for (let j = 0; j < 3; j++) live[k][j] += (tgt[k][j] - live[k][j]) * (reduce ? 1 : .07)
      ctx.clearRect(0, 0, W, H)
      const pr = S * 1.12 / 235

      for (let i = 0; i < N; i++) {
        const x = B.x[i], y = B.y[i], z = B.z[i]
        const rx = x * cyw + z * syw, rz = -x * syw + z * cyw, py = y * cp - rz * sp, pz = y * sp + rz * cp
        const nx0 = B.nx[i], ny0 = B.ny[i], nz0 = B.nz[i]
        const nx = nx0 * cyw + nz0 * syw, nz1 = -nx0 * syw + nz0 * cyw, ny = ny0 * cp - nz1 * sp, nz = ny0 * sp + nz1 * cp
        const SC = S * 1.12
        let px = CX + rx * SC * (1 + pz * .13), pyy = CY - py * SC * (1 + pz * .13), k = 1
        if (asm < 1) {
          const raw = clamp((asm * 1.5 - dl[i] * .5 - (x + 1) * .08) / .9); k = raw * raw * raw * (raw * (raw * 6 - 15) + 10)
          const gx = CX + (ox[i] - .5) * W * .5, gy = CY + (oy[i] - .5) * H * .9 + H * .06, an = ox[i] * 19 + k * 4, sw = Math.sin(k * Math.PI) * (1 - k * .3)
          px = gx + (px - gx) * k + Math.cos(an) * sw * 70 * ar[i]; pyy = gy + (pyy - gy) * k + Math.sin(an) * sw * 55 * ar[i]
        }
        if (B.fall[i] && k >= 1) {            // el tronco se deshace en polvo
          const ph = (t * (.05 + B.r[i] * .09) + B.hue[i]) % 1
          px += (B.r[i] - .4) * SC * .22 * ph; pyy += SC * (.18 + B.hue[i] * .4) * ph * (1 + ph)
          const a = Math.pow(1 - ph, 1.3)
          if (a < .06) { bk[i] = -1; continue }
          bk[i] = Math.min(3, (a * 4) | 0); sx[i] = px; sy[i] = pyy; sz[i] = pr * (1.1 + B.r[i] * .8) * .8; cl[i] = reg[i]; continue
        }
        const facing = nz
        if (facing < -.08 && k >= 1) { bk[i] = -1; continue }
        const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), rim = Math.pow(1 - Math.max(0, facing), 2)
        const tone = C.dark ? clamp(diff * 1.05 + .06 - B.g[i] * .25 + rim * .25) : clamp(1 - diff * 1.05 + rim * .45 + B.g[i] * .55)
        const act = c >= 1 && c <= 3 ? (reg[i] === c ? 1.15 : .5) : 1
        const vis2 = clamp((tone * 1.2 + .12 - B.r[i] * .95) * 4.5) * clamp((facing + .08) * 5) * Math.min(1, k * 3) * (.72 + .28 * clamp((pz + 1) / 1.6)) * act
        if (vis2 < .06) { bk[i] = -1; continue }
        bk[i] = Math.min(3, (vis2 * 4) | 0); sx[i] = px; sy[i] = pyy; cl[i] = reg[i]
        sz[i] = pr * (1.05 + B.r[i] * .85 + pz * .35) * 1.15 * (c >= 1 && c <= 3 && reg[i] === c ? 1.25 : 1)
      }
      for (let b = 0; b < 4; b++) {
        const a = .35 + b * .22
        for (let g = 0; g < 5; g++) {
          const col = live[g]; ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`; ctx.beginPath()
          for (let i = 0; i < N; i++) { if (bk[i] !== b || cl[i] !== g) continue; ctx.rect(sx[i], sy[i], sz[i], sz[i]) }
          ctx.fill()
        }
      }
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

        {decor}

        <canvas ref={canvasRef} aria-label="Cerebro 3D de partículas. Se puede arrastrar para girarlo." className="absolute inset-0 size-full cursor-grab touch-pan-y active:cursor-grabbing" />

        <div className="pointer-events-none relative mx-auto grid h-full w-full max-w-[1180px] content-end px-4 pb-10 sm:px-10 wide:content-center wide:pb-0">
          <div className="grid max-w-[480px] gap-8">
            <div className="relative min-h-[250px] wide:min-h-[300px]">
              {CHAPTERS.map((c, i) => (
                <div key={c.n + c.kicker} aria-hidden={i !== ch}
                  className={`absolute inset-x-0 bottom-0 grid content-end gap-4 transition-all duration-500 wide:top-0 wide:bottom-auto wide:content-start ${i === ch ? 'translate-y-0 opacity-100' : i < ch ? '-translate-y-4 opacity-0' : 'translate-y-4 opacity-0'}`}>
                  <Kicker color={c.color} className="justify-self-start">{c.kicker.toLowerCase()}</Kicker>
                  <h2 className={`display ${c.intro ? 'text-[clamp(2rem,3.8vw,3.1rem)]' : 'text-[clamp(2.4rem,4.8vw,4rem)]'}`}>
                    {c.title}{c.intro ? <br /> : ' '}
                    {c.pct ? <><span ref={pctRef} style={{ color: c.color }}>0%</span> conectada.</> : <span style={{ color: c.color }}>{c.accent}</span>}
                  </h2>
                  <p className="max-w-[40ch] text-muted">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* progreso a mano: lo que ya pasaste lleva tilde, donde estás va encerrado en un círculo */}
            <ol className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Progreso de la sección">
              {CHAPTERS.slice(1).map((c, j) => {
                const i = j + 1, on = i === ch, done = i < ch
                return (
                  <li key={c.kicker} className="relative inline-flex items-center gap-1.5 leading-none transition-all duration-300"
                    style={{ fontFamily: '"Caveat", cursive', fontSize: '1.45rem', fontWeight: on ? 700 : 500, color: on || done ? c.color : 'var(--text-secondary)', opacity: on || done ? 1 : .55 }}>
                    {done && <svg viewBox="0 0 20 20" className="nb-tick size-[.85em]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path pathLength="1" d="M3 11l4.5 5L17 4" /></svg>}
                    {c.kicker.toLowerCase()}
                    {on && <svg key={ch} viewBox="0 0 100 40" preserveAspectRatio="none" className="nb-circ" aria-hidden="true"><path pathLength="1" d="M12 24C6 10 40 3 64 5c27 2 34 12 26 24-9 11-50 11-68 2-8-4-9-10-5-15" /></svg>}
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
