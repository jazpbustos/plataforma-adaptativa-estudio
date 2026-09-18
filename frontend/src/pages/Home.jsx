import { useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import NeuralBrain from '../components/NeuralBrain.jsx'
import PageHeader from '../components/PageHeader.jsx'
import RouteChain from '../components/RouteChain.jsx'
import Synapse from '../components/Synapse.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { MODULES, firstName, parseDay, shortDate } from '../lib/format.js'

export default function Home() {
  const { user } = useAuth()
  const { data } = useOutletContext()
  const navState = useLocation().state
  const navigate = useNavigate()
  const [notice, setNotice] = useState(() => {
    if (!navState?.created) return ''
    window.history.replaceState({}, '') // que el aviso no vuelva al recargar
    const failed = navState.failedUploads ?? []
    return 'Tu ruta quedó lista. La primera sesión ya te está esperando.' + (failed.length ? ` No se pudo subir: ${failed.join(', ')}.` : '')
  })

  if (!data) return <Synapse>Cargando tu espacio</Synapse>
  const name = firstName(user?.name)

  if (!data.plans.length) {
    return (
      <div className="grid gap-8">
        <PageHeader title={`Hola, ${name}.`} accent="Empecemos por tu objetivo." sub="Contanos qué querés preparar y, si tenés, sumá tus apuntes: con eso armamos tu recorrido." />
        <section className="card grid items-center gap-6 overflow-hidden p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-8">
          <div className="grid gap-5">
            <ol className="grid gap-3">
              {[['01', 'Configurá tu objetivo'], ['02', 'Subí tu material'], ['03', 'Revisá tu ruta']].map(([n, t]) => (
                <li key={n} className="flex items-center gap-3"><span className="font-mono text-xs accent">{n}</span><span>{t}</span></li>
              ))}
            </ol>
            <div><Link to="/empezar" className="btn btn-primary">Empezar con mis apuntes <span className="arrow">→</span></Link></div>
          </div>
          <div className="h-[260px]"><NeuralBrain intensity={0.85} /></div>
        </section>
      </div>
    )
  }

  const plan = data.plans[0]
  const next = plan.next_session
  const m = next ? MODULES[next.module] : null
  const pct = Math.round((plan.sessions_done / plan.sessions_total) * 100)
  const isToday = next && parseDay(next.day) <= parseDay(data.today)

  return (
    <div className="grid gap-10">
      <PageHeader title={`Hola, ${name}.`} accent={plan.sessions_done ? 'Seguimos desde acá.' : 'Arrancamos cuando quieras.'}
        sub={next ? `${isToday ? 'Hoy toca' : `El ${shortDate(parseDay(next.day))} toca`} ${m.label.toLowerCase()} ${plan.topic}.` : `Completaste la ruta de ${plan.topic}.`} />

      {notice && (
        <div role="status" className="rise card flex items-start justify-between gap-4 border-l-2 !border-l-green px-5 py-3 text-sm">
          <span>{notice}</span>
          <button type="button" className="cursor-pointer font-mono text-xs text-muted hover:text-fg" onClick={() => setNotice('')}>cerrar</button>
        </div>
      )}

      {next && (
        <section className="card flex flex-wrap items-center justify-between gap-5 p-6" style={{ '--c': m.color }}>
          <div className="grid gap-1">
            <span className="label" style={{ color: m.color }}>Siguiente paso · {m.label}</span>
            <h2 className="text-[1.35rem] font-medium tracking-[-.02em]">{plan.topic}</h2>
            <p className="text-xs text-muted">
              Sesión {next.position} de {plan.sessions_total} · {next.minutes} min · {plan.materials ? 'Tus apuntes + fuentes indexadas' : 'Con fuentes indexadas'}
            </p>
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
        <div className="flex justify-between text-xs"><span className="text-muted">Tu avance en {plan.topic}</span><span className="font-mono tabular-nums">{pct} %</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elev" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i className="block h-full rounded-full bg-violet" style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
        <p className="text-xs text-muted">{plan.sessions_done} de {plan.sessions_total} sesiones · {plan.goal === 'examen' && plan.days_left >= 0 ? `faltan ${plan.days_left} días para tu fecha objetivo` : `hasta el ${shortDate(parseDay(plan.end_date))}`}</p>
      </section>
    </div>
  )
}
