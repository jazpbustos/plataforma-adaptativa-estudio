import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Asistente from '../components/Asistente.jsx'
import { Bloqueado, Pantalla, SinPlan } from '../components/PageHeader.jsx'
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
const PUNTOS = { 10: 'sin ayuda', 7: 'con pistas', 4: 'con explicación' }

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

  if (!plan) return <SinPlan m={m} />
  if (error && !estado) return <p role="alert" className="text-red">{error}</p>
  if (!estado) return <Synapse>Buscando tu próximo ejercicio</Synapse>
  if (!estado.ejercicio) return <Bloqueado m={m} tema={estado.tema} falta={estado.modulo.falta} anterior={MODULES.aprender} />
  return <Ejercicio key={`${estado.ejercicio.id}-${estado.ejercicio.intentos.length}`} plan={plan} estado={estado} onSiguiente={() => { cargar(); reload() }} />
}

function Ejercicio({ plan, estado, onSiguiente }) {
  const ej = estado.ejercicio
  const [lenguaje, setLenguaje] = useState(ej.lenguaje_fijo ?? estado.lenguaje)
  const [codigos, setCodigos] = useState(() => ({ ...ej.plantillas, ...(ej.codigo && ej.lenguaje_fijo ? { [ej.lenguaje_fijo]: ej.codigo } : {}) }))
  const [intentos, setIntentos] = useState(ej.intentos) // { n, resultado, tipo_error } y, si se enviaron en esta visita, el detalle
  const { config } = useAuth()
  const [ultimo, setUltimo] = useState(null) // resultado del último envío
  const [intervencion, setIntervencion] = useState(ej.intervenciones.at(-1) ?? null)
  const [puntosPosibles, setPuntosPosibles] = useState(ej.puntos_posibles)
  const [resueltos, setResueltos] = useState(estado.resueltos)
  const [resuelto, setResuelto] = useState(false)
  const [aprobado, setAprobado] = useState(estado.aprobado)
  const [enviando, setEnviando] = useState(false)
  const [lento, setLento] = useState(false)  // la respuesta tarda: el sistema está redactando la pista
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
        .then((r) => { if (r.intervencion) { setIntervencion(r.intervencion); setPuntosPosibles((x) => Math.min(x, 7)) } }).catch(() => {})
    }, AVISO_MS)
    return () => { clearInterval(tic); clearInterval(aviso) }
  }, [ej.id, plan.id, resuelto])

  const ejecutar = async () => {
    setEnviando(true); setError('')
    const aviso = setTimeout(() => setLento(true), 2500)
    try {
      const r = await api(`/plans/${plan.id}/practicar/intentos`, {
        method: 'POST', body: { id_ejercicio: ej.id, lenguaje, codigo: codigos[lenguaje], tiempo_activo: tiempo.current },
      })
      setUltimo(r)
      setIntentos((xs) => [...xs, { n: r.intento, resultado: r.resultado, tipo_error: r.tipo_error, mensaje: r.mensaje, casos: r.casos,
        motivo: r.intervencion?.motivo }])
      // Los puntos solo bajan: una pista nueva después de una explicación no los vuelve a subir.
      if (r.intervencion) { setIntervencion(r.intervencion); setPuntosPosibles((x) => Math.min(x, r.intervencion.nivel === 1 ? 7 : 4)) }
      if (r.resultado === 'correcto') { setResuelto(true); setResueltos(r.resueltos); setAprobado(r.aprobado) }
    } catch (e) { setError(e.message) } finally { clearTimeout(aviso); setLento(false); setEnviando(false) }
  }

  const cambiarLenguaje = (l) => { if (!fijo) setLenguaje(l) }
  const aPlantilla = () => setCodigos((c) => ({ ...c, [lenguaje]: ej.plantillas[lenguaje] }))
  // Solo en modo prueba (DEV_LOGIN): borra intentos, pistas y puntos del ejercicio para volver a probarlo.
  const reiniciar = async () => {
    setError('')
    try {
      await api(`/plans/${plan.id}/practicar/ejercicios/${ej.id}`, { method: 'DELETE' })
      guardarTiempo(ej.id, 0)
      onSiguiente()
    } catch (e) { setError(e.message) }
  }
  const onEditar = (valor) => { ultimaEdicion.current = Date.now(); setCodigos((c) => ({ ...c, [lenguaje]: valor ?? '' })) }
  const titulo = ej.posicion ? `Ejercicio ${ej.posicion} de ${estado.requeridos}` : ej.es_repaso ? 'Repaso' : 'Práctica adicional'

  // Un solo bloque que ocupa el alto de la ventana, como en Aprender: arriba el enunciado, en el medio el editor
  // (toma el alto que queda), la barra y la consola, y abajo el avance del módulo. La página no se desplaza.
  return (
    <Pantalla color={m.color} title="Módulo" accent={m.label} accentColor={m.color} sub={`${estado.tema} · ${titulo} · ${ej.dificultad}`}>

      <section className="card relative flex min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        <div className="max-h-[32%] flex-none overflow-y-auto border-b border-line px-5 py-3.5 [scrollbar-width:thin]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[1.05rem] font-medium tracking-[-.01em]">{ej.titulo}</h2>
            <span className="text-xs text-muted">Tiempo esperado: {ej.tiempo_esperado} min</span>
          </div>
          <p className="mt-1 text-[.95rem]">{ej.enunciado}</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
            {ej.ejemplos.map((c, i) => <li key={i}>{fmtLlamada(c.entrada)} → {JSON.stringify(c.salida)}</li>)}
          </ul>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e]">
          {/* El ayudante vive en la esquina del editor: la pista aparece donde el estudiante está mirando */}
          <div className="relative h-[380px] lg:h-auto lg:min-h-[180px] lg:flex-1">
            <Editor height="100%" language={lenguaje} theme="vs-dark" value={codigos[lenguaje]} onChange={onEditar}
              options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', fontLigatures: false,
                scrollBeyondLastLine: false, tabSize: 4, automaticLayout: true, padding: { top: 14 }, readOnly: resuelto }}
              loading={<span className="text-sm text-white/60">Cargando el editor…</span>}
              onMount={(editor, monaco) => editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => document.getElementById('ejecutar')?.click())} />
            <Ayudante enviando={enviando} lento={lento} intentos={intentos} ultimo={ultimo} intervencion={intervencion} resuelto={resuelto} />
          </div>
          {/* Barra de la consola: lenguaje a la izquierda y ejecutar a la derecha, como en un IDE */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#252526] px-4 py-2">
            <div role="radiogroup" aria-label="Lenguaje" className="flex items-center gap-1"
              title={fijo ? 'El lenguaje puede cambiarse antes de iniciar el próximo ejercicio' : 'Elegí el lenguaje antes del primer intento'}>
              {Object.entries(LANGUAGES).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={lenguaje === k} disabled={!!fijo && fijo !== k}
                  title={fijo && fijo !== k ? 'El lenguaje se puede cambiar en el próximo ejercicio' : undefined}
                  className="cs-lenguaje" onClick={() => cambiarLenguaje(k)}>{label}</button>
              ))}
            </div>
            {resuelto
              ? <div className="flex flex-wrap items-center gap-2">
                  {config?.dev_login && <button type="button" className="cs-accion cs-accion-prueba" onClick={reiniciar}
                    title="Modo prueba: borra los intentos, las pistas y los puntos de este ejercicio">Reiniciar ejercicio</button>}
                  <button type="button" className="cs-run cs-run-ok" onClick={onSiguiente}>{aprobado ? 'Practicar otro' : 'Siguiente ejercicio'} →</button>
                </div>
              : <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="cs-accion" onClick={aPlantilla} title="Vuelve el editor al código inicial (los intentos quedan registrados)">↺ Plantilla</button>
                  {config?.dev_login && intentos.length > 0 && (
                    <button type="button" className="cs-accion cs-accion-prueba" onClick={reiniciar}
                      title="Modo prueba: borra los intentos, las pistas y los puntos de este ejercicio">Reiniciar ejercicio</button>
                  )}
                  <span className="mx-1 hidden font-mono text-[.7rem] text-white/40 md:inline">Ctrl + Enter</span>
                  <button id="ejecutar" type="button" className="cs-run" disabled={enviando} onClick={ejecutar}>
                    {enviando ? <span className="cs-spin" aria-hidden="true" /> : <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" /></svg>}
                    {enviando ? (lento ? 'Analizando…' : 'Ejecutando…') : 'Ejecutar'}
                  </button>
                </div>}
          </div>
          <Consola intentos={intentos} />
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))] px-5 py-2.5">
          <p className="text-xs text-muted">
            {/* El ejercicio en curso y los ya resueltos se muestran por separado: estar en el 2 no es tener 2 resueltos. */}
            {ej.posicion ? <>Estás en el ejercicio <span className="text-fg">{ej.posicion}</span> · </> : <>Práctica adicional · </>}
            resueltos: <span className="text-fg">{Math.min(resueltos, estado.requeridos)} de {estado.requeridos}</span>
            {!resuelto && !ej.ya_resuelto && <> · este ejercicio suma {puntosPosibles} puntos ({PUNTOS[puntosPosibles]})</>}
          </p>
          {error && <p role="alert" className="text-xs text-red">{error}</p>}
          {aprobado
            ? <Link to="/app/consolidar" className="btn btn-sm border-transparent text-white hover:brightness-110" style={{ background: 'var(--green)' }}>Continuar a Consolidar →</Link>
            : <button type="button" className="btn btn-soft btn-sm" disabled title={`Resolvé ${estado.requeridos} ejercicios para habilitarlo`}>Continuar a Consolidar</button>}
        </div>
      </section>
    </Pantalla>
  )
}

