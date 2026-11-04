import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { IconCheck } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { LEVELS, MODULES } from '../lib/format.js'

/*
  Módulo Aprender (HU-003 y HU-004), según la Pantalla 2 de la Entrega 3: plan del tema con los conceptos
  recorridos, lección guiada en formato de chat con citas, tarjetas de memoria, cuestionario de práctica,
  repetición de lo fallado y evaluación de comprensión, que con el 60 % habilita Practicar.
*/
const m = MODULES.aprender
const PASOS = [['leccion', 'Lección'], ['tarjetas', 'Tarjetas de memoria'], ['cuestionario', 'Cuestionario']]
const fmt = (n) => String(n).replace('.', ',')

export default function Aprender() {
  const { plan, reload } = useOutletContext()
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [evaluando, setEvaluando] = useState(false)
  // El concepto elegido en el plan del tema guía todo: la lección, las tarjetas y el cuestionario son sobre él,
  // en secuencia (lección → tarjetas → cuestionario → próximo concepto).
  const [activo, setActivo] = useState(null)
  const [paso, setPaso] = useState('leccion')

  // Depende del id del plan y no del objeto: al recargar el panel el objeto cambia, y eso no debe borrar el chat.
  const planId = plan?.id
  const cargar = useCallback(() => {
    if (!planId) return
    api(`/plans/${planId}/aprender`).then((e) => {
      setEstado(e)
      if (e.evaluacion_pendiente) setEvaluando(true)
      setActivo((a) => a ?? (e.conceptos.find((c) => !c.recorrido) ?? e.conceptos[0])?.nombre ?? null)
    }).catch((e) => setError(e.message))
  }, [planId])
  useEffect(() => { setEstado(null); setActivo(null); cargar() }, [cargar])

  if (!plan) return <div className="grid gap-6"><PageHeader title="Módulo" accent={m.label} accentColor={m.color} /><p className="text-sm">Todavía no armaste tu plan. <Link className="underline" to="/empezar">Armalo acá</Link>.</p></div>
  if (error && !estado) return <p role="alert" className="text-red">{error}</p>
  if (!estado || !activo) return <Synapse>Preparando el plan del tema</Synapse>

  const actualizar = () => { cargar(); reload() }
  const nombres = estado.conceptos.map((c) => c.nombre)
  const actual = estado.conceptos.find((c) => c.nombre === activo) ?? estado.conceptos[0]
  const proximo = nombres[nombres.indexOf(activo) + 1]
  const irAConcepto = (c) => { setEvaluando(false); setActivo(c); setPaso('leccion') }
  const avanzar = () => {
    if (paso === 'leccion') setPaso('tarjetas')
    else if (paso === 'tarjetas') setPaso('cuestionario')
    else if (proximo) irAConcepto(proximo)
    else setEvaluando(true)
  }
  const recorridos = estado.conceptos.filter((c) => c.recorrido).length

  return (
    <div className="grid gap-6" style={{ '--c': m.color }}>
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color}
        sub={`${estado.tema} · Nivel inicial: ${LEVELS[estado.nivel]?.label.toLowerCase()} · Elegí un concepto del plan y recorrelo paso a paso.`} />

      {!estado.generacion_disponible && (
        <p className="rounded-xl border border-dashed border-orange/60 px-4 py-3 text-sm text-orange">
          La generación de contenido no está configurada en el servidor (falta la clave del modelo de lenguaje).
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="card grid min-w-0 gap-4 p-5 lg:sticky lg:top-6">
          <div>
            <h2 className="font-medium">Plan del tema</h2>
            <p className="text-xs text-muted">{recorridos} de {estado.conceptos.length} conceptos recorridos</p>
          </div>
          <ul className="grid gap-1">
            {estado.conceptos.map((c) => {
              const elegido = c.nombre === activo && !evaluando
              return (
                <li key={c.nombre}>
                  <button type="button" onClick={() => irAConcepto(c.nombre)} aria-current={elegido ? 'step' : undefined}
                    className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm ${elegido ? 'bg-[color-mix(in_srgb,var(--blue)_9%,transparent)]' : 'hover:bg-elev'}`}>
                    <span className="grid gap-1">
                      <span className={`first-letter:uppercase ${elegido ? 'font-medium text-blue' : ''}`}>{c.nombre}</span>
                      <span className="flex items-center gap-1" aria-label={`Lección, tarjetas y cuestionario: ${PASOS.filter(([k]) => c.pasos[k]).length} de 3`}>
                        {PASOS.map(([k, label]) => <i key={k} title={label} className={`h-1 w-5 rounded-full ${c.pasos[k] ? 'bg-blue' : 'bg-rule/60'}`} />)}
                        {c.recorrido && <span className="ml-1 text-[.7rem] text-blue">recorrido</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {estado.todos_recorridos && !estado.aprobado && <p className="text-xs text-blue">Recorriste todos los conceptos: ya podés rendir la evaluación.</p>}
          <button type="button" className={`btn ${estado.todos_recorridos ? 'btn-primary' : 'btn-soft'} btn-sm w-full !whitespace-normal`} disabled={!estado.generacion_disponible}
            onClick={() => setEvaluando(true)}>{estado.evaluacion_pendiente ? 'Continuar la evaluación' : 'Rendir evaluación de comprensión'}</button>
          <p className="text-center text-[.72rem] text-muted">Podés rendirla en cualquier momento, también sin recorrer los conceptos si ya conocés el tema.</p>
        </aside>

        <section className="card min-w-0 p-5">
          {evaluando
            ? <Evaluacion plan={plan} estado={estado} onSalir={() => { setEvaluando(false); actualizar() }} onConcepto={irAConcepto} onTerminar={actualizar} />
            : <>
                <div className="mb-4 grid gap-3 border-b border-line pb-4">
                  <p className="text-[.72rem] font-medium uppercase tracking-[.06em] text-blue">Concepto {nombres.indexOf(activo) + 1} de {nombres.length}</p>
                  <h2 className="text-[1.15rem] font-medium first-letter:uppercase">{activo}</h2>
                  <ol className="flex flex-wrap items-center gap-1.5" aria-label="Secuencia del concepto">
                    {PASOS.map(([k, label], n) => (
                      <li key={k} className="flex items-center gap-1.5">
                        {n > 0 && <span className="text-muted" aria-hidden="true">→</span>}
                        <button type="button" onClick={() => setPaso(k)} aria-current={paso === k ? 'step' : undefined}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[.8rem] ${paso === k ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_9%,transparent)] font-medium text-blue' : 'border-line text-muted hover:text-fg'}`}>
                          {actual.pasos[k] ? <IconCheck className="size-3 text-blue" /> : <span className="font-mono text-[.72rem]">{n + 1}</span>}{label}
                        </button>
                      </li>
                    ))}
                    {actual.repeticion > 0 && (
                      <li><button type="button" onClick={() => setPaso('repeticion')}
                        className={`ml-1 cursor-pointer rounded-full border border-dashed px-3 py-1 text-[.8rem] ${paso === 'repeticion' ? 'border-orange text-orange' : 'border-orange/50 text-orange/90'}`}>
                        Repasar lo fallado ({actual.repeticion})</button></li>
                    )}
                  </ol>
                </div>
                {paso === 'leccion' ? <Leccion key={activo} plan={plan} concepto={activo} onCambio={actualizar} onSiguiente={avanzar} />
                  : paso === 'repeticion' ? <Repeticion key={activo} plan={plan} concepto={activo} onCambio={actualizar} onSiguiente={avanzar} proximo={proximo} />
                    : <Practica key={`${activo}-${paso}`} plan={plan} modo={paso} concepto={activo} proximo={proximo} onCambio={actualizar}
                        onSiguiente={avanzar} onRepasar={() => setPaso('repeticion')} />}
              </>}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-elev px-5 py-3 text-sm">
        <span>
          {estado.ultima_evaluacion
            ? <><b className="font-medium">Última evaluación: {fmt(estado.ultima_evaluacion.puntaje)} de {estado.ultima_evaluacion.sobre} ({fmt(estado.ultima_evaluacion.porcentaje)} %)</b>
              {' · '}{estado.ultima_evaluacion.composicion}{' · '}{estado.aprobado ? 'Aprender aprobado' : `se aprueba con el ${estado.aprobacion} %`}</>
            : <>Todavía no rendiste la evaluación · se aprueba con el {estado.aprobacion} %</>}
        </span>
        <span className="pill" style={{ '--c': estado.practicar.estado === 'bloqueado' ? 'var(--text-secondary)' : 'var(--green)' }}>
          {estado.practicar.estado === 'bloqueado' ? 'Practicar bloqueado' : 'Practicar habilitado'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="pill" style={{ '--c': estado.contradicciones.length ? 'var(--orange)' : 'var(--text-secondary)' }}>
          {estado.contradicciones.length
            ? `Fuentes contrastadas: ${estado.contradicciones.length} ${estado.contradicciones.length === 1 ? 'contradicción detectada' : 'contradicciones detectadas'}`
            : 'Fuentes contrastadas: sin contradicciones detectadas'}
        </span>
        {estado.practicar.estado !== 'bloqueado'
          ? <Link to="/app/practicar" className="btn btn-primary">Continuar a Practicar <span className="arrow">→</span></Link>
          : <button type="button" className="btn btn-soft" disabled title={estado.practicar.falta}>Continuar a Practicar</button>}
      </div>
    </div>
  )
}

// ---------------- Texto con citas ----------------

// Texto con **negrita**, `código` y citas. Con la lista de citas, cada [n] se muestra como un número que, al pasar
// el mouse (o al enfocarlo con el teclado), muestra la fuente y el fragmento indexado del que salió (como NotebookLM).
// Sin la lista, las marcas se quitan.
function TextoCitado({ texto, citas }) {
  const porN = Object.fromEntries((citas ?? []).map((c) => [c.n, c]))
  const limpio = citas ? texto : texto.replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, '')
  return limpio.split(/(\[\d+(?:\s*,\s*\d+)*\]|`[^`\n]+`|\*\*[^*\n]+\*\*)/).map((p, i) => {
    if (/^\[[\d,\s]+\]$/.test(p)) {
      const ns = p.slice(1, -1).split(',').map((x) => Number(x.trim())).filter((n) => porN[n])
      return ns.map((n) => <Cita key={`${i}-${n}`} cita={porN[n]} />)
    }
    if (/^`.+`$/.test(p)) return <code key={i} className="rounded bg-black/5 px-1 font-mono text-[.85em]">{p.slice(1, -1)}</code>
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i} className="font-semibold">{p.slice(2, -2)}</b>
    return p
  })
}

function Cita({ cita, conEtiqueta = false }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const abrir = () => {
    const r = ref.current.getBoundingClientRect()
    const ancho = Math.min(360, window.innerWidth - 24)
    setPos({ left: Math.max(12, Math.min(r.left - 20, window.innerWidth - ancho - 12)), ancho,
      ...(r.bottom + 230 > window.innerHeight ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) })
  }
  return (
    <>
      <button ref={ref} type="button" onMouseEnter={abrir} onMouseLeave={() => setPos(null)} onFocus={abrir} onBlur={() => setPos(null)}
        aria-label={`Fuente ${cita.n}: ${cita.etiqueta}`}
        className={conEtiqueta ? 'cita-chip' : 'cita-num'}>
        {conEtiqueta ? <><b>{cita.n}</b> {cita.fuente === 'propia' ? 'Tu material' : 'Fuente académica'} · {cita.etiqueta}</> : cita.n}
      </button>
      {pos && (
        <span role="tooltip" className="cita-vista" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.ancho }}>
          <span className="block text-[.72rem] font-medium text-blue">{cita.fuente === 'propia' ? 'Tu material' : 'Fuente académica'}</span>
          <span className="block text-[.82rem] font-medium">{cita.etiqueta}</span>
          {cita.texto && <span className="mt-1.5 block text-[.8rem] leading-relaxed text-muted">“{cita.texto}”</span>}
        </span>
      )}
    </>
  )
}

// Explicación por secciones: títulos "### ", listas, bloques de código ``` y párrafos con citas.
function Explicacion({ texto, citas }) {
  const bloques = []
  const partes = texto.split(/```[a-zA-Z]*\n?([\s\S]*?)```/)
  partes.forEach((parte, i) => {
    if (i % 2 === 1) { bloques.push({ tipo: 'codigo', texto: parte.replace(/\n$/, '') }); return }
    let lista = null
    for (const linea of parte.split('\n')) {
      const l = linea.trim()
      const item = l.match(/^(?:[-*]|\d+[.)])\s+(.*)/)
      if (item) {
        const ordenada = /^\d/.test(l)
        if (!lista || lista.ordenada !== ordenada) { lista = { tipo: 'lista', ordenada, items: [] }; bloques.push(lista) }
        lista.items.push(item[1]); continue
      }
      lista = null
      if (!l) continue
      if (l.startsWith('#')) bloques.push({ tipo: l.startsWith('####') ? 'subtitulo' : 'titulo', texto: l.replace(/^#+\s*/, '').replace(/\*\*/g, '') })
      else if (bloques.at(-1)?.tipo === 'parrafo') bloques.at(-1).texto += ` ${l}`
      else bloques.push({ tipo: 'parrafo', texto: l })
    }
  })
  return (
    <div className="grid gap-2">
      {bloques.map((b, i) => b.tipo === 'codigo' ? <Codigo key={i} codigo={b.texto} />
        : b.tipo === 'titulo' ? <h3 key={i} className="mt-3 border-b border-line pb-1 text-[.98rem] font-semibold text-blue first:mt-0">{b.texto}</h3>
          : b.tipo === 'subtitulo' ? <h4 key={i} className="mt-1.5 text-[.9rem] font-semibold">{b.texto}</h4>
          : b.tipo === 'lista' ? (b.ordenada
            ? <ol key={i} className="ml-5 grid list-decimal gap-1">{b.items.map((t, k) => <li key={k}><TextoCitado texto={t} citas={citas} /></li>)}</ol>
            : <ul key={i} className="ml-5 grid list-disc gap-1">{b.items.map((t, k) => <li key={k}><TextoCitado texto={t} citas={citas} /></li>)}</ul>)
            : <p key={i}><TextoCitado texto={b.texto} citas={citas} /></p>)}
    </div>
  )
}

function Citas({ citas, noRespaldada }) {
  if (noRespaldada) return <p className="mt-2"><span className="pill" style={{ '--c': 'var(--orange)' }}>No respaldado por las fuentes del tema · conocimiento general del modelo</span></p>
  if (!citas?.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      <span className="text-[.72rem] font-medium text-muted">Fuentes:</span>
      {citas.map((c) => <Cita key={c.n} cita={c} conEtiqueta />)}
    </div>
  )
}

// HU-003, CA4: el aviso cita los dos fragmentos con su fuente y su página o sección.
function Contradiccion({ c }) {
  return (
    <div className="mt-3 rounded-xl border border-orange/50 bg-[color-mix(in_srgb,var(--orange)_6%,transparent)] p-3 text-[.85rem]">
      <p className="font-medium text-orange">Contradicción entre fuentes</p>
      {c.detalle && <p className="mt-1">{c.detalle}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[['Tu material', c.propio], ['Fuente académica', c.academico]].map(([t, f]) => (
          <blockquote key={t} className="rounded-lg bg-card p-2.5 text-[.8rem]">
            <p className="mb-1 text-[.72rem] font-medium text-muted">{t} · {f.etiqueta}</p>
            <p className="line-clamp-4">“{f.texto}”</p>
          </blockquote>
        ))}
      </div>
      <p className="mt-2 text-[.78rem] text-muted">El contenido se presenta según la fuente académica.</p>
    </div>
  )
}

const Burbuja = ({ quien, children }) => (
  <div className={`max-w-[94%] rounded-2xl px-4 py-3 text-[.92rem] leading-relaxed ${quien === 'yo' ? 'justify-self-end bg-[color-mix(in_srgb,var(--blue)_10%,var(--bg-card))]' : 'border border-line bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))]'}`}>
    {children}
  </div>
)

// ---------------- Lección guiada (CA2) ----------------

// Lección de un concepto: su explicación con citas, la pregunta de comprobación y las consultas libres sobre él.
function Leccion({ plan, concepto, onCambio, onSiguiente }) {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState('')
  const [consulta, setConsulta] = useState('')
  const caja = useRef(null)

  // Al llegar un mensaje, el chat se ubica en su comienzo (no al final): las explicaciones largas se leen desde arriba.
  useEffect(() => {
    const c = caja.current
    const ultimo = c ? [...c.querySelectorAll('[data-msg]')].at(-1) : null
    if (c && ultimo && mensajes.length > 1) c.scrollTo({ top: ultimo.offsetTop - c.offsetTop - 8, behavior: 'smooth' })
  }, [mensajes.length])

  const agregar = (msg) => setMensajes((ms) => [...ms, { id: crypto.randomUUID?.() ?? Math.random(), ...msg }])

  const explicar = useCallback(async (general = false) => {
    setCargando(`Preparando la explicación de “${concepto}”…`)
    try {
      const r = await api(`/plans/${plan.id}/aprender/leccion`, { method: 'POST', body: { concepto, general } })
      agregar(r.insuficiente ? { tipo: 'insuficiente', concepto } : { tipo: 'explicacion', concepto, ...r })
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) } finally { setCargando('') }
  }, [plan.id, concepto])

  // Una sola vez al abrir el concepto (en desarrollo React ejecuta los efectos dos veces).
  const pedida = useRef(false)
  useEffect(() => { if (!pedida.current) { pedida.current = true; explicar() } }, [explicar])

  const responder = async (msg, i) => {
    setMensajes((ms) => ms.map((x) => (x.id === msg.id ? { ...x, elegida: i } : x)))
    try {
      const r = await api(`/plans/${plan.id}/aprender/leccion/comprobacion`, { method: 'POST', body: { concepto, respuesta: i } })
      setMensajes((ms) => ms.map((x) => (x.id === msg.id ? { ...x, resultado: r } : x)))
      onCambio()
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) }
  }

  const preguntar = async (texto, general = false) => {
    if (!general) { agregar({ tipo: 'yo', texto }); setConsulta('') }
    setCargando('Buscando en el material…')
    try {
      const r = await api(`/plans/${plan.id}/aprender/consulta`, { method: 'POST', body: { consulta: texto, general, concepto } })
      agregar(r.insuficiente ? { tipo: 'insuficiente', consulta: texto } : { tipo: 'respuesta', ...r })
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) } finally { setCargando('') }
  }

  return (
    <div className="grid gap-3">
      <div ref={caja} className="relative grid max-h-[70vh] min-h-[320px] content-start gap-3 overflow-y-auto pr-1">
        {mensajes.map((msg) => <div key={msg.id} data-msg className="grid gap-3"><Mensaje msg={msg} onExplicar={explicar} onResponder={responder}
          onGeneral={(t) => preguntar(t, true)} onSiguiente={onSiguiente} /></div>)}
        {cargando && <Burbuja quien="tutor"><Synapse>{cargando}</Synapse></Burbuja>}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (consulta.trim().length > 1 && !cargando) preguntar(consulta.trim()) }}>
        <input value={consulta} onChange={(e) => setConsulta(e.target.value)} maxLength={600} aria-label="Consulta sobre el concepto"
          placeholder={`Preguntá lo que no te quedó claro sobre “${concepto}”…`} className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-sm outline-none focus:border-blue" />
        <button type="submit" className="btn btn-soft btn-sm" disabled={!!cargando || consulta.trim().length < 2}>Enviar</button>
      </form>
    </div>
  )
}

