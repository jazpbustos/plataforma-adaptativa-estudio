/*
  Progreso (Pantalla 5; HU-009, HU-010, HU-011 y HU-012), con lo esencial a la vista y el detalle a pedido:
  el dominio frente al requerido por la nota objetivo y lo que falta; el plan de hoy (y si se reajustó); cada
  módulo con su estado, su resultado y lo que falta si está bloqueado (el cálculo del dominio, a pedido); las
  dificultades detectadas, en palabras, con la ayuda recibida y si hubo avance, y el detalle de sesiones y de
  puntos por ejercicio.
*/
import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import PageHeader, { Pantalla } from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import TopicSwitch from '../components/TopicSwitch.jsx'
import { api } from '../lib/api.js'
import { instante, MODULES } from '../lib/format.js'

const num = (x, d = 1) => (Number.isInteger(x) ? String(x) : x.toFixed(d)).replace('.', ',')
const ESTADOS = {
  aprobado: { texto: 'Aprobado', color: 'var(--green)' },
  habilitado: { texto: 'Habilitado', color: 'var(--blue)' },
  bloqueado: { texto: 'Bloqueado', color: 'var(--text-secondary)' },
}
const fecha = (iso) => instante(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
const hora = (iso) => instante(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

export default function Progreso() {
  const { data, plan, selectPlan, reload } = useOutletContext()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState(null) // módulo elegido en las tarjetas: la lista de abajo muestra solo lo suyo
  const planId = plan?.id

  const cargar = useCallback(() => api(`/plans/${planId}/progreso`).then(setP).catch((e) => setError(e.message)), [planId])
  useEffect(() => {
    if (!planId) return
    setP(null); setError(''); setFiltro(null)
    cargar()
  }, [planId, cargar])

  if (!data) return <Synapse>Cargando</Synapse>
  if (!plan) return (
    <div className="grid gap-8">
      <PageHeader title="Progreso" sub="Cuando tengas un plan, acá vas a ver tu dominio y tus sesiones." />
      <div><Link to="/empezar" className="btn btn-primary">Configurar objetivo <span className="arrow">→</span></Link></div>
    </div>
  )

  return (
    <Pantalla title="Progreso" sub="Cuánto sabés del tema, qué te toca hoy y qué te costó.">
      <TopicSwitch plans={data.plans} current={plan} onSelect={selectPlan} />
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      {!p && !error ? <Synapse>Cargando el progreso del tema</Synapse> : p && (
        // Lo esencial a la vista (dominio, hoy, cada módulo y lo que costó); el detalle, a pedido.
        // Un solo bloque a alto de ventana, como los módulos: arriba el dominio y el plan de hoy, después los tres
        // módulos y abajo, en pestañas con su propio desplazamiento, lo que costó, las sesiones y los puntos.
        <article className="card flex min-h-[520px] min-w-0 flex-col gap-5 overflow-hidden px-6 pt-5 lg:min-h-0 lg:flex-1">
          <Resumen p={p} plan={plan} planes={data.plans} onExtendido={() => { cargar(); reload() }} />
          <Modulos p={p} filtro={filtro} onFiltro={setFiltro} />
          <Pestanas p={p} filtro={filtro} onFiltro={setFiltro} />
        </article>
      )}
    </Pantalla>
  )
}

// ---------------- Resumen: dominio frente a la meta y el plan de hoy ----------------

const MOTIVOS = {
  'reajuste: actividades pendientes': 'plan reajustado: lo pendiente pasó a los días que quedan',
  'reajuste: adelanto': 'plan reajustado: te adelantaste',
  'extensión': 'plan extendido',
  'avance de nivel': 'seguís con un nivel más',
}

function Resumen({ p, plan, planes, onExtendido }) {
  const falta = -p.diferencia
  const dias = plan.days_left
  const actual = planes.find((x) => x.id === plan.id)
  const hoy = actual?.today_session
  const otros = planes.filter((x) => x.id !== plan.id && x.today_session)
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
      <div className="grid gap-3">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[2.6rem] leading-none font-medium tracking-[-.03em] tabular-nums"><span className="accent">{num(p.dominio)} %</span></span>
          <span className="text-sm text-muted">de dominio · necesitás {p.requerido} % para tu {p.nota_objetivo}</span>
        </p>
        <div className="relative h-2.5 max-w-xl rounded-full bg-elev" aria-hidden="true">
          <i className="block h-full rounded-full bg-violet" style={{ width: `${Math.min(100, p.dominio)}%` }} />
          <i className="absolute -top-1 h-[18px] w-0.5 rounded bg-fg" style={{ left: `${p.requerido}%` }} />
        </div>
        <p className="text-sm">
          {falta > 0 ? <>Te faltan <b className="font-medium">{num(falta)} puntos</b></> : <span className="text-green">¡Llegaste a la meta!</span>}
          <span className="text-muted"> · {dias > 0 ? `${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`} de plan` : dias === 0 ? 'hoy es el último día del plan' : 'el plan terminó, podés seguir estudiando'}</span>
        </p>
      </div>
      <div className="grid gap-1.5 rounded-2xl bg-elev/60 px-4 py-3 text-sm md:min-w-64">
        <span className="text-xs text-muted">{hoy ? `Hoy · día ${hoy.position} de ${actual?.sessions_total}` : 'Hoy'}
          {actual?.plan_readjusted && <span className="block text-orange">{MOTIVOS[actual.plan_reason] ?? 'plan reajustado'}</span>}</span>
        {hoy
          ? <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium"><i className="size-2.5 rounded-full" style={{ background: MODULES[hoy.module].color }} />{MODULES[hoy.module].label}</span>
              {hoy.status !== 'hecha' ? <Link to={MODULES[hoy.module].path} className="btn btn-soft btn-sm">Ir →</Link> : <span className="text-xs text-green">hecho</span>}
            </div>
          : <span>No tenés actividades hoy.</span>}
        {otros.length > 0 && <span className="text-xs text-muted">También hoy: {otros.map((x) => `${x.topic} (${MODULES[x.today_session.module].label})`).join(' · ')}</span>}
      </div>
      {p.plan.extensible && (
        <ElegirDias p={p} plan={plan} accion="extender" boton="Extender el plan" onListo={onExtendido}
          tono="bg-[color-mix(in_srgb,var(--orange)_8%,transparent)]">
          El plan terminó y todavía te faltan {num(-p.diferencia)} puntos para la meta. Podés seguir estudiando libre o extenderlo:
          lo pendiente y actividades de refuerzo se reparten en los días nuevos.
        </ElegirDias>
      )}
      {p.plan.nivel_siguiente && (
        <ElegirDias p={p} plan={plan} accion="avanzar" boton={`Seguir con el nivel ${p.plan.nivel_siguiente}`} onListo={onExtendido}
          tono="bg-[color-mix(in_srgb,var(--green)_9%,transparent)]">
          Cumpliste tu objetivo. ¿Seguís con el nivel <b className="font-medium">{p.plan.nivel_siguiente}</b>? La evaluación de
          Aprender pasa a tener preguntas más difíciles y Practicar te da ejercicios nuevos de mayor dificultad. Lo que ya lograste se conserva.
        </ElegirDias>
      )}
    </div>
  )
}

// Ofertas sobre el plan (HU-010): extenderlo si terminó sin llegar al dominio requerido (CA5) o seguir con el nivel
// siguiente si ya se llegó (CA6). En las dos el estudiante elige de 1 a 7 días.
function ElegirDias({ p, plan, accion, tono, boton, onListo, children }) {
  const [desde, hasta] = p.plan.dias_extension
  const [dias, setDias] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enviar = async () => {
    setBusy(true); setError('')
    try { await api(`/plans/${plan.id}/plan/${accion}`, { method: 'POST', body: { dias } }); onListo() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm md:col-span-2 ${tono}`}>
      <p className="min-w-0 flex-1">{children}</p>
      <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Días" className="rounded-lg border border-line bg-card px-2 py-1 text-sm">
        {Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'día' : 'días'}</option>)}
      </select>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={enviar}>{boton}</button>
      {error && <p role="alert" className="w-full text-xs text-red">{error}</p>}
    </div>
  )
}

