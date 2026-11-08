import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Cerebrito } from '../components/Asistente.jsx'
import { Bloqueado, Pantalla, SinPlan } from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { MODULES } from '../lib/format.js'

/*
  Módulo Consolidar (HU-008), según la Pantalla 4: una charla con Brity.

  Para cada concepto clave, Brity plantea una situación concreta y el estudiante responde con sus palabras; si la
  respuesta no muestra el concepto, Brity repregunta sin decir cuál falta (CA6). Recorridos los conceptos, el
  estudiante explica el tema en un párrafo, que se evalúa (CA2 a CA5): el resultado informa cuántos conceptos
  están, sin señalar cuál falta. El campo no admite pegar texto (CA7). Con una explicación correcta se habilita
  el botón para finalizar el tema.
*/
const m = MODULES.consolidar
const RESULTADO = {
  correcta: ['Explicación correcta', 'var(--green)'],
  incompleta: ['Explicación incompleta', 'var(--orange)'],
  incorrecta: ['Explicación incorrecta', 'var(--red)'],
  'no concluyente': ['Evaluación no concluyente', 'var(--text-secondary)'],
}
const SIN_PEGAR = 'Tiene que estar escrita con tus propias palabras: no se puede pegar texto.'

export default function Consolidar() {
  const { plan, reload } = useOutletContext()
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')

  const id = plan?.id
  const cargar = useCallback(() => {
    if (!id) return
    setError('')
    api(`/plans/${id}/consolidar`).then(setEstado).catch((e) => setError(e.message))
  }, [id])
  useEffect(() => { setEstado(null); cargar() }, [cargar])

  if (!plan) return <SinPlan m={m} />
  if (error && !estado) return <p role="alert" className="text-red">{error}</p>
  if (!estado) return <Synapse>Preparando Consolidar</Synapse>
  if (estado.modulo.estado === 'bloqueado') return <Bloqueado m={m} tema={estado.tema} falta={estado.modulo.falta} anterior={MODULES.practicar} />
  return <Charla key={plan.id} plan={plan} estado={estado} onCambio={reload} />
}

