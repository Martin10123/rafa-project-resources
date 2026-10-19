export type TipoCierre = 'usuario' | 'admin' | 'automatico'

export interface Sala {
  id: string
  nombre: string
  ubicacion: string | null
  token_qr: string
  activa: boolean
}

export interface Horario {
  id: string
  sala_id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export interface Perfil {
  id: string
  email: string
  nombre: string | null
}

export interface Registro {
  id: string
  sala_id: string
  usuario_id: string
  motivo: string
  entrada: string
  salida: string | null
  tipo_cierre: TipoCierre | null
  cerrado_por: string | null
}
