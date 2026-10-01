import { useEffect, useRef, useState } from 'react'

/*
  Frase de transición entre el hero y los módulos. Las palabras se encienden de a una
  mientras se scrollea. El contenido resume el área problemática de la Entrega 1:
  herramientas reactivas y dispersas frente a una plataforma proactiva e integrada.
*/
const PARTS = [
  { text: 'Las herramientas de IA suelen responder solo cuando preguntás, y cada una resuelve una parte.', accent: false },
  { text: 'Esta plataforma se anticipa y reúne todo el proceso en un mismo lugar.', accent: true },
]

export default function Statement({ progress }) {
  const ref = useRef(null)
  const [pl, setP] = useState(0)
  const p = progress ?? pl // si viene 'progress' (la hoja que gira), manda ese; si no, el scroll propio

  useEffect(() => {
    if (progress !== undefined) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setP(1); return }
    let raf = 0
    const update = () => {
      raf = 0
      const r = ref.current.getBoundingClientRect()
      // 0 cuando la frase entra por abajo, 1 cuando llega a un tercio de la pantalla
      setP(Math.min(1, Math.max(0, (innerHeight * .9 - r.top) / (innerHeight * .6))))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [progress])

  const words = PARTS.flatMap((part) => part.text.split(' ').map((w) => ({ w, accent: part.accent })))
  const lit = p * words.length

  return (
    <section ref={ref} aria-label="Por qué esta plataforma" className="mx-auto max-w-[1000px] px-4 py-24 sm:px-10 sm:py-32">
      <p className="display text-center text-[clamp(1.6rem,3.6vw,2.8rem)] leading-[1.18]">
        {words.map(({ w, accent }, i) => (
          <span key={i} className={`transition-[opacity,color] duration-300 ${accent ? 'accent' : ''}`}
            style={{ opacity: i < lit ? 1 : .18 }}>{w}{' '}</span>
        ))}
      </p>
    </section>
  )
}
