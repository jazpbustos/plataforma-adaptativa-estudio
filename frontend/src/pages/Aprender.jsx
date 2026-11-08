import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Cerebrito } from '../components/Asistente.jsx'
import { IconCheck } from '../components/Icons.jsx'
import { Pantalla, SinPlan } from '../components/PageHeader.jsx'
import Synapse from '../components/Synapse.jsx'
import { api } from '../lib/api.js'
import { LEVELS, MODULES } from '../lib/format.js'

/*
  Módulo Aprender (HU-003 y HU-004), según la Pantalla 2: el plan del tema en una barra arriba, con los conceptos
  recorridos y los pasos de cada uno; un solo chat por tema con la lección guiada de cada concepto (explicación con
  citas y pregunta de comprobación), las consultas libres y las definiciones puntuales; tarjetas de memoria y
  cuestionario de un concepto o del repaso del tema, dentro del mismo chat y también a pedido escrito («tarjetas de
  bucles»); repetición de lo fallado; resumen del tema; sugerencias de Brity, y evaluación de comprensión, que con
  el 60 % habilita Practicar.
*/
const m = MODULES.aprender
const PASOS = [['leccion', 'Lección'], ['tarjetas', 'Tarjetas de memoria'], ['cuestionario', 'Cuestionario']]
const fmt = (n) => String(n).replace('.', ',')

