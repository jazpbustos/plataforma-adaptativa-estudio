import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/AppHeader.jsx'
import PaperTopbar from '../components/PaperTopbar.jsx'
import { Floaty, Kicker, GradeDoodle, CalendarDoodle, FlagDoodle, FootDoodle } from '../components/Doodles.jsx'
import usePaperTheme from '../lib/usePaperTheme.js'
import { IconCheck, IconChevron, IconFile, IconUpload } from '../components/Icons.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { LANGUAGES, LEVELS, MATERIA, MODULES, TOPICS, addDays, fullDate, kb, longDate, parseDay, requiredMastery, shortDate, toISO } from '../lib/format.js'
import { ACCEPT, MAX_MB } from './Material.jsx'

/*
  Configuración del objetivo de estudio (HU-002) y carga del material (HU-003), en tres pasos:
  1. Objetivo: tema, días disponibles, nivel inicial y nota objetivo → 2. Material (opcional) y lenguaje → 3. Revisar el plan.
*/

// Garabatos a los costados de cada paso (solo en pantallas anchas), como en el ingreso.
const DOODLES = {
  objetivo: [{ D: GradeDoodle, label: 'tu nota', rot: -5 }, { D: CalendarDoodle, label: 'tu fecha', rot: 6 }],
  material: [], // este paso es más ancho: los garabatos tapaban el contenido
  plan: [{ D: FootDoodle, label: 'paso a paso', rot: -4 }, { D: FlagDoodle, label: 'tu meta', rot: 6 }],
}
const STEPS = [
  { key: 'objetivo', kicker: 'antes de empezar', title: '¿Qué vas a estudiar?', sub: 'Elegí el tema, cuántos días tenés y a qué nota apuntás. Con eso armamos tu plan de estudio día por día.' },
  { key: 'material', kicker: 'tu material', title: 'Sumá tu material de estudio.', sub: 'Es opcional. Lo combinamos con fuentes académicas del tema para que todo lo que estudies salga de lo que pide tu cátedra.' },
  { key: 'plan', kicker: 'tu plan', title: 'Así queda tu plan de estudio.', sub: 'Revisalo antes de confirmarlo. A medida que avances, se va a ajustar a tu nivel de dominio.' },
]

const DAYS = [1, 3, 5, 7, 10, 14, 21, 30]
const GRADES = [6, 7, 8, 9, 10]
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
const endFromDays = (n) => toISO(addDays(new Date(), n - 1))

// "el tema y la nota objetivo" a partir de la lista de campos que faltan (HU-002, CA3).
const listar = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0]

export default function NuevoPlan() {
  const [step, setStep] = useState(0)
  const [showError, setShowError] = useState(false)
  const [form, setForm] = useState({
    subject: MATERIA, topic: '', days: 7, start_date: toISO(new Date()), end_date: endFromDays(7),
    weekdays: ALL_WEEKDAYS, level: null, target_grade: null, language: null, files: [],
  })
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const headingRef = useRef(null)
  usePaperTheme() // mismo papel claro que la portada y el ingreso
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [step])

  const faltan = [
    !form.topic && 'el tema',
    form.level === null && 'tu nivel inicial',
    form.target_grade === null && 'la nota objetivo',
  ].filter(Boolean)
  const errors = [
    faltan.length ? `Falta completar ${listar(faltan)}.` : '',
    form.language === null ? 'Elegí el lenguaje en el que vas a practicar.' : '',
  ]

  const next = () => { if (errors[step]) { setShowError(true); return } setShowError(false); setStep(step + 1) }
  const s = STEPS[step]

  return (
    <div className="notebook min-h-dvh overflow-x-clip">
      <div className="nb-page nb-lined relative flex min-h-dvh flex-col">
        <PaperTopbar logoTo="/app" right={<><span className="text-sm text-muted">Paso {step + 1} de {STEPS.length}</span><Avatar /></>} />

        <main className="relative z-[2] mx-auto grid w-full max-w-[1120px] flex-1 content-start gap-8 px-4 pt-10 pb-10 sm:px-10 md:pt-14">
          {DOODLES[s.key].map(({ D, label, rot }, i) => (
            <Floaty key={`${s.key}-${label}`} rot={rot} delay={i * .9} label={label}
              style={i === 0 ? { left: '2%', top: '30%' } : { right: '2%', top: '52%' }}><D /></Floaty>
          ))}
          <div className="flex justify-center gap-1.5" aria-hidden="true">
            {STEPS.map((x, i) => <i key={x.key} className={`size-1.5 rounded-full transition ${i <= step ? 'bg-violet' : 'bg-rule'}`} />)}
          </div>
          <header key={s.key} className="rise grid justify-items-center gap-4 text-center">
            <Kicker>{s.kicker}</Kicker>
            <h1 ref={headingRef} tabIndex={-1} className="display text-[clamp(2rem,4vw,2.8rem)] outline-none">{s.title}</h1>
            <p className="max-w-[54ch] text-balance text-muted">{s.sub}</p>
          </header>

          <div key={`b-${s.key}`} className="rise">
            {s.key === 'objetivo' && <StepObjetivo form={form} set={set} error={showError && errors[0]} onNext={next} />}
            {s.key === 'material' && <StepMaterial form={form} set={set} error={showError && errors[1]} onBack={() => setStep(0)} onNext={next} />}
            {s.key === 'plan' && <StepPlan form={form} goTo={setStep} />}
          </div>
        </main>
        <footer className="relative z-[2] mx-auto flex w-full max-w-[1120px] justify-end px-4 pb-6 sm:px-10">
          <Link to="/app" className="text-sm text-muted hover:text-fg">Salir</Link>
        </footer>
      </div>
    </div>
  )
}

