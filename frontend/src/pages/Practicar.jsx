import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { IconCheck, IconLock } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { LANGUAGES, MODULES } from '../lib/format.js'

/*
  Módulo Practicar (HU-005, HU-006, HU-007 y HU-011), según la Pantalla 3 de la Entrega 3.

  Tiempo activo (HU-006, CA2 y CA3): avanza solo mientras la pestaña está visible y se detiene si pasan cinco
  minutos sin editar; se reanuda con la siguiente edición. Cada 30 segundos se informa al backend, que evalúa
  la regla de tiempo sin esperar un nuevo intento.
*/
const AVISO_MS = 30_000
const INACTIVIDAD_MS = 5 * 60_000
const m = MODULES.practicar
const PUNTOS = { 10: 'sin ayuda', 7: 'con pista', 4: 'con explicación' }

// Tiempo activo por ejercicio, guardado en este navegador para que recargar no lo reinicie.
const leerTiempo = (id) => { try { return Number(localStorage.getItem(`tiempo-${id}`)) || 0 } catch { return 0 } }
const guardarTiempo = (id, s) => { try { localStorage.setItem(`tiempo-${id}`, String(Math.round(s))) } catch { /* sin almacenamiento */ } }

export default function Practicar() {
  const { plan, reload } = useOutletContext()
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    if (!plan) return
    setError('')
    api(`/plans/${plan.id}/practicar`).then(setEstado).catch((e) => setError(e.message))
  }, [plan])
  useEffect(() => { setEstado(null); cargar() }, [cargar])

  if (!plan) return <SinPlan />
  if (error && !estado) return <p role="alert" className="text-red">{error}</p>
  if (!estado) return <Synapse>Buscando tu próximo ejercicio</Synapse>
  if (!estado.ejercicio) return <Bloqueado estado={estado} />
  return <Ejercicio key={estado.ejercicio.id} plan={plan} estado={estado} onSiguiente={() => { cargar(); reload() }} />
}

function SinPlan() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} />
      <p className="text-sm">Todavía no armaste tu plan.</p>
      <div><Link to="/empezar" className="btn btn-primary">Armar mi plan <span className="arrow">→</span></Link></div>
    </div>
  )
}

// HU-011, CA3: el módulo bloqueado informa qué condición falta cumplir.
function Bloqueado({ estado }) {
  return (
    <div className="grid gap-8" style={{ '--c': m.color }}>
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} sub={estado.tema} />
      <section className="card grid justify-items-start gap-3 p-6">
        <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-rule text-muted"><IconLock className="size-4" /></span>
        <p className="text-sm">{estado.modulo.falta}</p>
        <Link to="/app/aprender" className="btn btn-primary btn-sm">Ir a Aprender <span className="arrow">→</span></Link>
      </section>
    </div>
  )
}

