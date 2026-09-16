import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import NeuralBrain from '../components/NeuralBrain.jsx'
import RouteChain from '../components/RouteChain.jsx'
import Synapse from '../components/Synapse.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { MODULES, WEEKDAYS, firstName, longDate, parseDay, shortDate } from '../lib/format.js'

export default function Home() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const navState = useLocation().state
  const [notice, setNotice] = useState(() => {
    if (!navState?.created) return ''
    const failed = navState.failedUploads ?? []
    return 'Tu plan quedó listo. La primera sesión ya está en tu ruta.' +
      (failed.length ? ` No se pudo subir: ${failed.join(', ')}.` : '')
  })
  const navigate = useNavigate()

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message))
    if (notice) navigate('.', { replace: true, state: null }) // que el aviso no vuelva al recargar
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-[1120px] px-4 pb-20 sm:px-[4vw] xl:px-6">
        <section className="rise grid gap-2 pt-10 pb-8 md:pt-14">
          <span className="label first-letter:uppercase">{longDate(new Date())}</span>
          <h1 className="text-[clamp(2rem,4.6vw,3.2rem)] font-light tracking-[-.04em]">
            Hola, <strong className="font-semibold">{firstName(user?.name)}</strong>.
          </h1>
        </section>

        {notice && (
          <div role="status" className="rise mb-8 flex items-start justify-between gap-4 border-l-2 border-green bg-[color-mix(in_srgb,var(--green)_8%,transparent)] px-4 py-3 text-sm">
            <span>{notice}</span>
            <button type="button" className="cursor-pointer font-mono text-xs text-muted hover:text-fg" onClick={() => setNotice('')}>cerrar</button>
          </div>
        )}

        {error && <p role="alert" className="text-red">{error}</p>}
        {!data && !error && <Synapse>Cargando tu progreso</Synapse>}
        {data && (data.plans.length ? <Dashboard data={data} onNotice={setNotice} /> : <EmptyState />)}
      </main>
    </div>
  )
}

/* ---------- usuario nuevo: explicar y llevar al CTA ---------- */
function EmptyState() {
  const steps = [
    ['01', 'Elegí el tema y subí tu apunte', 'Lo cruzamos con fuentes confiables y te marcamos lo que está incompleto.'],
    ['02', 'Contanos cuánto sabés y cuándo podés', 'Con tus días y tu nivel armamos una ruta sesión por sesión.'],
    ['03', 'Seguí la ruta', 'Aprender, Practicar y Consolidar. Cada módulo suma a tu nivel de dominio.'],
  ]
  return (
    <section className="grid items-center gap-10 border-t border-line pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-8">
        <div className="grid gap-3">
          <h2 className="text-[1.6rem] font-light tracking-[-.02em]">Todavía no tenés un plan de estudio.</h2>
          <p className="max-w-[46ch] text-muted">Configurarlo lleva un par de minutos. Después, cada vez que entres vas a ver acá qué te toca hoy.</p>
        </div>
        <ol className="border-t border-line">
          {steps.map(([n, t, d]) => (
            <li key={n} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-line py-4">
              <span className="font-mono text-sm text-violet-strong">{n}</span>
              <div><p className="font-medium">{t}</p><p className="text-sm text-muted">{d}</p></div>
            </li>
          ))}
        </ol>
        <div><Link to="/estudiar/nuevo" className="btn btn-primary">Empezar a estudiar <span className="arrow">→</span></Link></div>
      </div>
      <div className="h-[300px] md:h-[440px]"><NeuralBrain intensity={0.85} /></div>
    </section>
  )
}

