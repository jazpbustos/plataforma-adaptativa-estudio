import { Link } from 'react-router-dom'
import { MODULES } from '../lib/format.js'
import { IconCheck, IconLock } from './Icons.jsx'

/*
  "Tu recorrido": los tres módulos como tarjetas.
  Cada una lleva su neurona: encendida (hecha), con halo (actual) o punteada con candado (bloqueada).
  Una línea con gradiente las conecta, como en la identidad visual.
*/
export default function RouteChain({ byModule, current }) {
  const keys = Object.keys(MODULES)
  const idx = keys.indexOf(current)

  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute top-[34px] right-[16%] left-[16%] hidden h-px md:block"
        style={{ background: 'linear-gradient(90deg, var(--blue), var(--green) 50%, var(--pink))', opacity: .35 }} />
      <ol className="relative grid gap-3 md:grid-cols-3">
        {keys.map((k, i) => {
          const m = MODULES[k], s = byModule?.[k] ?? { done: 0, total: 0 }
          const state = s.total && s.done === s.total ? 'done' : i === idx ? 'now' : i < idx ? 'done' : 'locked'
          const status = state === 'done' ? `Completo · ${s.total} sesiones`
            : state === 'now' ? `${s.done} de ${s.total} sesiones · Continuar ↗`
            : i === idx + 1 ? `Disponible al terminar ${MODULES[keys[i - 1]].label}` : 'Se desbloquea más adelante'
          return (
            <li key={k} className="card grid content-start gap-3 p-5" style={{ '--c': m.color }}>
              <div className="flex items-center justify-between">
                <span className={`relative grid size-7 place-items-center rounded-full border-[1.5px] font-mono text-[.68rem] ${
                  state === 'done' ? 'border-[var(--c)] bg-[var(--c)] text-bg'
                  : state === 'now' ? 'halo border-[var(--c)] bg-card text-[var(--c)]'
                  : 'border-dashed border-rule bg-card text-muted'}`}>
                  {state === 'done' ? <IconCheck className="size-3.5" /> : state === 'locked' ? <IconLock className="size-3.5" /> : i + 1}
                </span>
                <span className="font-mono text-[.68rem] tracking-wider uppercase" style={{ color: m.color }}>{m.n} / {m.label}</span>
              </div>
              <div>
                <h3 className="text-[1.2rem] font-medium tracking-[-.02em]">{m.verb}</h3>
                <p className="text-sm text-muted">{m.desc}</p>
              </div>
              {state === 'now'
                ? <Link to={m.path} className="text-sm font-medium" style={{ color: m.color }}>{status}</Link>
                : <span className="text-sm font-medium" style={{ color: state === 'locked' && i !== idx + 1 ? m.color : m.color, opacity: state === 'locked' ? .85 : 1 }}>{status}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