function Mensaje({ msg, onExplicar, onResponder, onGeneral, onSiguiente }) {
  if (msg.tipo === 'yo') return <Burbuja quien="yo">{msg.texto}</Burbuja>
  if (msg.tipo === 'error') return <Burbuja quien="tutor"><span className="text-red">{msg.texto}</span></Burbuja>
  if (msg.tipo === 'insuficiente') {
    return (
      <Burbuja quien="tutor">
        No encontré suficiente material sobre {msg.concepto ? `“${msg.concepto}”` : 'tu consulta'} en las fuentes del tema.
        <div className="mt-2.5"><button type="button" className="btn btn-soft btn-sm"
          onClick={() => (msg.concepto ? onExplicar(true) : onGeneral(msg.consulta))}>
          Responder igual con conocimiento general</button></div>
        <p className="mt-1.5 text-[.72rem] text-muted">Esa respuesta va a quedar marcada como no respaldada por las fuentes del tema.</p>
      </Burbuja>
    )
  }
  if (msg.tipo === 'respuesta') return <Burbuja quien="tutor"><TextoCitado texto={msg.respuesta} citas={msg.citas} /><Citas citas={msg.citas} noRespaldada={msg.no_respaldada} /></Burbuja>
  const p = msg.pregunta
  return (
    <>
      <Burbuja quien="tutor">
        <Explicacion texto={msg.explicacion} citas={msg.citas} />
        <Citas citas={msg.citas} noRespaldada={msg.no_respaldada} />
        {msg.contradiccion && <Contradiccion c={msg.contradiccion} />}
      </Burbuja>
      <Burbuja quien="tutor">
        <b className="font-medium">Comprobemos:</b> <TextoCitado texto={p.enunciado} />
        {p.codigo && <div className="mt-2"><Codigo codigo={p.codigo} /></div>}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {p.opciones.map((o, i) => {
            const r = msg.resultado
            const tono = r ? (i === r.indice_correcto ? 'border-green bg-[color-mix(in_srgb,var(--green)_10%,transparent)]' : i === msg.elegida ? 'border-red' : 'opacity-60') : ''
            return <button key={i} type="button" disabled={msg.elegida !== undefined} onClick={() => onResponder(msg, i)}
              className={`cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-left text-sm hover:border-blue disabled:cursor-default ${tono}`}>
              {String.fromCharCode(65 + i)}) <TextoCitado texto={o} /></button>
          })}
        </div>
        {msg.resultado && (
          <div className="mt-2.5 text-sm">
            <p className={msg.resultado.correcta ? 'text-green' : 'text-red'}>{msg.resultado.correcta ? 'Correcto.' : 'Incorrecto.'} <span className="text-fg"><TextoCitado texto={msg.resultado.porque ?? ''} /></span></p>
            <p className="mt-2.5 text-muted">Si te quedó alguna duda, preguntame abajo. Cuando quieras, seguimos con las tarjetas de memoria.</p>
            <div className="mt-2"><button type="button" className="btn btn-primary btn-sm" onClick={onSiguiente}>Siguiente: Tarjetas de memoria →</button></div>
          </div>
        )}
      </Burbuja>
    </>
  )
}