function Ejercicio({ plan, estado, onSiguiente }) {
  const ej = estado.ejercicio
  const [lenguaje, setLenguaje] = useState(ej.lenguaje_fijo ?? estado.lenguaje)
  const [codigos, setCodigos] = useState(() => ({ ...ej.plantillas, ...(ej.codigo && ej.lenguaje_fijo ? { [ej.lenguaje_fijo]: ej.codigo } : {}) }))
  const [intentos, setIntentos] = useState(ej.intentos)
  const [ultimo, setUltimo] = useState(null) // resultado del último envío
  const [intervencion, setIntervencion] = useState(ej.intervenciones.at(-1) ?? null)
  const [puntosPosibles, setPuntosPosibles] = useState(ej.puntos_posibles)
  const [resueltos, setResueltos] = useState(estado.resueltos)
  const [resuelto, setResuelto] = useState(false)
  const [aprobado, setAprobado] = useState(estado.aprobado)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const fijo = intentos.length > 0 ? (ej.lenguaje_fijo ?? lenguaje) : null

  // ---- Tiempo activo ----
  const tiempo = useRef(leerTiempo(ej.id))
  const ultimaEdicion = useRef(Date.now())
  useEffect(() => {
    let previo = Date.now()
    const tic = setInterval(() => {
      const ahora = Date.now()
      if (document.visibilityState === 'visible' && ahora - ultimaEdicion.current < INACTIVIDAD_MS && !resuelto) {
        tiempo.current += (ahora - previo) / 1000
        guardarTiempo(ej.id, tiempo.current)
      }
      previo = ahora
    }, 1000)
    const aviso = setInterval(() => {
      if (resuelto) return
      api(`/plans/${plan.id}/practicar/tiempo`, { method: 'POST', body: { id_ejercicio: ej.id, tiempo_activo: tiempo.current } })
        .then((r) => { if (r.intervencion) { setIntervencion(r.intervencion); setPuntosPosibles(7) } }).catch(() => {})
    }, AVISO_MS)
    return () => { clearInterval(tic); clearInterval(aviso) }
  }, [ej.id, plan.id, resuelto])

  const ejecutar = async () => {
    setEnviando(true); setError('')
    try {
      const r = await api(`/plans/${plan.id}/practicar/intentos`, {
        method: 'POST', body: { id_ejercicio: ej.id, lenguaje, codigo: codigos[lenguaje], tiempo_activo: tiempo.current },
      })
      setUltimo(r)
      setIntentos((xs) => [...xs, { n: r.intento, resultado: r.resultado, tipo_error: r.tipo_error }])
      if (r.intervencion) { setIntervencion(r.intervencion); setPuntosPosibles(r.intervencion.nivel === 1 ? 7 : 4) }
      if (r.resultado === 'correcto') { setResuelto(true); setResueltos(r.resueltos); setAprobado(r.aprobado) }
    } catch (e) { setError(e.message) } finally { setEnviando(false) }
  }

  const cambiarLenguaje = (l) => { if (!fijo) setLenguaje(l) }
  const onEditar = (valor) => { ultimaEdicion.current = Date.now(); setCodigos((c) => ({ ...c, [lenguaje]: valor ?? '' })) }
  const titulo = ej.posicion ? `Ejercicio ${ej.posicion} de ${estado.requeridos}` : ej.es_repaso ? 'Repaso' : 'Práctica adicional'

  return (
    <div className="grid gap-6" style={{ '--c': m.color }}>
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} sub={`${estado.tema} · ${titulo} · ${ej.dificultad}`}
        action={<div className="flex flex-wrap items-center gap-2">
          {intervencion && !resuelto && <span className="pill" style={{ '--c': 'var(--orange)' }}>Posible bloqueo detectado</span>}
          <div role="radiogroup" aria-label="Lenguaje" className="flex gap-1.5">
            {Object.entries(LANGUAGES).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={lenguaje === k} disabled={!!fijo && fijo !== k}
                className="chip no-check" onClick={() => cambiarLenguaje(k)}>{label}</button>
            ))}
          </div>
        </div>} />

      <section className="rounded-2xl border border-dashed border-rule bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] px-5 py-4">
        <h2 className="text-[1.05rem] font-medium tracking-[-.01em]">{ej.titulo}</h2>
        <p className="mt-1 text-[.95rem]">{ej.enunciado}</p>
        <ul className="mt-3 grid gap-1 font-mono text-xs text-muted">
          {ej.ejemplos.map((c, i) => <li key={i}>{fmtLlamada(c.entrada)} → {JSON.stringify(c.salida)}</li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Tiempo esperado: {ej.tiempo_esperado} min · {fijo ? 'El lenguaje puede cambiarse antes de iniciar el próximo ejercicio.' : 'Elegí el lenguaje antes del primer intento.'}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl bg-[#1e1e1e] shadow-sm">
        <Editor height="300px" language={lenguaje} theme="vs-dark" value={codigos[lenguaje]} onChange={onEditar}
          options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false,
            tabSize: 4, automaticLayout: true, padding: { top: 14 }, readOnly: resuelto }}
          loading={<span className="text-sm text-white/60">Cargando el editor…</span>}
          onMount={(editor, monaco) => editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => document.getElementById('ejecutar')?.click())} />
        <Consola intentos={intentos} ultimo={ultimo} intervencion={intervencion} />
      </section>

      {intervencion && !resuelto && (
        <section className="card border-l-2 !border-l-orange px-5 py-4 text-[.95rem]" aria-live="polite">
          <b className="font-medium">{intervencion.nivel === 1 ? 'Pista (nivel 1 de 2):' : 'Explicación (nivel 2 de 2):'}</b> {intervencion.texto}
        </section>
      )}
      {resuelto && ultimo?.resultado === 'correcto' && (
        <section className="card flex items-center gap-3 border-l-2 !border-l-green px-5 py-4 text-[.95rem]" aria-live="polite">
          <IconCheck className="size-4 flex-none text-green" />
          <span>{ultimo.mensaje}{ultimo.puntos_obtenidos ? ` Sumás ${ultimo.puntos_obtenidos} puntos (${PUNTOS[ultimo.puntos_obtenidos]}).` : ' Ya lo habías resuelto: no suma puntos de nuevo.'}</span>
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {resuelto
          ? <button type="button" className="btn btn-primary" onClick={onSiguiente}>{aprobado ? 'Practicar otro' : 'Siguiente ejercicio'} <span className="arrow">→</span></button>
          : <button id="ejecutar" type="button" className="btn btn-primary" disabled={enviando} onClick={ejecutar}>
              {enviando ? 'Ejecutando…' : 'Ejecutar código'}</button>}
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-right text-xs text-muted">
            Ejercicios resueltos: <span className="text-fg">{Math.min(resueltos, estado.requeridos)} de {estado.requeridos}</span>
            {!resuelto && !ej.ya_resuelto && <><br />Este ejercicio suma {puntosPosibles} puntos ({PUNTOS[puntosPosibles]})</>}
          </p>
          {aprobado
            ? <Link to="/app/consolidar" className="btn btn-soft">Continuar a Consolidar <span className="arrow">→</span></Link>
            : <button type="button" className="btn btn-soft" disabled title={`Resolvé ${estado.requeridos} ejercicios para habilitarlo`}>Continuar a Consolidar</button>}
        </div>
      </div>
    </div>
  )
}

