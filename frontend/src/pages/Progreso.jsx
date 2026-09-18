import { Link, useOutletContext } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { MODULES, WEEKDAYS, parseDay } from '../lib/format.js'

function Stat({ label, value, sub }) {
  return (
    <div className="card grid gap-1 p-5">
      <span className="label">{label}</span>
      <span className="text-[2rem] leading-tight font-medium tracking-[-.03em] tabular-nums">{value}</span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  )
}

export default function Progreso() {
  const { data } = useOutletContext()
  if (!data) return <Synapse>Cargando</Synapse>
  const plan = data.plans[0]

  if (!plan) return (
    <div className="grid gap-8">
      <PageHeader kicker="Mi avance" title="Acá vas a ver" accent="cómo toma forma." sub="Cuando tengas una ruta, este panel muestra tu dominio, tus sesiones y tu semana." />
      <div><Link to="/empezar" className="btn btn-primary">Configurar objetivo <span className="arrow">→</span></Link></div>
    </div>
  )

  const next = plan.next_session
  const focus = next ? MODULES[next.module] : null

  return (
    <div className="grid gap-8">
      <PageHeader kicker={`Mi avance / ${plan.topic}`} title="Así va" accent="tomando forma." sub="Tu dominio del tema, cuánto avanzaste en cada módulo y cómo viene la semana." />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Dominio del tema" value={<span className="accent">{plan.mastery} %</span>} sub="Se calcula con los tres módulos" />
        <Stat label="Sesiones completadas" value={`${plan.sessions_done} / ${plan.sessions_total}`} sub="En esta ruta" />
        <Stat label="Fecha objetivo" value={plan.days_left >= 0 ? `${plan.days_left} días` : 'Vencida'} sub={plan.days_left >= 0 ? 'Para llegar' : 'Podés ajustar la fecha'} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="card grid content-start gap-5 p-5">
          <span className="label">Esta semana</span>
          <ol className="grid grid-cols-7 gap-1.5">
            {data.week.map((d, i) => {
              const today = d.day === data.today
              const st = d.done ? 'done' : d.planned ? 'planned' : 'free'
              return (
                <li key={d.day} className="grid justify-items-center gap-2" title={st === 'free' ? 'Sin sesión' : `${d.done}/${d.planned} sesión hecha`}>
                  <span className={`text-[.7rem] ${today ? 'text-fg' : 'text-muted'}`}>{WEEKDAYS[i]}</span>
                  <span className={`grid size-9 place-items-center rounded-full text-xs tabular-nums ${
                    st === 'done' ? 'bg-violet text-on-accent' : st === 'planned' ? 'border border-violet text-fg' : 'bg-elev text-muted'} ${today ? 'ring-2 ring-violet/30 ring-offset-2 ring-offset-card' : ''}`}>
                    {parseDay(d.day).getDate()}
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full border border-violet" />Planificada</span>
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-violet" />Hecha</span>
          </div>
        </div>

        <div className="card grid content-start gap-5 p-5">
          <span className="label">Por módulo</span>
          {Object.entries(MODULES).map(([k, m]) => {
            const s = plan.by_module[k], pct = s.total ? Math.round((s.done / s.total) * 100) : 0
            return (
              <div key={k} className="grid gap-1.5" title={`${m.label}: ${s.done} de ${s.total} sesiones`}>
                <div className="flex justify-between text-sm"><span className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: m.color }} />{m.label}</span>
                  <span className="font-mono text-xs text-muted tabular-nums">{s.done}/{s.total} · {pct} %</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-elev"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} /></div>
              </div>
            )
          })}
        </div>
      </section>

      {focus && (
        <p className="card px-5 py-4 text-sm">
          <span className="text-muted">Próximo foco: </span>{focus.label.toLowerCase()} {plan.topic}, sesión {next.position} de {plan.sessions_total}.
        </p>
      )}
    </div>
  )
}