/* ---------------- Paso 1: objetivo ---------------- */

function StepObjetivo({ form, set, error, onNext }) {
  const [open, setOpen] = useState('tema')
  const llegada = form.days === 1 ? 'hoy' : `el ${longDate(parseDay(form.end_date)).replace(',', '')}`
  const sessions = Math.max(3, form.days)

  // Al elegir un valor se cierra el bloque y se abre el siguiente: el formulario se recorre solo.
  const paso = (next) => (patch) => { set(patch); setOpen(next) }

  return (
    <div className="mx-auto grid w-full max-w-[580px] gap-5">
      <div className="card divide-y divide-rule overflow-hidden p-0">
        <Fila id="tema" label="Tema" value={form.topic} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Tema" className="grid gap-1.5 sm:grid-cols-2">
            {TOPICS.map((t) => (
              <Opcion key={t.value} checked={form.topic === t.value} title={t.value} desc={t.desc}
                onClick={() => paso('dias')({ topic: t.value })} />
            ))}
          </div>
        </Fila>

        <Fila id="dias" label="Días disponibles" value={form.days === 1 ? '1 día' : `${form.days} días`} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Días disponibles" className="flex flex-wrap gap-1.5">
            {DAYS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.days === n} className="chip min-w-[3.4rem] justify-center"
                onClick={() => paso('nivel')({ days: n, end_date: endFromDays(n) })}>{n === 1 ? '1 día' : `${n} días`}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Terminás {llegada}.</p>
        </Fila>

        <Fila id="nivel" label="Nivel inicial" value={form.level ? LEVELS[form.level].label : ''} open={open} setOpen={setOpen}>
          <div role="radiogroup" aria-label="Nivel inicial" className="grid gap-1.5">
            {Object.entries(LEVELS).map(([k, l]) => (
              <Opcion key={k} checked={form.level === k} title={l.label} desc={l.desc} onClick={() => paso('nota')({ level: k })} />
            ))}
          </div>
        </Fila>

        <Fila id="nota" label="Nota objetivo" open={open} setOpen={setOpen}
          value={form.target_grade ? `${form.target_grade} · ${requiredMastery(form.target_grade)} % de dominio` : ''}>
          <NotaDial value={form.target_grade} onChange={(g) => set({ target_grade: g })} />
        </Fila>
      </div>

      {error && <p role="alert" className="text-center text-sm text-red">{error}</p>}
      <div className="grid justify-items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={onNext}>Continuar <span className="arrow">→</span></button>
        <span className="text-xs text-muted" aria-live="polite">
          <span className="text-fg">{sessions} sesiones</span> · terminás {llegada}
          {form.target_grade && <> · dominio requerido <span className="text-fg">{requiredMastery(form.target_grade)} %</span></>}
        </span>
      </div>
    </div>
  )
}

// Opción con título y aclaración (tema, nivel). Se comporta como un radio.
function Opcion({ checked, title, desc, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onClick}
      className={`grid cursor-pointer gap-0.5 rounded-xl border px-4 py-3 text-left transition ${checked
        ? 'border-violet/60 bg-[color-mix(in_srgb,var(--violet)_12%,transparent)]' : 'border-line hover:border-violet/40'}`}>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted">{desc}</span>
    </button>
  )
}

