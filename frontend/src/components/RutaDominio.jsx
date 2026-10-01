import { useEffect, useMemo, useRef, useState } from 'react'
import { MODULES } from '../lib/format.js'
import { Kicker, Floaty, BulbDoodle, CodeDoodle, BrainDoodle, FootDoodle, MedalDoodle, FlagDoodle } from './Doodles.jsx'

/*
  "Tu ruta": un libro que se abre solo al scrollear. Cada hoja doble explica una etapa (a la izquierda qué se hace y para qué,
  a la derecha los pasos concretos que se van tildando). Al terminar la etapa la hoja se da vuelta, el marcapáginas cambia de color
  y un semicírculo del color de la etapa sube y cambia el fondo. El dominio sube arriba hasta 100 %.
  Solo incluye pasos que el prototipo plantea.
*/
const V = 'var(--p1)'
const STEPS = [
  { setup: true, group: { label: 'Configurar', color: V }, title: 'Elegí tu tema', note: '', text: 'Indicás qué querés preparar dentro de la materia.' },
  { setup: true, group: { label: 'Configurar', color: V }, title: 'Días y tiempo disponible', note: '', text: 'Definís en cuántos días lo querés estudiar y cuánto tiempo tenés por día.' },
  { setup: true, group: { label: 'Configurar', color: V }, title: 'Cuánto sabés del tema', note: '', text: 'Tu nivel inicial, para que la ruta parta de donde estás.' },
  { setup: true, group: { label: 'Configurar', color: V }, title: 'Subí tu material', note: '', text: 'Es opcional: tus apuntes se combinan con fuentes académicas indexadas.' },
  { group: MODULES.aprender, title: 'Resumen del tema', note: 'lo importante, sin vueltas', text: 'Las ideas clave, generadas a partir del material del tema.' },
  { group: MODULES.aprender, title: 'Preguntas guiadas', note: 'pensás vos, te guiamos', text: 'Llegás a cada concepto razonando paso a paso.' },
  { group: MODULES.aprender, title: 'Ejercicio guiado', note: 'un caso concreto', text: 'Un caso concreto para aplicar lo que viste.' },
  { group: MODULES.practicar, title: 'Práctica en el editor', note: 'a escribir código', text: 'Ejercicios de código que se ejecutan y se validan automáticamente.' },
  { group: MODULES.practicar, title: 'Ayuda ante bloqueos', note: '¿trabado? te ayudamos', text: 'Si se detecta un bloqueo, recibís retroalimentación sin tener que pedirla.' },
  { group: MODULES.consolidar, title: 'Explicación del tema', note: 'ahora enseñás vos', text: 'Lo explicás con tus palabras y respondés preguntas de seguimiento.' },
  { group: MODULES.consolidar, title: 'Revisión de la explicación', note: 'chequeamos que esté bien', text: 'Se verifica que lo que explicaste sea correcto.' },
]
const DOODLE = { Configurar: FootDoodle, Aprender: BulbDoodle, Practicar: CodeDoodle, Consolidar: BrainDoodle }

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (t) => t * t * (3 - 2 * t)
const LILA = '#E8E1F4'
const CL = 1.2            // tramo final: el libro se cierra y aparece el sello de 100 %
const OP0 = 1.4          // acá empieza a abrirse la portada
const INTRO = 1.8          // tramo de entrada (en "hojas"): sube el semicírculo lila, se arma el título y pasa al anotador
// color de fondo de cada etapa
const TINT = (c) => `color-mix(in srgb, ${c} 17%, #fbf9f6)`
const TITLE = [{ w: 'Paso' }, { w: 'a' }, { w: 'paso,' }, { w: 'hasta', a: 1 }, { w: 'dominar', a: 1 }, { w: 'el', a: 1 }, { w: 'tema.', a: 1 }]
const PARA = 'Cada tema se recorre en el mismo orden. Cada paso completado suma a tu nivel de dominio.'

// qué se hace en cada etapa (hoja izquierda del libro)
const INFO = {
  Configurar: { title: 'Antes de empezar,', accent: 'armá tu ruta.', desc: 'Contás qué querés preparar, cuándo necesitás llegar y cuánto sabés. Si querés, sumás tus apuntes. Con eso se organiza una ruta posible para vos.' },
  Aprender: { title: MODULES.aprender.verb.split(', ')[0] + ',', accent: MODULES.aprender.verb.split(', ')[1], desc: 'Entendés el tema con un resumen del material y preguntas que te guían para que lo razones vos, no que lo memorices.' },
  Practicar: { title: MODULES.practicar.verb.split(', ')[0] + ',', accent: MODULES.practicar.verb.split(', ')[1], desc: 'Escribís código en el editor, se ejecuta y se valida solo. Si te trabás, te llega ayuda sin tener que pedirla.' },
  Consolidar: { title: MODULES.consolidar.verb.split(', ')[0] + ',', accent: MODULES.consolidar.verb.split(', ')[1], desc: 'Le explicás el tema a un agente que aprende de vos. Así se ve qué entendiste bien y qué te falta reforzar.' },
}

