import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { IconFile, IconUpload } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { fullDate, kb, parseDay, shortDate } from '../lib/format.js'

export const ACCEPT = ['.pdf', '.docx', '.txt', '.md', '.py']
export const MAX_MB = 10

export default function Material() {
  const { data, reload } = useOutletContext()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef(null)
  const plan = data?.plans?.[0]

  const load = () => api('/materials').then(setItems).catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])

  const upload = async (files) => {
    if (!plan) return
    setBusy(true); setMsg('')
    const errors = []
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPT.includes(ext)) { errors.push(`${f.name}: formato no admitido`); continue }
      if (f.size > MAX_MB * 1024 * 1024) { errors.push(`${f.name}: supera ${MAX_MB} MB`); continue }
      const fd = new FormData(); fd.append('file', f)
      await api(`/plans/${plan.id}/materials`, { method: 'POST', form: fd }).catch((e) => errors.push(`${f.name}: ${e.message}`))
    }
    setMsg(errors.join(' · ')); setBusy(false); load(); reload()
  }

  return (
    <div className="grid gap-8">
      <PageHeader kicker={`Mi material${plan ? ` / ${plan.topic}` : ''}`} title="Todo parte" accent="de acá."
        sub="Tu ruta combina estos apuntes con fuentes académicas indexadas. Si no cargás ninguno, se usan solo esas fuentes."
        action={plan && (
          <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => input.current.click()}>
            <IconUpload className="size-4" /> Añadir archivo
          </button>
        )} />
      <input ref={input} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />

      {busy && <Synapse>Subiendo material</Synapse>}
      {msg && <p role="alert" className="text-sm text-orange">{msg}</p>}

      {!items ? <Synapse>Cargando</Synapse> : items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((f) => (
            <li key={f.id} className="card grid gap-3 p-5">
              <div className="flex items-center justify-between">
                <IconFile className="size-5 text-violet" />
                <span className="pill" style={{ '--c': 'var(--text-secondary)' }} title="El pipeline de procesamiento (RAG) se incorpora en un próximo sprint">Pendiente de procesar</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[1.05rem] font-medium tracking-[-.01em]">{f.filename}</p>
                <p className="text-xs text-muted">{kb(f.size_bytes)} · Añadido el {shortDate(new Date(f.uploaded_at))}</p>
              </div>
              <p className="text-sm text-muted">{f.topic}</p>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" disabled={!plan} onClick={() => input.current.click()}
          className="grid cursor-pointer justify-items-center gap-2 rounded-2xl border border-dashed border-rule px-6 py-12 text-center transition hover:border-violet disabled:cursor-default">
          <IconUpload className="size-6 text-violet" />
          <span className="font-medium">{plan ? 'Sin apuntes: tu ruta usa fuentes indexadas' : 'Primero configurá tu objetivo'}</span>
          <span className="text-xs text-muted">{ACCEPT.join(' ').toUpperCase().replaceAll('.', '')} · hasta {MAX_MB} MB por archivo</span>
        </button>
      )}

      {plan ? (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="grid gap-1">
            <span className="label">Tu ruta está lista</span>
            <p className="text-sm">{plan.sessions_total} sesiones · {plan.topic} · objetivo: {fullDate(parseDay(plan.end_date))}</p>
          </div>
          <Link to="/app" className="btn btn-primary btn-sm">Ver mi ruta <span className="arrow">→</span></Link>
        </section>
      ) : (
        <div><Link to="/empezar" className="btn btn-primary">Configurar objetivo <span className="arrow">→</span></Link></div>
      )}
    </div>
  )
}
