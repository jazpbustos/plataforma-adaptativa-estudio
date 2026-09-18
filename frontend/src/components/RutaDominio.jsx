import { useEffect, useRef, useState } from 'react'
import { MODULES } from '../lib/format.js'

/*
  "Tu ruta": tarjetas medianas (ícono, paso y título) que se apilan al scrollear.
  Las de abajo se achican y se apagan apenas; a la izquierda el dominio sube a medida que se juntan.
  Solo incluye pasos que el prototipo plantea.
*/
/* Íconos de línea (24px) para cada paso */
const I = (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[22px]" aria-hidden="true" {...props} />
const IcoDiagnostico = () => <I><path d="M4 16a8 8 0 1116 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.2" fill="currentColor" /></I>
const IcoResumen = () => <I><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" /><path d="M12 6.5v13" /></I>
const IcoPreguntas = () => <I><path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4A8 8 0 1120 12z" /><path d="M10 10a2 2 0 113 1.7c-.6.4-1 .8-1 1.5M12 15.5h.01" /></I>
const IcoEjercicio = () => <I><path d="M14.5 4.5l5 5L9 20H4v-5z" /><path d="M12.5 6.5l5 5" /></I>
const IcoEditor = () => <I><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M8 10l-2 2 2 2M16 10l2 2-2 2M13 9l-2 6" /></I>
const IcoPista = () => <I><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" /></I>
const IcoAlumna = () => <I><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2V11M21.5 9v5" /></I>
const IcoRevision = () => <I><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.8-5" /></I>
const IcoMejora = () => <I><path d="M4 17l5-5 3.5 3.5L20 8" /><path d="M15 8h5v5" /></I>
const IcoDominio = () => <I><path d="M12 3l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 14.9l-4.6 2.4.9-5.2-3.8-3.6 5.2-.7z" /></I>

const V = 'var(--violet)'
const STEPS = [
  { group: 'Punto de partida', color: V, title: 'Nivel inicial', text: 'Indicás cuánto sabés del tema para adaptar la ruta.', Icon: IcoDiagnostico },
  { group: MODULES.aprender, title: 'Resumen del tema', text: 'Las ideas clave, generadas a partir del material del tema.', Icon: IcoResumen },
  { group: MODULES.aprender, title: 'Preguntas guiadas', text: 'Llegás a cada concepto razonando paso a paso.', Icon: IcoPreguntas },
  { group: MODULES.aprender, title: 'Ejercicio guiado', text: 'Un caso concreto para aplicar lo que viste.', Icon: IcoEjercicio },
  { group: MODULES.practicar, title: 'Práctica en el editor', text: 'Ejercicios de código que se ejecutan y se validan automáticamente.', Icon: IcoEditor },
  { group: MODULES.practicar, title: 'Ayuda ante bloqueos', text: 'Si se detecta un bloqueo, recibís retroalimentación sin tener que pedirla.', Icon: IcoPista },
  { group: MODULES.consolidar, title: 'Explicación del tema', text: 'Lo explicás con tus palabras y respondés preguntas de seguimiento.', Icon: IcoAlumna },
  { group: MODULES.consolidar, title: 'Revisión de la explicación', text: 'Se verifica que lo que explicaste sea correcto.', Icon: IcoRevision },
]

export default function RutaDominio({ header }) {
  const cards = useRef([])
  const [done, setDone] = useState(0)

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const update = () => {
      raf = 0
      const els = cards.current.filter(Boolean)
      const tops = els.map((el) => parseFloat(getComputedStyle(el).top) || 0)
      const rects = els.map((el) => el.getBoundingClientRect())
      let stuck = 0
      els.forEach((el, i) => {
        if (rects[i].top <= tops[i] + 2) stuck = i + 1
        let k = 0 // cuántas tarjetas ya se apoyaron encima (continuo)
        for (let j = i + 1; j < els.length; j++) {
          const h = rects[j].height || 1
          k += Math.min(1, Math.max(0, (tops[j] + h - rects[j].top) / h))
        }
        const inner = el.firstElementChild
        if (!inner || reduce) return
        inner.style.transform = `scale(${Math.max(.94, 1 - k * .012)})`
        // opacas: la de abajo no se transparenta (se leería el texto); en oscuro se apaga apenas
        inner.style.filter = document.documentElement.dataset.theme === 'dark' ? `brightness(${Math.max(.7, 1 - k * .08)})` : ''
      })
      setDone(stuck)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const total = STEPS.length
  const pct = Math.round((Math.min(done, total) / total) * 100)
  const cur = STEPS[Math.min(total - 1, Math.max(0, done - 1))]
  const curColor = cur.group.color ?? cur.color

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-20">
      {/* panel fijo: título + dominio que sube */}
      <div className="grid content-start gap-10 lg:sticky lg:top-28 lg:self-start">
        {header}
        <div className="grid max-w-[340px] gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">Dominio del tema</span>
            <span className="text-[2.4rem] leading-none font-light tracking-[-.04em] tabular-nums">{pct}<span className="ml-1 text-sm text-muted">%</span></span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-line">
            <i className="block h-full rounded-full transition-[width,background-color] duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: curColor }} />
          </div>
          <p className="h-5 text-sm transition-colors duration-300" style={{ color: done ? curColor : 'var(--text-secondary)' }}>
            {done > total ? 'Tema dominado' : done ? cur.title : 'Bajá para recorrer los pasos'}
          </p>
        </div>
      </div>

      {/* tarjetas medianas (ícono + paso + título) que se apilan al scrollear */}
      <ol className="relative mx-auto w-full min-w-0 max-w-[440px]">
        {STEPS.map((s, i) => {
          const color = s.group.color ?? s.color
          const group = s.group.label ?? s.group
          return (
            <li key={s.title} ref={(el) => (cards.current[i] = el)} className="sticky mb-[18vh]" style={{ top: `calc(7rem + ${i * 10}px)` }}>
              <article className="flex origin-top items-center gap-5 rounded-[26px] border px-6 py-6 will-change-transform sm:gap-6 sm:px-7 sm:py-7"
                style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--text) 4%, var(--bg-card)), var(--bg-card))',
                  borderColor: `color-mix(in srgb, ${color} 18%, var(--border))`,
                  boxShadow: `inset 0 1px 0 color-mix(in srgb, var(--text) 7%, transparent), 0 16px 36px -28px rgba(0,0,0,.55)` }}>
                <span className="grid size-14 shrink-0 place-items-center rounded-full border"
                  style={{ color, background: `color-mix(in srgb, ${color} 10%, var(--bg-elev))`, borderColor: `color-mix(in srgb, ${color} 22%, var(--border))` }}>
                  <s.Icon />
                </span>
                <div className="grid min-w-0 gap-1">
                  <span className="flex items-center gap-2 font-mono text-[.68rem] tracking-[.16em] uppercase">
                    <span className="text-muted">Paso {String(i + 1).padStart(2, '0')}</span>
                    <i className="size-1 rounded-full bg-rule" />
                    <span style={{ color }}>{group}</span>
                  </span>
                  <h3 className="text-[1.2rem] leading-snug font-medium tracking-[-.02em] [text-wrap:wrap] sm:text-[1.35rem]" title={s.text}>{s.title}</h3>
                </div>
              </article>
            </li>
          )
        })}
        <li ref={(el) => (cards.current[total] = el)} className="sticky" style={{ top: `calc(7rem + ${total * 10}px)` }}>
          <article className="flex items-center gap-6 rounded-[26px] border px-7 py-7"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--violet) 16%, var(--bg-card)), color-mix(in srgb, var(--pink) 8%, var(--bg-card)))',
              borderColor: 'color-mix(in srgb, var(--violet) 35%, var(--border))', boxShadow: '0 16px 40px -28px var(--violet)' }}>
            <span className="grid size-14 shrink-0 place-items-center rounded-full text-on-accent" style={{ background: 'linear-gradient(135deg, var(--violet), var(--pink))' }}><IcoDominio /></span>
            <div className="grid gap-1">
              <span className="font-mono text-[.68rem] tracking-[.16em] text-muted uppercase">Meta</span>
              <p className="text-[1.35rem] font-medium tracking-[-.02em]">100 % <span className="accent">de dominio</span></p>
            </div>
          </article>
        </li>
      </ol>
    </div>
  )
}