/* tapa del cuaderno: papel con borde de tinta, cinta y etiqueta a mano (la de adelante y la de atrás, ya corregida con 100 %) */
function Cover({ done }) {
  const spark = [
    { top: -14, left: -10, '--r': '-14deg', '--s': '46px' },
    { top: 46, right: -12, '--r': '12deg', '--s': '36px' },
    { bottom: 96, left: -14, '--r': '10deg', '--s': '34px' },
    { bottom: -12, right: 26, '--r': '-8deg', '--s': '42px' },
  ]
  return (
    <div className="rl-cv">
      <i className="rl-tail" aria-hidden="true" />
      <div className="rl-label">
        {done ? <>tema dominado</> : <>tu ruta<small>paso a paso</small></>}
      </div>
      {done && (
        <>
          <div className="rl-mark" style={{ opacity: 0 }}>
            <svg viewBox="0 0 230 120" aria-hidden="true"><path className="rl-circ" pathLength="1" d="M38 64C30 30 84 12 124 14c54 2 94 22 90 50-4 30-60 44-106 40C60 100 18 86 26 54c4-18 34-32 70-38" /></svg>
            <b>100<small>%</small></b>
          </div>
          <p className="rl-pop rl-wow">¡lo lograste!</p>
          {spark.map((p, i) => (
            <svg key={i} className="rl-pop rl-spark" viewBox="0 0 24 24" style={p} aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
          ))}
        </>
      )}
    </div>
  )
}

function MiniBook() {
  const ink = 'var(--ink-hand, #3a2a7a)'
  return (
    <span aria-hidden="true" className="lg-book nb-float" style={{ '--r': '-2deg' }}>
      <svg viewBox="0 0 160 126" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 34v62c26-5 52-4 74 6 22-10 48-11 74-6V34" strokeWidth="2.6" />
        <path d="M80 32C60 20 32 20 12 27v62c24-5 50-4 68 5z" fill="var(--doodle-fill)" />
        <path d="M80 32c20-12 48-12 68-5v62c-24-5-50-4-68 5z" fill="var(--doodle-fill)" />
        <path d="M80 32v62" strokeWidth="2.4" />
        <path d="M24 46c12-3 26-2 42 3M24 58c12-3 26-2 42 3M24 70c10-2 20-2 30 1" strokeWidth="2.2" />
        <path d="M94 49c16-5 30-6 42-3M94 61c16-5 30-6 42-3M94 73c10-3 20-3 30-1" strokeWidth="2.2" />
        <g className="lg-ribbon"><path d="M73 58h14l1 62-8-8-8 8z" fill="#a58bff" /><path d="M80 64v40" strokeWidth="1.8" opacity=".5" /></g>
      </svg>
    </span>
  )
}