// ---------------- Los tres módulos: estado, resultado y aporte ----------------

const CLAVE = {
  aprender: (c) => c.detalle.replace('mejor evaluación', 'Mejor evaluación').replace('todavía sin evaluación', 'Todavía no rendiste la evaluación'),
  practicar: (_, p) => `${p.puntos.ejercicios.length} ${p.puntos.ejercicios.length === 1 ? 'ejercicio resuelto' : 'ejercicios resueltos'} · ${p.puntos.total} puntos`,
  consolidar: (c) => c.detalle.replace('última explicación', 'Última explicación').replace('todavía sin explicación', 'Todavía no explicaste el tema'),
}

function Modulos({ p, filtro, onFiltro }) {
  const [cuenta, setCuenta] = useState(false)
  const c = p.componentes
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        {Object.entries(MODULES).map(([k, m]) => {
          const e = p.modulos[k], st = ESTADOS[e.estado]
          return (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => onFiltro(filtro === k ? null : k)}
              title={filtro === k ? 'Ver todos los módulos' : `Ver solo lo de ${m.label}`}
              className="grid cursor-pointer content-start gap-1.5 rounded-2xl border px-4 py-3.5 text-left transition hover:bg-elev"
              style={{ background: filtro === k ? `color-mix(in srgb, ${m.color} 8%, var(--bg-card))` : 'color-mix(in srgb, var(--bg-elev) 60%, transparent)',
                borderColor: filtro === k ? m.color : 'transparent' }}>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium"><i className="size-2.5 flex-none rounded-full" style={{ background: m.color }} />{m.label}</span>
                <span className="text-xs font-medium" style={{ color: st.color }}>{st.texto}</span>
              </span>
              <span className="text-sm">{CLAVE[k](c[k], p)}</span>
              {e.falta && <span className="text-xs text-muted">Falta: {e.falta}</span>}
            </button>
          )
        })}
      </div>
      <button type="button" className="justify-self-start cursor-pointer text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setCuenta((x) => !x)}
        aria-expanded={cuenta}>{cuenta ? 'Ocultar el cálculo' : '¿Cómo se calcula el dominio?'}</button>
      {cuenta && (
        <p className="text-sm text-muted">
          Cada módulo aporta su resultado por su peso: Aprender {num(c.aprender.valor)} % × {num(c.aprender.peso)} + Practicar {num(c.practicar.valor)} % × {num(c.practicar.peso)} + Consolidar {num(c.consolidar.valor)} % × {num(c.consolidar.peso)} = <b className="font-medium text-fg">{num(p.dominio)} %</b>.
          {' '}En Practicar cuentan los puntos de tus 5 mejores ejercicios sobre 50.
        </p>
      )}
    </div>
  )
}