const fmtLlamada = (entrada) => `(${entrada.map((v) => JSON.stringify(v)).join(', ')})`

// Debajo del editor: historial de intentos del ejercicio y detalle del último envío, como una terminal.
function Consola({ intentos, ultimo, intervencion }) {
  if (!intentos.length) return <div className="border-t border-white/10 px-5 py-3 font-mono text-xs text-white/40">&gt; Ejecutá el código para ver el resultado de los casos de prueba (Ctrl + Enter).</div>
  const recientes = intentos.slice(-4)
  return (
    <div className="grid gap-1 border-t border-white/10 px-5 py-3 font-mono text-[.78rem] leading-relaxed text-white/80" aria-live="polite">
      {recientes.map((i) => (
        <p key={i.n}>&gt; Intento {i.n}: {i.resultado === 'correcto' ? <span className="text-[#7fd1a3]">correcto</span>
          : <>{i.tipo_error?.replace(/^[^:]+: /, '')} <span className="text-white/50">({i.resultado})</span></>}</p>
      ))}
      {ultimo && ultimo.resultado !== 'correcto' && <p className="text-[#f2b880]">&gt; {ultimo.mensaje.split('\n')[0]}</p>}
      {ultimo?.casos?.length > 0 && (
        <p className="text-white/50">&gt; Casos: {ultimo.casos.map((c) => (c.estado === 'OK' ? '✓' : '✗')).join(' ')}</p>
      )}
      {intervencion && ultimo?.resultado !== 'correcto' && <p className="text-white/50">&gt; {intervencion.motivo}</p>}
    </div>
  )
}
