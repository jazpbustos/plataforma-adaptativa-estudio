// Cliente mínimo para la API. `credentials: 'include'` manda la cookie de sesión.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function detailToMessage(detail) {
  if (!detail) return 'Algo salió mal. Probá de nuevo.'
  if (typeof detail === 'string') return detail
  // Errores de validación de FastAPI: [{loc, msg}, ...]
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace(/^Value error, /, '')).join(' · ')
  return 'Algo salió mal. Probá de nuevo.'
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} }
  if (form) opts.body = form
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, opts)
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está corriendo el backend?')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, detailToMessage(data?.detail))
  return data
}