// ---------------- Abajo, en pestañas: lo que costó, las sesiones y los puntos ----------------

const QUE_PASO = {
  'intentos fallidos repetidos': 'repetiste el mismo error varias veces',
  'tiempo excedido': 'tardaste más de lo esperado después de un error',
  'explicación incompleta': 'una respuesta quedó incompleta',
  'explicación incorrecta': 'una respuesta tenía un error',
}

function Pestanas({ p, filtro, onFiltro }) {
  const historial = filtro ? p.historial.filter((s) => s.modulo === filtro) : p.historial
  const costos = historial.flatMap((s) => s.dificultades.map((d) => ({ ...d, modulo: s.modulo })))
  const puntos = !filtro || filtro === 'practicar' ? p.puntos : { total: 0, ejercicios: [] } // los puntos son de Practicar
  const [tab, setTab] = useState('costos')
  const tabs = [['costos', 'Lo que te costó', costos.length], ['sesiones', 'Sesiones', historial.length], ['puntos', 'Puntos', puntos.total]]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex gap-5 text-sm">
        {tabs.map(([k, t, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`cursor-pointer pb-1.5 ${tab === k ? 'border-b-2 border-violet font-medium text-fg' : 'border-b-2 border-transparent text-muted hover:text-fg'}`}>
            {t} <span className="text-xs text-muted tabular-nums">{n}</span>
          </button>
        ))}
        {filtro && (
          <span className="ml-auto flex items-center gap-2 self-start text-xs text-muted">
            Solo {MODULES[filtro].label}
            <button type="button" className="cursor-pointer underline underline-offset-2 hover:text-fg" onClick={() => onFiltro(null)}>ver todo</button>
          </span>
        )}
      </div>
      <div role="tabpanel" className="relative min-h-0 flex-1 overflow-y-auto pt-3 pb-5 [scrollbar-width:thin]">
        {tab === 'costos' && (!costos.length
          ? <p className="text-sm text-muted">{filtro === 'aprender' ? 'En Aprender no se registran dificultades: el resultado de tus evaluaciones está en la tarjeta de arriba y el detalle, en Sesiones.' : filtro ? `Por ahora no se detectaron dificultades en ${MODULES[filtro].label}.` : 'Por ahora no se detectaron dificultades.'} {!filtro && ' Cuando te trabes en un ejercicio o una respuesta de Consolidar quede incompleta, va a aparecer acá.'}</p>
          : <ul className="grid gap-2.5">{costos.map((d, i) => <Dificultad key={i} d={d} />)}</ul>)}
        {tab === 'sesiones' && (!historial.length
          ? <p className="text-sm text-muted">Todavía no hay sesiones en este tema.</p>
          : <ol className="grid gap-2 text-sm">
              {historial.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="w-32 flex-none text-xs text-muted">{fecha(s.fecha_hora)} · {hora(s.fecha_hora)}</span>
                  <span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: MODULES[s.modulo].color }} />{MODULES[s.modulo].label}</span>
                  <span className="min-w-0 flex-1 text-muted">{s.resumen}</span>
                </li>
              ))}
            </ol>)}
        {tab === 'puntos' && (!puntos.ejercicios.length
          ? <p className="text-sm text-muted">{filtro && filtro !== 'practicar' ? 'Los puntos se ganan en Practicar. ' : ''}Cada ejercicio resuelto suma 10 puntos sin ayuda, 7 con pista y 4 con explicación.</p>
          : <ul className="grid max-w-xl gap-2 text-sm">
              {puntos.ejercicios.map((e, i) => (
                <li key={i} className="flex justify-between gap-3"><span>{e.ejercicio} <span className="text-xs text-muted">· {e.ayuda}</span></span><b className="font-medium tabular-nums">+{e.puntos}</b></li>
              ))}
            </ul>)}
      </div>
    </div>
  )
}

