import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { IconFile, IconUpload } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import TopicSwitch from '../components/TopicSwitch.jsx'
import { api } from '../lib/api.js'
import { fullDate, kb, parseDay, shortDate } from '../lib/format.js'

// Carga del material (HU-003 y Seguridad): el backend vuelve a validar todo, también el contenido real del archivo.
export const ACCEPT = ['.pdf', '.docx', '.pptx']
export const MAX_MB = 25
export const MAX_FILES = 20 // por tema

// Estado del procesamiento (RAG): el archivo se indexa en segundo plano después de subirlo.
const ESTADO = {
  pendiente: ['Procesando…', 'var(--text-secondary)', 'Extrayendo el texto e indexándolo'],
  procesado: ['Listo', 'var(--green)', 'Ya se usa en tus sesiones'],
  'sin texto': ['Sin texto', 'var(--red)', 'No encontramos texto: ¿es un documento escaneado o una presentación solo con imágenes?'],
  'con error': ['No se pudo leer', 'var(--red)', 'El archivo parece dañado. Probá exportarlo de nuevo.'],
}

export default function Material() {
  const { data, reload, plan, selectPlan } = useOutletContext()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef(null)

  const mine = items?.filter((f) => !plan || f.plan_id === plan.id) // solo el material del tema elegido
  const load = () => api('/materials').then(setItems).catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])
  // Mientras haya archivos procesándose, se vuelve a consultar cada 2 segundos.
  const processing = items?.some((f) => f.status === 'pendiente')
  useEffect(() => {
    if (!processing) return
    const t = setTimeout(load, 2000)
    return () => clearTimeout(t)
  }, [items])

  const upload = async (files) => {
    if (!plan) return
    setBusy(true); setMsg('')
    const errors = []
    let cargados = mine?.length ?? 0
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPT.includes(ext)) { errors.push(`${f.name}: formato no admitido`); continue }
      if (f.size > MAX_MB * 1024 * 1024) { errors.push(`${f.name}: supera ${MAX_MB} MB`); continue }
      if (cargados >= MAX_FILES) { errors.push(`${f.name}: ya hay ${MAX_FILES} archivos en este tema`); continue }
      const fd = new FormData(); fd.append('file', f)
      await api(`/plans/${plan.id}/materials`, { method: 'POST', form: fd }).then(() => cargados++).catch((e) => errors.push(`${f.name}: ${e.message}`))
    }
    setMsg(errors.join(' · ')); setBusy(false); load(); reload()
  }

  return (
    <div className="grid gap-8">
      <PageHeader title="Mi material" sub="Tus apuntes se combinan con fuentes académicas del tema."
        action={plan && (
          <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => input.current.click()}>
            <IconUpload className="size-4" /> Añadir archivo
          </button>
        )} />
      {data?.plans?.length > 0 && (
        <TopicSwitch plans={data.plans} current={plan} onSelect={selectPlan} />
      )}
      <input ref={input} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />

      {busy && <Synapse>Subiendo material</Synapse>}
      {msg && <p role="alert" className="text-sm text-orange">{msg}</p>}

      {!mine ? <Synapse>Cargando</Synapse> : mine.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {mine.map((f) => {
            const [label, color, hint] = ESTADO[f.status] ?? ESTADO.pendiente
            return <li key={f.id} className="card grid gap-3 p-5">
              <div className="flex items-center justify-between">
                <IconFile className="size-5 text-violet" />
                <span className="pill" style={{ '--c': color }} title={hint}>{label}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[1.05rem] font-medium tracking-[-.01em]">{f.filename}</p>
                <p className="text-xs text-muted">{kb(f.size_bytes)} · Añadido el {shortDate(new Date(f.uploaded_at))}</p>
              </div>
            </li>
          })}
        </ul>
      ) : (
        <button type="button" disabled={!plan} onClick={() => input.current.click()}
          className="grid cursor-pointer justify-items-center gap-2 rounded-2xl border border-dashed border-rule px-6 py-12 text-center transition hover:border-violet disabled:cursor-default">
          <IconUpload className="size-6 text-violet" />
          <span className="font-medium">{plan ? `Subí apuntes de ${plan.topic}` : 'Primero armá tu plan'}</span>
          <span className="text-xs text-muted">Opcional · {ACCEPT.join(' ').toUpperCase().replaceAll('.', '')} · hasta {MAX_MB} MB por archivo y {MAX_FILES} por tema</span>
        </button>
      )}

      {plan ? (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="grid gap-1">
            <span className="label">Tu plan de {plan.topic}</span>
            <p className="text-sm">{plan.sessions_total} sesiones · hasta el {fullDate(parseDay(plan.end_date))}</p>
          </div>
          <Link to="/app" className="btn btn-primary btn-sm">Ver mi plan <span className="arrow">→</span></Link>
        </section>
      ) : (
        <div><Link to="/empezar" className="btn btn-primary">Configurar objetivo <span className="arrow">→</span></Link></div>
      )}
    </div>
  )
}
