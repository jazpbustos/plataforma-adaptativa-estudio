import { useEffect, useRef } from 'react'
import { getDenseBrain, rng, OUT, spline } from '../lib/brainShape.js'

/*
  Cerebro "vivo" del hero: red densa de partículas con brillo, que respira, gira apenas, sigue al cursor
  y por la que viajan señales. Desde las tres fuentes (puntos `inputs`, en fracciones del lienzo)
  llegan hilos de luz que se funden con la red. Canvas 2D; respeta prefers-reduced-motion.
*/
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const LIGHT = [[36, 78, 228], [102, 56, 236], [206, 48, 182]], DARK = [[110, 150, 255], [170, 130, 255], [255, 130, 225]]

// Masa luminosa del cerebro: silueta rellena con degradé, brillo suave y un núcleo más profundo
function volume(pal, dark) {
  const S = 600, s = document.createElement('canvas'); s.width = s.height = S
  const g = s.getContext('2d')
  g.save(); g.scale(S, S); g.beginPath(); spline(g, OUT, true); g.closePath(); g.restore()
  const lg = g.createLinearGradient(S * .1, S * .6, S * .9, S * .3)
  lg.addColorStop(0, rgba(pal[0], dark ? .22 : .13)); lg.addColorStop(.55, rgba(pal[1], dark ? .22 : .13)); lg.addColorStop(1, rgba(pal[2], dark ? .26 : .16))
  g.shadowColor = rgba(pal[1], .8); g.shadowBlur = 46; g.fillStyle = lg; g.fill(); g.shadowBlur = 0
  g.save(); g.clip()
  const core = g.createRadialGradient(S * .46, S * .42, 0, S * .46, S * .42, S * .36)
  core.addColorStop(0, rgba(dark ? [150, 130, 255] : [28, 30, 150], dark ? .45 : .3)); core.addColorStop(1, rgba(pal[1], 0))
  g.fillStyle = core; g.fillRect(0, 0, S, S)
  const rim = g.createRadialGradient(S * .5, S * .5, S * .28, S * .5, S * .5, S * .5)
  rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, rgba(pal[2], dark ? .16 : .07))
  g.fillStyle = rim; g.fillRect(0, 0, S, S)
  g.restore()
  return s
}

function sprite(c) {
  const s = document.createElement('canvas'); s.width = s.height = 64
  const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, rgba([255, 255, 255], .95)); gr.addColorStop(.14, rgba(c, .75)); gr.addColorStop(.45, rgba(c, .2)); gr.addColorStop(1, rgba(c, 0))
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
  return s
}

