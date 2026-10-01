import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DocDoodle, CodeDoodle, ChatDoodle } from './Doodles.jsx'
import ParticleBrain from './ParticleBrain.jsx'

/*
  Hero: página completa partida al medio, como un libro abierto.
  - Hoja izquierda: título, bajada, botón y el esquema a mano "Mis apuntes → apunte.pdf / ejercicio.py / chat con IA".
  - Hoja derecha: cerebro de partículas en 3D que se forma desde las fuentes y gira; de cada una llegan hilos de partículas.
  Un único margen: la línea de la hoja izquierda; el texto arranca a la derecha de esa línea.
  Menos de 1024px: una sola columna (texto y cerebro).
*/
function useWide() {
  const q = '(min-width: 1024px)'
  const [w, setW] = useState(() => typeof window !== 'undefined' && matchMedia(q).matches)
  useEffect(() => { const m = matchMedia(q), f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return w
}

const Cta = ({ user, startState }) => (
  <div className="flex flex-wrap items-center gap-3">
    <Link to={user ? '/empezar' : '/ingresar'} state={startState} className="btn btn-primary">Empezar con mis apuntes <span className="arrow">→</span></Link>
    <a href="#modulos" className="btn btn-soft">Descubrí los módulos</a>
  </div>
)

// Tres garabatos flotantes estilo cuaderno (ver Doodles.jsx), con su aclaración manuscrita y una flechita.
const SOURCES = [
  { label: 'apunte.pdf', rot: -5, d: 0, icon: <DocDoodle /> },
  { label: 'ejercicio.py', rot: 4, d: 1.2, icon: <CodeDoodle /> },
  { label: 'chat con IA', rot: -3, d: 2.4, icon: <ChatDoodle /> },
]
const POS = [{ ml: 0, mt: 6 }, { ml: 'clamp(18px,2.2vw,40px)', mt: 'clamp(26px,4.4vh,50px)' }, { ml: 'clamp(30px,3.6vw,70px)', mt: 0 }]
function Sources() {
  return (
    <div className="flex items-start">
      {SOURCES.map((s, i) => (
        <div key={s.label} className="grid justify-items-start gap-1" style={{ marginLeft: POS[i].ml, marginTop: POS[i].mt }}>
          <div className="nb-float hb-fade" style={{ '--r': `${s.rot}deg`, '--fd': `${s.d}s`, '--d': `${2.0 + i * .9}s` }}>{s.icon}</div>
          <span aria-hidden="true" className="flex items-end gap-1" style={{ fontFamily: '"Caveat", cursive', fontSize: 'clamp(1.05rem, 1.35vw, 1.4rem)', color: 'var(--ink-hand)', transform: `rotate(${-s.rot / 2}deg)` }}>
            <svg viewBox="0 0 22 22" className="nb-arrow mb-[.35em] size-[1.1em]" style={{ '--d': `${2.6 + i * .9}s` }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path pathLength="1" d="M4 19C3 12 6 6 14 3M9 2.5L14.4 3L12.6 8.2" /></svg>
            <span className="nb-wipe" style={{ '--d': `${3.0 + i * .9}s` }}>{s.label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function HeroBook({ user, startState }) {
  const wide = useWide()

  if (!wide) return (
    <div className="px-4 pt-8 pb-6 sm:px-10">
      <div className="rise mx-auto grid max-w-[560px] justify-items-center gap-5 text-center">
        <h1 className="display text-[clamp(2.1rem,8vw,3rem)]">Tus apuntes ya tienen ideas.<br /><span className="accent">Ahora conectalas.</span></h1>
        <p className="balance max-w-[40ch] text-muted">Aprendé, practicá y explicá cada tema a partir de tu propio material.</p>
        <Cta user={user} startState={startState} />
      </div>
      <div className="relative mx-auto mt-2 h-[380px] max-w-[560px]"><ParticleBrain center={[.5, .46]} size={.95} /></div>
    </div>
  )

  return (
    <div className="nb-spread">
      <div className="nb-sp l" />
      <div className="nb-sp r" />
      <ParticleBrain center={[.75, .5]} size={.46} />

      <div className="relative z-[3] grid h-full grid-cols-2" style={{ paddingBottom: 44 }}>
        {/* hoja izquierda */}
        <div className="relative flex h-full flex-col justify-center" style={{ paddingLeft: 'calc(var(--mg) + clamp(32px, 4vw, 80px))', paddingRight: '2vw', paddingTop: 'clamp(8px, 2vh, 24px)', paddingBottom: 'clamp(8px, 2vh, 20px)' }}>
          <div className="grid gap-[clamp(12px,2.2vh,24px)]">
            <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 4.2vw, 4.4rem)', lineHeight: 1.04 }}>Tus apuntes<br />ya tienen ideas.<br /><span className="accent">Ahora conectalas.</span></h1>
            <p className="text-muted" style={{ fontSize: 'clamp(15px, 1.25vw, 19px)', maxWidth: '31ch' }}>Aprendé, practicá y explicá cada tema a partir de tu propio material.</p>
            <div className="mt-1"><Cta user={user} startState={startState} /></div>
          </div>
          <div className="mt-[clamp(16px,3vh,36px)]"><Sources /></div>
        </div>
        {/* hoja derecha */}
        <div className="relative h-full">
        </div>
      </div>
    </div>
  )
}
