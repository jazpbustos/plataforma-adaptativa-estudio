export const MODULES = {
  aprender: { label: 'Aprender', color: 'var(--blue)' },
  practicar: { label: 'Practicar', color: 'var(--green)' },
  consolidar: { label: 'Consolidar', color: 'var(--pink)' },
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Las fechas llegan como "2026-09-21": las parseamos como fecha local, no UTC.
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmt = (opts) => new Intl.DateTimeFormat('es-AR', opts)
export const longDate = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)
export const shortDate = (d) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, '')

export function hoursLabel(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

export const firstName = (name = '') => name.split(' ')[0]