// Una dificultad en una línea de texto: dónde, qué pasó, qué ayuda recibió y si destrabó.
function Dificultad({ d }) {
  const [abierta, setAbierta] = useState(false)
  const m = MODULES[d.modulo]
  const despues = d.hubo_avance === true ? [' y lo destrabaste', 'text-green'] : d.hubo_avance === false ? [' y seguiste trabada', 'text-red'] : null
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <i className="size-2 flex-none self-center rounded-full" style={{ background: m.color }} />
        <p className="min-w-0 flex-1">
          <b className="font-medium">{d.ejercicio ?? m.label}</b>
          <span className="text-muted">: {QUE_PASO[d.tipo] ?? d.tipo}{d.nivel ? `; recibiste ${d.nivel === 1 ? 'una pista' : 'una explicación'}` : ''}</span>
          {despues && <span className={despues[1]}>{despues[0]}</span>}.
        </p>
        <span className="text-xs text-muted">{fecha(d.fecha_hora)}</span>
        {d.intervencion && <button type="button" className="cursor-pointer text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setAbierta((x) => !x)}
          aria-expanded={abierta}>{abierta ? 'ocultar' : 'ver la ayuda'}</button>}
      </div>
      {abierta && <p className="mt-1 ml-4 border-l-2 border-orange/50 pl-3 text-muted">{d.intervencion}</p>}
    </li>
  )
}