// ---------------- Tarjetas y cuestionario (CA3) ----------------

// Tarjetas o cuestionario del concepto elegido: se generan al entrar al paso y, al terminar, llevan al siguiente.
function Practica({ plan, modo, concepto, proximo, onCambio, onSiguiente, onRepasar }) {
  const [items, setItems] = useState(null)
  const [i, setI] = useState(0)
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const tarjetas = modo === 'tarjetas'

  const generar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const r = await api(`/plans/${plan.id}/aprender/practica`, { method: 'POST', body: { modo, conceptos: [concepto] } })
      setItems(r.items); setI(0); setResultados([])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [plan.id, modo, concepto])
  const pedida = useRef(false)
  useEffect(() => { if (!pedida.current) { pedida.current = true; generar() } }, [generar])

  const registrar = async (item, correcta) => {
    const todos = [...resultados, { item, correcta }]
    setResultados(todos)
    if (todos.length === items.length) {
      try { await api(`/plans/${plan.id}/aprender/practica/resultado`, { method: 'POST', body: { modo, resultados: todos } }); onCambio() }
      catch (e) { setError(e.message) }
    }
  }

  if (!items) {
    return (
      <div className="grid justify-items-start gap-3">
        {cargando ? <Synapse>{tarjetas ? 'Armando las tarjetas…' : 'Armando el cuestionario…'}</Synapse>
          : <button type="button" className="btn btn-primary btn-sm" onClick={generar}>Volver a intentar</button>}
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
      </div>
    )
  }
  if (resultados.length === items.length) {
    const bien = resultados.filter((r) => r.correcta).length
    const falladas = items.length - bien
    const siguiente = tarjetas ? 'Siguiente: Cuestionario →' : proximo ? `Siguiente concepto: “${proximo}” →` : 'Rendir la evaluación →'
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm"><b className="font-medium">{bien} de {items.length}</b> {tarjetas ? 'las sabías' : 'correctas'}.
          {falladas > 0 && ` ${falladas === 1 ? 'La que fallaste quedó' : 'Las que fallaste quedaron'} para repasar.`}</p>
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {falladas > 0 && <button type="button" className="btn btn-soft btn-sm" onClick={onRepasar}>Repasar {falladas === 1 ? 'la que fallaste' : `las ${falladas} que fallaste`}</button>}
          <button type="button" className="btn btn-primary btn-sm !whitespace-normal text-left" onClick={onSiguiente}>{siguiente}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={generar} disabled={cargando}>{cargando ? 'Generando…' : 'Otra ronda'}</button>
        </div>
      </div>
    )
  }
  const item = items[i]
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{tarjetas ? 'Leé la pregunta, pensá la respuesta y dala vuelta.' : 'Elegí la respuesta correcta.'}</p>
        <span className="text-xs text-muted">{i + 1} de {items.length}</span></div>
      <ItemPractica key={item.id} item={item} onListo={(ok) => { registrar(item, ok); if (i + 1 < items.length) setI(i + 1) }} />
    </div>
  )
}

