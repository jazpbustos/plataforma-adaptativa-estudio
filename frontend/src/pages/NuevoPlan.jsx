import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { MODULES, WEEKDAYS, hoursLabel, parseDay, shortDate, toISO } from '../lib/format.js'

const SUBJECTS = [
  'Algoritmos y Estructuras de Datos I', 'Algoritmos y Estructuras de Datos II',
  'Taller de Algoritmos y Estructuras de Datos I', 'Taller de Algoritmos y Estructuras de Datos II',
]
const TOPICS = ['Recursividad', 'Listas enlazadas', 'Pilas y colas', 'Árboles binarios', 'Ordenamiento y búsqueda']
const LEVELS = [
  ['Nunca lo vi', 'Arrancamos desde cero, con más sesiones de Aprender.'],
  ['Lo vi, pero no lo entiendo', 'Repasamos la teoría antes de pasar al código.'],
  ['Lo entiendo, pero me cuesta aplicarlo', 'Menos teoría y más ejercicios en el editor.'],
  ['Puedo resolver ejercicios', 'Vamos directo a practicar y a explicarlo con tus palabras.'],
]
const FORMATS = [
  ['variar', 'Ir variando', 'Alternamos formatos según cómo te vaya.'],
  ['resumen', 'Resumen', 'Lo esencial del tema, sacado de tu apunte.'],
  ['preguntas', 'Preguntas guiadas', 'Llegás a las ideas respondiendo paso a paso.'],
  ['ejercicio', 'Ejercicio práctico', 'Aprendés resolviendo un caso concreto.'],
]
const ACCEPT = ['.pdf', '.md', '.txt', '.docx', '.py']
const MAX_MB = 10

const STEPS = [
  { key: 'tema', title: 'Tema', heading: '¿Qué vas a estudiar?', intro: 'Por ahora la plataforma trabaja con temas de programación en Python.' },
  { key: 'material', title: 'Material', heading: 'Subí tu apunte', intro: 'Lo cruzamos con fuentes confiables y te avisamos si algo está incompleto o es incorrecto. Es opcional: podés subirlo después.' },
  { key: 'nivel', title: 'Nivel inicial', heading: '¿Cuánto sabés del tema?', intro: 'Con esto decidimos cuántas sesiones van a cada módulo. Después se ajusta según tu avance real.' },
  { key: 'tiempo', title: 'Disponibilidad', heading: '¿Cuándo podés estudiar?', intro: 'Armamos la ruta con los días que marques. Si te atrasás o avanzás más rápido, se recalcula.' },
  { key: 'prefs', title: 'Preferencias', heading: '¿Cómo te gusta aprender?', intro: 'Lo podés cambiar en cualquier sesión.' },
  { key: 'revision', title: 'Revisión', heading: 'Tu ruta', intro: 'Revisá que esté todo bien antes de crear el plan.' },
]

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function countSessions(start, end, weekdays) {
  if (!start || !end || end <= start) return 0
  let n = 0
  for (let d = parseDay(start); d <= parseDay(end); d = addDays(d, 1)) if (weekdays.includes((d.getDay() + 6) % 7)) n++
  return n
}