// Qué dice el ayudante en cada momento: la pista o la explicación tienen prioridad mientras no se resuelva.
function Ayudante({ enviando, lento, intentos, ultimo, intervencion, resuelto }) {
  if (resuelto && ultimo?.resultado === 'correcto') {
    return (
      <Asistente estado="festeja" titulo="¡Lo lograste!" clave="festeja">
        {ultimo.mensaje}{ultimo.puntos_obtenidos ? ` Sumás ${ultimo.puntos_obtenidos} puntos (${PUNTOS[ultimo.puntos_obtenidos]}).` : ' Ya lo habías resuelto: no suma puntos de nuevo.'}
      </Asistente>
    )
  }
  if (enviando && lento) return <Asistente estado="pensando" clave="pensando">Estoy mirando tu código…</Asistente>
  if (intervencion) {
    const nivel1 = intervencion.nivel === 1
    return (
      <Asistente estado={nivel1 ? 'pista' : 'explicacion'} aviso={intervencion.etiqueta ?? 'Posible bloqueo detectado'} clave={`intervencion-${intervencion.nivel}`}
        titulo={nivel1 ? 'Pista (nivel 1 de 2)' : 'Explicación (nivel 2 de 2)'}>
        <TextoConCodigo texto={intervencion.texto} />
      </Asistente>
    )
  }
  if (intentos.length) {
    const sintaxis = intentos.at(-1).resultado === 'error de sintaxis'
    return (
      <Asistente estado="mirando" clave={`intento-${intentos.length}`}>
        {sintaxis ? 'El código no compila: mirá la línea que marca la consola y probá de nuevo.'
          : 'Revisá en la consola qué caso falló y probá de nuevo. Si veo que te trabás, te doy una pista.'}
      </Asistente>
    )
  }
  return <Asistente estado="espera" clave="espera">Escribí tu solución y ejecutala. Si veo que te trabás, te doy una pista.</Asistente>
}

