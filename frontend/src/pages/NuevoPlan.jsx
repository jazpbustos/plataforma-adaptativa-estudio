import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import { IconCheck, IconChevron, IconFile, IconUpload } from '../components/Icons.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { LEVELS, MATERIA, MODULES, addDays, fullDate, hoursLabel, kb, longDate, parseDay, shortDate, toISO } from '../lib/format.js'
import { ACCEPT, MAX_MB } from './Material.jsx'

/*
  Configuración del objetivo, en el orden del flujo definido para la plataforma:
  1. Configurar objetivo (tema, tiempo disponible y nivel inicial) → 2. Subir material → 3. Revisar la ruta generada.
*/
const TOPICS = ['Recursividad', 'Listas enlazadas', 'Pilas y colas', 'Árboles binarios', 'Ordenamiento y búsqueda']
const STEPS = [
  { key: 'objetivo', kicker: 'Antes de empezar', title: '¿Qué querés preparar?', sub: 'Contanos el tema, cuándo necesitás llegar y cuánto sabés. Con eso organizamos una ruta posible para vos.', foot: 'El objetivo ordena la ruta · no te encierra' },
  { key: 'material', kicker: 'Tu punto de partida', title: 'Traé lo que ya tenés.', sub: 'Es opcional. Si subís apuntes, se combinan con fuentes académicas indexadas; si no, se trabaja solo con esas fuentes.', foot: 'Material híbrido · tus apuntes + fuentes indexadas' },
  { key: 'ruta', kicker: 'Tu ruta', title: 'Así queda tu recorrido.', sub: 'Revisá que esté todo bien antes de crear tu plan.', foot: 'Primero comprender, después practicar, al final explicar' },
]

// Días disponibles hasta el examen. La ruta cubre siempre los tres módulos:
// con menos de tres días, varias sesiones caen en el mismo día.
const DAYS = [1, 3, 5, 7, 10, 14, 21, 30]
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
const endFromDays = (n) => toISO(addDays(new Date(), n - 1))

export default function NuevoPlan() {
  const [step, setStep] = useState(0)
  const [showError, setShowError] = useState(false)
  const [form, setForm] = useState({
    subject: MATERIA, topic: '', days: 7, start_date: toISO(new Date()), end_date: endFromDays(7),
    weekdays: ALL_WEEKDAYS, minutes_per_session: 45, level: null, files: [],
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const sessions = Math.max(3, form.days)
  const headingRef = useRef(null)
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  const errorObjetivo = form.topic.trim().length < 2 ? 'Indicá el tema.'
    : !form.days ? 'Indicá cuántos días tenés.'
    : form.level === null ? 'Elegí cuánto sabés del tema.' : ''

  const next = () => { if (step === 0 && errorObjetivo) { setShowError(true); return } setShowError(false); setStep(step + 1) }
  const s = STEPS[step]

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader right={<span className="font-mono text-xs text-muted">Paso {step + 1} de {STEPS.length}</span>} />
      <main className="mx-auto grid w-full max-w-[1120px] flex-1 content-start gap-8 px-4 pt-8 pb-10 sm:px-10 md:pt-14">
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((x, i) => <i key={x.key} className={`size-1.5 rounded-full transition ${i <= step ? 'bg-violet' : 'bg-rule'}`} />)}
        </div>
        <header key={s.key} className="rise grid justify-items-center gap-3 text-center">
          <span className="label">{s.kicker}</span>
          <h1 ref={headingRef} tabIndex={-1} className="display text-[clamp(2rem,4vw,2.8rem)] outline-none">{s.title}</h1>
          <p className="max-w-[52ch] text-balance text-muted">{s.sub}</p>
        </header>

        <div key={`b-${s.key}`} className="rise">
          {s.key === 'objetivo' && <StepObjetivo form={form} set={set} sessions={sessions} error={showError && errorObjetivo} onNext={next} />}
          {s.key === 'material' && <StepMaterial form={form} set={set} onBack={() => setStep(0)} onNext={next} />}
          {s.key === 'ruta' && <StepRuta form={form} goTo={setStep} />}
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-[1120px] justify-between gap-4 px-4 pb-6 sm:px-10">
        <span className="label !text-[.64rem]">{s.foot}</span>
        <Link to="/app" className="font-mono text-xs text-muted hover:text-fg">salir</Link>
      </footer>
    </div>
  )
}

