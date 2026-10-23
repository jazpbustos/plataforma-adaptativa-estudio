import { Link } from 'react-router-dom'

/*
  Selector del tema activo (cada tema es un objetivo de estudio con su propio plan).
  "tabs": pestañas de cuaderno con el subrayado a mano debajo del tema elegido (Progreso, Mi material).
  "cards": tarjetas con el avance de cada tema (Inicio).
  El tema elegido se guarda en AppShell y lo usan todas las pantallas del panel.
*/
const Subrayado = () => (
  <svg className="tp-underline" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6C20 2 40 9 60 5S100 3 118 6" /></svg>
)
const Tilde = () => (
  <svg className="tp-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13c2.5 2 4 4 5 6 3-6 6-10 11-14" /></svg>
)

export default function TopicSwitch({ plans, current, onSelect, variant = 'tabs' }) {
  if (variant === 'tabs') {
    return (
      <div role="radiogroup" aria-label="Tema" className="flex flex-wrap items-end gap-x-7 gap-y-2 border-b border-line/70">
        {plans.map((p) => {
          const on = p.id === current?.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onSelect(p.id)}
              className={`relative cursor-pointer pb-2.5 text-sm transition ${on ? 'font-medium text-fg' : 'text-muted hover:text-fg'}`}>
              {p.topic}{on && <Subrayado />}
            </button>
          )
        })}
        <Link to="/empezar" className="pb-2.5 text-sm text-muted transition hover:text-fg">+ Sumar tema</Link>
      </div>
    )
  }

  const pct = (p) => Math.round((p.sessions_done / p.sessions_total) * 100)
  return (
    <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => {
        const on = p.id === current?.id
        return (
          <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onSelect(p.id)}
            className={`card relative grid cursor-pointer gap-4 p-5 text-left transition ${on ? '!border-violet/60' : 'opacity-80 hover:opacity-100'}`}>
            <span className="pr-7 text-[1.02rem] font-medium tracking-[-.02em]">{p.topic}</span>
            {on && <Tilde />}
            <span className="grid gap-1.5">
              <span className="h-1 overflow-hidden rounded-full bg-elev" aria-hidden="true">
                <i className="block h-full rounded-full bg-violet" style={{ width: `${Math.max(pct(p), 2)}%` }} />
              </span>
              <span className="text-xs text-muted">Sesión {Math.min(p.sessions_done + 1, p.sessions_total)} de {p.sessions_total}</span>
            </span>
          </button>
        )
      })}
      <Link to="/empezar" className="grid min-h-[104px] place-content-center rounded-2xl border border-dashed border-rule p-5 text-sm text-muted transition hover:border-violet/50 hover:text-fg">
        + Sumar tema
      </Link>
    </div>
  )
}
