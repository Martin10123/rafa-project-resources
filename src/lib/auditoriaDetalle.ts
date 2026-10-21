export interface CampoDetalle {
  etiqueta: string
  valor: string
}

export interface SeccionDetalle {
  titulo: string
  campos: CampoDetalle[]
}

const DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const ETIQUETA: Record<string, string> = {
  nombre: 'Nombre',
  sala: 'Sala',
  antes: 'Antes',
  despues: 'Después',
  clave: 'Ajuste',
  dia_semana: 'Día',
  hora_inicio: 'Hora inicio',
  hora_fin: 'Hora fin',
  activa: 'Activa',
  ubicacion: 'Ubicación',
  salida: 'Salida',
  motivo: 'Motivo',
  tipo_cierre: 'Tipo de cierre',
  email: 'Correo',
  valor: 'Valor',
  entrada: 'Entrada',
  sede_id: 'Sede',
}

const OCULTAR = new Set([
  'id',
  'token_qr',
  'creado_en',
  'actualizado_en',
  'actualizado_por',
  'sala_id',
  'usuario_id',
  'entidad_id',
  'actor_id',
])

function etiqueta(clave: string): string {
  return ETIQUETA[clave] ?? clave.replaceAll('_', ' ')
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatearValor(clave: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (clave === 'dia_semana' && typeof value === 'number') return DIA[value] ?? String(value)
  if (clave === 'tipo_cierre' && typeof value === 'string') {
    if (value === 'usuario') return 'Usuario'
    if (value === 'admin') return 'Administrador'
    if (value === 'automatico') return 'Automático'
  }
  if (typeof value === 'string' && (clave === 'hora_inicio' || clave === 'hora_fin')) {
    return value.slice(0, 5)
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const fecha = new Date(value)
    if (!Number.isNaN(fecha.getTime())) {
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(fecha)
    }
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return '—'
}

function camposDe(objeto: Record<string, unknown>): CampoDetalle[] {
  return Object.entries(objeto)
    .filter(([clave, value]) => !OCULTAR.has(clave) && !esObjeto(value))
    .map(([clave, value]) => ({ etiqueta: etiqueta(clave), valor: formatearValor(clave, value) }))
    .filter((campo) => campo.valor !== '—')
}

export function resumenDetalle(detalle: Record<string, unknown> | null): string {
  if (!detalle) return 'Sin detalle'
  if (typeof detalle.nombre === 'string' && detalle.nombre.trim()) return detalle.nombre.trim()
  if (typeof detalle.sala === 'string' && detalle.sala.trim()) return detalle.sala.trim()
  if (typeof detalle.clave === 'string') {
    const antes = detalle.antes == null ? '—' : String(detalle.antes)
    const despues = detalle.despues == null ? '—' : String(detalle.despues)
    return `${detalle.clave}: ${antes} → ${despues}`
  }
  if (esObjeto(detalle.antes) || esObjeto(detalle.despues)) return 'Ver qué cambió'
  if (typeof detalle.salida === 'string') return `Cierre ${formatearValor('salida', detalle.salida)}`
  const campos = camposDe(detalle)
  if (!campos.length) return 'Ver detalle'
  return campos
    .slice(0, 2)
    .map((campo) => `${campo.etiqueta}: ${campo.valor}`)
    .join(' · ')
}

export function seccionesDetalle(detalle: Record<string, unknown> | null): SeccionDetalle[] {
  if (!detalle) return []
  const secciones: SeccionDetalle[] = []
  const planos = camposDe(detalle)
  if (planos.length) secciones.push({ titulo: 'Detalle', campos: planos })

  if (esObjeto(detalle.antes)) {
    const campos = camposDe(detalle.antes)
    if (campos.length) secciones.push({ titulo: 'Antes', campos })
  }
  if (esObjeto(detalle.despues)) {
    const campos = camposDe(detalle.despues)
    if (campos.length) secciones.push({ titulo: 'Después', campos })
  }

  return secciones
}