/*
  Nota objetivo (6 a 10). El anillo muestra el dominio requerido que define esa nota
  (HU-002, CA2): 60 % para 6 o 7, 80 % para 8 o 9 y 90 % para 10.
*/
function NotaDial({ value, onChange }) {
  const R = 52, C = 2 * Math.PI * R
  const mastery = value ? requiredMastery(value) : 0
  return (
    <div className="grid justify-items-center gap-4 pt-1">
      <div className="relative size-40" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--rule)" strokeWidth="9" opacity=".55" />
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--violet)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - mastery / 100)}
            style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.3,.7,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 grid place-content-center justify-items-center">
          <span className="text-[2.6rem] leading-none font-medium tracking-[-.04em] tabular-nums">{mastery ? `${mastery}` : '–'}<span className="text-lg text-muted">{mastery ? ' %' : ''}</span></span>
          <span className="mt-1 text-xs text-muted">dominio requerido</span>
        </div>
      </div>
      <div role="radiogroup" aria-label="Nota objetivo" className="flex gap-1.5">
        {GRADES.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={value === g} className="chip no-check size-11 justify-center !p-0 text-base"
            aria-label={`Nota ${g}: ${requiredMastery(g)} % de dominio requerido`} onClick={() => onChange(g)}>{g}</button>
        ))}
      </div>
      <p className="max-w-[40ch] text-center text-xs text-muted">
        {value ? <>Para un <span className="text-fg">{value}</span>, el tema se da por dominado al llegar al <span className="text-fg">{mastery} %</span>. Cuanto más alta la nota, más práctica tiene tu plan.</>
          : 'Elegí la nota a la que apuntás. Define cuánto dominio del tema necesitás alcanzar.'}
      </p>
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

/* ---------------- Paso 2: material y lenguaje ---------------- */

const POR_QUE = [
  ['Por qué conviene sumarlo', 'Las explicaciones, preguntas y ejercicios se arman sobre lo que da tu cátedra: los mismos temas, el mismo enfoque y el mismo lenguaje.'],
  ['Qué podés subir', 'Apuntes de clase, guías de ejercicios, resúmenes o parciales anteriores.'],
  ['¿No tenés material?', 'No pasa nada. Cada tema ya tiene fuentes académicas cargadas y trabajamos con esas.'],
]

