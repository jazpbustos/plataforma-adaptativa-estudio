import { Fragment, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { GradeDoodle, DocDoodle, CalendarDoodle } from '../components/Doodles.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RouteChain from '../components/RouteChain.jsx'
import Synapse from '../components/Synapse.jsx'
import TopicSwitch from '../components/TopicSwitch.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { MODULES, firstName, parseDay, shortDate } from '../lib/format.js'

const PASOS = [
  { D: GradeDoodle, title: 'Elegí qué estudiar', desc: 'El tema, los días que tenés, tu nivel y la nota a la que apuntás.' },
  { D: DocDoodle, title: 'Sumá tu material', desc: 'Apuntes o guías de tu cátedra. Es opcional: si no tenés, usamos fuentes académicas.' },
  { D: CalendarDoodle, title: 'Recibí tu plan', desc: 'Un plan día por día que se ajusta a medida que avanzás.' },
]

// Flecha a mano entre un paso y el siguiente
const Flecha = () => (
  <svg className="hm-arrow" viewBox="0 0 84 30"><path d="M4 22C26 6 54 4 80 16" /><path d="M71 8l9 8-11 4" /></svg>
)

export default function Home() {
  const { user } = useAuth()
  const { data, plan, selectPlan } = useOutletContext()
  const navState = useLocation().state
  const navigate = useNavigate()
  const [notice, setNotice] = useState(() => {
    if (!navState?.created) return ''
    window.history.replaceState({}, '') // que el aviso no vuelva al recargar
    const failed = navState.failedUploads ?? []
    return 'Tu plan quedó listo y ya está elegido. La primera sesión te está esperando.' + (failed.length ? ` No se pudo subir: ${failed.join(', ')}.` : '')
  })

  if (!data) return <Synapse>Cargando tu espacio</Synapse>
  const name = firstName(user?.name)

  if (!data.plans.length) {
    return (
      <div className="grid gap-10">
        <PageHeader title={`Hola, ${name}.`} sub="Armemos tu primer plan de estudio." />
        <ol className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          {PASOS.map(({ D, title, desc }, i) => (
            <Fragment key={title}>
              {i > 0 && <li aria-hidden="true" className="hidden pt-10 md:block"><Flecha /></li>}
              <li className="rise grid justify-items-start gap-3" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="flex items-end gap-2"><D size="84px" /><span className="hm-num">{i + 1}</span></div>
                <h2 className="text-[1.1rem] font-medium tracking-[-.02em]">{title}</h2>
                <p className="max-w-[30ch] text-sm text-muted">{desc}</p>
              </li>
            </Fragment>
          ))}
        </ol>
        <div><Link to="/empezar" className="btn btn-primary">Armar mi plan <span className="arrow">→</span></Link></div>
      </div>
    )
  }

  const next = plan.next_session
  const m = next ? MODULES[next.module] : null
  const pct = Math.round((plan.sessions_done / plan.sessions_total) * 100)
  const isToday = next && parseDay(next.day) <= parseDay(data.today)

  return (
    <div className="grid gap-10">
      <PageHeader title={`Hola, ${name}.`} />
      <TopicSwitch plans={data.plans} current={plan} onSelect={selectPlan} />

      {notice && (
        <div role="status" className="rise card flex items-start justify-between gap-4 border-l-2 !border-l-green px-5 py-3 text-sm">
          <span>{notice}</span>
          <button type="button" className="cursor-pointer text-xs text-muted hover:text-fg" onClick={() => setNotice('')}>cerrar</button>
        </div>
      )}

      {next && (
        <section className="card flex flex-wrap items-center justify-between gap-5 p-6" style={{ '--c': m.color }}>
          <div className="grid gap-1">
            <span className="label" style={{ color: m.color }}>{isToday ? 'Hoy' : `El ${shortDate(parseDay(next.day))}`} · {m.label}</span>
            <h2 className="text-[1.35rem] font-medium tracking-[-.02em]">{plan.topic}</h2>
          </div>
          <button type="button" className="btn btn-module" onClick={() => navigate(m.path)}>Continuar <span className="arrow">→</span></button>
        </section>
      )}

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[1.15rem] font-medium tracking-[-.02em]">Tu recorrido</h2>
          <Link to="/app/progreso" className="text-xs text-muted hover:text-fg">Ver progreso ↗</Link>
        </div>
        <RouteChain byModule={plan.by_module} current={next?.module} />
      </section>

      <section className="grid gap-2">
        <div className="flex justify-between text-xs"><span className="text-muted">Tu avance en {plan.topic}</span><span className="tabular-nums">{pct} %</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elev" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i className="block h-full rounded-full bg-violet" style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
        <p className="text-xs text-muted">{plan.sessions_done} de {plan.sessions_total} sesiones · {plan.days_left >= 0 ? `faltan ${plan.days_left} días para tu fecha objetivo` : `hasta el ${shortDate(parseDay(plan.end_date))}`}</p>
      </section>
    </div>
  )
}
