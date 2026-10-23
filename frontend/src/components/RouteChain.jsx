import { Link } from 'react-router-dom'
import { MODULES } from '../lib/format.js'
import { IconLock } from './Icons.jsx'

/*
  "Tu recorrido": los tres módulos en fila, unidos por una línea con gradiente.
  El estado de cada uno se marca a mano (subrayado en el actual, tilde en los hechos),
  igual que el subrayado/tilde del selector de temas — no con un ícono geométrico,
  para no romper la estética de cuaderno.
*/
const Subrayado = () => (
  <svg className="rc-underline" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6C20 2 40 9 60 5S100 3 118 6" /></svg>
)
const Tilde = () => (
  <svg className="rc-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13c2.5 2 4 4 5 6 3-6 6-10 11-14" /></svg>
)

export default function RouteChain({ byModule, current }) {
  const keys = Object.keys(MODULES)
  const idx = keys.indexOf(current)

  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute top-[22px] right-[16%] left-[16%] hidden h-px md:block"
        style={{ background: 'linear-gradient(90deg, var(--blue), var(--green) 50%, var(--pink))', opacity: .35 }} />
      <ol className="relative grid gap-3 md:grid-cols-3">
        {keys.map((k, i) => {
          const m = MODULES[k], s = byModule?.[k] ?? { done: 0, total: 0 }
          const state = s.total && s.done === s.total ? 'done' : i === idx ? 'now' : i < idx ? 'done' : 'locked'
          const status = state === 'done' ? 'Completo'
            : state === 'now' ? `${s.done} de ${s.total} · Continuar →`
            : 'Bloqueado'
          return (
            <li key={k} className="card grid content-start gap-2 p-5" style={{ '--c': m.color }}>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                {state === 'done' && <Tilde />}
                {state === 'locked' && <IconLock className="size-3.5" />}
                <span>{state === 'now' ? 'Estás acá' : state === 'done' ? 'Listo' : 'Todavía no'}</span>
              </div>
              <h3 className="relative inline-block self-start text-[1.1rem] font-medium tracking-[-.02em]">
                {m.label}
                {state === 'now' && <Subrayado />}
              </h3>
              {state === 'now'
                ? <Link to={m.path} className="text-sm font-medium" style={{ color: m.color }}>{status}</Link>
                : <span className="text-sm text-muted">{status}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
