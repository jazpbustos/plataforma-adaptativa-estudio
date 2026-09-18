import { useEffect, useRef } from 'react'
import { getBrain, getMorph, rng } from '../lib/brainShape.js'

/*
  Firma visual: cerebro de red neuronal hecho de partículas (Canvas 2D, sin librerías 3D).
  - morph=false: al montar, las partículas dispersas se ensamblan en el cerebro.
  - morph=true: ciclo apunte + código + chat → cerebro → vuelta ("del material disperso al conocimiento conectado").
    onPhase recibe el texto de cada fase para mostrarlo como leyenda.
  - Gira apenas, sigue al cursor y cada tanto viajan señales (sinapsis) por la red.
  - Respeta prefers-reduced-motion: dibuja un cuadro fijo.
*/
const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const T1 = 3.2, T2 = 2.8, T3 = 9, T4 = 2.8, LOOP = T1 + T2 + T3 + T4
export const PHASES = { sources: 'apunte.pdf · ejercicio.py · chat con IA', linking: 'conectando…', brain: 'conocimiento conectado' }

export default function NeuralBrain({ className = '', intensity = 1, morph = false, onPhase }) {
  const ref = useRef(null)
  const phaseRef = useRef(onPhase)
  phaseRef.current = onPhase

  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d'), root = document.documentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const brain = getBrain(), N = brain.pts.length, r = rng(3)
    const mo_ = morph ? getMorph() : null

    const parts = brain.pts.map((b, i) => ({
      b, ph: r() * 6.28, rad: .7 + r() * .9, hub: r() < .07,
      delay: morph ? r() * .3 + mo_.source[i].x * .3 : r() * .35 + b.x * .25,
      sx: morph ? mo_.source[i].x : (r() - .5) * 1.6 + .5, sy: morph ? mo_.source[i].y : (r() - .5) * 1.4 + .45,
      x: 0, y: 0, d: 1, col: [0, 0, 0],
    }))
    let lastPhase = ''
    const setPhase = (p) => { if (p !== lastPhase) { lastPhase = p; phaseRef.current?.(p) } }

    let C = {}, W = 0, H = 0, SC = 0, OX = 0, OY = 0, raf = 0, yaw = 0, syn = []
    const mouse = { x: -1e4, y: -1e4, nx: 0 }, start = performance.now()

    function readColors() {
      const css = (n) => getComputedStyle(root).getPropertyValue(n)
      C = { p1: hex(css('--p1')), p2: hex(css('--p2')), p3: hex(css('--p3')), pulse: css('--pulse').trim(),
        dark: getComputedStyle(root).colorScheme === 'dark' }
      parts.forEach((p) => {
        const t = clamp(p.b.x * 1.15 - .08)
        const c = t < .5 ? mix(C.p3, C.p1, t * 2) : mix(C.p1, C.p2, (t - .5) * 2)
        p.col = mix(c, C.p1, Math.max(0, .35 - p.b.y))
      })
    }
    function layout() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SC = Math.min(W * .95, H * 1.15); OX = (W - SC) / 2; OY = (H - SC * .86) / 2 - SC * .03
    }

    function frame(now) {
      const t = reduce ? 0 : now / 1000
      let m
      if (!morph) m = reduce ? 1 : clamp((now - start) / 2600)
      else {
        const T = reduce ? T1 + T2 + 1 : ((now - start) / 1000) % LOOP
        if (T < T1) { m = 0; setPhase(PHASES.sources) }
        else if (T < T1 + T2) { m = (T - T1) / T2; setPhase(PHASES.linking) }
        else if (T < T1 + T2 + T3) { m = 1; setPhase(PHASES.brain) }
        else { m = 1 - (T - T1 - T2 - T3) / T4; setPhase(PHASES.linking) }
      }
      yaw += ((Math.sin(t * .3) * .18 + mouse.nx * .3) - yaw) * .05
      const cy = Math.cos(yaw), sy = Math.sin(yaw)
      ctx.clearRect(0, 0, W, H)
      const near = []
      for (const p of parts) {
        const k = ease(clamp((m * 1.5 - p.delay) / 1)); p.k = k
        const bx = .5 + (p.b.x - .5) * cy + p.b.z * sy
        p.d = 1 + (-(p.b.x - .5) * sy + p.b.z * cy) * .8
        const tx = OX + bx * SC, ty = OY + p.b.y * SC
        const sx = OX + p.sx * SC + (morph ? Math.sin(t * .7 + p.ph) * 2.5 : 0)
        const sy2 = OY + p.sy * SC + (morph ? Math.cos(t * .6 + p.ph) * 2.5 : 0)
        const arc = morph ? Math.sin(k * Math.PI) * (24 + p.ph * 5) : 0
        let x = sx + (tx - sx) * k + Math.cos(p.ph) * arc * .4 + Math.sin(t * .8 + p.ph) * .9
        let y = sy2 + (ty - sy2) * k - arc * .5 + Math.cos(t * .7 + p.ph * 1.3) * .9
        const dx = x - mouse.x, dy = y - mouse.y, dm = Math.hypot(dx, dy) || 1
        if (dm < 110) { const f = 1 - dm / 110; x += dx / dm * f * 10; y += dy / dm * f * 10; if (dm < 80) near.push([dm, x, y]) }
        p.x = x; p.y = y
      }
      // aristas en dos capas (atrás más tenues)
      const base = (C.dark ? .26 : .42) * intensity
      // red de cada ícono mientras están separados
      const sA = morph ? clamp((.25 - m) / .25) : 0
      if (sA > 0) {
        ctx.lineWidth = .6; ctx.strokeStyle = rgba(C.p1, base * sA); ctx.beginPath()
        for (let k = 0; k < mo_.edges.length; k += 2) { const a = parts[mo_.edges[k]], b = parts[mo_.edges[k + 1]]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y) }
        ctx.stroke()
      }
      const eA = base * (morph ? clamp((m - .72) / .28) : clamp((m - .55) / .45))
      if (eA > 0) {
        ctx.lineWidth = .6
        for (const front of [false, true]) {
          ctx.strokeStyle = rgba(C.p1, eA * (front ? 1 : .55)); ctx.beginPath()
          for (let k = 0; k < brain.edges.length; k += 2) {
            const a = parts[brain.edges[k]], b = parts[brain.edges[k + 1]]
            if ((a.d > 1) !== front) continue
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
          }
          ctx.stroke()
        }
      }
      for (const p of parts) {
        const rr = p.rad * (1 + (p.d - 1) * p.k) * (p.hub ? 1.5 : 1) * Math.max(.8, SC / 520)
        ctx.globalAlpha = clamp(.45 + .55 * (p.k ? p.d - .2 : 1)) * intensity
        if (p.hub) { ctx.fillStyle = rgba(p.col, .12); ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.2, 0, 7); ctx.fill() }
        ctx.fillStyle = rgba(p.col, 1); ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill()
      }
      ctx.globalAlpha = 1
      // el cursor también es una neurona
      if (near.length) {
        near.sort((a, b) => a[0] - b[0]); ctx.lineWidth = .7
        for (const [dm, x, y] of near.slice(0, 7)) { ctx.strokeStyle = rgba(C.p2, (1 - dm / 80) * .7); ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(x, y); ctx.stroke() }
        ctx.fillStyle = rgba(C.p2, .9); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2.2, 0, 7); ctx.fill()
      }
      // sinapsis: señales que recorren la red
      if (!reduce && m < .9) syn = []
      if (!reduce && m === 1 && syn.length < 7 && Math.random() < .06) {
        const s0 = (Math.random() * N) | 0
        if (brain.nb[s0].length) syn.push({ path: [s0], cur: s0, next: brain.nb[s0][0], t: 0, hops: 8 + ((Math.random() * 12) | 0) })
      }
      syn = syn.filter((q) => {
        q.t += .1
        const A = parts[q.cur], B = parts[q.next], hx = A.x + (B.x - A.x) * Math.min(1, q.t), hy = A.y + (B.y - A.y) * Math.min(1, q.t)
        const P = q.path.map((i) => parts[i]).concat([{ x: hx, y: hy }])
        ctx.lineWidth = 1.1; ctx.strokeStyle = C.pulse
        for (let i = 1; i < P.length; i++) { ctx.globalAlpha = (i / P.length) * .85; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke() }
        ctx.fillStyle = C.pulse; ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, 7); ctx.fill()
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hx, hy, 1.8, 0, 7); ctx.fill()
        if (q.t >= 1) {
          q.path.push(q.next); if (q.path.length > 6) q.path.shift(); q.hops--
          const o = brain.nb[q.next].filter((j) => !q.path.includes(j))
          if (!q.hops || !o.length) return false
          q.cur = q.next; q.next = o[(Math.random() * o.length) | 0]; q.t = 0
        }
        return true
      })
      ctx.globalAlpha = 1
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => { const b = canvas.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; mouse.nx = (mouse.x / W - .5) * 2 }
    const onLeave = () => { mouse.x = mouse.y = -1e4; mouse.nx = 0 }
    const redraw = () => { readColors(); if (reduce) frame(0) }
    const ro = new ResizeObserver(() => { layout(); if (reduce) frame(0) })
    const mo = new MutationObserver(() => requestAnimationFrame(redraw))
    const mq = matchMedia('(prefers-color-scheme: dark)')

    readColors(); layout()
    ro.observe(canvas)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener('change', redraw)
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', redraw)
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [intensity, morph])

  return <canvas ref={ref} aria-hidden="true" className={`block h-full w-full ${className}`} />
}
