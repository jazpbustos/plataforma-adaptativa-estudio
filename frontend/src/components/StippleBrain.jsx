import { useEffect, useRef } from 'react'
import { OUT, GYRI, spline } from '../lib/brainShape.js'

/*
  Cerebro punteado: miles de puntitos de un solo color; la densidad dibuja el volumen (luz arriba a la
  izquierda, surcos y bordes más densos) y hacia abajo se deshace en polvo que cae.
  Desde los elementos con data-anchor (las tres fuentes) llegan hilos de puntos que se suman al cerebro.
  Canvas 2D. Respeta prefers-reduced-motion.
*/
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }

let cache = null
function build() {
  if (cache) return cache
  const S = 640, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c }
  const mask = mk(), groove = mk(), gm = mask.getContext('2d', { willReadFrequently: true }), gg = groove.getContext('2d', { willReadFrequently: true })
  gm.fillStyle = '#000'; gm.save(); gm.scale(S, S); gm.beginPath(); spline(gm, OUT, true); gm.closePath(); gm.fill(); gm.restore()
  gg.strokeStyle = '#000'; gg.lineCap = 'round'; gg.lineJoin = 'round'; gg.shadowColor = '#000'; gg.shadowBlur = 7
  gg.save(); gg.scale(S, S); gg.lineWidth = .016; for (const c of GYRI) { gg.beginPath(); spline(gg, c, false); gg.stroke() } gg.restore()
  const md = gm.getImageData(0, 0, S, S).data, gd = gg.getImageData(0, 0, S, S).data
  const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && md[((y | 0) * S + (x | 0)) * 4 + 3] > 127
  const r = mulberry(21), pts = []
  const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]]
  for (let tries = 0; pts.length < 27000 && tries < 900000; tries++) {
    const x = r() * S, y = r() * S
    if (!inside(x, y)) continue
    const u = x / S, v = y / S
    let edge = 0; for (const [a, b] of ring) if (!inside(x + a * 16, y + b * 16)) edge++
    const gr = gd[((y | 0) * S + (x | 0)) * 4 + 3] / 255
    const shade = clamp((u - .15) * .55 + (v - .1) * .75)            // luz desde arriba a la izquierda
    const T = clamp(.14 + .5 * shade + .7 * gr + .55 * (edge / 8))
    if (r() > Math.pow(T, 1.35)) continue
    const shed = clamp((v - .6) / .26)
    pts.push({ u, v, sz: .55 + r() * .7 + T * .35, a: .55 + r() * .45, ph: r() * 6.28,
      fall: r() < shed * .75 ? 1 : 0, sp: .05 + r() * .09, off: r(), dx: (r() - .3) * .09, dy: .12 + r() * .3 })
  }
  cache = pts
  return pts
}

export default function StippleBrain({ center = [.5, .5], size = .9, anchors = false, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d'), root = document.documentElement, host = canvas.parentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const P = build(), N = P.length
    let W = 0, H = 0, SC = 0, BX = 0, BY = 0, ink = [70, 38, 140], gcol = [], raf = 0, src = []
    const mouse = { x: 0 }

    const theme = () => {
      const cs = getComputedStyle(root), dark = cs.colorScheme === 'dark'
      ink = dark ? [200, 184, 255] : [66, 34, 142]
      gcol = ['--blue', '--green', '--pink'].map((n) => hex(cs.getPropertyValue(n)))
    }
    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SC = Math.min(size * W, H * .86)
      BX = center[0] * W - SC / 2; BY = center[1] * H - SC * .47
      const cb = canvas.getBoundingClientRect()
      src = anchors ? [...host.querySelectorAll('[data-anchor]')].map((e) => { const b = e.getBoundingClientRect(); return [b.left - cb.left + b.width / 2, b.top - cb.top + b.height / 2] }) : []
    }

    function frame(now) {
      const t = reduce ? 3 : now / 1000
      ctx.clearRect(0, 0, W, H)
      const px = mouse.x * 7
      // masa del cerebro y polvo que cae
      const rgb = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = rgb(.36 + b * .21); ctx.beginPath()
        for (let i = b; i < N; i += 4) {
          const p = P[i]
          let x = BX + p.u * SC + px, y = BY + p.v * SC, al = 1
          if (p.fall) {
            const ph = (t * p.sp + p.off) % 1
            x += p.dx * SC * ph + Math.sin(t + p.ph) * 2 * ph; y += p.dy * SC * ph * (1 + ph)
            al = Math.pow(1 - ph, 1.3)
            if (al < .05) continue
          } else {
            const tw = .78 + .22 * Math.sin(t * 1.4 + p.ph)
            if (tw < .8 && (i & 7) === 0) continue
          }
          const s = p.sz * (SC / 620) * (.9 + al * .1)
          if (al < .7) { ctx.fillStyle = rgb((.36 + b * .21) * al); ctx.fillRect(x, y, s, s); ctx.fillStyle = rgb(.36 + b * .21) } else ctx.rect(x, y, s, s)
        }
        ctx.fill()
      }
      // hilos de puntos desde cada fuente hacia el cerebro
      src.forEach(([x0, y0], g) => {
        const tx = BX + SC * .12 + px, ty = BY + SC * (.42 + (g - 1) * .07)
        const c1 = [x0 + (tx - x0) * .45, y0], c2 = [x0 + (tx - x0) * .6, ty]
        const at = (q) => { const a = 1 - q; return [a * a * a * x0 + 3 * a * a * q * c1[0] + 3 * a * q * q * c2[0] + q * q * q * tx, a * a * a * y0 + 3 * a * a * q * c1[1] + 3 * a * q * q * c2[1] + q * q * q * ty] }
        const c = gcol[g] || ink
        for (let i = 0; i < 70; i++) {
          const q = (((t * .07 + i / 70 + g * .21) % 1) + 1) % 1, [x, y] = at(q)
          const sp = Math.sin((i * 12.9898 + g * 78.2) * 43758.5453) % 1 * 7
          const a = Math.sin(q * Math.PI) ** .7
          ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a * .95})`
          const s = 1.4 + (i % 3) * .55
          ctx.fillRect(x + sp * (1 - q) * .8, y + sp * (1 - q) * .5, s, s)
        }
      })
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => { const b = canvas.getBoundingClientRect(); mouse.x = clamp(((e.clientX - b.left) / b.width - .5) * 2, -1, 1) }
    const redraw = () => { theme(); if (reduce) frame(0) }
    const ro = new ResizeObserver(() => { layout(); if (reduce) frame(0) })
    const mo = new MutationObserver(() => requestAnimationFrame(redraw))
    theme(); layout(); ro.observe(canvas); ro.observe(host)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    host.addEventListener('pointermove', onMove)
    document.fonts?.ready.then(() => { layout(); if (reduce) frame(0) })
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); host.removeEventListener('pointermove', onMove) }
  }, [size, center[0], center[1], anchors])

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`} />
}
