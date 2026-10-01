import { useEffect, useRef } from 'react'
import { getWorld } from '../lib/world.js'

/*
  Lienzo fijo detrás de toda la landing en modo oscuro. Las mismas 1500 partículas del cerebro
  cambian de forma a medida que se scrollea: apunte + código + chat → herramientas sueltas →
  cerebro → una región por módulo → la ruta → cerebro completo.
  Cada escena de la página es una "parada" (STOPS): define forma, cámara y qué regiones se encienden.
  Entre dos paradas todo se interpola según el scroll. Canvas 2D, proyección en perspectiva a mano.
  - Las partículas reaccionan al cursor (lo esquivan y se conectan con él como neuronas).
  - Al scrollear rápido se estiran con un poco de inercia.
  - En los módulos se puede arrastrar para girar el cerebro (data-world-drag).
  - prefers-reduced-motion: sin movimiento propio (solo cambia de forma con el scroll).
*/
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const ss = (t) => t * t * (3 - 2 * t)
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const plateau = (t, a) => ss(clamp((t - a) / (1 - 2 * a))) // se queda quieto en las paradas y cambia en el medio
const lerp = (a, b, t) => a + (b - a) * t
const hex = (h) => { h = h.trim().replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const D = 3.6 // distancia de la cámara
const DX = .7 // cuánto se desfasa el arranque de cada partícula en una transformación

// lit = regiones encendidas [Aprender, Practicar, Consolidar]; act = la que está en foco
const FOC = (lit, act) => ({ fm: 1, lit, act })
const ALL = { fm: 0, lit: [1, 1, 1], act: [0, 0, 0] }
const cam = (ox, cy, sc, yaw, pitch, px = 0) => ({ ox, cy, sc, yaw, pitch, px })
const STOPS = [
  { at: ['w-hero', 'p', 0], shape: 'sources', dim: 1, cam: cam(1.1, .52, .76, .12, .08), n: { ox: 0, cy: .78, sc: .68 }, foc: ALL },
  { at: ['w-statement', 'c'], shape: 'fragments', dim: .5, cam: cam(0, .5, .85, .25, .05), n: { sc: .6 }, foc: ALL },
  { at: ['modulos', 'p', .1], shape: 'brain', dim: 1, cam: cam(.95, .5, 1, -.7, .12), n: { ox: 0, cy: .27, sc: .8 }, foc: FOC([0, 0, 0], [0, 0, 0]) },
  { at: ['modulos', 'p', .3], shape: 'brain', dim: 1, cam: cam(.95, .5, 1, -.35, .12), n: { ox: 0, cy: .27, sc: .8 }, foc: FOC([1, 0, 0], [1, 0, 0]) },
  { at: ['modulos', 'p', .5], shape: 'brain', dim: 1, cam: cam(.95, .5, 1.04, .1, .16), n: { ox: 0, cy: .27, sc: .8 }, foc: FOC([1, 1, 0], [0, 1, 0]) },
  { at: ['modulos', 'p', .7], shape: 'brain', dim: 1, cam: cam(.95, .5, 1.04, .5, .1), n: { ox: 0, cy: .27, sc: .8 }, foc: FOC([1, 1, 1], [0, 0, 1]) },
  { at: ['modulos', 'p', .9], shape: 'brain', dim: 1, cam: cam(.95, .5, 1.08, .9, .12), n: { ox: 0, cy: .27, sc: .8 }, foc: ALL },
  { at: ['ruta', 'p', .03], shape: 'path', dim: .62, cam: cam(-.15, .5, .86, .12, .16, -2.45), n: { ox: 0, cy: .5, sc: .55 }, foc: ALL, lin: true },
  { at: ['ruta', 'p', .97], shape: 'path', dim: .62, cam: cam(-.15, .5, .86, -.06, .16, 2.5), n: { ox: 0, cy: .5, sc: .55 }, foc: ALL },
  { at: ['w-cierre', 'end'], shape: 'brain', dim: .95, cam: cam(0, .25, .74, .4, .08), n: { cy: .24, sc: .72 }, foc: ALL },
]

export default function ParticleWorld() {
  const ref = useRef(null)

  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d'), root = document.documentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const Wd = getWorld(), N = Wd.N, ND = matchMedia('(max-width: 700px)').matches ? 240 : Wd.ND
    const tot = N + ND
    const sx = new Float32Array(tot), sy = new Float32Array(tot), sf = new Float32Array(tot), ly = new Float32Array(N)
    const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N)
    const base = new Float32Array(N * 3)
    let C = {}, W = 0, H = 0, raf = 0, pending = 0, syn = []
    const els = STOPS.map(() => null)
    let scrollSm = window.scrollY, lastSc = window.scrollY, vs = 0, litN = 0
    let yawAuto = 0, dragYaw = 0, dragV = 0, drag = null
    const mouse = { x: -1e4, y: -1e4, nx: 0, ny: 0 }, start = performance.now()
    const sm = { cam: null, fm: 1, lit: [0, 0, 0], act: [0, 0, 0], dim: 1 }

    function readColors() {
      const css = (n) => getComputedStyle(root).getPropertyValue(n)
      C = { p1: hex(css('--p1')), p2: hex(css('--p2')), p3: hex(css('--p3')), violet: hex(css('--violet')), blue: hex(css('--blue')), green: hex(css('--green')),
        pink: hex(css('--pink')), dim: hex(css('--node-dim')), pulse: css('--pulse').trim() }
      const b = Wd.shapes.brain
      for (let i = 0; i < N; i++) {
        const g = clamp((b[i * 3] + 1.05) / 2.1), c0 = g < .5 ? mix(C.p3, C.p1, g * 2) : mix(C.p1, C.p2, (g - .5) * 2)
        const c = mix(c0, C.p1, Math.max(0, .35 - b[i * 3 + 1]))
        base[i * 3] = c[0]; base[i * 3 + 1] = c[1]; base[i * 3 + 2] = c[2]
        if (!cr[i]) { cr[i] = c[0]; cg[i] = c[1]; cb[i] = c[2] }
      }
    }
    function layout() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      schedule()
    }

    const anchor = (s, i, vh, maxS) => {
      const [id, mode, p] = s.at
      const el = els[i] || (els[i] = document.getElementById(id))
      if (!el) return null
      const r = el.getBoundingClientRect(), top = r.top + window.scrollY
      if (mode === 'p') return top + p * Math.max(0, r.height - vh)
      if (mode === 'c') return top + r.height / 2 - vh / 2
      return maxS
    }

    function frame(now) {
      raf = 0; pending = 0
      const t = reduce ? 0 : now / 1000, vh = innerHeight
      const wide = W >= 1024 && W / H >= 1
      const maxS = Math.max(1, document.documentElement.scrollHeight - vh)
      const sc = window.scrollY
      vs += ((sc - lastSc) - vs) * .15; lastSc = sc
      scrollSm += (sc - scrollSm) * (reduce ? 1 : .16)

      // ---- escena actual: entre qué dos paradas estamos y cuánto avanzamos ----
      const ys = []
      let prev = -1e9
      STOPS.forEach((s, i) => { let y = anchor(s, i, vh, maxS); if (y == null) y = prev + 1; y = Math.max(y, prev + 1); ys.push(y); prev = y })
      let i0 = 0
      for (let i = 0; i < STOPS.length - 1; i++) if (scrollSm >= ys[i]) i0 = i
      const A = STOPS[i0], B = STOPS[Math.min(STOPS.length - 1, i0 + 1)]
      const tt = clamp((scrollSm - ys[i0]) / ((ys[Math.min(STOPS.length - 1, i0 + 1)] - ys[i0]) || 1))
      const same = A.shape === B.shape
      const m = same ? 0 : plateau(tt, .14)
      const u = A.lin ? tt : plateau(tt, .18)

      const cA = wide ? A.cam : { ...A.cam, ...A.n }, cB = wide ? B.cam : { ...B.cam, ...B.n }
      const tc = {}; for (const k in cA) tc[k] = lerp(cA[k], cB[k], u)
      const tfm = lerp(A.foc.fm, B.foc.fm, u), tdim = lerp(A.dim, B.dim, u)
      const tl = [0, 1, 2].map((k) => lerp(A.foc.lit[k], B.foc.lit[k], u)), ta = [0, 1, 2].map((k) => lerp(A.foc.act[k], B.foc.act[k], u))
      // suaviza los cambios bruscos de cámara (por ejemplo al redimensionar)
      const a = reduce ? 1 : .2
      if (!sm.cam) sm.cam = { ...tc }
      for (const k in tc) sm.cam[k] += (tc[k] - sm.cam[k]) * a
      sm.fm += (tfm - sm.fm) * a; sm.dim += (tdim - sm.dim) * a
      for (let k = 0; k < 3; k++) { sm.lit[k] += (tl[k] - sm.lit[k]) * a; sm.act[k] += (ta[k] - sm.act[k]) * a }
      const cm = sm.cam

      // ---- cámara ----
      if (!drag) { dragV *= .94; dragYaw += dragV }
            mouse.nx += ((mouse.x > -1e3 ? (mouse.x / W - .5) * 2 : 0) - mouse.nx) * .05
      mouse.ny += ((mouse.y > -1e3 ? (mouse.y / H - .5) * 2 : 0) - mouse.ny) * .05
      yawAuto = reduce ? 0 : Math.sin(t * .35) * .26
      const yaw = cm.yaw + yawAuto * (wide ? 1 : .6) + dragYaw + mouse.nx * .14, pitch = cm.pitch + mouse.ny * .06
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const S = wide ? Math.min(W, H * 1.5) * .23 * cm.sc : Math.min(W * .34, H * .24) * cm.sc
      const CX = W / 2 + cm.ox * S, CY = H * cm.cy
      const intro = reduce ? 1 : clamp((performance.now() - start) / 2800)

      // ---- colores objetivo por región (según qué módulo está en foco) ----
      const cols = [C.blue, C.green, C.pink], dimC = mix(C.dim, C.violet, .4)
      const fc = [mix(dimC, C.violet, .22)]
      for (let k = 0; k < 3; k++) fc.push(mix(dimC, cols[k], sm.lit[k] * (.42 + .58 * sm.act[k])))
      const glowCol = sm.fm > .5 && Math.max(...sm.act) > .3 ? cols[sm.act.indexOf(Math.max(...sm.act))] : C.violet

      // ---- posición de cada partícula ----
      const SA = Wd.shapes[A.shape], SB = Wd.shapes[B.shape], CL = Wd.shapes.cloud
      const dirs = Wd.dirs, cl = reduce ? 1 : .08
      let ia = 1
      const P = { x: 0, y: 0, f: 1 }
      const proj = (x, y, z) => {
        x -= cm.px
        const X = x * cyw + z * syw, Z0 = -x * syw + z * cyw, Y = y * cp - Z0 * sp, Z = y * sp + Z0 * cp
        const f = D / Math.max(1.2, D + Z)
        P.x = CX + X * S * f; P.y = CY - Y * S * f; P.f = f
      }
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, dl = Wd.del[i]
        const k = m <= 0 ? 0 : m >= 1 ? 1 : ease(clamp(m * (1 + DX) - dl / .7 * DX))
        let x = SA[i3] + (SB[i3] - SA[i3]) * k, y = SA[i3 + 1] + (SB[i3 + 1] - SA[i3 + 1]) * k, z = SA[i3 + 2] + (SB[i3 + 2] - SA[i3 + 2]) * k
        if (intro < 1) {
          const ki = ease(clamp(intro * (1 + DX) - dl / .7 * DX))
          x = CL[i3] + (x - CL[i3]) * ki; y = CL[i3 + 1] + (y - CL[i3 + 1]) * ki; z = CL[i3 + 2] + (z - CL[i3 + 2]) * ki
          if (i === 0) ia = 1
        }
        const sk = Math.sin(k * Math.PI)
        if (sk > .001) {
          const th = sk * Wd.vort[i], c = Math.cos(th), s = Math.sin(th), nx = x * c + z * s
          z = -x * s + z * c; x = nx
          const am = sk * Wd.arc[i] * 1.1
          x += dirs[i3] * am; y += dirs[i3 + 1] * am; z += dirs[i3 + 2] * am
        }
        if (!reduce) { const p = Wd.ph[i]; x += Math.sin(t * .8 + p) * .007; y += Math.cos(t * .7 + p) * .007; z += Math.sin(t * .6 + p * 1.3) * .007 }
        proj(x, y, z)
        let px = P.x, py = P.y
        // inercia del scroll: las partículas se estiran un poco hacia donde vienen
        const lt = reduce ? 0 : clamp(vs * .9 * (.3 + Wd.rad[i] * .5), -70, 70)
        ly[i] += (lt - ly[i]) * .12; py += ly[i]
        // esquivan el cursor
        const dx = px - mouse.x, dy = py - mouse.y, dm = Math.hypot(dx, dy) || 1
        if (dm < 110 && !reduce) { const f = 1 - dm / 110; px += dx / dm * f * 12; py += dy / dm * f * 12 }
        sx[i] = px; sy[i] = py; sf[i] = P.f
        // color
        const r = Wd.reg[i] > 3 ? 0 : Wd.reg[i], F = fc[r], fm = sm.fm
        cr[i] += (base[i3] + (F[0] - base[i3]) * fm - cr[i]) * cl
        cg[i] += (base[i3 + 1] + (F[1] - base[i3 + 1]) * fm - cg[i]) * cl
        cb[i] += (base[i3 + 2] + (F[2] - base[i3 + 2]) * fm - cb[i]) * cl
      }
      // polvo de fondo
      const dust = Wd.dust
      for (let j = 0; j < ND; j++) {
        const j3 = j * 3, o = N + j
        proj(dust[j3] + Math.sin(t * .1 + Wd.dph[j]) * .15, dust[j3 + 1] - scrollSm * .0011 * (1.4 - (dust[j3 + 2] + 6) / 12), dust[j3 + 2])
        sx[o] = P.x; sy[o] = P.y; sf[o] = P.f
      }

      // ---- dibujo ----
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const dv = sm.dim
      // brillo suave del color del módulo en foco
      const gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, S * 2.4)
      gr.addColorStop(0, `rgba(${glowCol[0] | 0},${glowCol[1] | 0},${glowCol[2] | 0},${.16 * dv})`); gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
      // polvo
      ctx.fillStyle = 'rgb(185,170,240)'
      for (let j = 0; j < ND; j++) {
        const o = N + j, f = sf[o]; ctx.globalAlpha = clamp((f - .5) * .9) * .42 * (.5 + .5 * dv) * intro
        ctx.beginPath(); ctx.arc(sx[o], sy[o], Math.max(.5, .9 * f * f * (S / 300)), 0, 6.283); ctx.fill()
      }
      // aristas (atrás más tenues). Desaparecen a mitad de una transformación.
      const E = m < .5 ? Wd.edges[A.shape] : Wd.edges[B.shape]
      const ea = (same ? 1 : Math.pow(Math.abs(1 - 2 * m), 1.6)) * dv * clamp(intro * 1.4 - .4)
      if (ea > .02 && E.length) {
        for (const front of [false, true]) {
          ctx.globalAlpha = 1; ctx.lineWidth = front ? .7 : .5
          ctx.strokeStyle = `rgba(${C.violet[0] | 0},${C.violet[1] | 0},${C.violet[2] | 0},${.3 * ea * (front ? 1 : .45)})`
          ctx.beginPath()
          for (let k = 0; k < E.length; k += 2) { const p = E[k], q = E[k + 1]; if ((sf[p] > 1) !== front) continue; ctx.moveTo(sx[p], sy[p]); ctx.lineTo(sx[q], sy[q]) }
          ctx.stroke()
        }
      }
      // partículas
      const gate = clamp(Math.max(...sm.act) * 1.6) * sm.fm
      for (let i = 0; i < N; i++) {
        const f = sf[i], hub = Wd.hub[i], rg = Wd.reg[i], ri = rg >= 1 && rg <= 3 ? rg - 1 : -1
        // la región en foco brilla y es más grande; el resto baja
        const ar = ri >= 0 ? sm.act[ri] : 0, wgt = .42 + .16 * (ri >= 0 ? sm.lit[ri] : 0) + .42 * ar
        const al = clamp((f - .68) * 2.3) * dv * (.4 + .6 * clamp(intro * 1.5)) * (1 - gate * (1 - wgt))
        if (al < .02) continue
        const rr = Math.max(.5, Math.min(4.2, Wd.rad[i] * (S / 300) * Math.pow(f, 2.4) * (hub ? 1.6 : 1) * (1 + .35 * ar * gate)))
        const col = `rgb(${cr[i] | 0},${cg[i] | 0},${cb[i] | 0})`
        if (hub && al > .3) { ctx.globalAlpha = al * .1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx[i], sy[i], rr * 3.4, 0, 6.283); ctx.fill() }
        ctx.globalAlpha = al; ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(sx[i], sy[i], rr, 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1

      // nudos de la ruta: se encienden a medida que bajás por los pasos
      const wPath = A.shape === 'path' ? 1 - m : B.shape === 'path' ? m : 0
      const ruta = document.getElementById('ruta')
      if (ruta) { const r = ruta.getBoundingClientRect(); litN = clamp((vh * .55 - r.top) / Math.max(1, r.height - vh * .25)) * 9.4 }
      if (wPath > .05) {
        Wd.pathNodes.forEach((n, k) => {
          proj(n[0], n[1], n[2])
          const lit = k < litN, goal = k === 8, pul = lit && k === Math.floor(litN) - 0 ? 1 + .25 * Math.sin(t * 4) : 1
          const col = goal ? C.pink : mix(C.violet, C.pink, k / 8), rr = (goal ? 16 : 9) * P.f * (S / 300) * pul
          ctx.globalAlpha = wPath * (lit ? .95 : .3)
          ctx.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; ctx.lineWidth = lit ? 1.6 : 1
          ctx.beginPath(); ctx.arc(P.x, P.y, rr, 0, 6.283); ctx.stroke()
          if (lit) { ctx.globalAlpha = wPath * .16; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(P.x, P.y, rr * 2.3, 0, 6.283); ctx.fill() }
        })
        ctx.globalAlpha = 1
      }

      // señales (sinapsis) por el cerebro cuando ya está armado
      const settled = (A.shape === 'brain' && B.shape === 'brain') || (A.shape === 'brain' && m < .04) || (B.shape === 'brain' && m > .96)
      const act = sm.act.indexOf(Math.max(...sm.act)), inFocus = sm.fm > .5 && Math.max(...sm.act) > .5
      if (!settled || reduce) syn = []
      else {
        if (syn.length < (act === 1 && inFocus ? 16 : 8) && Math.random() < (act === 1 && inFocus ? .25 : .08)) {
          let s0 = (Math.random() * N) | 0
          if (inFocus) { const idx = []; for (let i = 0; i < N; i++) if (Wd.reg[i] === act + 1) idx.push(i); s0 = idx[(Math.random() * idx.length) | 0] ?? s0 }
          if (Wd.NB[s0]?.length) syn.push({ path: [s0], cur: s0, next: Wd.NB[s0][0], t: 0, hops: 6 + ((Math.random() * 10) | 0) })
        }
        const pc = inFocus ? cols[act] : mix(C.pink, C.p1, .3), pcs = `rgb(${pc[0] | 0},${pc[1] | 0},${pc[2] | 0})`
        syn = syn.filter((s) => {
          s.t += act === 1 && inFocus ? .16 : .1
          const a0 = s.cur, b0 = s.next, hx = sx[a0] + (sx[b0] - sx[a0]) * Math.min(1, s.t), hy = sy[a0] + (sy[b0] - sy[a0]) * Math.min(1, s.t)
          const pts = s.path.map((q) => [sx[q], sy[q]]).concat([[hx, hy]])
          ctx.lineWidth = 1.2; ctx.strokeStyle = pcs
          for (let q = 1; q < pts.length; q++) { ctx.globalAlpha = (q / pts.length) * .9 * dv; ctx.beginPath(); ctx.moveTo(pts[q - 1][0], pts[q - 1][1]); ctx.lineTo(pts[q][0], pts[q][1]); ctx.stroke() }
          ctx.fillStyle = pcs; ctx.globalAlpha = .22 * dv; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 6.283); ctx.fill(); ctx.globalAlpha = dv; ctx.beginPath(); ctx.arc(hx, hy, 2, 0, 6.283); ctx.fill()
          if (s.t >= 1) {
            s.path.push(s.next); if (s.path.length > 6) s.path.shift(); s.hops--
            const o = Wd.NB[s.next].filter((j) => !s.path.includes(j))
            if (!s.hops || !o.length) return false
            s.cur = s.next; s.next = o[(Math.random() * o.length) | 0]; s.t = 0
          }
          return true
        })
        ctx.globalAlpha = 1
      }

      // el cursor también es una neurona
      if (!reduce && mouse.x > -1e3) {
        const near = []
        for (let i = 0; i < N; i++) { const d = Math.hypot(sx[i] - mouse.x, sy[i] - mouse.y); if (d < 90 && sf[i] > .8) near.push([d, i]) }
        near.sort((p, q) => p[0] - q[0])
        ctx.lineWidth = .7
        for (const [d, i] of near.slice(0, 7)) { ctx.strokeStyle = `rgba(${C.p2[0] | 0},${C.p2[1] | 0},${C.p2[2] | 0},${(1 - d / 90) * .7 * dv})`; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(sx[i], sy[i]); ctx.stroke() }
        if (near.length) { ctx.globalAlpha = .9; ctx.fillStyle = `rgb(${C.p2[0] | 0},${C.p2[1] | 0},${C.p2[2] | 0})`; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2.2, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1 }
      }
      ctx.globalCompositeOperation = 'source-over'
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    function schedule() { if (!raf && !pending) { pending = 1; raf = requestAnimationFrame(frame) } }

    const onMove = (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY
      if (drag) { const dx = e.clientX - drag.x; dragV = dx * .005; dragYaw += dragV; drag = { x: e.clientX }; if (reduce) schedule() }
    }
    const onDown = (e) => {
      if (e.pointerType === 'touch' || !(e.target instanceof Element) || !e.target.closest('[data-world-drag]')) return
      drag = { x: e.clientX }; document.body.style.cursor = 'grabbing'
    }
    const onUp = () => { drag = null; document.body.style.cursor = '' }
    const onLeave = () => { mouse.x = mouse.y = -1e4 }
    const ro = new ResizeObserver(layout)
    const mo = new MutationObserver(() => requestAnimationFrame(() => { readColors(); schedule() }))

    readColors(); layout()
    ro.observe(cv); mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    addEventListener('pointermove', onMove); addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp)
    document.addEventListener('pointerleave', onLeave)
    if (reduce) addEventListener('scroll', schedule, { passive: true })
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect()
      removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp)
      document.removeEventListener('pointerleave', onLeave); removeEventListener('scroll', schedule)
      document.body.style.cursor = ''
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-dvh w-full" />
}