// ---------------- Repetición (CA4) ----------------

// Lo fallado del concepto vuelve hasta responderlo bien: lo que se responde bien sale; lo que se falla, al final de la fila.
function Repeticion({ plan, concepto, proximo, onCambio, onSiguiente }) {
  const [cola, setCola] = useState(null)
  const [hechas, setHechas] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    api(`/plans/${plan.id}/aprender/repeticion?concepto=${encodeURIComponent(concepto)}`).then((r) => setCola(r.items)).catch((e) => setError(e.message))
  }, [plan.id, concepto])

  const listo = async (item, ok) => {
    if (ok) {
      try { await api(`/plans/${plan.id}/aprender/practica/resultado`, { method: 'POST', body: { modo: 'repeticion', resultados: [{ item, correcta: true }] } }); onCambio() }
      catch (e) { setError(e.message) }
      setHechas((h) => h + 1)
    }
    setCola((c) => (ok ? c.slice(1) : [...c.slice(1), c[0]]))
  }

  if (error) return <p role="alert" className="text-sm text-red">{error}</p>
  if (!cola) return <Synapse>Buscando lo que fallaste</Synapse>
  if (!cola.length) {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm">{hechas ? '¡Listo! Respondiste bien todo lo que habías fallado de este concepto.' : 'No tenés nada para repasar de este concepto.'}</p>
        <button type="button" className="btn btn-primary btn-sm !whitespace-normal text-left" onClick={onSiguiente}>
          {proximo ? `Siguiente concepto: “${proximo}” →` : 'Rendir la evaluación →'}</button>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">Repasá lo que fallaste hasta responderlo bien.</p><span className="text-xs text-muted">quedan {cola.length}</span></div>
      <ItemPractica key={`${cola[0].id}-${hechas}-${cola.length}`} item={cola[0]} onListo={(ok) => listo(cola[0], ok)} />
    </div>
  )
}