function StepMaterial({ form, set, error, onBack, onNext }) {
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef(null)
  const hasFiles = form.files.length > 0
  const langs = Object.keys(LANGUAGES).filter((k) => k !== 'material' || hasFiles)

  const add = (list) => {
    const ok = [], bad = []
    for (const f of list) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPT.includes(ext)) bad.push(`${f.name}: formato no admitido`)
      else if (f.size > MAX_MB * 1024 * 1024) bad.push(`${f.name}: supera ${MAX_MB} MB`)
      else if (!form.files.some((x) => x.name === f.name && x.size === f.size)) ok.push(f)
    }
    setMsg(bad.join(' · '))
    // Con material, el lenguaje se toma de ahí salvo que ya se haya elegido otro (HU-002, CA4).
    if (ok.length) set({ files: [...form.files, ...ok], language: form.language ?? 'material' })
  }
  const quitar = (f) => {
    const files = form.files.filter((x) => x !== f)
    set({ files, language: !files.length && form.language === 'material' ? null : form.language })
  }

  return (
    <div className="mx-auto grid w-full max-w-[920px] items-start gap-6 wide:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid gap-5">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
          className={`card grid justify-items-center gap-2 !border-dashed px-6 py-12 text-center transition ${drag ? '!border-violet bg-[color-mix(in_srgb,var(--violet)_8%,var(--bg-card))]' : '!border-rule'}`}>
          <IconUpload className="mb-2 size-7 text-violet" />
          <p className="text-[1.15rem] font-medium tracking-[-.02em]">Soltá tus archivos acá</p>
          <p className="text-sm text-muted">o <button type="button" className="cursor-pointer font-medium accent hover:underline" onClick={() => input.current.click()}>elegilos desde tu compu</button></p>
          <p className="text-xs text-muted">{ACCEPT.join(', ').toUpperCase().replaceAll('.', '')} · hasta {MAX_MB} MB por archivo</p>
          <input ref={input} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        </div>
        {msg && <p className="text-sm text-orange">{msg}</p>}
        {hasFiles && (
          <ul className="grid gap-2">
            {form.files.map((f) => (
              <li key={f.name + f.size} className="card flex items-center gap-3 px-4 py-3">
                <IconFile className="size-4 flex-none text-violet" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{f.name}</span><span className="text-xs text-muted">{kb(f.size)}</span></span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => quitar(f)}>Quitar</button>
              </li>
            ))}
          </ul>
        )}

        <section className="card grid gap-3 px-5 py-4" aria-labelledby="lenguaje">
          <h2 id="lenguaje" className="text-sm font-medium">¿En qué lenguaje vas a practicar?</h2>
          <div role="radiogroup" aria-labelledby="lenguaje" className="flex flex-wrap gap-1.5">
            {langs.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={form.language === k} className="chip"
                onClick={() => set({ language: k })}>{LANGUAGES[k]}</button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {hasFiles ? 'Si tu material indica un lenguaje, usamos ese; si no lo indica, te lo preguntamos. ' : 'Como no subiste material, elegí uno. '}
            Los ejercicios se escriben en este lenguaje y lo podés cambiar al empezar a practicar.
          </p>
        </section>
      </div>

      <aside className="grid gap-4 px-1 wide:pt-2">
        {POR_QUE.map(([t, d]) => (
          <div key={t} className="grid gap-1">
            <h2 className="text-sm font-medium">{t}</h2>
            <p className="text-sm text-muted">{d}</p>
          </div>
        ))}
      </aside>

      <div className="grid gap-3 wide:col-span-2">
        {error && <p role="alert" className="text-center text-sm text-red">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Atrás</button>
          <button type="button" className="btn btn-primary" onClick={onNext}>{hasFiles ? 'Continuar' : 'Continuar sin material'} <span className="arrow">→</span></button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Paso 3: revisar y crear ---------------- */

function StepPlan({ form, goTo }) {
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState(-1) // -1 = sin enviar

  const payload = useMemo(() => {
    const { files, days, ...rest } = form // eslint-disable-line no-unused-vars
    return rest // `days` es solo de la interfaz: se traduce a start_date/end_date
  }, [form])
  useEffect(() => { api('/plans/preview', { method: 'POST', body: payload }).then(setPreview).catch((e) => setError(e.message)) }, [payload])

  const phases = ['Guardar objetivo', 'Subir material', 'Armar el plan', 'Listo']

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

  if (error && !preview) return <p role="alert" className="text-center text-red">{error}</p>
  if (!preview) return <Synapse>Armando tu plan</Synapse>

  if (phase >= 0) {
    const pct = Math.round(((phase + .5) / phases.length) * 100)
    return (
      <section className="card mx-auto grid w-full max-w-[680px] gap-6 p-6" aria-live="polite">
        <div className="flex items-baseline justify-between"><h2 className="text-[1.3rem] font-medium tracking-[-.02em]">Preparando tu plan</h2>
          <span className="text-xs accent">{Math.min(phase + 1, phases.length)} de {phases.length}</span></div>
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
    ['Días disponibles', `${form.days === 1 ? '1 día' : `${form.days} días`} · hasta el ${fullDate(parseDay(form.end_date))}`, 0],
    ['Nivel inicial', LEVELS[form.level].label, 0],
    ['Nota objetivo', `${form.target_grade} · ${preview.required_mastery} % de dominio requerido`, 0],
    ['Lenguaje', LANGUAGES[form.language], 1],
    ['Material', form.files.length ? form.files.map((f) => f.name).join(', ') : 'Fuentes académicas del tema', 1],
  ]

  return (
    <div className="mx-auto grid w-full max-w-[680px] gap-5">
      <section className="card grid gap-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[2.4rem] leading-none font-medium tracking-[-.04em] tabular-nums">{preview.total_sessions}<span className="ml-2 text-base font-normal tracking-normal text-muted">sesiones</span></p>
          <span className="text-sm text-muted">Meta: <span className="accent font-medium">{preview.required_mastery} % de dominio</span></span>
        </div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {Object.entries(MODULES).map(([k, m]) => <i key={k} style={{ background: m.color, flex: preview.by_module[k] }} />)}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(MODULES).map(([k, m]) => <span key={k} className="pill" style={{ '--c': m.color }}>{m.label} · {preview.by_module[k]}</span>)}
        </div>
        <ol className="grid gap-2 border-t border-line/70 pt-4">
          {weeks.map((w, i) => (
            <li key={w.monday} className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
              <span className="text-xs text-muted">Semana {i + 1} · {shortDate(parseDay(w.monday))}</span>
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
          <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-3 text-sm">
            <dt className="text-muted">{k}</dt><dd className="min-w-0 truncate">{v}</dd>
            <button type="button" className="cursor-pointer text-xs text-muted hover:text-fg" onClick={() => goTo(st)}>Editar</button>
          </div>
        ))}
      </dl>

      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button type="button" className="btn btn-ghost" onClick={() => goTo(1)}>← Atrás</button>
        <button type="button" className="btn btn-primary" onClick={create}>Crear mi plan <span className="arrow">→</span></button>
      </div>
    </div>
  )
}