export default function BrainGlow({ inputs = [], center = [.76, .5], size = .44, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d'), root = document.documentElement, host = canvas.parentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const brain = getDenseBrain(), N = brain.pts.length, r = rng(5)
    const P = brain.pts.map((b) => {
      const t = clamp(b.x * .95 + (b.y - .4) * .35 + (r() - .5) * .14 - .06)
      return { b, t, ph: r() * 6.28, tw: .8 + r() * 1.6, hub: r() < .04 }
    })
    const ea = brain.edges.filter((_, i) => i % 2 === 0), eb = brain.edges.filter((_, i) => i % 2 === 1)
    const bucket = ea.map((a, i) => Math.min(2, Math.floor((P[a].t + P[eb[i]].t) * 1.5)))
    // fibras largas y curvas entre nodos lejanos
    const fr = rng(9), fibers = []
    for (let n = 0; n < 4000 && fibers.length < 170; n++) {
      const i = (fr() * N) | 0, j = (fr() * N) | 0, d = Math.hypot(P[i].b.x - P[j].b.x, P[i].b.y - P[j].b.y)
      if (d > .1 && d < .34) fibers.push({ i, j, k: Math.min(2, Math.floor((P[i].t + P[j].t) * 1.5)), bend: (fr() - .5) * .9 })
    }
    const xs = new Float32Array(N), ys = new Float32Array(N), ds = new Float32Array(N)
    let W = 0, H = 0, SC = 0, BX = 0, BY = 0, dark = false, pal = LIGHT, spr = [], vol = null, raf = 0, yaw = 0, pulses = []
    const mouse = { x: -1e4, y: -1e4, nx: 0 }

    const readTheme = () => { dark = getComputedStyle(root).colorScheme === 'dark'; pal = dark ? DARK : LIGHT; spr = pal.map(sprite); vol = volume(pal, dark) }
    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SC = Math.min(size * W, H * 1.08)
      BX = center[0] * W - SC / 2; BY = center[1] * H - SC * .47
    }
    const col = (t) => (t < .5 ? mix(pal[0], pal[1], t * 2) : mix(pal[1], pal[2], (t - .5) * 2))

    function frame(now) {
      const t = reduce ? 2 : now / 1000
      yaw += ((Math.sin(t * .33) * .26 + mouse.nx * .2) - yaw) * .05
      const cy = Math.cos(yaw), sy = Math.sin(yaw), br = 1 + Math.sin(t * 1.15) * .012
      ctx.clearRect(0, 0, W, H)
      const cx0 = BX + SC / 2, cy0 = BY + SC * .47
      // halo de fondo
      const hz = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, SC * .5)
      hz.addColorStop(0, rgba(pal[1], dark ? .30 : .20)); hz.addColorStop(.55, rgba(pal[0], dark ? .12 : .08)); hz.addColorStop(1, rgba(pal[0], 0))
      ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = .95; ctx.drawImage(vol, BX - SC * .02, BY - SC * .02, SC * 1.04 * br, SC * 1.04 * br); ctx.globalAlpha = 1
      for (let i = 0; i < N; i++) {
        const b = P[i].b
        const bx = .5 + (b.x - .5) * cy + b.z * sy
        ds[i] = 1 + (-(b.x - .5) * sy + b.z * cy) * .8
        let x = BX + SC / 2 + (bx - .5) * SC * br, y = BY + b.y * SC * br + (br - 1) * -SC * .2
        x += Math.sin(t * .9 + P[i].ph) * .8; y += Math.cos(t * .8 + P[i].ph * 1.3) * .8
        const dx = x - mouse.x, dy = y - mouse.y, dm = Math.hypot(dx, dy) || 1
        if (dm < 100) { const f = 1 - dm / 100; x += dx / dm * f * 9; y += dy / dm * f * 9 }
        xs[i] = x; ys[i] = y
      }
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
      // hilos que entran desde las tres fuentes
      inputs.forEach(([fx, fy], g) => {
        const x0 = fx * W, y0 = fy * H
        for (let s = -2; s <= 2; s++) {
          const tx = BX + SC * (.15 + Math.abs(s) * .012), ty = BY + SC * (.47 + (g - 1) * .05 + s * .035)
          const c1x = x0 + (tx - x0) * .4, c1y = y0 + (g - 1) * SC * .02, c2x = x0 + (tx - x0) * .62, c2y = ty + s * SC * .05
          const at = (q) => { const a = 1 - q; return [a * a * a * x0 + 3 * a * a * q * c1x + 3 * a * q * q * c2x + q * q * q * tx, a * a * a * y0 + 3 * a * a * q * c1y + 3 * a * q * q * c2y + q * q * q * ty] }
          const c = pal[g === 0 ? 0 : g === 1 ? 1 : 2]
          ctx.strokeStyle = rgba(c, .2); ctx.lineWidth = .8; ctx.beginPath()
          for (let i = 0; i <= 26; i++) { const [px, py] = at(i / 26); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
          ctx.stroke()
          for (let i = 0; i < 6; i++) {
            const q = (((t * .1 + i / 6 + s * .09 + g * .27) % 1) + 1) % 1, [px, py] = at(q), a = Math.sin(q * Math.PI)
            ctx.globalAlpha = a * .9; ctx.drawImage(spr[g], px - 6, py - 6, 12, 12)
          }
          ctx.globalAlpha = 1
        }
      })
      // fibras
      ctx.lineWidth = .7
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(pal[k], dark ? .2 : .3); ctx.beginPath()
        for (const f of fibers) {
          if (f.k !== k) continue
          const x1 = xs[f.i], y1 = ys[f.i], x2 = xs[f.j], y2 = ys[f.j], mx = (x1 + x2) / 2 - (y2 - y1) * f.bend, my = (y1 + y2) / 2 + (x2 - x1) * f.bend
          ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2)
        }
        ctx.stroke()
      }
      // aristas
      ctx.lineWidth = .7; ctx.lineCap = 'round'
      for (let k = 0; k < 3; k++) for (const front of [false, true]) {
        ctx.strokeStyle = rgba(pal[k], (dark ? .22 : .36) * (front ? 1.5 : .8)); ctx.beginPath()
        for (let i = 0; i < ea.length; i++) {
          if (bucket[i] !== k || (ds[ea[i]] > 1) !== front) continue
          ctx.moveTo(xs[ea[i]], ys[ea[i]]); ctx.lineTo(xs[eb[i]], ys[eb[i]])
        }
        ctx.stroke()
      }
      // nodos
      const rs = Math.max(.9, SC / 560)
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = rgba(pal[k], 1); ctx.globalAlpha = .55 + .4 * Math.sin(t * 1.3 + k * 2.1) ** 2; ctx.beginPath()
        for (let i = 0; i < N; i++) {
          if (P[i].hub || Math.min(2, Math.floor(P[i].t * 3)) !== k) continue
          const rr = (.8 + (ds[i] - 1) * .7) * rs
          ctx.moveTo(xs[i] + rr, ys[i]); ctx.arc(xs[i], ys[i], rr, 0, 7)
        }
        ctx.fill()
      }
      ctx.globalAlpha = 1
      for (let i = 0; i < N; i++) {
        if (!P[i].hub) continue
        const k = Math.min(2, Math.floor(P[i].t * 3)), tw = .55 + .45 * Math.sin(t * P[i].tw + P[i].ph), sz = (11 + 15 * tw) * rs * (.8 + (ds[i] - 1))
        ctx.globalAlpha = clamp(tw + .15); ctx.drawImage(spr[k], xs[i] - sz, ys[i] - sz, sz * 2, sz * 2)
      }
      ctx.globalAlpha = 1
      // señales que recorren la red
      if (!reduce && pulses.length < 22 && Math.random() < .35) {
        const s0 = (Math.random() * N) | 0
        if (brain.nb[s0].length) pulses.push({ path: [s0], cur: s0, next: brain.nb[s0][0], q: 0, hops: 10 + ((Math.random() * 16) | 0), k: Math.min(2, Math.floor(P[s0].t * 3)) })
      }
      pulses = pulses.filter((p) => {
        p.q += .16
        const A = p.cur, B = p.next, q = Math.min(1, p.q), hx = xs[A] + (xs[B] - xs[A]) * q, hy = ys[A] + (ys[B] - ys[A]) * q
        const pts = p.path.map((i) => [xs[i], ys[i]]).concat([[hx, hy]])
        ctx.strokeStyle = rgba(mix(pal[p.k], [255, 255, 255], dark ? .35 : .1), 1); ctx.lineWidth = 1.2
        for (let i = 1; i < pts.length; i++) { ctx.globalAlpha = (i / pts.length) * .9; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke() }
        ctx.globalAlpha = 1; ctx.drawImage(spr[p.k], hx - 9, hy - 9, 18, 18)
        if (p.q >= 1) {
          p.path.push(p.next); if (p.path.length > 6) p.path.shift(); p.hops--
          const o = brain.nb[p.next].filter((j) => !p.path.includes(j))
          if (!p.hops || !o.length) return false
          p.cur = p.next; p.next = o[(Math.random() * o.length) | 0]; p.q = 0
        }
        return true
      })
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => { const b = canvas.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; mouse.nx = clamp((mouse.x / W - .5) * 2, -1, 1) }
    const onLeave = () => { mouse.x = mouse.y = -1e4; mouse.nx = 0 }
    const redraw = () => { readTheme(); if (reduce) frame(0) }
    const ro = new ResizeObserver(() => { layout(); if (reduce) frame(0) })
    const mo = new MutationObserver(() => requestAnimationFrame(redraw))
    readTheme(); layout(); ro.observe(canvas)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave) }
  }, [size, center[0], center[1], JSON.stringify(inputs)])

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`} />
}