/* ---------------- Paso 1: objetivo ---------------- */


function StepObjetivo({ form, set, sessions, error, onNext }) {
  const [open, setOpen] = useState('tema')
  const llegada = form.days === 1 ? 'hoy' : `el ${longDate(parseDay(form.end_date)).replace(',', '')}`
  const minutos = [[20, '20 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30']]

  // Al elegir un valor se cierra el bloque y se abre el siguiente: la ruta del formulario queda sola.
  const paso = (id, next) => (patch) => { set(patch); setOpen(next) }

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-5">
      <div className="card divide-y divide-rule overflow-hidden p-0">
        <Fila id="tema" label="Tema" value={form.topic} open={open} setOpen={setOpen}>
          <input id="topic" className="field" value={form.topic} maxLength={120} placeholder="Ej: Listas enlazadas"
            onChange={(e) => set({ topic: e.target.value })} />
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => (
              <button key={t} type="button" className="chip no-check" aria-pressed={form.topic === t}
                onClick={() => paso('tema', 'dias')({ topic: t })}>{t}</button>
            ))}
          </div>
        </Fila>

        <Fila id="dias" label="Días para estudiarlo" value={form.days === 1 ? '1 día' : `${form.days} días`} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Días disponibles" className="flex flex-wrap gap-1.5">
            {DAYS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.days === n} className="chip min-w-[3.4rem] justify-center"
                onClick={() => paso('dias', 'tiempo')({ days: n, end_date: endFromDays(n) })}>{n === 1 ? '1 día' : `${n} días`}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Llegás {llegada}.</p>
        </Fila>

        <Fila id="tiempo" label={form.days === 1 ? 'Tiempo por sesión' : 'Tiempo por día'}
          value={minutos.find(([v]) => v === form.minutes_per_session)[1]} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Duración" className="flex flex-wrap gap-1.5">
            {minutos.map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={form.minutes_per_session === v} className="chip"
                onClick={() => paso('tiempo', 'nivel')({ minutes_per_session: v })}>{t}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Es un promedio: define cuánto contenido entra en cada sesión. Lo cambiás cuando quieras.</p>
        </Fila>

        <Fila id="nivel" label="Cuánto sabés del tema" value={form.level === null ? '' : LEVELS[form.level][0]} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Nivel inicial" className="grid gap-1.5">
            {LEVELS.map(([t, d], i) => (
              <button key={t} type="button" role="radio" aria-checked={form.level === i} onClick={() => paso('nivel', '')({ level: i })}
                className={`grid cursor-pointer gap-0.5 rounded-xl border px-4 py-3 text-left transition ${form.level === i
                  ? 'border-violet/60 bg-[color-mix(in_srgb,var(--violet)_12%,transparent)]' : 'border-line hover:border-violet/40'}`}>
                <span className="text-sm font-medium">{t}</span>
                <span className="text-xs text-muted">{d}</span>
              </button>
            ))}
          </div>
        </Fila>
      </div>

      {error && <p role="alert" className="text-center text-sm text-red">{error}</p>}
      <div className="grid justify-items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={onNext}>Continuar <span className="arrow">→</span></button>
        <span className="text-xs text-muted" aria-live="polite">
          <span className="text-fg">{sessions} sesiones</span> · {hoursLabel(sessions * form.minutes_per_session)} · llegás {llegada}
        </span>
      </div>
    </div>
  )
}

