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

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] // etiquetas de la semana en Progreso
// Nivel inicial declarado por el estudiante (diccionario de datos: OBJETIVO_ESTUDIO.nivel_inicial).
export const LEVELS = {
  principiante: { label: 'Principiante', desc: 'Es la primera vez que lo veo o lo vi muy por arriba.' },
  intermedio: { label: 'Intermedio', desc: 'Conozco la teoría, pero me cuesta llevarla al código.' },
  avanzado: { label: 'Avanzado', desc: 'Resuelvo ejercicios; quiero afianzarlo y no trabarme.' },
}

// Contenidos del alcance del prototipo (Entrega 3, Alcances y Pantalla 1).
export const TOPICS = [
  { value: 'Sintaxis y estructuras de control', desc: 'Variables, condicionales y bucles' },
  { value: 'Estructuras de datos lineales', desc: 'Arreglos, pilas y colas' },
  { value: 'Recursividad', desc: 'Funciones que se llaman a sí mismas' },
  { value: 'Búsqueda y ordenamiento', desc: 'Un algoritmo de cada uno' },
]

// Lenguaje de los ejemplos y ejercicios: Java o Python, obligatorio (Alcances; HU-002, CA4).
export const LANGUAGES = { java: 'Java', python: 'Python' }

// Reglas de HU-002 (las mismas de backend/parametros.toml; el backend vuelve a validarlas).
export const DAYS_MIN = 1, DAYS_MAX = 14
// CA2: dominio requerido según la nota objetivo.
export const requiredMastery = (grade) => (grade <= 7 ? 60 : grade <= 9 ? 80 : 90)
// CA6: días mínimos que necesita cada nota, y la nota más alta que entra en una cantidad de días.
export const minDays = (grade) => (grade <= 7 ? 3 : grade <= 9 ? 4 : 5)
export const maxGradeFor = (days) => (days >= 5 ? 10 : days >= 4 ? 9 : days >= 3 ? 7 : null)

// Las fechas llegan como "2026-09-21": las parseamos como fecha local, no UTC.
export const parseDay = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const fmt = (opts) => new Intl.DateTimeFormat('es-AR', opts)
export const longDate = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)
export const shortDate = (d) => fmt({ day: 'numeric', month: 'short' }).format(d).replace(/\./g, '')
export const fullDate = (d) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export const kb = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
export const firstName = (name = '') => name.split(' ')[0]
