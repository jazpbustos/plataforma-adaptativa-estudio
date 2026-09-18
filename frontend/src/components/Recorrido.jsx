import { useEffect, useRef, useState } from 'react'

/*
  "El recorrido": tres pasos parejos, sin tarjetas ni íconos.
  Cada paso tiene una línea superior que se llena mientras está activo; los pasos avanzan solos
  cuando la sección está a la vista y se puede elegir uno pasando el mouse.
  Textos de largo similar para que las columnas queden a la misma altura.
*/
const DURATION = 3200
const STEPS = [
  { n: '01', title: 'Configurá tu objetivo', text: 'Definí tema, fecha objetivo, días disponibles y nivel inicial.' },
  { n: '02', title: 'Sumá tus apuntes', tag: 'opcional', text: 'Se combinan con fuentes académicas indexadas del tema.' },
  { n: '03', title: 'Seguí tu ruta', text: 'Comprendé, practicá y explicá cada tema, en orden y a tu ritmo.' },
]

export default function Recorrido() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(false)
  const reduce = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: .5 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!inView || hover || reduce) return
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DURATION)
    return () => clearTimeout(t)
  }, [active, inView, hover, reduce])

  const running = inView && !hover && !reduce

  return (
    <ol ref={ref} className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10" onMouseLeave={() => setHover(false)}>
      {STEPS.map((s, i) => {
        const on = active === i
        return (
          <li key={s.n} onMouseEnter={() => { setHover(true); setActive(i) }}
            className="group grid cursor-default grid-cols-[2px_minmax(0,1fr)] gap-x-5 sm:grid-cols-1 sm:gap-x-0">
            {/* línea de progreso: vertical en celular, horizontal desde sm */}
            <span className="relative row-span-2 overflow-hidden rounded-full bg-line sm:row-span-1 sm:h-[2px]">
              <i key={`${active}-${running}`}
                className={`absolute rounded-full bg-gradient-to-b from-violet to-pink sm:bg-gradient-to-r ${on ? (running ? 'step-fill' : 'step-full') : 'step-empty'}`}
                style={on && running ? { animationDuration: `${DURATION}ms` } : undefined} />
            </span>

            <div className="grid content-start gap-3 pt-0 sm:pt-6">
              <span className="flex h-5 items-center gap-2.5">
                <span className={`font-mono text-xs transition-colors duration-300 ${on ? 'accent' : 'text-muted'}`}>{s.n}</span>
                {s.tag && <span className="rounded-full border border-line px-2 py-px font-mono text-[.62rem] tracking-wide text-muted uppercase">{s.tag}</span>}
              </span>
              <h3 className={`text-[1.2rem] font-medium tracking-[-.02em] transition-colors duration-300 lg:text-[1.3rem] ${on ? 'text-fg' : 'text-fg/70'}`}>{s.title}</h3>
              <p className={`balance max-w-[34ch] text-[.95rem] leading-relaxed transition-colors duration-300 sm:min-h-[5.1em] lg:min-h-[3.4em] ${on ? 'text-muted' : 'text-muted/70'}`}>{s.text}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