const Burbuja = ({ yo, children }) => (
  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[.92rem] leading-relaxed whitespace-pre-line ${yo ? 'justify-self-end bg-[color-mix(in_srgb,var(--pink)_10%,var(--bg-card))]' : 'border border-line bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))]'}`}>
    {children}
  </div>
)

function Mensaje({ msg }) {
  if (msg.de === 'yo') return <Burbuja yo>{msg.texto}</Burbuja>
  const res = msg.tipo === 'resultado' && RESULTADO[msg.resultado]
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 w-8 flex-none [&_.as-neurona]:!w-8" aria-hidden="true"><Cerebrito estado={msg.tipo === 'bien' || msg.resultado === 'correcta' ? 'festeja' : 'espera'} /></span>
      <Burbuja>
        {res && (
          <span className="mb-2 flex flex-wrap items-center gap-2">
            <span className="pill" style={{ '--c': res[1] }}>{res[0]}</span>
            {msg.presentes != null && <span className="text-[.8rem] text-muted">{msg.presentes} de {msg.total} conceptos clave</span>}
          </span>
        )}
        {msg.texto}
      </Burbuja>
    </div>
  )
}

function Charla({ plan, estado, onCambio }) {
  const navigate = useNavigate()
  const [charla, setCharla] = useState(estado.charla)
  const [aprobado, setAprobado] = useState(estado.aprobado)
  const [texto, setTexto] = useState('')
  const [pendiente, setPendiente] = useState(null) // mensaje enviado mientras Brity responde
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const caja = useRef(null)
  const disponible = estado.generacion_disponible

  const fase = charla?.fase
  const parrafo = fase === 'párrafo'
  const primeraExplicacion = parrafo && !charla.mensajes.some((x) => x.tipo === 'resultado')
  const largo = texto.trim().length
  const minimo = primeraExplicacion ? estado.largo_minimo : 2
  const maximo = parrafo ? estado.largo_maximo : estado.largo_maximo_respuesta

  useEffect(() => {
    const c = caja.current
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
  }, [charla?.mensajes.length, pendiente, busy])

  const empezar = async () => {
    setBusy('Brity está preparando las preguntas'); setError('')
    try { setCharla(await api(`/plans/${plan.id}/consolidar/charla`, { method: 'POST' })); setTexto('') }
    catch (e) { setError(e.message) } finally { setBusy('') }
  }

  const enviar = async (e) => {
    e?.preventDefault()
    const t = texto.trim()
    if (busy || t.length < minimo) return
    setPendiente(t); setTexto(''); setError('')
    setBusy(parrafo ? 'Evaluando tu explicación' : 'Brity está leyendo tu respuesta')
    try {
      const r = await api(`/plans/${plan.id}/consolidar/respuesta`, { method: 'POST', body: { texto: t } })
      setCharla(r.charla); setAprobado(r.aprobado)
      if (r.resultado) onCambio() // la explicación final actualiza el dominio y el plan
    } catch (err) { setError(err.message); setTexto(t) } finally { setPendiente(null); setBusy('') }
  }

  const bloquear = (e) => { e.preventDefault(); setAviso(SIN_PEGAR) }
  const alTeclear = (e) => { if (e.key === 'Enter' && !e.shiftKey && !parrafo) enviar(e) }

  const progreso = !charla ? '' : fase === 'charla' ? `Situación ${charla.actual + 1} de ${charla.total}`
    : parrafo ? 'Explicación final' : 'Charla terminada'

  return (
    <Pantalla color={m.color} title="Módulo" accent={m.label} accentColor={m.color} sub={`${estado.tema} · Charlá con Brity y explicá el tema con tus palabras.`}>
      <section className="card relative flex min-h-[460px] min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        {!disponible && <p className="bg-[color-mix(in_srgb,var(--orange)_8%,transparent)] px-6 py-2.5 text-sm text-orange">La charla no está disponible en este momento. Probá de nuevo en unos minutos.</p>}

        {charla && (
          <div className="flex flex-none items-center gap-3 border-b border-line px-5 py-2.5">
            <span className="text-[.8rem] font-medium">{progreso}</span>
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: charla.total }, (_, i) => (
                <i key={i} className="h-1 w-6 rounded-full" style={{ background: i < charla.actual || fase !== 'charla' ? 'var(--pink)' : 'var(--rule)' }} />
              ))}
              <i className="ml-1 h-1 w-6 rounded-full" style={{ background: fase === 'terminada' ? 'var(--pink)' : 'var(--rule)' }} />
            </span>
          </div>
        )}

        <div ref={caja} className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-5 pt-4 pb-3 [scrollbar-width:thin]">
          {!charla ? (
            <div className="grid max-w-2xl gap-4">
              <Mensaje msg={{ de: 'brity', texto: `Vamos a repasar ${estado.tema} charlando: te planteo algunas situaciones concretas y vos me contás, con tus palabras, cómo las resolverías. Si algo falta, te hago otra pregunta para que lo pienses. Al final, me explicás el tema en un párrafo y lo evalúo.` }} />
              {!busy && <button type="button" className="btn btn-primary btn-sm ml-10 justify-self-start" disabled={!disponible} onClick={empezar}>Empezar la charla</button>}
            </div>
          ) : charla.mensajes.map((msg, i) => <Mensaje key={i} msg={msg} />)}
          {pendiente && <Burbuja yo>{pendiente}</Burbuja>}
          {busy && <div className="ml-10"><Synapse>{busy}</Synapse></div>}
          {error && <p role="alert" className="text-sm text-red">{error}</p>}
        </div>

        {charla && fase !== 'terminada' && (
          <form className="flex-none border-t border-line px-5 py-2.5" onSubmit={enviar}>
            <div className={`flex items-end gap-1 border border-line bg-card py-1 pr-1 pl-3 focus-within:border-[var(--pink)] ${parrafo ? 'rounded-2xl' : 'rounded-full'}`}>
              <textarea value={texto} rows={parrafo ? 5 : 1} maxLength={maximo} aria-label={parrafo ? 'Tu explicación' : 'Tu respuesta'}
                placeholder={primeraExplicacion ? 'Explicá el tema en un párrafo, con tus palabras…' : parrafo ? 'Respondé con tus palabras: se suma a tu explicación.' : 'Respondé con tus palabras… (Enter para enviar)'}
                onChange={(e) => { setAviso(''); setTexto(e.target.value) }} onPaste={bloquear} onDrop={bloquear} onKeyDown={alTeclear}
                className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none" />
              <button type="submit" aria-label="Enviar" title="Enviar" disabled={!!busy || !disponible || largo < minimo}
                className="mb-0.5 grid size-7 flex-none cursor-pointer place-items-center rounded-full bg-fg text-bg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
              </button>
            </div>
            {aviso && <p role="alert" className="mt-1 text-xs text-orange">{aviso}</p>}
          </form>
        )}

        <div className="flex flex-none flex-wrap items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))] px-6 py-3">
          <p className="text-xs text-muted tabular-nums">
            {primeraExplicacion ? (largo < minimo ? `Mínimo ${minimo} caracteres · llevás ${largo}` : `${largo} caracteres`)
              : aprobado ? 'Consolidar aprobado: ya podés finalizar el tema.' : 'Para finalizar el tema, tu explicación final tiene que resultar correcta.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {charla && <button type="button" className="btn btn-soft btn-sm" disabled={!!busy || !disponible} onClick={empezar}>Empezar de nuevo</button>}
            <button type="button" className="btn btn-sm border-transparent text-white hover:brightness-110 disabled:opacity-40" style={{ background: 'var(--pink)' }}
              disabled={!aprobado} onClick={() => navigate('/app/progreso')}>Finalizar tema →</button>
          </div>
        </div>
      </section>
    </Pantalla>
  )
}