export default function Aprender() {
  const { plan, reload } = useOutletContext()
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  // Qué se ve en el panel principal: el chat del tema (siempre montado, para no perder la conversación), las tarjetas
  // o el cuestionario de uno o varios conceptos, la repetición de lo fallado o la evaluación de comprensión.
  const [vista, setVista] = useState({ tipo: 'chat' })

  // Depende del id del plan y no del objeto: al recargar el panel el objeto cambia, y eso no debe borrar el chat.
  const planId = plan?.id
  const cargar = useCallback(() => {
    if (!planId) return
    api(`/plans/${planId}/aprender`).then((e) => {
      setEstado(e)
      if (e.evaluacion_pendiente) setVista({ tipo: 'evaluacion' })
    }).catch((e) => setError(e.message))
  }, [planId])
  useEffect(() => { setEstado(null); setVista({ tipo: 'chat' }); cargar() }, [cargar])

  const actualizar = useCallback(() => { cargar(); reload() }, [cargar, reload])
  const chat = useChat(planId, actualizar)

  // Al entrar, la lección del primer concepto sin recorrer (o del primero): una sola vez por plan.
  const abierto = useRef(null)
  useEffect(() => {
    if (!estado || abierto.current === planId) return
    abierto.current = planId
    chat.abrirConcepto((estado.conceptos.find((c) => !c.recorrido) ?? estado.conceptos[0])?.nombre)
  }, [estado, planId, chat])

  if (!plan) return <SinPlan m={m} />
  if (error && !estado) return <p role="alert" className="text-red">{error}</p>
  if (!estado) return <Synapse>Preparando el plan del tema</Synapse>

  const nombres = estado.conceptos.map((c) => c.nombre)
  const volver = () => setVista({ tipo: 'chat' })
  const irAConcepto = (c) => { setVista({ tipo: 'chat' }); chat.abrirConcepto(c) }
  const acciones = {
    evaluar: () => setVista({ tipo: 'evaluacion' }),
    nombreSiguiente: (c) => nombres[nombres.indexOf(c) + 1],
  }

  return (
    <Pantalla color={m.color} title="Módulo" accent={m.label} accentColor={m.color} sub={`${estado.tema} · Nivel inicial: ${LEVELS[estado.nivel]?.label.toLowerCase()}`}>

      {!estado.generacion_disponible && (
        <p className="rounded-xl border border-dashed border-orange/60 px-4 py-3 text-sm text-orange">
          La generación de contenido no está configurada en el servidor (falta la clave del modelo de lenguaje).
        </p>
      )}

      <section className="card relative flex h-[85dvh] min-h-[460px] min-w-0 flex-col overflow-hidden lg:h-auto lg:flex-1">
        {/* Durante la evaluación, solo la evaluación: sin el plan ni las acciones del tema, para no distraer ni salir sin querer. */}
        {vista.tipo !== 'evaluacion' && <PlanBar estado={estado} activo={chat.activo} onConcepto={irAConcepto} />}
        <div className={vista.tipo === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <Chat chat={chat} estado={estado} acciones={acciones} plan={plan} onCambio={actualizar} />
        </div>
        {vista.tipo === 'evaluacion' && (
          <div className="relative min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
            <Evaluacion plan={plan} estado={estado} onSalir={() => { volver(); actualizar() }} onConcepto={irAConcepto} onTerminar={actualizar} />
          </div>
        )}
        {vista.tipo !== 'evaluacion' && <PieEstado estado={estado} onEvaluar={acciones.evaluar} onRepaso={() => { volver(); chat.pedirRepaso() }}
          onRepasarFallado={() => { volver(); chat.repasarFallado() }} />}
      </section>
    </Pantalla>
  )
}

// En pantallas grandes, la página ocupa el alto de la ventana (descontados los márgenes del contenedor) y el panel
// principal, el resto: la página no se desplaza y solo se desplaza la conversación, con el campo para escribir
// siempre a la vista. Se resuelve con CSS, sin medir: así no depende de cuándo terminan de cargar la fuente o el
// encabezado. En pantallas chicas, el panel ocupa casi toda la ventana.

// Nombre corto de un concepto para la barra del plan: sin la aclaración entre paréntesis.
const corto = (c) => c.replace(/\s*\(.*\)\s*$/, '')

// ---------------- Plan del tema (CA1), en una barra arriba ----------------

// Cada concepto con sus tres segmentos (lección, tarjetas y cuestionario completados) y la marca de recorrido; el
// concepto en curso, con otro color.
function PlanBar({ estado, activo, onConcepto }) {
  const recorridos = estado.conceptos.filter((c) => c.recorrido).length
  return (
    <div className="min-w-0 border-b border-line px-5 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap">
        <span className="grid flex-none text-[.78rem] font-medium leading-tight">Plan del tema <span className="font-normal text-muted">{recorridos} de {estado.conceptos.length} recorridos</span></span>
        <ol className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {estado.conceptos.map((c, n) => {
            const elegido = c.nombre === activo
            return (
              <li key={c.nombre} className="flex-none">
                <button type="button" onClick={() => onConcepto(c.nombre)} title={c.nombre} aria-current={elegido ? 'step' : undefined}
                  className={`grid cursor-pointer gap-1 rounded-lg border px-2.5 py-1.5 text-left text-[.8rem] ${elegido ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_9%,transparent)] text-blue' : 'border-line hover:border-blue/60'}`}>
                  <span className="flex max-w-[9rem] items-center gap-1.5">
                    <span className="font-mono text-[.7rem] text-muted">{n + 1}</span>
                    <span className="truncate first-letter:uppercase">{corto(c.nombre)}</span>
                    {c.recorrido && <IconCheck className="size-3 flex-none text-blue" aria-label="recorrido" />}
                  </span>
                  <span className="flex gap-0.5" aria-label={`Lección, tarjetas y cuestionario: ${PASOS.filter(([k]) => c.pasos[k]).length} de 3`}>
                    {PASOS.map(([k, label]) => <i key={k} title={label} className={`h-[3px] w-4 rounded-full ${c.pasos[k] ? 'bg-blue' : 'bg-rule/60'}`} />)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// Pie del panel principal: las acciones del tema (repasar lo fallado, practicar todo el tema y rendir la evaluación).
function PieEstado({ estado, onEvaluar, onRepaso, onRepasarFallado }) {
  const ult = estado.ultima_evaluacion
  const n = estado.contradicciones.length
  // Solo acciones: el resultado de la evaluación se ve al rendirla y en Progreso, y el pase a Practicar lo avisa
  // Brity. Una contradicción entre fuentes, en cambio, sí se señala acá además de en la lección (HU-003, CA4).
  const detalle = `Se aprueba con el ${estado.aprobacion} %. Podés rendirla en cualquier momento, también sin recorrer los conceptos.`
    + (ult ? ` Última: ${fmt(ult.puntaje)} de ${ult.sobre} (${fmt(ult.porcentaje)} %).` : '')
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 border-t border-line bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))] px-5 py-2.5">
      {n > 0 && <span className="pill mr-auto" style={{ '--c': 'var(--orange)' }} title="Se muestran en la lección del concepto">{n} {n === 1 ? 'contradicción' : 'contradicciones'} entre tu material y las fuentes</span>}
      {estado.repeticion > 0 && <button type="button" onClick={onRepasarFallado}
        title="Solo las tarjetas y preguntas que respondiste mal, hasta que las respondas bien"
        className="cursor-pointer rounded-full border border-dashed border-orange/60 px-3 py-1 text-[.78rem] text-orange">Repasar lo que fallé ({estado.repeticion})</button>}
      <button type="button" className="btn btn-soft btn-sm" onClick={onRepaso} disabled={!estado.generacion_disponible}
        title="Tarjetas o cuestionario nuevos, con una por cada concepto que recorriste">Practicar todo el tema</button>
      <button type="button" className="btn btn-sm border-transparent text-white hover:brightness-110" style={{ background: 'var(--blue)' }}
        title={detalle} disabled={!estado.generacion_disponible} onClick={onEvaluar}>
        {estado.evaluacion_pendiente ? 'Continuar la evaluación' : 'Rendir evaluación'} →</button>
    </div>
  )
}

// ---------------- Texto con citas ----------------

// Texto con **negrita**, *cursiva*, `código` y citas. Con la lista de citas, cada [n] se muestra como un número que, al pasar
// el mouse (o al enfocarlo con el teclado), muestra la fuente y el fragmento indexado del que salió (como NotebookLM).
// Cada número recibe la oración de la respuesta que lo cita, para mostrar la parte del fragmento que la respalda.
// Sin la lista, las marcas se quitan.
function TextoCitado({ texto, citas }) {
  const porN = Object.fromEntries((citas ?? []).map((c) => [c.n, c]))
  const limpio = citas ? texto : texto.replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, '')
  let previo = ''
  return limpio.split(/(\[\d+(?:\s*,\s*\d+)*\]|`[^`\n]+`|\*\*[^*\n]+\*\*|\*(?=\S)[^*\n]+?(?<=\S)\*)/).map((p, i) => {
    if (/^\[[\d,\s]+\]$/.test(p)) {
      const frase = ultimaOracion(previo)
      const ns = p.slice(1, -1).split(',').map((x) => Number(x.trim())).filter((n) => porN[n])
      return ns.map((n) => <Cita key={`${i}-${n}`} cita={porN[n]} frase={frase} />)
    }
    previo += p.replace(/^`|`$|^\*{1,2}|\*{1,2}$/g, '')
    if (/^`.+`$/.test(p)) return <code key={i} className="rounded bg-black/5 px-1 font-mono text-[.85em]">{p.slice(1, -1)}</code>
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i} className="font-semibold">{p.slice(2, -2)}</b>
    if (/^\*\S(.*\S)?\*$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>
    return p
  })
}

// La oración que termina justo antes de una cita: lo que viene después del último punto (o la anterior, si la
// cita va después del punto).
function ultimaOracion(texto) {
  const partes = texto.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter((t) => t.length > 1)
  return partes.at(-1) ?? ''
}

const sinTildes = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Raíces de las palabras con contenido (cuatro letras o más): "errores" y "error" comparten "erro".
const raices = (t) => new Set((sinTildes(t).match(/[a-z0-9_]{4,}/g) ?? []).map((w) => w.slice(0, 5)))

// Parte del fragmento que respalda la oración citada: la oración del fragmento con más palabras en común y las
// siguientes, hasta el largo máximo. Sin palabras en común (por ejemplo, fuente en otro idioma), el comienzo.
function parteRelevante(texto, frase, largo = 420) {
  const oraciones = (texto ?? '').replace(/\s+/g, ' ').trim().replace(/…$/, '').split(/(?<=[.!?])\s+/)
  const buscadas = raices(frase)
  let mejor = 0, puntaje = 0
  oraciones.forEach((o, i) => {
    const n = [...raices(o)].filter((r) => buscadas.has(r)).length
    if (n > puntaje) { mejor = i; puntaje = n }
  })
  let fin = mejor + 1
  while (fin < oraciones.length && oraciones.slice(mejor, fin + 1).join(' ').length <= largo) fin++
  let elegida = oraciones[mejor]
  if (elegida.length > largo) elegida = elegida.slice(0, largo).replace(/\s+\S*$/, '')
  const resto = oraciones.slice(mejor + 1, fin).join(' ')
  return { antes: mejor > 0, elegida, resto, despues: fin < oraciones.length || elegida.length < oraciones[mejor].length,
    resaltar: puntaje > 0 }
}

// Indicio simple de que un fragmento está en inglés (las fuentes académicas incluyen libros en inglés).
const enIngles = (t) => ((` ${sinTildes(t ?? '')} `).match(/ (the|and|is|of|to|that|it|you|in|are) /g) ?? []).length >= 4

function Cita({ cita, frase = '', conEtiqueta = false }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const abrir = () => {
    const r = ref.current.getBoundingClientRect()
    const ancho = Math.min(360, window.innerWidth - 24)
    setPos({ left: Math.max(12, Math.min(r.left - 20, window.innerWidth - ancho - 12)), ancho,
      ...(r.bottom + 230 > window.innerHeight ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) })
  }
  const parte = pos && cita.texto ? parteRelevante(cita.texto, frase) : null
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
          {parte && (
            <span className="mt-1.5 block text-[.8rem] leading-relaxed text-muted">
              “{parte.antes && '… '}
              <span className={parte.resaltar ? 'rounded bg-[color-mix(in_srgb,var(--blue)_14%,transparent)] px-0.5 text-fg' : ''}>{parte.elegida}</span>
              {parte.resto && ` ${parte.resto}`}{parte.despues && ' …'}”
            </span>
          )}
          {parte && enIngles(cita.texto) && <span className="mt-1 block text-[.7rem] italic text-muted">Texto original de la fuente, en inglés.</span>}
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

// HU-003, CA4: el aviso cita los dos fragmentos con su fuente y su página o sección. De cada fragmento se muestra la
// oración que sostiene la afirmación enfrentada (copiada textual y verificada en el backend) y, si no llegó, la parte
// del fragmento más parecida al detalle, como en las citas. Si la oración académica está en inglés, va traducida.
function Contradiccion({ c }) {
  return (
    <div className="mt-3 rounded-xl border border-orange/50 bg-[color-mix(in_srgb,var(--orange)_6%,transparent)] p-3 text-[.85rem]">
      <p className="font-medium text-orange">Contradicción entre fuentes</p>
      {c.detalle && <p className="mt-1">{c.detalle}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[['Tu material', c.propio], ['Fuente académica', c.academico]].map(([t, f]) => <FraseEnfrentada key={t} titulo={t} f={f} detalle={c.detalle} />)}
      </div>
      <p className="mt-2 text-[.78rem] text-muted">Como tu material no coincide con la fuente académica, en esta lección se explica lo que dice la fuente académica.</p>
    </div>
  )
}

function FraseEnfrentada({ titulo, f, detalle }) {
  const marca = 'rounded bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] px-0.5 text-fg'
  const parte = f.frase ? null : parteRelevante(f.texto, detalle ?? '', 260)
  return (
    <blockquote className="rounded-lg bg-card p-2.5 text-[.8rem] leading-relaxed">
      <p className="mb-1 text-[.72rem] font-medium text-muted">{titulo} · {f.etiqueta}</p>
      {f.traduccion ? (
        <>
          <p>“<span className={marca}>{f.traduccion}</span>”</p>
          <p className="mt-1 text-[.72rem] text-muted">Traducido del inglés. Original: “{f.frase}”</p>
        </>
      ) : f.frase ? (
        <p>“<span className={marca}>{f.frase}</span>”</p>
      ) : (
        <p>“{parte.antes && '… '}<span className={parte.resaltar ? marca : ''}>{parte.elegida}</span>{parte.despues && ' …'}”
          {enIngles(parte.elegida) && <span className="mt-1 block text-[.72rem] text-muted">El original está en inglés.</span>}</p>
      )}
    </blockquote>
  )
}

const Burbuja = ({ quien, children }) => (
  <div className={`max-w-[94%] rounded-2xl px-4 py-3 text-[.92rem] leading-relaxed ${quien === 'yo' ? 'justify-self-end bg-[color-mix(in_srgb,var(--blue)_10%,var(--bg-card))]' : 'border border-line bg-[color-mix(in_srgb,var(--bg-elev)_45%,var(--bg-card))]'}`}>
    {children}
  </div>
)

// ---------------- Lección guiada (CA2): un solo chat por tema ----------------

const nuevoId = () => crypto.randomUUID?.() ?? String(Math.random())

// Pedidos que el chat entiende sin consultar al modelo: tarjetas, cuestionario, definición, resumen, repaso y
// evaluación. Se reconocen por palabras clave y el concepto, por las raíces de su nombre y sinónimos frecuentes.
// Lo que no se reconoce como pedido se responde como una consulta libre.
const SINONIMOS = [
  [/\b(bucle|ciclo|while|for|repeti|iteraci|vuelta)/, ['bucle', 'repet']],
  [/\b(if|else|elif|condicional|decisi)/, ['condi']],
  [/\b(variable|tipo|int|float|str|bool)/, ['varia', 'tipos']],
  [/\b(operador|expresi|aritmet|logic|comparaci)/, ['opera', 'expre']],
  [/\b(corte|termin|infinit|salida)/, ['corte']],
  [/\b(arreglo|array|vector|lista|indice)/, ['arreg', 'indic']],
  [/\b(pila|stack|lifo|apilar)/, ['pila']],
  [/\b(cola|queue|fifo|encolar)/, ['cola']],
  [/\b(insert|elimin|push|pop|agregar|sacar)/, ['inser', 'elimi']],
  [/\b(caso base|base)/, ['base']],
  [/\b(recursi|llamada)/, ['recur', 'llama']],
  [/\b(binaria|busqueda|buscar)/, ['binar', 'busqu']],
  [/\b(burbuja|ordenamiento|ordenar|intercambi)/, ['burbu', 'orden', 'inter']],
]
const GENERICAS = new Set(['estru', 'datos', 'tema', 'conce', 'sobre', 'armam', 'quier', 'gener', 'hacem', 'dame'])

function conceptosMencionados(texto, conceptos) {
  const t = sinTildes(texto)
  const buscadas = new Set([...raices(t)].filter((r) => !GENERICAS.has(r)))
  SINONIMOS.forEach(([re, rs]) => { if (re.test(t)) rs.forEach((r) => buscadas.add(r)) })
  const puntajes = conceptos.map((c) => [...raices(c)].filter((r) => !GENERICAS.has(r) && buscadas.has(r)).length)
  const max = Math.max(0, ...puntajes)
  return max ? conceptos.filter((_, i) => puntajes[i] === max) : []
}

function interpretar(texto, conceptos) {
  const t = sinTildes(texto).trim()
  if (t.length > 90) return null
  const todoElTema = /\b(todo|todos|tema|completo|general)\b/.test(t)
  const mencionados = todoElTema ? [] : conceptosMencionados(t, conceptos)
  if (/\brendir\b|\bevaluacion\b/.test(t) && /\b(rendir|quiero|hacer|empezar)\b/.test(t)) return { accion: 'evaluar' }
  if (/resum/.test(t)) return { accion: 'resumen' }
  if (/repas/.test(t) && /(fall|error|equivoc)/.test(t)) return { accion: 'repeticion' }
  const modo = /tarjet|flashcard|ficha/.test(t) ? 'tarjetas' : /cuestionari|\bquiz\b|\btest\b|preguntas de (practica|prueba)/.test(t) ? 'cuestionario' : null
  if (modo) return { accion: 'practica', modo, conceptos: mencionados, todoElTema }
  if (/repas/.test(t)) return { accion: 'repaso' }
  if (/^(defin|que significa)|\bdefini(r|me|cion)\b/.test(t)) return mencionados.length ? { accion: 'definir', concepto: mencionados[0] } : null
  return null
}

// Estado del chat del tema. Cada concepto que se abre agrega su lección (separador, explicación con citas y pregunta
// de comprobación) a la misma conversación; las consultas, definiciones, tarjetas, cuestionarios, repasos y el
// resumen se suman al final.
function useChat(planId, onCambio) {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState('')
  const [activo, setActivo] = useState(null)
  const [irA, setIrA] = useState(null)  // id del mensaje al que hay que llevar el scroll
  const abiertos = useRef(new Set())
  const pedidoRef = useRef(null)  // lo asigna la vista: ejecuta un pedido detectado en una consulta

  useEffect(() => { setMensajes([]); setActivo(null); abiertos.current = new Set() }, [planId])

  const agregar = useCallback((msg) => {
    const id = nuevoId()
    setMensajes((ms) => [...ms, { id, ...msg }]); setIrA(id)
  }, [])

  const explicar = useCallback(async (concepto, general = false) => {
    setCargando(`Preparando la explicación de “${corto(concepto)}”…`)
    try {
      const r = await api(`/plans/${planId}/aprender/leccion`, { method: 'POST', body: { concepto, general } })
      agregar(r.insuficiente ? { tipo: 'insuficiente', concepto } : { tipo: 'explicacion', concepto, ...r })
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) } finally { setCargando('') }
  }, [planId, agregar])

  // Abrir un concepto: si su lección ya está en el chat, se vuelve a ella; si no, se agrega al final.
  const abrirConcepto = useCallback((concepto) => {
    if (!concepto) return
    setActivo(concepto)
    if (abiertos.current.has(concepto)) { setIrA(`sep-${concepto}`); return }
    abiertos.current.add(concepto)
    setMensajes((ms) => [...ms, { id: `sep-${concepto}`, tipo: 'separador', concepto }])
    explicar(concepto)
  }, [explicar])

  const responder = useCallback(async (msg, i) => {
    setMensajes((ms) => ms.map((x) => (x.id === msg.id ? { ...x, elegida: i } : x)))
    try {
      const r = await api(`/plans/${planId}/aprender/leccion/comprobacion`, { method: 'POST', body: { concepto: msg.concepto, respuesta: i } })
      setMensajes((ms) => ms.map((x) => (x.id === msg.id ? { ...x, resultado: r } : x)))
      onCambio()
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) }
  }, [planId, agregar, onCambio])

  // Consulta libre sobre el tema; con un concepto (definición puntual), la respuesta se centra en él.
  const preguntar = useCallback(async (consulta, { general = false, concepto = null, mostrar = consulta } = {}) => {
    if (!general && mostrar) agregar({ tipo: 'yo', texto: mostrar })
    setCargando('Buscando en el material…')
    let pedido = null
    try {
      const r = await api(`/plans/${planId}/aprender/consulta`, { method: 'POST', body: { consulta, general, concepto } })
      // Un pedido que la página no reconoció (por ejemplo, con una falta de ortografía): se hace con su función.
      if (r.pedido) pedido = r
      else agregar(r.insuficiente ? { tipo: 'insuficiente', consulta, conceptoConsulta: concepto } : { tipo: 'respuesta', concepto, ...r })
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) } finally { setCargando('') }
    if (pedido) pedidoRef.current?.(pedido.pedido, pedido.concepto)
  }, [planId, agregar])

  const definir = useCallback((concepto, mostrar = `Definición: ${corto(concepto)}`) => preguntar(
    `¿Qué es ${concepto}? Dame una definición breve y precisa, con un ejemplo corto.`, { concepto, mostrar }), [preguntar])

  // Tarjetas o cuestionario dentro del chat, de uno o varios conceptos.
  const practicar = useCallback((modo, conceptos, mostrar) => {
    if (mostrar) agregar({ tipo: 'yo', texto: mostrar })
    agregar({ tipo: 'practica', modo, conceptos })
  }, [agregar])

  const repasarFallado = useCallback((mostrar) => {
    if (mostrar) agregar({ tipo: 'yo', texto: mostrar })
    agregar({ tipo: 'repeticion' })
  }, [agregar])

  // Repaso del tema: se elige tarjetas o cuestionario de los conceptos recorridos.
  const pedirRepaso = useCallback((mostrar) => {
    if (mostrar) agregar({ tipo: 'yo', texto: mostrar })
    agregar({ tipo: 'elegir', titulo: 'Practicar todo el tema', todoElTema: true })
  }, [agregar])

  const resumir = useCallback(async (mostrar = 'Resumen del tema') => {
    if (mostrar) agregar({ tipo: 'yo', texto: mostrar })
    setCargando('Armando el resumen del tema…')
    try {
      const r = await api(`/plans/${planId}/aprender/resumen`, { method: 'POST' })
      agregar({ tipo: 'resumen', ...r })
    } catch (e) { agregar({ tipo: 'error', texto: e.message }) } finally { setCargando('') }
  }, [planId, agregar])

  return { mensajes, cargando, activo, irA, agregar, abrirConcepto, explicar, responder, preguntar, definir, practicar,
    repasarFallado, pedirRepaso, resumir, pedidoRef }
}

// Brity, el ayudante de Practicar, sugiere en Aprender el próximo paso según lo hecho (reglas, sin el modelo):
// repasar lo fallado, practicar el concepto recién explicado, el resumen o la evaluación, o seguir con el plan.
function sugerencia(estado, chat, acciones) {
  if (!estado.generacion_disponible) return null
  if (chat.cargando) return { clave: 'pensando', estado: 'pensando', texto: 'Estoy buscando en el material…', fija: true }
  const ms = chat.mensajes
  const pendiente = (tipo) => ms.findLastIndex((x) => x.tipo === tipo)
  if (estado.repeticion > 0 && (pendiente('repeticion') < 0 || pendiente('repeticion') < pendiente('practica'))) {
    return { clave: `rep-${estado.repeticion}`, texto: `Tenés ${estado.repeticion} ${estado.repeticion === 1 ? 'tarjeta o pregunta' : 'tarjetas o preguntas'} para repasar. ¿Las vemos?`,
      botones: [['Repasar lo que fallé', () => chat.repasarFallado()]] }
  }
  const i = ms.findLastIndex((x) => x.tipo === 'explicacion' && x.resultado)
  if (i >= 0 && !ms.slice(i).some((x) => x.tipo === 'practica' && x.conceptos.includes(ms[i].concepto))) {
    const c = ms[i].concepto
    return { clave: `fijar-${c}`, texto: `¿Te armo tarjetas de ${corto(c)} para fijarlo?`,
      botones: [['Tarjetas', () => chat.practicar('tarjetas', [c])], ['Cuestionario', () => chat.practicar('cuestionario', [c])]] }
  }
  if (estado.aprobado) return { clave: 'aprobado', texto: '¡Aprobaste Aprender! Ya podés pasar a Practicar.', enlace: ['Ir a Practicar', '/app/practicar'] }
  const ult = estado.ultima_evaluacion
  if (ult) {
    return { clave: `desaprobada-${ult.porcentaje}-${ult.puntaje}`, estado: 'mirando',
      texto: `En la última evaluación sacaste ${fmt(ult.porcentaje)} % y se aprueba con ${estado.aprobacion} %. Practicá el tema y volvé a rendirla cuando quieras.`,
      botones: [['Practicar todo el tema', () => chat.pedirRepaso()], ['Rendir de nuevo', acciones.evaluar]] }
  }
  if (estado.todos_recorridos) {
    return pendiente('resumen') < 0
      ? { clave: 'resumen', texto: 'Recorriste todo el tema. ¿Te hago un resumen antes de rendir la evaluación?',
          botones: [['Resumen del tema', () => chat.resumir()], ['Rendir evaluación', acciones.evaluar]] }
      : { clave: 'rendir', texto: '¿Rendimos la evaluación?', botones: [['Rendir evaluación', acciones.evaluar]] }
  }
  const proximo = estado.conceptos.find((c) => !c.recorrido && c.nombre !== chat.activo)
  if (proximo && ms.some((x) => x.tipo === 'explicacion' && x.resultado)) {
    return { clave: `seguir-${proximo.nombre}`, texto: `¿Seguimos con ${corto(proximo.nombre)}?`, botones: [['Seguir', () => chat.abrirConcepto(proximo.nombre)]] }
  }
  const leccion = ms.findLast((x) => x.tipo === 'explicacion' && !x.resultado)
  if (leccion) {
    return { clave: `leer-${leccion.concepto}`, estado: 'mirando',
      texto: 'Leé la explicación y respondé la pregunta de comprobación. Si algo no te cierra, preguntame abajo.' }
  }
  return { clave: 'consejo', texto: 'Podés escribirme pedidos como «tarjetas de bucles», «cuestionario del tema», «definí variables» o «resumen».' }
}

function Brity({ s }) {
  const [cerradas, setCerradas] = useState(() => new Set())
  if (!s || cerradas.has(s.clave)) return null
  return (
    <div key={s.clave} className="rise flex items-center gap-3 border-t border-line bg-[color-mix(in_srgb,#C9B8FF_10%,var(--bg-card))] px-5 py-2" role="status" aria-live="polite">
      <span className="w-11 flex-none [&_.as-neurona]:!w-11" aria-hidden="true"><Cerebrito estado={s.estado ?? 'espera'} /></span>
      <p className="min-w-0 flex-1 text-[.85rem]"><b className="font-medium">Brity:</b> {s.texto}</p>
      <div className="flex flex-none flex-wrap gap-1.5">
        {s.botones?.map(([t, fn]) => <button key={t} type="button" className="btn btn-soft btn-sm" onClick={fn}>{t}</button>)}
        {s.enlace && <Link to={s.enlace[1]} className="btn btn-primary btn-sm">{s.enlace[0]} →</Link>}
        {!s.fija && <button type="button" aria-label="Cerrar la sugerencia" className="cursor-pointer px-1.5 text-muted hover:text-fg"
          onClick={() => setCerradas((c) => new Set(c).add(s.clave))}>×</button>}
      </div>
    </div>
  )
}

function Chat({ chat, estado, acciones, plan, onCambio }) {
  const [consulta, setConsulta] = useState('')
  const caja = useRef(null)
  const nombres = estado.conceptos.map((c) => c.nombre)
  const recorridos = estado.conceptos.filter((c) => c.recorrido).map((c) => c.nombre)
  const delTema = recorridos.length ? recorridos : nombres

  // Al llegar un mensaje (o al volver a un concepto), el chat se ubica en su comienzo: las explicaciones largas se
  // leen desde arriba.
  useEffect(() => {
    const c = caja.current
    const el = chat.irA && c?.querySelector(`[data-msg="${CSS.escape(chat.irA)}"]`)
    if (el) c.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }, [chat.irA, chat.mensajes.length])

  // Menú de definiciones puntuales: se cierra al elegir o al hacer clic afuera.
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!menu) return
    const cerrar = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menu])

  // Si se subió a releer una lección anterior, un botón lleva de vuelta al final de la conversación.
  const [arriba, setArriba] = useState(false)
  const alDesplazar = () => { const c = caja.current; setArriba(c.scrollHeight - c.scrollTop - c.clientHeight > 240) }
  const alFinal = () => caja.current?.scrollTo({ top: caja.current.scrollHeight, behavior: 'smooth' })

  const enviar = (e) => {
    e.preventDefault()
    const t = consulta.trim()
    if (t.length < 2 || chat.cargando) return
    setConsulta('')
    const p = interpretar(t, nombres)
    if (!p) return chat.preguntar(t)
    if (p.accion === 'definir') return chat.definir(p.concepto, t)
    if (p.accion === 'resumen') return chat.resumir(t)
    if (p.accion === 'repeticion') return chat.repasarFallado(t)
    if (p.accion === 'repaso') return chat.pedirRepaso(t)
    if (p.accion === 'evaluar') return acciones.evaluar()
    if (p.todoElTema) return chat.practicar(p.modo, delTema, t)
    if (p.conceptos.length) return chat.practicar(p.modo, p.conceptos, t)
    // Tarjetas o cuestionario sin decir de qué: se pregunta el concepto.
    chat.agregar({ tipo: 'yo', texto: t })
    chat.agregar({ tipo: 'elegir', titulo: p.modo === 'tarjetas' ? '¿Tarjetas de qué concepto?' : '¿Cuestionario de qué concepto?', modo: p.modo })
  }

  chat.pedidoRef.current = (pedido, concepto) => {
    if (pedido === 'resumen') return chat.resumir('')
    if (pedido === 'definicion') return concepto ? chat.definir(concepto, '') : chat.agregar({ tipo: 'error', texto: 'Decime qué concepto querés que defina.' })
    const conceptos = concepto ? [concepto] : []
    if (conceptos.length) return chat.practicar(pedido, conceptos)
    chat.agregar({ tipo: 'elegir', titulo: pedido === 'tarjetas' ? '¿Tarjetas de qué concepto?' : '¿Cuestionario de qué concepto?', modo: pedido })
  }

  const s = sugerencia(estado, chat, acciones)
  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={caja} onScroll={alDesplazar} className="relative grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-5 pt-4 pb-3 [scrollbar-width:thin]">
          {chat.mensajes.map((msg) => <div key={msg.id} data-msg={msg.id} className="grid gap-3">
            <Mensaje msg={msg} chat={chat} acciones={acciones} estado={estado} plan={plan} onCambio={onCambio} delTema={delTema} /></div>)}
          {chat.cargando && <Burbuja quien="tutor"><Synapse>{chat.cargando}</Synapse></Burbuja>}
        </div>
        {arriba && <button type="button" onClick={alFinal}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-line bg-card px-3 py-1 text-[.75rem] shadow-sm hover:border-blue">↓ Ir al final del chat</button>}
      </div>
      <Brity s={s} />
      <form className="border-t border-line px-5 py-2.5" onSubmit={enviar}>
        {/* Una sola caja: Definir y Enviar quedan adentro, como en un chat. */}
        <div className="flex items-center gap-1 rounded-full border border-line bg-card py-1 pr-1 pl-1.5 focus-within:border-blue">
          <div className="relative flex-none" ref={menuRef}>
            <button type="button" aria-expanded={menu} aria-haspopup="menu"
              className="cursor-pointer rounded-full px-2.5 py-1 text-[.78rem] text-muted transition hover:bg-elev hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!!chat.cargando || !estado.generacion_disponible} onClick={() => setMenu((x) => !x)}>Definir ▾</button>
            {menu && (
              <div role="menu" className="absolute bottom-full left-0 z-20 mb-2 grid w-72 gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-lg">
                <p className="px-2.5 pt-1 pb-1.5 text-[.72rem] text-muted">Definición breve, con un ejemplo, de:</p>
                {estado.conceptos.map((c) => (
                  <button key={c.nombre} type="button" role="menuitem" onClick={() => { setMenu(false); chat.definir(c.nombre) }}
                    className="cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-elev first-letter:uppercase">{c.nombre}</button>
                ))}
              </div>
            )}
          </div>
          <span className="h-4 w-px flex-none bg-rule" aria-hidden="true" />
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} maxLength={600} aria-label="Consulta sobre el tema"
            placeholder="Preguntá, o pedí: «tarjetas de bucles», «cuestionario del tema», «definí variables», «resumen»…"
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none" />
          <button type="submit" aria-label="Enviar" title="Enviar" disabled={!!chat.cargando || consulta.trim().length < 2}
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-full bg-fg text-bg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
          </button>
        </div>
      </form>
    </>
  )
}

// Debajo de una definición o una respuesta sobre un concepto: practicarlo ahí mismo.
function AccionesConcepto({ concepto, chat }) {
  if (!concepto) return null
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[.72rem] text-muted">Practicar {corto(concepto)}:</span>
      <button type="button" className="chip-accion" onClick={() => chat.practicar('tarjetas', [concepto])}>Tarjetas</button>
      <button type="button" className="chip-accion" onClick={() => chat.practicar('cuestionario', [concepto])}>Cuestionario</button>
    </div>
  )
}

function Mensaje({ msg, chat, acciones, estado, plan, onCambio, delTema }) {
  if (msg.tipo === 'separador') {
    const n = estado.conceptos.findIndex((c) => c.nombre === msg.concepto)
    return (
      <div className="mt-2 flex items-center gap-3 first:mt-0">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[.72rem] font-medium uppercase tracking-[.06em] text-blue">Concepto {n + 1} de {estado.conceptos.length} · <span className="normal-case tracking-normal">{msg.concepto}</span></span>
        <span className="h-px flex-1 bg-line" />
      </div>
    )
  }
  if (msg.tipo === 'yo') return <Burbuja quien="yo">{msg.texto}</Burbuja>
  if (msg.tipo === 'error') return <Burbuja quien="tutor"><span className="text-red">{msg.texto}</span></Burbuja>
  if (msg.tipo === 'insuficiente') {
    return (
      <Burbuja quien="tutor">
        No encontré suficiente material sobre {msg.concepto ? `“${msg.concepto}”` : 'tu consulta'} en las fuentes del tema.
        <div className="mt-2.5"><button type="button" className="btn btn-soft btn-sm"
          onClick={() => (msg.concepto ? chat.explicar(msg.concepto, true) : chat.preguntar(msg.consulta, { general: true, concepto: msg.conceptoConsulta }))}>
          Responder igual con conocimiento general</button></div>
        <p className="mt-1.5 text-[.72rem] text-muted">Esa respuesta va a quedar marcada como no respaldada por las fuentes del tema.</p>
      </Burbuja>
    )
  }
  if (msg.tipo === 'respuesta') {
    return (
      <Burbuja quien="tutor">
        <TextoCitado texto={msg.respuesta} citas={msg.citas} /><Citas citas={msg.citas} noRespaldada={msg.no_respaldada} />
        <AccionesConcepto concepto={msg.concepto} chat={chat} />
      </Burbuja>
    )
  }
  if (msg.tipo === 'resumen') {
    return (
      <Burbuja quien="tutor">
        <p className="mb-1.5 text-[.72rem] font-medium uppercase tracking-[.06em] text-blue">Resumen del tema</p>
        <Explicacion texto={msg.resumen} citas={msg.citas} /><Citas citas={msg.citas} />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" className="chip-accion" onClick={() => chat.practicar('cuestionario', msg.conceptos)}>Cuestionario del tema</button>
          <button type="button" className="chip-accion" onClick={acciones.evaluar}>Rendir evaluación</button>
        </div>
      </Burbuja>
    )
  }
  if (msg.tipo === 'elegir') {
    // Repaso del tema (tarjetas o cuestionario de lo recorrido) o, para un pedido sin concepto, de qué concepto.
    return (
      <Burbuja quien="tutor">
        <b className="font-medium">{msg.titulo}</b>
        {msg.todoElTema
          ? <>
              <p className="mt-1 text-sm text-muted">Tarjetas o preguntas nuevas, una por cada concepto que recorriste: {delTema.map(corto).join(' · ')}.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className="chip-accion" onClick={() => chat.practicar('tarjetas', delTema)}>Tarjetas</button>
                <button type="button" className="chip-accion" onClick={() => chat.practicar('cuestionario', delTema)}>Cuestionario</button>
              </div>
            </>
          : <div className="mt-2 flex flex-wrap gap-1.5">
              {estado.conceptos.map((c) => <button key={c.nombre} type="button" className="chip-accion first-letter:uppercase"
                onClick={() => chat.practicar(msg.modo, [c.nombre])}>{corto(c.nombre)}</button>)}
              <button type="button" className="chip-accion" onClick={() => chat.practicar(msg.modo, delTema)}>Todo el tema</button>
            </div>}
      </Burbuja>
    )
  }
  if (msg.tipo === 'practica') {
    return (
      <div className="max-w-[94%] rounded-2xl border border-line bg-card px-4 py-3">
        <Practica plan={plan} modo={msg.modo} conceptos={msg.conceptos} onCambio={onCambio}
          onCuestionario={() => chat.practicar('cuestionario', msg.conceptos)} onRepasar={() => chat.repasarFallado()} />
      </div>
    )
  }
  if (msg.tipo === 'repeticion') {
    return <div className="max-w-[94%] rounded-2xl border border-dashed border-orange/50 bg-card px-4 py-3"><Repeticion plan={plan} onCambio={onCambio} /></div>
  }
  const p = msg.pregunta
  const siguiente = acciones.nombreSiguiente(msg.concepto)
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
            return <button key={i} type="button" disabled={msg.elegida !== undefined} onClick={() => chat.responder(msg, i)}
              className={`cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-left text-sm hover:border-blue disabled:cursor-default ${tono}`}>
              {String.fromCharCode(65 + i)}) <TextoCitado texto={o} /></button>
          })}
        </div>
        {msg.resultado && (
          <div className="mt-2.5 grid gap-2.5 text-sm">
            <p className={msg.resultado.correcta ? 'text-green' : 'text-red'}>{msg.resultado.correcta ? 'Correcto.' : 'Incorrecto.'} <span className="text-fg"><TextoCitado texto={msg.resultado.porque ?? ''} /></span></p>
            <div className="flex flex-wrap gap-2">
              {siguiente
                ? <button type="button" className="btn btn-primary btn-sm !whitespace-normal text-left" onClick={() => chat.abrirConcepto(siguiente)}>Siguiente concepto: {corto(siguiente)} →</button>
                : <>
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => chat.resumir()}>Resumen del tema</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={acciones.evaluar}>Rendir la evaluación →</button>
                  </>}
            </div>
          </div>
        )}
      </Burbuja>
    </>
  )
}

// ---------------- Tarjetas y cuestionario (CA3) ----------------

// Tarjetas o cuestionario de un concepto (después de su lección) o de varios (repaso del tema): se generan al
// entrar y, al terminar, se vuelve al chat, se repasa lo fallado o se pide otra ronda.
function Practica({ plan, modo, conceptos, onCambio, onVolver, onCuestionario, onRepasar }) {
  const [items, setItems] = useState(null)
  const [i, setI] = useState(0)
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const tarjetas = modo === 'tarjetas'

  const generar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const r = await api(`/plans/${plan.id}/aprender/practica`, { method: 'POST', body: { modo, conceptos } })
      setItems(r.items); setI(0); setResultados([])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }, [plan.id, modo, conceptos])
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
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm"><b className="font-medium">{bien} de {items.length}</b> {tarjetas ? 'las sabías' : 'correctas'}.
          {falladas > 0 && ` ${falladas === 1 ? 'La que fallaste quedó' : 'Las que fallaste quedaron'} para repasar.`}</p>
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {falladas > 0 && <button type="button" className="btn btn-soft btn-sm" onClick={onRepasar}>Repasar {falladas === 1 ? 'la que fallaste' : `las ${falladas} que fallaste`}</button>}
          {tarjetas && <button type="button" className="btn btn-primary btn-sm" onClick={onCuestionario}>Seguir con el cuestionario →</button>}
          {onVolver && <button type="button" className={`btn ${tarjetas ? 'btn-soft' : 'btn-primary'} btn-sm`} onClick={onVolver}>Volver al chat</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={generar} disabled={cargando}>{cargando ? 'Generando…' : 'Otra ronda'}</button>
        </div>
      </div>
    )
  }
  const item = items[i]
  return (
    <div className="grid max-w-3xl gap-3">
      <h2 className="text-[1.05rem] font-medium">{tarjetas ? 'Tarjetas de memoria' : 'Cuestionario'} · <span className="first-letter:uppercase">{conceptos.length === 1 ? conceptos[0] : 'repaso del tema'}</span></h2>
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{tarjetas ? 'Leé la pregunta, pensá la respuesta y dala vuelta.' : 'Elegí la respuesta correcta.'}</p>
        <span className="text-xs text-muted">{i + 1} de {items.length}</span></div>
      <ItemPractica key={item.id} item={item} onListo={(ok) => { registrar(item, ok); if (i + 1 < items.length) setI(i + 1) }} />
    </div>
  )
}

// ---------------- Repetición (CA4) ----------------

// Lo fallado vuelve hasta responderlo bien: lo que se responde bien sale; lo que se falla, al final de la fila.
function Repeticion({ plan, onCambio, onVolver }) {
  const [cola, setCola] = useState(null)
  const [hechas, setHechas] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    api(`/plans/${plan.id}/aprender/repeticion`).then((r) => setCola(r.items)).catch((e) => setError(e.message))
  }, [plan.id])

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
        <p className="text-sm">{hechas ? '¡Listo! Respondiste bien todo lo que habías fallado.' : 'No tenés nada para repasar.'}</p>
        {onVolver && <button type="button" className="btn btn-primary btn-sm" onClick={onVolver}>Volver al chat</button>}
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <h2 className="text-[1.05rem] font-medium">Repasar lo fallado</h2>
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
    // Sin la evaluación anterior en pantalla mientras se arma la nueva: si no, se podía empezar a responder las
    // preguntas viejas y, al llegar las nuevas, cambiaban de golpe.
    setCargando(true); setError(''); setResultado(null); setRespuestas({}); setEv(null)
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
