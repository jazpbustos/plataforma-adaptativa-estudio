import { useEffect, useRef } from 'react'

/*
  Cerebro de partículas en 3D real (Canvas 2D, sin librerías):
  - La superficie se genera una sola vez (hemisferios con surcos, lóbulo temporal, cerebelo y tronco).
  - Cada partícula tiene posición y normal 3D; al rotar, la luz fija arriba a la izquierda decide cuántos
    granitos se ven (densidad = sombra) y de qué tono, así el volumen se lee y "rueda".
  - Al montar, las partículas salen de los elementos con data-anchor (apunte, código, chat) y se ensamblan.
  - Después sigue girando; el tronco se deshace en polvo que cae; de las fuentes llegan hilos de partículas.
  Respeta prefers-reduced-motion: dibuja un cuadro fijo.
*/
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// ---------- ruido de Perlin 3D ----------
const PERM = (() => { const r = mulberry(7), a = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] } return Uint8Array.from([...a, ...a]) })()
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t
const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v) }
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z)
  const u = fade(x), v = fade(y), w = fade(z), A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z
  return lerp(lerp(lerp(grad(PERM[AA], x, y, z), grad(PERM[BA], x - 1, y, z), u), lerp(grad(PERM[AB], x, y - 1, z), grad(PERM[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(PERM[AA + 1], x, y, z - 1), grad(PERM[BA + 1], x - 1, y, z - 1), u), lerp(grad(PERM[AB + 1], x, y - 1, z - 1), grad(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w)
}

// ---------- forma del cerebro (el frente mira hacia -x) ----------
// Devuelve [x, y, z, surco 0..1, fisura 0..1] para una dirección unitaria.
function brain(dx, dy, dz) {
  let r = 1 / Math.sqrt((dx / 1) ** 2 + (dy / .66) ** 2 + (dz / .6) ** 2)
  if (dy < 0) r *= 1 - .34 * Math.pow(-dy, 1.2)                                   // base más plana
  r *= 1 + .26 * Math.exp(-(((dx + .15) ** 2 + (dy + .55) ** 2 + (Math.abs(dz) - .62) ** 2)) / .09) // lóbulo temporal
  r *= 1 + .05 * smooth(0, -.8, dx) - .07 * smooth(.45, 1, dx)                     // frente más lleno, nuca más fina
  const fis = Math.exp(-((dz / .05) ** 2)) * smooth(-.15, .45, dy)
  r *= 1 - .16 * fis                                                                // fisura longitudinal
  const px = dx * r, py = dy * r, pz = dz * r
  const wx = px + noise(px * 3 + 5, py * 3, pz * 3) * .22, wy = py + noise(px * 3, py * 3 + 9, pz * 3) * .22, wz = pz + noise(px * 3, py * 3, pz * 3 + 3) * .22
  const v = noise(wx * 3.2, wy * 3.2, wz * 3.2) * .62 + noise(wx * 7, wy * 7, wz * 7) * .28 + noise(wx * 14, wy * 14, wz * 14) * .1
  const sulc = smooth(.55, .93, 1 - Math.min(1, Math.abs(v) * 3))                 // surcos como líneas sinuosas
  r *= 1 - .15 * sulc
  return [dx * r, dy * r, dz * r, sulc, fis]
}
const inBrain = (x, y, z, k = .97) => { const l = Math.hypot(x, y, z) || 1, b = brain(x / l, y / l, z / l); return l < Math.hypot(b[0], b[1], b[2]) * k }

let cache = null
export function build() {
  if (cache) return cache
  let part = 0
  const r = mulberry(3), PT = [], X = [], Y = [], Z = [], NX = [], NY = [], NZ = [], G = [], F = [], Rn = [], Fall = [], Hue = []
  const push = (p, n, g, fall) => { X.push(p[0]); Y.push(p[1]); Z.push(p[2]); const l = Math.hypot(n[0], n[1], n[2]) || 1; NX.push(n[0] / l); NY.push(n[1] / l); NZ.push(n[2] / l); G.push(g); Rn.push(r()); Fall.push(fall); Hue.push(r()); PT.push(part) }
  const dust = (y) => (r() < clamp((-y - .42) / .75) * .75 ? 1 : 0)
  // cerebro: puntos de Fibonacci sobre la esfera
  const NB = 34000, ga = Math.PI * (3 - Math.sqrt(5)), e = .012
  for (let i = 0; i < NB; i++) {
    const y = 1 - (i / (NB - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i, d = [Math.cos(th) * rr, y, Math.sin(th) * rr]
    const p = brain(d[0], d[1], d[2])
    if (p[1] < -.5) continue                                                    // la base se recorta (ahí van cerebelo y tronco)
    const t1 = [-d[2], 0, d[0]], t2 = [d[1] * t1[2] - d[2] * t1[1], d[2] * t1[0] - d[0] * t1[2], d[0] * t1[1] - d[1] * t1[0]]
    const n1 = (() => { const q = [d[0] + t1[0] * e, d[1], d[2] + t1[2] * e], l = Math.hypot(...q); return brain(q[0] / l, q[1] / l, q[2] / l) })()
    const n2 = (() => { const q = [d[0] + t2[0] * e, d[1] + t2[1] * e, d[2] + t2[2] * e], l = Math.hypot(...q); return brain(q[0] / l, q[1] / l, q[2] / l) })()
    const a = [n1[0] - p[0], n1[1] - p[1], n1[2] - p[2]], b = [n2[0] - p[0], n2[1] - p[1], n2[2] - p[2]]
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    if (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] < 0) n = n.map((v) => -v)
    push(p, n, Math.max(p[3], p[4] * .8), dust(p[1]))
  }
  part = 1
  // cerebelo: elipsoide con estrías horizontales, sin lo que queda dentro del cerebro
  for (let i = 0; i < 4200; i++) {
    const u = r() * 2 - 1, th = r() * 6.283, s = Math.sqrt(1 - u * u), d = [Math.cos(th) * s, u, Math.sin(th) * s]
    const str = Math.sin((u * .26) * 95 + noise(d[0] * 3, d[2] * 3, 1) * 4) > .55 ? 1 : 0
    const k = 1 - .05 * str
    const p = [.56 + d[0] * .36 * k, -.38 + d[1] * .22 * k, d[2] * .38 * k]
    if (inBrain(p[0], p[1], p[2])) continue
    push(p, [d[0] / .34, d[1] / .21, d[2] / .36], str * .8, dust(p[1]))
  }
  part = 2
  // tronco
  for (let i = 0; i < 2600; i++) {
    const t = r(), th = r() * 6.283, rad = .12 * (1 - .25 * t), cx = .3 + .2 * t, cy = -.4 - .5 * t
    const p = [cx + Math.cos(th) * rad, cy, Math.sin(th) * rad]
    if (inBrain(p[0], p[1], p[2], .93)) continue
    push(p, [Math.cos(th), 0, Math.sin(th)], 0, Math.min(1, dust(p[1]) + (t > .55 ? 1 : 0) * .6) > .5 ? 1 : 0)
  }
  const N = X.length
  cache = { N, x: Float32Array.from(X), y: Float32Array.from(Y), z: Float32Array.from(Z), nx: Float32Array.from(NX), ny: Float32Array.from(NY), nz: Float32Array.from(NZ),
    g: Float32Array.from(G), r: Float32Array.from(Rn), fall: Uint8Array.from(Fall), hue: Float32Array.from(Hue), part: Uint8Array.from(PT) }
  return cache
}

export default function ParticleBrain({ center = [.5, .5], size = .5, anchors = false, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d'), root = document.documentElement, host = canvas.parentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const B = build(), N = B.N, rr = mulberry(11)
    // origen de cada partícula (una de las fuentes), recorrido y demora
    const sg = new Uint8Array(N), sa = new Float32Array(N), sr = new Float32Array(N), dl = new Float32Array(N), ar = new Float32Array(N)
    for (let i = 0; i < N; i++) { sg[i] = (rr() * 3) | 0; sa[i] = rr() * 6.283; sr[i] = Math.sqrt(rr()) * 26; dl[i] = rr(); ar[i] = (rr() - .5) * 2 }
    const sx = new Float32Array(N), sy = new Float32Array(N), al = new Float32Array(N), bk = new Int8Array(N), sz = new Float32Array(N), co = new Float32Array(N)
    let W = 0, H = 0, SC = 0, CX = 0, CY = 0, dark = false, raf = 0, src = [], t0 = 0
    const mouse = { x: 0, y: 0 }
    const L = (() => { const v = [-.5, .62, .62], l = Math.hypot(...v); return v.map((a) => a / l) })()

    const theme = () => { dark = getComputedStyle(root).colorScheme === 'dark' }
    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      SC = Math.min(size * W, H * .8) / 2.1
      CX = center[0] * W; CY = center[1] * H
      const cb = canvas.getBoundingClientRect()
      src = anchors ? [...host.querySelectorAll('[data-anchor]')].map((e) => { const b = e.getBoundingClientRect(); return [b.left - cb.left + b.width / 2, b.top - cb.top + b.height / 2] }) : []
      if (!src.length) src = [[W * .5, H * .96], [W * .42, H * .96], [W * .58, H * .96]]
    }

    function frame(now) {
      if (!t0) t0 = now
      const ts = reduce ? 99 : (now - t0) / 1000
      const yaw = reduce ? .5 : -1.0 + ts * .3 + Math.min(ts, 4) * .0 + mouse.x * .25, pitch = .2 + mouse.y * .1
      const cy = Math.cos(yaw), sy2 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      ctx.clearRect(0, 0, W, H)
      const ink = dark ? [214, 200, 255] : [74, 38, 150], hi = dark ? [236, 228, 255] : [150, 108, 236]
      const pr = SC / 235

      for (let i = 0; i < N; i++) {
        const x = B.x[i], y = B.y[i], z = B.z[i]
        const rx = x * cy + z * sy2, rz = -x * sy2 + z * cy
        const py = y * cp - rz * sp, pz = y * sp + rz * cp
        const nx0 = B.nx[i], ny0 = B.ny[i], nz0 = B.nz[i]
        const nx = nx0 * cy + nz0 * sy2, nz1 = -nx0 * sy2 + nz0 * cy
        const ny = ny0 * cp - nz1 * sp, nz = ny0 * sp + nz1 * cp
        let px = CX + rx * SC * (1 + pz * .13), pyy = CY - py * SC * (1 + pz * .13)
        // ensamble: una nube de polvo se arremolina y se condensa en el cerebro
        let k = 1
        if (!reduce) {
          const raw = clamp((ts - .2 - dl[i] * 2.6 - (x + 1) * .35) / 2.6); const e = raw * raw * raw * (raw * (raw * 6 - 15) + 10)
          const ox = CX + (sa[i] / 6.283 - .5) * W * .8, oy = CY + (sr[i] / 26 - .5) * H * 1.0 + H * .08
          const sw = Math.sin(e * Math.PI) * (1 - e * .3), an = sa[i] * 3 + e * 4
          px = ox + (px - ox) * e + Math.cos(an) * sw * 90 * ar[i]; pyy = oy + (pyy - oy) * e + Math.sin(an) * sw * 70 * ar[i]
          k = e
        }
        if (B.fall[i] && k >= 1) {
          const ph = (ts * (.05 + B.r[i] * .09) + B.hue[i]) % 1
          px += (B.r[i] - .4) * SC * .22 * ph + Math.sin(ts + i) * 3 * ph; pyy += SC * (.18 + B.hue[i] * .4) * ph * (1 + ph)
          al[i] = 0; sz[i] = 0
          const a = Math.pow(1 - ph, 1.3)
          if (a < .06) { bk[i] = -1; continue }
          bk[i] = Math.min(3, (a * 4) | 0); sx[i] = px; sy[i] = pyy; sz[i] = pr * (1.1 + B.r[i] * .8) * .8; co[i] = .5; continue
        }
        // visibilidad: cara hacia la cámara + densidad según la luz (granitos = sombra)
        const facing = nz
        if (facing < -.08 && k >= 1) { bk[i] = -1; continue }
        const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
        const rim = Math.pow(1 - Math.max(0, facing), 2)
        let tone = dark ? clamp(diff * 1.05 + .06 + B.g[i] * -.25 + rim * .25) : clamp(1 - diff * 1.05 + rim * .45 + B.g[i] * .55)
        if (dark) tone = clamp(tone - B.g[i] * .15)
        const vis = clamp((tone * 1.2 + .12 - B.r[i] * .95) * 4.5) * clamp((facing + .08) * 5) * Math.min(1, k * 3) * (.72 + .28 * clamp((pz + 1) / 1.6))
        if (vis < .06) { bk[i] = -1; continue }
        bk[i] = Math.min(3, (vis * 4) | 0); sx[i] = px; sy[i] = pyy
        sz[i] = pr * (1.05 + B.r[i] * .85 + pz * .35) * 1.15; co[i] = tone
      }
      for (let b = 0; b < 4; b++) {
        const a = .35 + b * .22
        for (let c = 0; c < 2; c++) {            // dos tonos: más profundo / más lila
          const col = c ? hi : ink
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`; ctx.beginPath()
          const thr = dark ? .45 : .62
          for (let i = 0; i < N; i++) { if (bk[i] !== b || (co[i] > thr ? 0 : 1) !== c) continue; ctx.rect(sx[i], sy[i], sz[i], sz[i]) }
          ctx.fill()
        }
      }
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => { const b = canvas.getBoundingClientRect(); mouse.x = clamp(((e.clientX - b.left) / b.width - .5) * 2, -1, 1); mouse.y = clamp(((e.clientY - b.top) / b.height - .5) * 2, -1, 1) }
    const ro = new ResizeObserver(() => { layout(); if (reduce) frame(0) })
    const mo = new MutationObserver(() => requestAnimationFrame(() => { theme(); if (reduce) frame(0) }))
    theme(); layout(); ro.observe(canvas); ro.observe(host)
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    host.addEventListener('pointermove', onMove)
    document.fonts?.ready.then(() => { layout(); if (reduce) frame(0) })
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); host.removeEventListener('pointermove', onMove) }
  }, [size, center[0], center[1], anchors])

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`} />
}
