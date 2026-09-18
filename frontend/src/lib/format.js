export const MODULES = {
  aprender: { n: '01', label: 'Aprender', verb: 'Primero, entendé.', color: 'var(--blue)', path: '/app/aprender',
    desc: 'Explorá el tema con explicaciones y preguntas que te van guiando.' },
  practicar: { n: '02', label: 'Practicar', verb: 'Después, probalo.', color: 'var(--green)', path: '/app/practicar',
    desc: 'Resolvé ejercicios y recibí una ayuda justo cuando te trabás.' },
  consolidar: { n: '03', label: 'Consolidar', verb: 'Por último, explicalo.', color: 'var(--pink)', path: '/app/consolidar',
    desc: 'Explicáselo a un agente que aprende de vos y descubrí qué te falta reforzar.' },
}

// Alcance del prototipo: una única materia de programación (Entrega 1, objetivos específicos).
// El alumno elige el tema dentro de ella, no la materia. Cuando se confirme cuál es, se cambia solo esta constante.
export const MATERIA = 'Materia de programación'

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const LEVELS = [
  ['Nunca lo vi', 'Arrancamos desde cero, con más tiempo para comprender.'],
  ['Lo vi, pero no lo entiendo', 'Repasamos la teoría antes de pasar al código.'],
  ['Lo entiendo, pero me cuesta aplicarlo', 'Menos teoría y más ejercicios.'],
  ['Puedo resolver ejercicios', 'Vamos directo a practicar y a explicarlo con tus palabras.'],
]

// Las fechas llegan como "2026-09-21": las parseamos como fecha local, no UTC.
export const parseDay = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const fmt = (opts) => new Intl.DateTimeFormat('es-AR', opts)
export const longDate = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)
export const shortDate = (d) => fmt({ day: 'numeric', month: 'short' }).format(d).replace(/\./g, '')
export const fullDate = (d) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export function hoursLabel(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
export const kb = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
export const firstName = (name = '') => name.split(' ')[0]