export default function NuevoPlan() {
  const today = new Date()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    subject: '', topic: '', goal: 'examen', files: [], level: null,
    start_date: toISO(today), end_date: toISO(addDays(today, 28)), weekdays: [0, 2, 4],
    minutes_per_session: 45, preferred_time: 'tarde', learn_format: 'variar', hint_level: 'minimas',
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const sessions = countSessions(form.start_date, form.end_date, form.weekdays)

  const errors = {
    tema: form.subject.trim().length < 2 ? 'Indicá la materia.' : form.topic.trim().length < 2 ? 'Indicá el tema.' : '',
    material: '',
    nivel: form.level === null ? 'Elegí la opción que más se parezca a tu situación.' : '',
    tiempo: !form.weekdays.length ? 'Marcá al menos un día.'
      : form.end_date <= form.start_date ? 'La fecha límite tiene que ser posterior al inicio.'
      : sessions < 3 ? `Con esos días quedan ${sessions} sesión(es): se necesitan al menos 3.` : '',
    prefs: '',
    revision: '',
  }
  const [showError, setShowError] = useState(false)
  const current = STEPS[step]
  const headingRef = useRef(null)

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  const go = (i) => {
    // solo se puede saltar hacia adelante si los pasos anteriores están completos
    const blocked = STEPS.slice(0, i).findIndex((s) => errors[s.key])
    if (i > step && blocked !== -1 && blocked < i) { setStep(blocked); setShowError(true); return }
    setShowError(false); setStep(i)
  }
  const nextStep = () => { if (errors[current.key]) { setShowError(true); return } go(step + 1) }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto grid max-w-[1120px] gap-8 px-4 pt-8 pb-20 sm:px-[4vw] md:grid-cols-[220px_minmax(0,1fr)] md:gap-12 md:pt-12 xl:px-6">
        {/* Índice de pasos */}
        <aside className="md:sticky md:top-24 md:self-start">
          <Link to="/" className="font-mono text-xs text-muted hover:text-fg">← volver al inicio</Link>
          <span className="label mt-6 mb-3 block">Nuevo plan</span>
          <ol className="hidden border-l border-line md:block">
            {STEPS.map((s, i) => {
              const done = i < step && !errors[s.key]
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}
                    className={`-ml-px flex w-full cursor-pointer items-center gap-3 border-l-2 py-2 pl-4 text-left text-sm transition ${
                      i === step ? 'border-violet text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
                    <span className={`font-mono text-xs ${done ? 'text-green' : ''}`}>{done ? '✓' : String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="flex gap-1.5 md:hidden" aria-hidden="true">
            {STEPS.map((s, i) => <i key={s.key} className={`h-[3px] rounded transition-all ${i <= step ? 'w-10 bg-violet' : 'w-5 bg-line'}`} />)}
          </div>
        </aside>

        <section className="grid content-start gap-8">
          <header key={current.key} className="rise grid gap-2">
            <span className="label">Paso {step + 1} de {STEPS.length} · {current.title}</span>
            <h1 ref={headingRef} tabIndex={-1} className="text-[clamp(1.8rem,3.6vw,2.6rem)] font-light tracking-[-.035em] outline-none">{current.heading}</h1>
            <p className="max-w-[56ch] text-muted">{current.intro}</p>
          </header>

          <div key={`b-${current.key}`} className="rise">
            {current.key === 'tema' && <StepTema form={form} set={set} />}
            {current.key === 'material' && <StepMaterial form={form} set={set} />}
            {current.key === 'nivel' && <StepNivel form={form} set={set} />}
            {current.key === 'tiempo' && <StepTiempo form={form} set={set} sessions={sessions} />}
            {current.key === 'prefs' && <StepPrefs form={form} set={set} />}
            {current.key === 'revision' && <StepRevision form={form} goTo={go} />}
          </div>

          {showError && errors[current.key] && <p role="alert" className="text-sm text-red">{errors[current.key]}</p>}

          {current.key !== 'revision' && (
            <footer className="flex items-center justify-between gap-4 border-t border-line pt-6">
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)} disabled={step === 0}>← Atrás</button>
              <button type="button" className="btn btn-primary" onClick={nextStep}>
                {step === STEPS.length - 2 ? 'Ver mi ruta' : 'Siguiente'} <span className="arrow">→</span>
              </button>
            </footer>
          )}
        </section>
      </main>
    </div>
  )
}

/* ---------------- pasos ---------------- */

function Field({ label, hint, children, id }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Options({ value, onChange, items, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="border-t border-line">
      {items.map(([v, title, desc, extra]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="option" onClick={() => onChange(v)}>
          <span className="radio" />
          <span className="grid gap-0.5">
            <span className="flex flex-wrap items-center gap-3 font-medium">{title}{extra}</span>
            {desc && <span className="text-sm text-muted">{desc}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

function StepTema({ form, set }) {
  return (
    <div className="grid max-w-xl gap-7">
      <Field label="Materia" id="subject">
        <input id="subject" className="field" list="subjects" value={form.subject} maxLength={120}
          placeholder="Ej: Algoritmos y Estructuras de Datos I" onChange={(e) => set({ subject: e.target.value })} />
        <datalist id="subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Tema" id="topic">
        <input id="topic" className="field" value={form.topic} maxLength={120} placeholder="Ej: Recursividad"
          onChange={(e) => set({ topic: e.target.value })} />
        <div className="flex flex-wrap gap-2 pt-1">
          {TOPICS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={form.topic === t} onClick={() => set({ topic: t })}>{t}</button>
          ))}
        </div>
      </Field>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Lenguaje</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip" aria-pressed="true">Python</span>
          <span className="font-mono text-xs text-muted">más lenguajes próximamente</span>
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Objetivo</span>
        <Options name="Objetivo" value={form.goal} onChange={(goal) => set({ goal })} items={[
          ['examen', 'Tengo un examen o parcial', 'La ruta termina antes de la fecha del examen.'],
          ['aprender', 'Quiero aprenderlo bien', 'Sin fecha exacta: vos marcás hasta cuándo.'],
        ]} />
      </div>
    </div>
  )
}

function StepMaterial({ form, set }) {
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
    <div className="grid max-w-xl gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
        className={`grid justify-items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition ${
          drag ? 'border-violet bg-[color-mix(in_srgb,var(--violet)_8%,transparent)]' : 'border-rule'}`}
      >
        <svg viewBox="0 0 24 24" className="size-7 text-violet" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M12 17v-6M9.5 13.5L12 11l2.5 2.5" />
        </svg>
        <p className="text-sm">Arrastrá tus archivos acá o{' '}
          <button type="button" className="cursor-pointer border-b border-rule font-medium hover:border-fg" onClick={() => input.current.click()}>elegilos</button>
        </p>
        <p className="font-mono text-xs text-muted">{ACCEPT.join(' ')} · hasta {MAX_MB} MB</p>
        <input ref={input} type="file" multiple accept={ACCEPT.join(',')} className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      {msg && <p className="text-sm text-orange">{msg}</p>}
      {form.files.length > 0 && (
        <ul className="border-t border-line">
          {form.files.map((f) => (
            <li key={f.name + f.size} className="flex items-center justify-between gap-4 border-b border-line py-3">
              <span className="min-w-0"><span className="block truncate font-mono text-sm">{f.name}</span>
                <span className="text-xs text-muted">{(f.size / 1024).toFixed(0)} KB</span></span>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => set({ files: form.files.filter((x) => x !== f) })}>quitar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LevelDots({ n }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <i key={i} className={`size-1.5 rounded-full ${i <= n ? 'bg-violet' : 'bg-line'}`} />)}
    </span>
  )
}

function StepNivel({ form, set }) {
  return (
    <div className="max-w-xl">
      <Options name="Nivel inicial" value={form.level} onChange={(level) => set({ level })}
        items={LEVELS.map(([t, d], i) => [i, t, d, <LevelDots key="d" n={i} />])} />
    </div>
  )
}

function Segmented({ value, onChange, items, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {items.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={value === v} className="chip" onClick={() => onChange(v)}>{t}</button>)}
    </div>
  )
}

function StepTiempo({ form, set, sessions }) {
  const toggleDay = (i) => set({ weekdays: form.weekdays.includes(i) ? form.weekdays.filter((d) => d !== i) : [...form.weekdays, i].sort() })
  const weeks = form.end_date > form.start_date ? Math.ceil((parseDay(form.end_date) - parseDay(form.start_date)) / 864e5 / 7) : 0
  return (
    <div className="grid max-w-xl gap-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Empiezo el" id="start">
          <input id="start" type="date" className="field font-mono" value={form.start_date} min={toISO(new Date())}
            onChange={(e) => set({ start_date: e.target.value })} />
        </Field>
        <Field label={form.goal === 'examen' ? 'Fecha del examen' : 'Quiero terminar el'} id="end">
          <input id="end" type="date" className="field font-mono" value={form.end_date} min={form.start_date}
            onChange={(e) => set({ end_date: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Días de estudio</span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => <button key={d} type="button" className="chip min-w-[3.25rem] justify-center" aria-pressed={form.weekdays.includes(i)} onClick={() => toggleDay(i)}>{d}</button>)}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Duración de cada sesión</span>
        <Segmented label="Duración" value={form.minutes_per_session} onChange={(v) => set({ minutes_per_session: v })}
          items={[[25, '25 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30']]} />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Horario preferido</span>
        <Segmented label="Horario" value={form.preferred_time} onChange={(v) => set({ preferred_time: v })}
          items={[['manana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche']]} />
        <p className="text-xs text-muted">Lo usamos para los recordatorios.</p>
      </div>
      <p className="border-t border-line pt-5 font-mono text-sm" aria-live="polite">
        <span className={sessions >= 3 ? 'text-violet-strong' : 'text-orange'}>{sessions} sesiones</span>
        <span className="text-muted"> · {hoursLabel(sessions * form.minutes_per_session)} en {weeks} semana{weeks === 1 ? '' : 's'}</span>
      </p>
    </div>
  )
}

function StepPrefs({ form, set }) {
  return (
    <div className="grid max-w-xl gap-8">
      <div className="grid gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>Formato en Aprender</span>
        <Options name="Formato" value={form.learn_format} onChange={(v) => set({ learn_format: v })} items={FORMATS} />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--green)' }}>Pistas en Practicar</span>
        <Options name="Pistas" value={form.hint_level} onChange={(v) => set({ hint_level: v })} items={[
          ['minimas', 'Mínimas', 'Una pregunta que te orienta, sin darte la respuesta.'],
          ['normales', 'Más guiadas', 'Si seguís trabado, la pista se vuelve más concreta.'],
        ]} />
      </div>
    </div>
  )
}

function StepRevision({ form, goTo }) {
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState(-1) // -1 = sin enviar

  const payload = useMemo(() => {
    const { files, ...rest } = form // eslint-disable-line no-unused-vars
    return rest
  }, [form])

  useEffect(() => { api('/plans/preview', { method: 'POST', body: payload }).then(setPreview).catch((e) => setError(e.message)) }, [payload])

  const phases = ['guardando el plan', ...(form.files.length ? [`subiendo ${form.files.length} archivo${form.files.length > 1 ? 's' : ''}`] : []), 'armando la ruta']

  const create = async () => {
    setError(''); setPhase(0)
    try {
      const plan = await api('/plans', { method: 'POST', body: payload })
      const failed = []
      if (form.files.length) {
        setPhase(1)
        for (const f of form.files) {
          const fd = new FormData(); fd.append('file', f)
          await api(`/plans/${plan.id}/materials`, { method: 'POST', form: fd }).catch(() => failed.push(f.name))
        }
      }
      setPhase(phases.length - 1)
      await new Promise((r) => setTimeout(r, 600))
      navigate('/', { state: { created: true, failedUploads: failed } })
    } catch (e) { setError(e.message); setPhase(-1) }
  }

  if (error && !preview) return <p role="alert" className="text-red">{error}</p>
  if (!preview) return <Synapse>Calculando tu ruta</Synapse>

  // agrupar sesiones por semana (lunes)
  const weeks = []
  for (const s of preview.sessions) {
    const d = parseDay(s.day), monday = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)))
    if (weeks.at(-1)?.monday !== monday) weeks.push({ monday, sessions: [] })
    weeks.at(-1).sessions.push(s)
  }

  const rows = [
    ['Tema', `${form.topic} · ${form.subject}`, 0],
    ['Objetivo', form.goal === 'examen' ? `Examen el ${shortDate(parseDay(form.end_date))}` : `Hasta el ${shortDate(parseDay(form.end_date))}`, 0],
    ['Material', form.files.length ? form.files.map((f) => f.name).join(', ') : 'Sin apunte por ahora', 1],
    ['Nivel', LEVELS[form.level][0], 2],
    ['Días', `${form.weekdays.map((d) => WEEKDAYS[d]).join(', ')} · ${form.minutes_per_session} min`, 3],
    ['Aprender', FORMATS.find((f) => f[0] === form.learn_format)[1], 4],
  ]

  return (
    <div className="grid gap-10">
      {/* resumen de la ruta */}
      <div className="card-current grid gap-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[2.6rem] leading-none font-light tracking-[-.04em] tabular-nums">{preview.total_sessions}<span className="ml-2 text-base tracking-normal text-muted">sesiones</span></p>
          <span className="font-mono text-sm text-muted">{hoursLabel(preview.total_minutes)} en total</span>
        </div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded" aria-hidden="true">
          {Object.entries(MODULES).map(([k, m]) => <i key={k} style={{ background: m.color, flex: preview.by_module[k] }} />)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {Object.entries(MODULES).map(([k, m]) => (
            <span key={k} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: m.color }} />{m.label}<span className="font-mono text-muted">{preview.by_module[k]}</span></span>
          ))}
        </div>
        <ol className="grid gap-2 border-t border-line pt-4">
          {weeks.map((w, i) => (
            <li key={w.monday} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
              <span className="font-mono text-xs text-muted">sem {i + 1} · {shortDate(parseDay(w.monday)).split(' ').slice(1).join(' ')}</span>
              <span className="flex flex-wrap gap-1.5">
                {w.sessions.map((s) => (
                  <i key={s.position} title={`${shortDate(parseDay(s.day))} · ${MODULES[s.module].label}`}
                    className="size-3 rounded-full" style={{ background: MODULES[s.module].color }} />
                ))}
              </span>
            </li>
          ))}
        </ol>
        {preview.warning && <p className="text-sm text-orange">{preview.warning}</p>}
      </div>

      <dl className="border-t border-line">
        {rows.map(([k, v, s]) => (
          <div key={k} className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-line py-3 text-sm">
            <dt className="text-muted">{k}</dt><dd className="min-w-0 truncate">{v}</dd>
            <button type="button" className="cursor-pointer font-mono text-xs text-muted hover:text-fg" onClick={() => goTo(s)}>editar</button>
          </div>
        ))}
      </dl>

      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <button type="button" className="btn btn-ghost" onClick={() => goTo(4)} disabled={phase >= 0}>← Atrás</button>
        {phase < 0 ? (
          <button type="button" className="btn btn-primary" onClick={create}>Crear plan y empezar <span className="arrow">→</span></button>
        ) : (
          <ul className="grid gap-1 font-mono text-xs" aria-live="polite">
            {phases.map((p, i) => (
              <li key={p} className={i < phase ? 'text-muted' : i === phase ? 'text-violet-strong' : 'text-muted opacity-50'}>
                {i < phase ? '✓ ' : i === phase ? '› ' : '  '}{p}
              </li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  )
}
