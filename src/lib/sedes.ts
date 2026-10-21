import { isSupabaseConfigured, supabase } from './supabase'
import type { Sede } from '../types'

export const DEMO_SEDES: Sede[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', codigo: 'A', nombre: 'Sede A' },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', codigo: 'B', nombre: 'Sede B' },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', codigo: 'C', nombre: 'Sede C' },
]

const VISTA_KEY = 'checkin-vista-sede'

export async function loadSedes(): Promise<Sede[]> {
  if (!isSupabaseConfigured || !supabase) return DEMO_SEDES
  const { data, error } = await supabase.from('sedes').select('id, codigo, nombre').order('codigo')
  if (error) throw error
  return (data ?? []) as Sede[]
}

export function readVistaSede(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(VISTA_KEY)
}

export function writeVistaSede(value: string | null) {
  if (typeof sessionStorage === 'undefined') return
  if (!value) sessionStorage.removeItem(VISTA_KEY)
  else sessionStorage.setItem(VISTA_KEY, value)
}

export function isSedeUuid(value: string | null): value is string {
  return Boolean(value && value !== 'all' && value !== 'none')
}

export function sedeNombre(sedes: Sede[], sedeId: string | null): string {
  if (!sedeId) return 'Sin sede'
  return sedes.find((sede) => sede.id === sedeId)?.nombre ?? 'Sin sede'
}

export function filtrarPorSede<T extends { sede_id: string | null }>(
  rows: T[],
  filtro: string | null,
): T[] {
  if (!filtro) return []
  if (filtro === 'all') return rows
  if (filtro === 'none') return rows.filter((row) => !row.sede_id)
  return rows.filter((row) => row.sede_id === filtro)
}