// Bloque desplegable: en el encabezado se ve siempre qué quedó elegido.
function Fila({ id, label, value, open, setOpen, children }) {
  const abierto = open === id
  return (
    <div>
      <button type="button" aria-expanded={abierto} aria-controls={`p-${id}`} onClick={() => setOpen(abierto ? '' : id)}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
        <span className="flex-1 text-sm">{label}</span>
        <span className={`truncate text-sm ${value ? 'text-muted' : 'accent'}`}>{value || 'Elegir'}</span>
        <IconChevron className={`size-4 flex-none text-muted transition ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <div id={`p-${id}`} className={`grid transition-all duration-300 ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="grid gap-3 px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Paso 2: material ---------------- */

function StepMaterial({ form, set, onBack, onNext }) {
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef(null)

  const add = (list) => {
    const ok = [], bad = []
    for (const f of list) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPT.includes(ext)) bad.push(`${f.name}: formato no admitido`)
      else if (f.size > MAX_MB * 1024 * 1024) bad.push(`${f.name}: supera ${MAX_MB} MB`)
      else if (!form.files.some((x) => x.name === f.name && x.size === f.size)) ok.push(f)
    }
    setMsg(bad.join(' · '))
    if (ok.length) set({ files: [...form.files, ...ok] })
  }

  return (
    <div className="mx-auto grid w-full max-w-[600px] gap-5">
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
        className={`card grid justify-items-center gap-2 !border-dashed px-6 py-14 text-center transition ${drag ? '!border-violet bg-[color-mix(in_srgb,var(--violet)_8%,var(--bg-card))]' : '!border-rule'}`}>
        <IconUpload className="mb-2 size-7 text-violet" />
        <p className="text-[1.15rem] font-medium tracking-[-.02em]">Arrastrá tus archivos acá</p>
        <p className="text-sm text-muted">o <button type="button" className="cursor-pointer font-medium accent hover:underline" onClick={() => input.current.click()}>elegilos desde tu dispositivo</button></p>
        <p className="text-xs text-muted">{ACCEPT.join(', ').toUpperCase().replaceAll('.', '')} · hasta {MAX_MB} MB por archivo</p>
        <input ref={input} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      {msg && <p className="text-sm text-orange">{msg}</p>}
      {form.files.length > 0 && (
        <ul className="grid gap-2">
          {form.files.map((f) => (
            <li key={f.name + f.size} className="card flex items-center gap-3 px-4 py-3">
              <IconFile className="size-4 flex-none text-violet" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm">{f.name}</span><span className="text-xs text-muted">{kb(f.size)}</span></span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ files: form.files.filter((x) => x !== f) })}>quitar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← Atrás</button>
        <div className="flex flex-wrap items-center gap-4">
          {!form.files.length && <button type="button" className="cursor-pointer text-sm text-muted hover:text-fg" onClick={onNext}>Seguir solo con fuentes indexadas</button>}
          <button type="button" className="btn btn-primary" disabled={!form.files.length} onClick={onNext}>Continuar <span className="arrow">→</span></button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Paso 3: revisar y crear ---------------- */

function StepRuta({ form, goTo }) {
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState(-1) // -1 = sin enviar

  const payload = useMemo(() => {
    const { files, days, ...rest } = form // eslint-disable-line no-unused-vars
    return rest // `days` es solo de la interfaz: se traduce a start_date/end_date
  }, [form])
  useEffect(() => { api('/plans/preview', { method: 'POST', body: payload }).then(setPreview).catch((e) => setError(e.message)) }, [payload])

  const phases = ['Guardar objetivo', 'Subir material', 'Armar la ruta', 'Listo']

  const create = async () => {
    setError(''); setPhase(0)
    try {
      const plan = await api('/plans', { method: 'POST', body: payload })
      setPhase(1)
      const failed = []
      for (const f of form.files) {
        const fd = new FormData(); fd.append('file', f)
        await api(`/plans/${plan.id}/materials`, { method: 'POST', form: fd }).catch(() => failed.push(f.name))
      }
      setPhase(2); await new Promise((r) => setTimeout(r, 700))
      setPhase(3); await new Promise((r) => setTimeout(r, 500))
      navigate('/app', { state: { created: true, failedUploads: failed } })
    } catch (e) { setError(e.message); setPhase(-1) }
  }

  if (error && !preview) return <p role="alert" className="text-red">{error}</p>
  if (!preview) return <Synapse>Calculando tu ruta</Synapse>

  if (phase >= 0) {
    const pct = Math.round(((phase + .5) / phases.length) * 100)
    return (
      <section className="card grid gap-6 p-6" aria-live="polite">
        <div className="flex items-baseline justify-between"><h2 className="text-[1.3rem] font-medium tracking-[-.02em]">Preparando tu ruta</h2>
          <span className="font-mono text-xs accent">{Math.min(phase + 1, phases.length)} de {phases.length}</span></div>
        <ol className="grid grid-cols-4 gap-2 text-xs">
          {phases.map((p, i) => (
            <li key={p} className={`grid justify-items-start gap-1 ${i < phase ? 'accent' : i === phase ? 'text-fg' : 'text-muted'}`}>
              {i < phase ? <IconCheck className="size-3.5" /> : <i className={`mt-1 mb-0.5 size-2 rounded-full ${i === phase ? 'bg-violet shadow-[0_0_0_4px_color-mix(in_srgb,var(--violet)_25%,transparent)]' : 'border border-rule'}`} />}
              {p}
            </li>
          ))}
        </ol>
        <div className="h-1 overflow-hidden rounded-full bg-elev"><i className="block h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </section>
    )
  }

  const weeks = []
  for (const x of preview.sessions) {
    const d = parseDay(x.day), monday = toISO(addDays(d, -((d.getDay() + 6) % 7)))
    if (weeks.at(-1)?.monday !== monday) weeks.push({ monday, sessions: [] })
    weeks.at(-1).sessions.push(x)
  }
  const rows = [
    ['Tema', form.topic, 0],
    ['Fecha objetivo', fullDate(parseDay(form.end_date)), 0],
    ['Disponibilidad', `${form.days === 1 ? '1 día' : `${form.days} días`} · ${form.minutes_per_session} min por ${form.days === 1 ? 'sesión' : 'día'}`, 0],
    ['Nivel inicial', LEVELS[form.level][0], 0],
    ['Material', form.files.length ? form.files.map((f) => f.name).join(', ') : 'Solo fuentes indexadas', 1],
  ]

  return (
    <div className="mx-auto grid w-full max-w-[680px] gap-5">
      <section className="card grid gap-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[2.4rem] leading-none font-medium tracking-[-.04em] tabular-nums">{preview.total_sessions}<span className="ml-2 text-base font-normal tracking-normal text-muted">sesiones</span></p>
          <span className="font-mono text-xs text-muted">{hoursLabel(preview.total_minutes)} en total</span>
        </div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {Object.entries(MODULES).map(([k, m]) => <i key={k} style={{ background: m.color, flex: preview.by_module[k] }} />)}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(MODULES).map(([k, m]) => <span key={k} className="pill" style={{ '--c': m.color }}>{m.n} {m.label} · {preview.by_module[k]}</span>)}
        </div>
        <ol className="grid gap-2 border-t border-line/70 pt-4">
          {weeks.map((w, i) => (
            <li key={w.monday} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
              <span className="font-mono text-xs text-muted">sem {i + 1} · {shortDate(parseDay(w.monday))}</span>
              <span className="flex flex-wrap gap-1.5">
                {w.sessions.map((x) => <i key={x.position} title={`${shortDate(parseDay(x.day))} · ${MODULES[x.module].label}`} className="size-3 rounded-full" style={{ background: MODULES[x.module].color }} />)}
              </span>
            </li>
          ))}
        </ol>
        {preview.warning && <p className="text-sm text-orange">{preview.warning}</p>}
      </section>

      <dl className="card divide-y divide-line/70">
        {rows.map(([k, v, st]) => (
          <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-3 text-sm">
            <dt className="text-muted">{k}</dt><dd className="min-w-0 truncate">{v}</dd>
            <button type="button" className="cursor-pointer text-xs text-muted hover:text-fg" onClick={() => goTo(st)}>Editar</button>
          </div>
        ))}
      </dl>

      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button type="button" className="btn btn-ghost" onClick={() => goTo(1)}>← Atrás</button>
        <button type="button" className="btn btn-primary" onClick={create}>Crear mi ruta <span className="arrow">→</span></button>
      </div>
    </div>
  )
}