// Una tarjeta, como una ficha de cuaderno que se da vuelta, o una pregunta de práctica con su corrección inmediata.
function ItemPractica({ item, onListo }) {
  const [vuelta, setVuelta] = useState(false)
  const [elegida, setElegida] = useState(null)
  return (
    <div className="grid gap-3">
      <p className="text-[.72rem] font-medium uppercase tracking-[.06em] text-blue">{item.concepto}</p>
      {item.frente !== undefined ? (
        <>
          <button type="button" className={`ficha ${vuelta ? 'ficha-vuelta' : ''}`} onClick={() => setVuelta((v) => !v)}
            aria-label={vuelta ? 'Ver la pregunta' : 'Ver la respuesta'}>
            <span className="ficha-cara ficha-frente">
              <span className="ficha-etiqueta">Pregunta</span>
              <span className="ficha-texto"><TextoCitado texto={item.frente} /></span>
            </span>
            <span className="ficha-cara ficha-dorso">
              <span className="ficha-etiqueta">Respuesta</span>
              <span className="ficha-texto"><TextoCitado texto={item.dorso} /></span>
            </span>
          </button>
          {!vuelta
            ? <div><button type="button" className="btn btn-soft btn-sm" onClick={() => setVuelta(true)}>Ver respuesta</button></div>
            : <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onListo(true)}>La sabía</button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => onListo(false)}>No la sabía</button>
              </div>}
        </>
      ) : (
        <>
          <div className="hoja">
            <span className="ficha-etiqueta">{item.tipo === 'verdadero o falso' ? 'Verdadero o falso' : 'Elegí la correcta'}</span>
            <p className="ficha-texto !text-left"><TextoCitado texto={item.enunciado} /></p>
          </div>
          {item.codigo && <Codigo codigo={item.codigo} />}
          <div className="grid gap-2">
            {item.opciones.map((o, k) => (
              <button key={k} type="button" disabled={elegida !== null} onClick={() => setElegida(k)}
                className={`cursor-pointer rounded-xl border px-4 py-2.5 text-left text-sm disabled:cursor-default ${elegida === null ? 'border-line bg-card hover:border-blue'
                  : k === item.correcta ? 'border-green bg-[color-mix(in_srgb,var(--green)_10%,transparent)]' : k === elegida ? 'border-red' : 'border-line opacity-60'}`}><TextoCitado texto={o} /></button>
            ))}
          </div>
          {elegida !== null && (
            <div className="grid justify-items-start gap-2 text-sm">
              <p className={elegida === item.correcta ? 'text-green' : 'text-red'}>{elegida === item.correcta ? 'Correcto.' : 'Incorrecto.'} <span className="text-fg"><TextoCitado texto={item.porque ?? ''} /></span></p>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => onListo(elegida === item.correcta)}>Seguir →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------- Evaluación de comprensión (CA5 a CA10) ----------------

const Codigo = ({ codigo }) => <pre className="overflow-x-auto rounded-xl bg-[#1e1e1e] px-4 py-3 font-mono text-[.8rem] leading-relaxed text-white/90">{codigo}</pre>

function Evaluacion({ plan, estado, onSalir, onConcepto, onTerminar }) {
  const [ev, setEv] = useState(estado.evaluacion_pendiente)
  const [respuestas, setRespuestas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(!estado.evaluacion_pendiente)
  const [error, setError] = useState('')

  const nueva = useCallback(async () => {
    setCargando(true); setError(''); setResultado(null); setRespuestas({})
    try { setEv(await api(`/plans/${plan.id}/aprender/evaluacion`, { method: 'POST' })) } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [plan.id])
  // Una sola vez: en desarrollo React ejecuta los efectos dos veces al montar, y eso generaba dos evaluaciones.
  const pedida = useRef(false)
  useEffect(() => {
    if (!estado.evaluacion_pendiente && !pedida.current) { pedida.current = true; nueva() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const entregar = async () => {
    setCargando(true); setError('')
    try { setResultado(await api(`/plans/${plan.id}/aprender/evaluacion/${ev.id}`, { method: 'POST', body: { respuestas } })); onTerminar() }
    catch (e) { setError(e.message) } finally { setCargando(false) }
  }

  if (cargando && !ev) return <Synapse>Armando una evaluación con preguntas nuevas…</Synapse>
  if (error && !ev) return <div className="grid justify-items-start gap-3"><p role="alert" className="text-sm text-red">{error}</p><button type="button" className="btn btn-soft btn-sm" onClick={onSalir}>Volver</button></div>
  if (resultado) return <Resultado r={resultado} onRepetir={nueva} onSalir={onSalir} onConcepto={onConcepto} />

  const sinResponder = ev.preguntas.filter((p) => respuestas[p.n] === undefined || respuestas[p.n] === '').length
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-medium">Evaluación de comprensión</h2>
          <p className="text-xs text-muted">5 preguntas según tu nivel inicial · se aprueba con 3 de 5 ({estado.aprobacion} %)</p></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSalir}>Volver a estudiar</button>
      </div>
      {ev.preguntas.map((p) => (
        <fieldset key={p.n} className="grid gap-2.5 border-t border-line pt-4">
          <legend className="sr-only">Pregunta {p.n}</legend>
          <div className="flex flex-wrap items-center gap-2 text-[.72rem]">
            <b className="font-mono text-blue">{p.n}.</b>
            <span className="pill">{p.dificultad}</span><span className="text-muted">{p.tipo}</span>
          </div>
          <p className="text-[.98rem]"><TextoCitado texto={p.enunciado} /></p>
          {p.codigo && <Codigo codigo={p.codigo} />}
          {p.opciones ? p.opciones.map((o, k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-2.5 text-sm ${respuestas[p.n] === k ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_6%,transparent)]' : 'border-line hover:border-rule'}`}>
              <input type="radio" name={`p${p.n}`} className="mt-1 accent-[var(--blue)]" checked={respuestas[p.n] === k} onChange={() => setRespuestas((r) => ({ ...r, [p.n]: k }))} />{o}
            </label>
          )) : (
            <textarea rows={3} maxLength={800} value={respuestas[p.n] ?? ''} onChange={(e) => setRespuestas((r) => ({ ...r, [p.n]: e.target.value }))}
              placeholder="Respondé con tus palabras, en una o dos oraciones." className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm outline-none focus:border-blue" />
          )}
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" className="btn btn-primary" disabled={cargando} onClick={entregar}>{cargando ? 'Corrigiendo…' : 'Entregar evaluación'}</button>
        {sinResponder > 0 && <span className="text-xs text-muted">{sinResponder === 1 ? 'Queda 1 pregunta' : `Quedan ${sinResponder} preguntas`} sin responder: cuentan como cero.</span>}
      </div>
    </div>
  )
}

function Resultado({ r, onRepetir, onSalir, onConcepto }) {
  return (
    <div className="grid gap-5">
      <div className={`rounded-2xl border p-5 ${r.aprobado ? 'border-green/50 bg-[color-mix(in_srgb,var(--green)_6%,transparent)]' : 'border-orange/50 bg-[color-mix(in_srgb,var(--orange)_6%,transparent)]'}`}>
        <p className="display text-[1.8rem]">{fmt(r.puntaje)} de {r.sobre} <span className="text-muted">({fmt(r.porcentaje)} %)</span></p>
        <p className="mt-1 text-sm">{r.aprobado ? '¡Aprobaste Aprender! Ya tenés habilitado Practicar.' : 'Todavía no alcanza el 60 %. Repasá los conceptos marcados y volvé a intentarlo con preguntas nuevas.'}</p>
        <p className="mt-1 text-xs text-muted">{r.composicion} · tu mejor resultado: {fmt(r.mejor_evaluacion)} %</p>
      </div>
      {r.repasar.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Conceptos que conviene repasar</p>
          <div className="flex flex-wrap gap-2">{r.repasar.map((c) => <button key={c} type="button" className="chip no-check" onClick={() => onConcepto(c)}>{c} →</button>)}</div>
        </div>
      )}
      <div className="grid gap-4">
        {r.preguntas.map((p, i) => {
          const d = r.detalle[i]
          return (
            <div key={p.n} className="grid gap-2 border-t border-line pt-4 text-sm">
              <p><b className="font-mono text-blue">{p.n}.</b> <TextoCitado texto={p.enunciado} />
                <span className={`ml-2 font-medium ${d.puntos === 1 ? 'text-green' : d.puntos ? 'text-orange' : 'text-red'}`}>{fmt(d.puntos)} {d.puntos === 1 ? 'punto' : 'puntos'}</span></p>
              {p.codigo && <Codigo codigo={p.codigo} />}
              {p.opciones ? (
                <ul className="grid gap-1">
                  {p.opciones.map((o, k) => (
                    <li key={k} className={k === p.correcta ? 'text-green' : k === d.respuesta ? 'text-red line-through' : 'text-muted'}>
                      {k === p.correcta ? '✓' : k === d.respuesta ? '✗' : '·'} {o}{k === d.respuesta && k !== p.correcta ? ' (tu respuesta)' : ''}
                    </li>
                  ))}
                  {d.respuesta === null || d.respuesta === undefined ? <li className="text-red">Sin responder</li> : null}
                </ul>
              ) : (
                <div className="grid gap-1.5">
                  <p className="rounded-lg bg-elev px-3 py-2">{d.respuesta || <span className="text-red">Sin responder</span>}</p>
                  <ul className="grid gap-1">
                    {d.elementos.map((e) => <li key={e.elemento} className={e.presente ? 'text-green' : 'text-red'}>{e.presente ? '✓' : '✗'} {e.elemento}{e.cita ? <span className="text-muted"> · “{e.cita}”</span> : ''}</li>)}
                  </ul>
                </div>
              )}
              {p.porque && <p className="text-muted">{p.porque}</p>}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        {r.aprobado && <Link to="/app/practicar" className="btn btn-primary">Continuar a Practicar <span className="arrow">→</span></Link>}
        <button type="button" className={`btn ${r.aprobado ? 'btn-soft' : 'btn-primary'}`} onClick={onRepetir}>Repetir con preguntas nuevas</button>
        <button type="button" className="btn btn-ghost" onClick={onSalir}>Volver a estudiar</button>
      </div>
    </div>
  )
}