/* ---------- con planes activos ---------- */
function Dashboard({ data, onNotice }) {
  const [main, ...others] = data.plans
  const next = main.next_session
  const mod = next ? MODULES[next.module] : null
  const today = parseDay(data.today)

  return (
    <div className="grid gap-12">
      <section className="grid items-start gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Tarjeta: lo único que destaca en la pantalla es qué toca ahora */}
        <article className="card-current grid gap-6 p-6" style={{ '--c': mod?.color }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label">{next ? (parseDay(next.day) <= today ? 'Te toca hoy' : `Próxima sesión · ${shortDate(parseDay(next.day))}`) : 'Ruta completa'}</span>
            <span className="font-mono text-xs text-muted">sesión {next?.position ?? main.sessions_total} de {main.sessions_total}</span>
          </div>
          <div className="grid gap-1">
            {mod && <span className="font-mono text-sm" style={{ color: mod.color }}>{mod.label.toLowerCase()} · {next.minutes} min</span>}
            <h2 className="text-[clamp(1.7rem,3.4vw,2.4rem)] font-light tracking-[-.035em]">{main.topic}</h2>
            <p className="text-sm text-muted">{main.subject}</p>
          </div>
          <RouteChain byModule={main.by_module} current={next?.module} />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="btn btn-primary" disabled={!next}
              onClick={() => onNotice('El módulo Aprender se implementa en el próximo sprint: por ahora la ruta queda guardada.')}>
              Empezar sesión <span className="arrow">→</span>
            </button>
            <span className="text-sm text-muted">
              {main.materials ? `${main.materials} apunte${main.materials > 1 ? 's' : ''} cargado${main.materials > 1 ? 's' : ''}` : 'Sin apunte cargado'}
            </span>
          </div>
        </article>

        {/* Dominio */}
        <aside className="grid gap-4">
          <span className="label">Dominio · {main.topic}</span>
          <div className="text-[4.5rem] leading-none font-light tracking-[-.05em] tabular-nums">
            {main.mastery}<sup className="ml-1 align-top font-mono text-base tracking-normal text-muted">%</sup>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded bg-elev" aria-hidden="true">
            {Object.entries(MODULES).map(([k, m]) => {
              const s = main.by_module[k]
              return <i key={k} style={{ background: m.color, width: `${(s.done / main.sessions_total) * 100}%` }} />
            })}
          </div>
          <div className="grid gap-1.5 text-sm">
            {Object.entries(MODULES).map(([k, m]) => (
              <div key={k} className="flex justify-between border-b border-dashed border-line pb-1.5">
                <span className="flex items-center gap-2.5"><i className="size-2 rounded-full" style={{ background: m.color }} />{m.label}</span>
                <span className="font-mono text-muted tabular-nums">{main.by_module[k].done}/{main.by_module[k].total}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            {main.goal === 'examen'
              ? main.days_left >= 0 ? `Faltan ${main.days_left} días para el examen.` : 'La fecha del examen ya pasó.'
              : `Plan hasta el ${shortDate(parseDay(main.end_date))}.`}
          </p>
        </aside>
      </section>

      {/* Semana */}
      <section className="grid gap-4 border-t border-line pt-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid content-start gap-1"><span className="label">Esta semana</span><p className="text-sm text-muted">Días con sesión planificada.</p></div>
        <ol className="grid grid-cols-7 gap-2">
          {data.week.map((d, i) => {
            const isToday = d.day === data.today
            const state = d.done ? 'done' : d.planned ? 'planned' : 'free'
            return (
              <li key={d.day} className="grid justify-items-center gap-2">
                <span className={`font-mono text-[.7rem] ${isToday ? 'text-fg' : 'text-muted'}`}>{WEEKDAYS[i]}</span>
                <span className={`grid size-9 place-items-center rounded-full border font-mono text-xs ${
                  state === 'done' ? 'border-violet bg-violet text-on-accent'
                  : state === 'planned' ? 'border-violet text-violet-strong'
                  : 'border-line text-muted'} ${isToday ? 'ring-2 ring-violet/30 ring-offset-2 ring-offset-bg' : ''}`}>
                  {parseDay(d.day).getDate()}
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Planes */}
      <section className="grid gap-4 border-t border-line pt-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <span className="label">Tus planes</span>
          <div><Link to="/estudiar/nuevo" className="btn btn-secondary">Nuevo plan</Link></div>
        </div>
        <ul className="border-t border-line">
          {[main, ...others].map((p) => {
            const pct = Math.round((p.sessions_done / p.sessions_total) * 100)
            return (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.topic}</p>
                  <p className="truncate text-sm text-muted">{p.subject}</p>
                </div>
                <div className="col-span-2 flex items-center gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <span className="h-[3px] flex-1 overflow-hidden rounded bg-elev"><i className="block h-full bg-gradient-to-r from-blue via-green to-pink" style={{ width: `${pct}%` }} /></span>
                  <span className="font-mono text-xs text-muted tabular-nums">{p.sessions_done}/{p.sessions_total}</span>
                </div>
                <span className="col-start-2 row-start-1 font-mono text-xs text-muted sm:col-start-3">{p.mastery}%</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
