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
// Nivel inicial declarado por el estudiante (diccionario de datos: OBJETIVO_ESTUDIO.nivel_inicial).
export const LEVELS = {
  principiante: { label: 'Principiante', desc: 'Es la primera vez que lo veo o lo vi muy por arriba.' },
  intermedio: { label: 'Intermedio', desc: 'Conozco la teoría, pero me cuesta llevarla al código.' },
  avanzado: { label: 'Avanzado', desc: 'Resuelvo ejercicios; quiero afianzarlo y no trabarme.' },
}

// Contenidos del alcance del prototipo (Entrega 2, Alcances).
export const TOPICS = [
  { value: 'Sintaxis y estructuras de control', desc: 'Variables, condicionales y bucles' },
  { value: 'Arreglos, pilas y colas', desc: 'Estructuras de datos lineales' },
  { value: 'Recursividad', desc: 'Funciones que se llaman a sí mismas' },
  { value: 'Búsqueda y ordenamiento', desc: 'Un algoritmo de cada uno' },
]

// Lenguaje de los ejemplos y ejercicios. "material": se toma del material de la cátedra (HU-002, CA4).
export const LANGUAGES = { python: 'Python', java: 'Java', c: 'C', cpp: 'C++', javascript: 'JavaScript', material: 'El de mi material' }

// Dominio requerido según la nota objetivo (HU-002, CA2). Misma regla que el backend.
export const requiredMastery = (grade) => (grade <= 7 ? 60 : grade <= 9 ? 80 : 90)

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