// El modelo marca el código entre comillas invertidas (`return 0`): se muestra con fuente de código.
function TextoConCodigo({ texto }) {
  return texto.split(/(`[^`\n]+`)/).map((parte, i) => (parte.length > 2 && parte.startsWith('`') && parte.endsWith('`')
    ? <code key={i} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[.85em]">{parte.slice(1, -1)}</code>
    : parte))
}

const fmtLlamada = (entrada) => `(${entrada.map((v) => JSON.stringify(v)).join(', ')})`

// Debajo del editor: todos los intentos del ejercicio, como una terminal con su propio scroll. Cada intento
// enviado en esta visita muestra el detalle completo; al llegar uno nuevo baja sola hasta el final.
function Consola({ intentos }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }) }, [intentos.length])
  return (
    <div ref={ref} className="cs-salida" aria-live="polite" aria-label="Consola">
      {!intentos.length && <p className="text-white/40">&gt; Ejecutá el código para ver el resultado de los casos de prueba.</p>}
      {intentos.map((i) => (
        <div key={i.n} className="cs-intento">
          <p>&gt; Intento {i.n}: {i.resultado === 'correcto' ? <span className="text-[#7fd1a3]">correcto</span>
            : <>{i.tipo_error?.replace(/^[^:]+: /, '')} <span className="text-white/50">({i.resultado})</span></>}</p>
          {i.mensaje && i.resultado !== 'correcto' && i.mensaje.split('\n').map((l, k) => <p key={k} className="pl-4 text-[#f2b880]">{l}</p>)}
          {i.casos?.length > 0 && <p className="pl-4 text-white/50">Casos: {i.casos.map((c) => (c.estado === 'OK' ? '✓' : '✗')).join(' ')}</p>}
          {i.motivo && <p className="pl-4 text-[#C9B8FF]">↳ {i.motivo}</p>}
        </div>
      ))}
    </div>
  )
}
