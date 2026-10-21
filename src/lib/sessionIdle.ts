/** Si la app sigue cerrada más de esto, la próxima apertura pide contraseña. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000

const STORAGE_KEY = 'checkin-ultima-actividad'

export function marcarActividad(now = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    /* modo privado */
  }
}

export function limpiarActividad() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* modo privado */
  }
}

export function sesionInactiva(ultimoInicio?: string | null, now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const marcada = Number(raw)
      if (Number.isFinite(marcada)) return now - marcada > SESSION_IDLE_MS
    }
  } catch {
    /* seguir con la fecha de inicio */
  }

  if (ultimoInicio) {
    const inicio = Date.parse(ultimoInicio)
    if (Number.isFinite(inicio)) return now - inicio > SESSION_IDLE_MS
  }

  return true
}