export default function RutaDominio() {
  const wrap = useRef(null), leaves = useRef([]), bgs = useRef([]), rows = useRef([]), ribbon = useRef(null)
  const book = useRef(null), cover = useRef(null), marks = useRef([]), circs = useRef([]), pops = useRef([]), hdr = useRef(null), kick = useRef(null), para = useRef(null), letters = useRef([]), board = useRef(null), mini = useRef(null)
  const [reduce] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [done, setDone] = useState(reduce ? STEPS.filter((s) => !s.setup).length : 0)

  // agrupa pasos consecutivos de la misma etapa (cada grupo = una hoja)
  const groups = useMemo(() => {
    const out = []
    STEPS.forEach((s, i) => {
      const gr = s.group
      const last = out[out.length - 1]
      if (last && last.label === gr.label) last.items.push([s, i])
      else out.push({ label: gr.label, color: gr.color, items: [[s, i]] })
    })
    return out
  }, [])
  const G = groups.length

  useEffect(() => {
    if (reduce) { rows.current.forEach((el) => el && (el.dataset.on = '1')); return }
    let raf = 0
    const N = letters.current.length
    marks.current = [...(book.current?.querySelectorAll('.rl-mark') || [])]
    circs.current = [...(book.current?.querySelectorAll('.rl-circ') || [])]
    pops.current = [...(book.current?.querySelectorAll('.rl-pop') || [])]
    const narrow = () => innerWidth < 760
    const update = () => {
      raf = 0
      const r = wrap.current.getBoundingClientRect(), total = Math.max(1, wrap.current.offsetHeight - innerHeight)
      const u = clamp(-r.top / total) * (INTRO + G + CL), g = clamp(u - INTRO, 0, G + CL)
      const CS = G - 1 + .88   // acá empieza el cierre

      // 1) entrada: semicírculo lila que sube, título que se arma letra por letra, y después el título se va
      const circ = smooth(clamp(u / .6)), hp = clamp((u - .38) / .7), hx = smooth(clamp((u - .9) / .3))
      const maxR = Math.hypot(innerWidth / 2, innerHeight) + 24
      if (bgs.current[0]) bgs.current[0].style.clipPath = `circle(${(circ * maxR).toFixed(1)}px at 50% 100%)`
      letters.current.forEach((el, k) => {
        if (!el) return
        const e = smooth(clamp(hp * 1.9 - (k / N) * .9))
        el.style.transform = `translateY(${((1 - e) * 112).toFixed(1)}%) rotate(${((1 - e) * 9).toFixed(1)}deg)`
      })
      if (kick.current) { const e = smooth(clamp(hp * 3)); kick.current.style.opacity = String(e); kick.current.style.transform = `translateY(${((1 - e) * 14).toFixed(1)}px)` }
      if (para.current) { const e = smooth(clamp((hp - .62) / .38)); para.current.style.opacity = String(e); para.current.style.transform = `translateY(${((1 - e) * 16).toFixed(1)}px)` }
      if (mini.current) mini.current.style.transform = `scale(${(1 + hx * 2.2).toFixed(3)})`
      if (hdr.current) {
        hdr.current.style.opacity = String(1 - hx); hdr.current.style.transform = `translateY(${(-hx * 80).toFixed(1)}px)`
        hdr.current.style.visibility = hx >= 1 ? 'hidden' : ''
      }
      // el libro entra: crece desde el librito del título y se abre
      if (board.current) {
        const sx = smooth(clamp((u - 1.05) / .3))
        board.current.style.opacity = String(sx)
        board.current.style.transform = sx >= 1 ? '' : `perspective(1400px) rotateX(${((1 - sx) * 26).toFixed(1)}deg) scale(${(.62 + .38 * sx).toFixed(3)}) translateY(${((1 - sx) * 40).toFixed(1)}px)`
        board.current.style.visibility = sx <= 0 ? 'hidden' : ''
      }

      // 2) libro: cada hoja gira sobre el lomo (la derecha pasa a ser la izquierda de la etapa siguiente)
      const turnOf = (i) => (i === G - 1 ? clamp((g - CS) / .35) : clamp((g - (i + .8)) / .2))
      const op = smooth(clamp((u - OP0) / .4))
      const tOf = (i) => (i === 0 ? clamp((u - OP0) / .4) : turnOf(i - 1))   // la hoja 0 es la portada
      leaves.current.forEach((el, i) => {
        if (!el) return
        const t = tOf(i), e = smooth(t)
        el.dataset.turning = t > .004 && t < .996 ? '1' : '0'
        if (narrow()) { el.style.transform = t ? `rotateY(${(-e * 70).toFixed(1)}deg)` : ''; el.style.opacity = String(1 - e) }
        else el.style.transform = t ? `rotateY(${(-e * 180).toFixed(1)}deg)` : ''
        el.style.zIndex = String(e > .5 ? 10 + i : 100 - i)
      })
      if (ribbon.current) { ribbon.current.style.setProperty('--rc', groups[Math.min(G - 1, Math.floor(g + .1))].color); ribbon.current.style.opacity = String(clamp((u - OP0 - .3) / .1) * (1 - smooth(clamp((g - CS) / .15)))) }
      // cierre: el libro queda de un solo lado, se corre al centro y le estampan el sello
      const sh = smooth(clamp((g - (CS + .3)) / .35)), sealT = clamp((g - (CS + .6)) / .35), tl = smooth(clamp((g - CS) / .35))
      if (book.current) {
        // cerrado al principio (portada a la derecha, centrada) y cerrado al final (tapa a la izquierda, centrada)
        book.current.style.transform = narrow() ? '' : `translateX(${((sh - (1 - op)) * book.current.offsetWidth * .25).toFixed(1)}px)`
        book.current.style.setProperty('--shr', String(1 - tl)); book.current.style.setProperty('--shl', String(clamp((op - .55) * 2.2) * (1 - tl)))
      }
      if (cover.current) cover.current.style.opacity = narrow() ? String(tl) : ''
      marks.current.forEach((el) => { el.style.opacity = String(smooth(clamp(sealT * 3))) })
      // estrellitas y "¡lo lograste!" saltan una tras otra (con rebote)
      pops.current.forEach((el, k) => {
        const s = clamp((sealT - .3 - k * .06) / .3), e = s >= 1 ? 1 : 1 + 2.70158 * (s - 1) ** 3 + 1.70158 * (s - 1) ** 2
        el.style.scale = s > 0 ? e.toFixed(3) : '0'
        el.style.opacity = s > 0 ? '1' : '0'
      })
      circs.current.forEach((el) => { el.style.strokeDashoffset = String(1 - smooth(clamp((sealT - .15) / .7))) })

      // 3) semicírculo de color de cada etapa: sube mientras se da vuelta la hoja anterior
      bgs.current.forEach((el, j) => {
        if (!el || j === 0) return
        if (j === G) { el.style.clipPath = `circle(${(smooth(clamp((g - (CS + .1)) / .45)) * maxR).toFixed(1)}px at 50% 100%)`; return }
        const t = smooth(clamp((g - (j - 1 + .72)) / .28))
        el.style.clipPath = `circle(${(t * maxR).toFixed(1)}px at 50% 100%)`
      })

      // 4) tildes: cada paso se marca cuando le toca dentro de su hoja
      let n = 0
      groups.forEach((gr, gi) => gr.items.forEach(([st, idx], k) => {
        const on = g >= gi + ((k + .4) / (gr.items.length + .6)) * .78 && u > INTRO
        const el = rows.current[idx]
        if (el) el.dataset.on = on ? '1' : '0'
        if (on && !st.setup) n++
      }))
      setDone((d) => (d === n ? d : n))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [reduce, G, groups])

  // el librito invita: al tocarlo baja solo hasta el libro abierto
  const goBoard = () => {
    const w = wrap.current
    if (!w) return
    const tot = Math.max(1, w.offsetHeight - innerHeight)
    const y = w.getBoundingClientRect().top + scrollY + tot * ((INTRO + .04) / (INTRO + G + CL))
    if (scrollY < y) scrollTo({ top: y, behavior: 'smooth' })
  }

  const total = STEPS.filter((s) => !s.setup).length
  const pct = Math.round((Math.min(done, total) / total) * 100)

  const dom = (
    <div className="rl-dom rl-dom-top">
      <span className="rl-domlabel">dominio del tema</span>
      <span className="rl-bar"><i style={{ width: `${pct}%`, backgroundSize: `${pct > 0 ? 10000 / pct : 100}% 100%` }} /></span>
      <span className="rl-pct tabular-nums">{pct}<small>%</small></span>
    </div>
  )

  // hoja izquierda: qué se hace en la etapa y para qué
  const info = (g) => {
    const Doodle = DOODLE[g.label], t = INFO[g.label]
    return (
      <div className="rl-info" style={{ '--c': g.color }}>
        <Kicker color={g.color}>{g.label.toLowerCase()}</Kicker>
        <h3 className="display rl-it">{t.title} <span className="accent">{t.accent}</span></h3>
        <p>{t.desc}</p>
        {Doodle && <span className="rl-gd" aria-hidden="true"><Doodle size="84px" /></span>}
      </div>
    )
  }
  // hoja derecha: los pasos concretos, que se van tildando
  const steps = (g) => (
    <div className="rl-steps" style={{ '--c': g.color }}>
      <div className="rl-mdesc">{info(g)}</div>
      <ol className="rl-list">
        {g.items.map(([s, i]) => (
          <li key={s.title} ref={(el) => (rows.current[i] = el)} className={`rl-row ${s.goal ? 'rl-goal' : ''}`} data-on={reduce ? '1' : '0'}>
            <svg className="rl-box" viewBox="0 0 30 30" aria-hidden="true">
              <path className="rl-sq" d="M5 6c6-2 13-1 19 0 1 6 1 12 0 18-6 2-13 1-19 0-1-6-1-12 0-18z" />
              <path className="rl-tick" pathLength="1" d="M8 16l5 6L26 6" />
            </svg>
            <div className="rl-body">
              <h4><span>{s.title}</span></h4>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )

  const stack = reduce ? (
    <div className="rl-static">
      <p className="rl-cap" style={{ order: 99 }}>100 % de dominio: tema dominado</p>
      {groups.map((g) => (
        <section key={g.label} className="rl-spread" aria-label={g.label}>
          <div className="rl-pg rl-pg-l">{info(g)}</div>
          <div className="rl-pg rl-pg-r">{steps(g)}</div>
        </section>
      ))}
    </div>
  ) : (
    <div ref={book} className="rl-book">
      <i ref={ribbon} className="rl-ribbon" aria-hidden="true" style={{ '--rc': groups[0].color }} />
      <section ref={(el) => (leaves.current[0] = el)} className="rl-leaf rl-hard" style={{ zIndex: 100 }} aria-label="Portada">
        <i className="rl-edge" aria-hidden="true" />
        <div className="rl-face rl-pg rl-pg-r rl-cover"><Cover /></div>
        <div className="rl-face rl-back rl-pg rl-pg-l" aria-hidden="true">{info(groups[0])}</div>
      </section>
      {groups.map((g, i) => (
        <section key={g.label} ref={(el) => (leaves.current[i + 1] = el)} className={`rl-leaf ${i === G - 1 ? 'rl-hard' : ''}`} style={{ zIndex: 99 - i }} aria-label={g.label}>
          {i === G - 1 && <i className="rl-edge" aria-hidden="true" />}
          <div className="rl-face rl-pg rl-pg-r">{steps(g)}</div>
          {i < G - 1
            ? <div className="rl-face rl-back rl-pg rl-pg-l" aria-hidden="true">{info(groups[i + 1])}</div>
            : <div className="rl-face rl-back rl-pg rl-pg-l rl-cover" aria-hidden="true"><Cover done /></div>}
        </section>
      ))}
      <div ref={cover} className="rl-cover rl-cover-m" aria-hidden="true" style={{ opacity: 0 }}><Cover done /></div>
    </div>
  )

  // título armado letra por letra (cada palabra recorta su máscara, cada letra sube con un pequeño giro)
  let li = 0
  const title = (
    <h2 className="display rl-title" aria-label={TITLE.map((t) => t.w).join(' ')}>
      {TITLE.map((t, wi) => (
        <span key={wi}>
          <span className={`rl-word ${t.a ? 'accent' : ''}`} aria-hidden="true">
            {[...t.w].map((ch) => { const k = li++; return <span key={k} ref={(el) => (letters.current[k] = el)} className="rl-let" style={reduce ? { transform: 'none' } : undefined}>{ch}</span> })}
          </span>{' '}
        </span>
      ))}
    </h2>
  )
  const head = (
    <div className="rl-head">
      <span ref={kick} style={reduce ? undefined : { opacity: 0 }}><Kicker>Tu ruta</Kicker></span>
      {title}
      <div ref={para} className="grid justify-items-center gap-5" style={reduce ? undefined : { opacity: 0 }}>
        <p className="balance max-w-[44ch] text-muted">{PARA}</p>
        {!reduce && (
          <button type="button" ref={mini} className="rl-open" onClick={goBoard} aria-label="Abrir el libro de la ruta">
            <MiniBook />
            <span className="rl-opentxt">abrí el libro ↓</span>
          </button>
        )}
      </div>
    </div>
  )

  return reduce ? (
    <div className="mx-auto grid max-w-[980px] gap-8 px-4 py-24 sm:px-10">{head}{dom}{stack}</div>
  ) : (
    <div ref={wrap} style={{ height: `${(INTRO + G + CL) * 85 + 100}vh` }}>
      <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden">
        {/* fondos: primero el semicírculo lila de la sección, después uno por etapa (ancho completo) */}
        <div ref={(el) => (bgs.current[0] = el)} aria-hidden="true" className="rl-wash" style={{ backgroundColor: LILA, clipPath: 'circle(0px at 50% 100%)' }} />
        {groups.slice(1).map((g, j) => (
          <div key={g.label} ref={(el) => (bgs.current[j + 1] = el)} aria-hidden="true" className="rl-wash"
            style={{ backgroundColor: TINT(g.color), clipPath: 'circle(0px at 50% 100%)' }} />
        ))}
        <div ref={(el) => (bgs.current[G] = el)} aria-hidden="true" className="rl-wash" style={{ backgroundColor: LILA, clipPath: 'circle(0px at 50% 100%)' }} />

        {/* entrada: el título (con sus garabatos) */}
        <div ref={hdr} className="rl-intro">
          <Floaty rot={-6} delay={.4} label="un paso a la vez" style={{ left: '7%', top: '26%' }}><FootDoodle /></Floaty>
          <Floaty rot={5} delay={1.6} label="la meta" style={{ right: '7%', top: '24%' }}><FlagDoodle /></Floaty>
          {head}
        </div>

        {/* anotador */}
        <div ref={board} className="rl-board" style={{ visibility: 'hidden', opacity: 0, transformOrigin: '50% 0' }}>{dom}{stack}</div>
      </div>
    </div>
  )
}
