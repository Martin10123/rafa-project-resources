import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Horario, Perfil, Registro, Sala, TipoCierre } from '../types'

export interface OpenRegistroRow {
  id: string
  usuario_id: string
  motivo: string
  entrada: string
  nombre: string | null
  email: string
}

export interface SalaEstado extends Sala {
  openRegistros: OpenRegistroRow[]
}

export interface HistorialRow extends Registro {
  sala_nombre: string
  usuario_email: string
  usuario_nombre: string | null
}

export interface AuditoriaRow {
  id: string
  ocurrido_en: string
  actor_id: string | null
  accion: string
  entidad: string
  entidad_id: string | null
  detalle: Record<string, unknown> | null
}

const DIA_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

export function diaSemanaLabel(dia: number): string {
  return DIA_LABELS[dia] ?? String(dia)
}

export function salaCheckinUrl(salaId: string, tokenQr: string): string {
  const base = String(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://ejemplo.local'
  return `${origin}${base}/sala/${salaId}?t=${encodeURIComponent(tokenQr)}`
}

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

const MOCK_SALA_1 = '11111111-1111-1111-1111-111111111101'
const MOCK_SALA_2 = '11111111-1111-1111-1111-111111111102'
const MOCK_USER_1 = '22222222-2222-2222-2222-222222222201'
const MOCK_USER_2 = '22222222-2222-2222-2222-222222222202'

function createMockState() {
  const salas: Sala[] = [
    {
      id: MOCK_SALA_1,
      nombre: 'Sala Sistemas A',
      ubicacion: 'Bloque 2 — Piso 3',
      token_qr: 'demo-token-sala-a',
      activa: true,
    },
    {
      id: MOCK_SALA_2,
      nombre: 'Sala Sistemas B',
      ubicacion: 'Bloque 2 — Piso 3',
      token_qr: 'demo-token-sala-b',
      activa: true,
    },
  ]
  const perfiles: Perfil[] = [
    {
      id: MOCK_USER_1,
      email: 'estudiante1@tecnocomfenalco.edu.co',
      nombre: 'Ana García',
    },
    {
      id: MOCK_USER_2,
      email: 'estudiante2@tecnocomfenalco.edu.co',
      nombre: 'Luis Pérez',
    },
  ]
  const horarios: Horario[] = [
    {
      id: '33333333-3333-3333-3333-333333333301',
      sala_id: MOCK_SALA_1,
      dia_semana: 1,
      hora_inicio: '08:00:00',
      hora_fin: '12:00:00',
    },
    {
      id: '33333333-3333-3333-3333-333333333302',
      sala_id: MOCK_SALA_1,
      dia_semana: 3,
      hora_inicio: '14:00:00',
      hora_fin: '18:00:00',
    },
  ]
  const now = new Date()
  const entrada = new Date(now.getTime() - 45 * 60 * 1000).toISOString()
  const registros: Registro[] = [
    {
      id: '44444444-4444-4444-4444-444444444401',
      sala_id: MOCK_SALA_2,
      usuario_id: MOCK_USER_1,
      motivo: 'Práctica de bases de datos',
      entrada,
      salida: null,
      tipo_cierre: null,
      cerrado_por: null,
    },
    {
      id: '44444444-4444-4444-4444-444444444402',
      sala_id: MOCK_SALA_1,
      usuario_id: MOCK_USER_2,
      motivo: 'Proyecto integrador',
      entrada: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      salida: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      tipo_cierre: 'usuario',
      cerrado_por: MOCK_USER_2,
    },
  ]
  const auditoria: AuditoriaRow[] = [
    {
      id: '55555555-5555-5555-5555-555555555501',
      ocurrido_en: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      actor_id: null,
      accion: 'rotacion_token',
      entidad: 'salas',
      entidad_id: MOCK_SALA_1,
      detalle: { sala: 'Sala Sistemas A' },
    },
  ]
  let margenGracia = 15
  return { salas, perfiles, horarios, registros, auditoria, margenGracia }
}

let mock = createMockState()

function perfilMap(perfiles: Perfil[]): Map<string, Perfil> {
  return new Map(perfiles.map((p) => [p.id, p]))
}

function buildSalaEstado(salas: Sala[], registros: Registro[], perfiles: Perfil[]): SalaEstado[] {
  const pm = perfilMap(perfiles)
  return salas.map((sala) => {
    const open = registros
      .filter((r) => r.sala_id === sala.id && r.salida === null)
      .map((r) => {
        const p = pm.get(r.usuario_id)
        return {
          id: r.id,
          usuario_id: r.usuario_id,
          motivo: r.motivo,
          entrada: r.entrada,
          nombre: p?.nombre ?? null,
          email: p?.email ?? '—',
        }
      })
    return { ...sala, openRegistros: open }
  })
}

function buildHistorialRows(
  registros: Registro[],
  salas: Sala[],
  perfiles: Perfil[],
): HistorialRow[] {
  const sm = new Map(salas.map((s) => [s.id, s.nombre]))
  const pm = perfilMap(perfiles)
  return registros
    .map((r) => {
      const p = pm.get(r.usuario_id)
      return {
        ...r,
        sala_nombre: sm.get(r.sala_id) ?? '—',
        usuario_email: p?.email ?? '—',
        usuario_nombre: p?.nombre ?? null,
      }
    })
    .sort((a, b) => b.entrada.localeCompare(a.entrada))
}

export const useAdminStore = defineStore('admin', () => {
  const demoMode = computed(() => !isSupabaseConfigured)
  const loading = ref(false)
  const dashboardSalas = ref<SalaEstado[]>([])
  const historialRows = ref<HistorialRow[]>([])
  const salasList = ref<Sala[]>([])
  const horariosList = ref<Horario[]>([])
  const perfilesList = ref<Perfil[]>([])
  const margenGraciaMinutos = ref(15)
  const auditoriaRows = ref<AuditoriaRow[]>([])

  async function fetchDashboard() {
    loading.value = true
    try {
      if (demoMode.value) {
        dashboardSalas.value = buildSalaEstado(mock.salas, mock.registros, mock.perfiles)
        return
      }
      const client = supabase!
      const [{ data: salas, error: e1 }, { data: abiertos, error: e2 }] = await Promise.all([
        client.from('salas').select('*').order('nombre'),
        client
          .from('registros')
          .select('id, sala_id, usuario_id, motivo, entrada, perfiles(nombre, email)')
          .is('salida', null),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const openBySala = new Map<string, OpenRegistroRow[]>()
      for (const row of abiertos ?? []) {
        const perfil = row.perfiles as unknown as { nombre: string | null; email: string } | null
        const list = openBySala.get(row.sala_id) ?? []
        list.push({
          id: row.id,
          usuario_id: row.usuario_id,
          motivo: row.motivo,
          entrada: row.entrada,
          nombre: perfil?.nombre ?? null,
          email: perfil?.email ?? '—',
        })
        openBySala.set(row.sala_id, list)
      }
      dashboardSalas.value = (salas ?? []).map((sala) => ({
        ...(sala as Sala),
        openRegistros: openBySala.get(sala.id) ?? [],
      }))
    } finally {
      loading.value = false
    }
  }

  async function closeRegistro(registroId: string) {
    const salida = new Date().toISOString()
    if (demoMode.value) {
      const r = mock.registros.find((x) => x.id === registroId)
      if (!r || r.salida) return
      r.salida = salida
      r.tipo_cierre = 'admin'
      await fetchDashboard()
      return
    }
    const { error } = await supabase!
      .from('registros')
      .update({ salida, tipo_cierre: 'admin' as TipoCierre })
      .eq('id', registroId)
      .is('salida', null)
    if (error) throw error
    await fetchDashboard()
  }

  async function closeAllInSala(salaId: string) {
    const salida = new Date().toISOString()
    if (demoMode.value) {
      for (const r of mock.registros) {
        if (r.sala_id === salaId && r.salida === null) {
          r.salida = salida
          r.tipo_cierre = 'admin'
        }
      }
      await fetchDashboard()
      return
    }
    const { error } = await supabase!
      .from('registros')
      .update({ salida, tipo_cierre: 'admin' as TipoCierre })
      .eq('sala_id', salaId)
      .is('salida', null)
    if (error) throw error
    await fetchDashboard()
  }

  async function fetchHistorial(filters: {
    desde: Date | null
    hasta: Date | null
    salaId: string | null
    usuarioQuery: string
  }) {
    loading.value = true
    try {
      if (demoMode.value) {
        let rows = buildHistorialRows(mock.registros, mock.salas, mock.perfiles)
        rows = applyHistorialFilters(rows, filters)
        historialRows.value = rows
        return
      }
      let query = supabase!
        .from('registros')
        .select('*, salas(nombre), perfiles(email, nombre)')
        .order('entrada', { ascending: false })
      if (filters.salaId) query = query.eq('sala_id', filters.salaId)
      if (filters.desde) query = query.gte('entrada', startOfDayIso(filters.desde))
      if (filters.hasta) query = query.lte('entrada', endOfDayIso(filters.hasta))
      const { data, error } = await query
      if (error) throw error
      let rows: HistorialRow[] = (data ?? []).map((row) => {
        const sala = row.salas as { nombre: string } | null
        const perfil = row.perfiles as { email: string; nombre: string | null } | null
        const { salas: _s, perfiles: _p, ...reg } = row
        return {
          ...(reg as Registro),
          sala_nombre: sala?.nombre ?? '—',
          usuario_email: perfil?.email ?? '—',
          usuario_nombre: perfil?.nombre ?? null,
        }
      })
      rows = applyHistorialFilters(rows, filters)
      historialRows.value = rows
    } finally {
      loading.value = false
    }
  }

  async function fetchSalasAndHorarios() {
    loading.value = true
    try {
      if (demoMode.value) {
        salasList.value = [...mock.salas]
        horariosList.value = [...mock.horarios]
        return
      }
      const [{ data: salas, error: e1 }, { data: horarios, error: e2 }] = await Promise.all([
        supabase!.from('salas').select('*').order('nombre'),
        supabase!.from('horarios').select('*').order('sala_id').order('dia_semana'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      salasList.value = (salas ?? []) as Sala[]
      horariosList.value = (horarios ?? []) as Horario[]
    } finally {
      loading.value = false
    }
  }

  async function saveSala(payload: {
    id?: string
    nombre: string
    ubicacion: string | null
    activa: boolean
  }) {
    if (demoMode.value) {
      if (payload.id) {
        const s = mock.salas.find((x) => x.id === payload.id)
        if (s) {
          s.nombre = payload.nombre
          s.ubicacion = payload.ubicacion
          s.activa = payload.activa
        }
      } else {
        mock.salas.push({
          id: crypto.randomUUID(),
          nombre: payload.nombre,
          ubicacion: payload.ubicacion,
          token_qr: newToken(),
          activa: payload.activa,
        })
      }
      await fetchSalasAndHorarios()
      return
    }
    if (payload.id) {
      const { error } = await supabase!
        .from('salas')
        .update({
          nombre: payload.nombre,
          ubicacion: payload.ubicacion,
          activa: payload.activa,
        })
        .eq('id', payload.id)
      if (error) throw error
    } else {
      const { error } = await supabase!.from('salas').insert({
        nombre: payload.nombre,
        ubicacion: payload.ubicacion,
        activa: payload.activa,
        token_qr: newToken(),
      })
      if (error) throw error
    }
    await fetchSalasAndHorarios()
  }

  async function rotateSalaToken(salaId: string) {
    const token = newToken()
    if (demoMode.value) {
      const s = mock.salas.find((x) => x.id === salaId)
      if (s) s.token_qr = token
      await fetchSalasAndHorarios()
      return token
    }
    const { error } = await supabase!.from('salas').update({ token_qr: token }).eq('id', salaId)
    if (error) throw error
    await fetchSalasAndHorarios()
    return token
  }

  async function saveHorario(payload: {
    id?: string
    sala_id: string
    dia_semana: number
    hora_inicio: string
    hora_fin: string
  }) {
    if (demoMode.value) {
      if (payload.id) {
        const h = mock.horarios.find((x) => x.id === payload.id)
        if (h) Object.assign(h, payload)
      } else {
        mock.horarios.push({ ...payload, id: crypto.randomUUID() })
      }
      await fetchSalasAndHorarios()
      return
    }
    if (payload.id) {
      const { id, ...rest } = payload
      const { error } = await supabase!.from('horarios').update(rest).eq('id', id)
      if (error) throw error
    } else {
      const { id: _id, ...insert } = payload
      const { error } = await supabase!.from('horarios').insert(insert)
      if (error) throw error
    }
    await fetchSalasAndHorarios()
  }

  async function deleteHorario(horarioId: string) {
    if (demoMode.value) {
      mock.horarios = mock.horarios.filter((h) => h.id !== horarioId)
      await fetchSalasAndHorarios()
      return
    }
    const { error } = await supabase!.from('horarios').delete().eq('id', horarioId)
    if (error) throw error
    await fetchSalasAndHorarios()
  }

  async function fetchConfig() {
    if (demoMode.value) {
      margenGraciaMinutos.value = mock.margenGracia
      return
    }
    const { data, error } = await supabase!
      .from('config_sistema')
      .select('valor')
      .eq('clave', 'margen_gracia_minutos')
      .maybeSingle()
    if (error) throw error
    const n = parseInt(data?.valor ?? '15', 10)
    margenGraciaMinutos.value = Number.isFinite(n) ? n : 15
  }

  async function saveMargenGracia(minutos: number) {
    if (demoMode.value) {
      mock.margenGracia = minutos
      margenGraciaMinutos.value = minutos
      return
    }
    const { error } = await supabase!
      .from('config_sistema')
      .update({ valor: String(minutos) })
      .eq('clave', 'margen_gracia_minutos')
    if (error) throw error
    margenGraciaMinutos.value = minutos
  }

  async function fetchAuditoria() {
    loading.value = true
    try {
      if (demoMode.value) {
        auditoriaRows.value = [...mock.auditoria].sort((a, b) =>
          b.ocurrido_en.localeCompare(a.ocurrido_en),
        )
        return
      }
      const { data, error } = await supabase!
        .from('auditoria')
        .select('*')
        .order('ocurrido_en', { ascending: false })
      if (error) throw error
      auditoriaRows.value = (data ?? []) as AuditoriaRow[]
    } finally {
      loading.value = false
    }
  }

  async function fetchPerfilesForFilter() {
    if (demoMode.value) {
      perfilesList.value = [...mock.perfiles]
      return
    }
    const { data, error } = await supabase!.from('perfiles').select('id, email, nombre').order('email')
    if (error) throw error
    perfilesList.value = (data ?? []) as Perfil[]
  }

  function resetMockDemo() {
    mock = createMockState()
  }

  return {
    demoMode,
    loading,
    dashboardSalas,
    historialRows,
    salasList,
    horariosList,
    perfilesList,
    margenGraciaMinutos,
    auditoriaRows,
    fetchDashboard,
    closeRegistro,
    closeAllInSala,
    fetchHistorial,
    fetchSalasAndHorarios,
    saveSala,
    rotateSalaToken,
    saveHorario,
    deleteHorario,
    fetchConfig,
    saveMargenGracia,
    fetchAuditoria,
    fetchPerfilesForFilter,
    resetMockDemo,
  }
})

function startOfDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function endOfDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

function applyHistorialFilters(
  rows: HistorialRow[],
  filters: { usuarioQuery: string; salaId: string | null },
): HistorialRow[] {
  let out = rows
  if (filters.salaId) {
    out = out.filter((r) => r.sala_id === filters.salaId)
  }
  const q = filters.usuarioQuery.trim().toLowerCase()
  if (q) {
    out = out.filter(
      (r) =>
        r.usuario_email.toLowerCase().includes(q) ||
        (r.usuario_nombre?.toLowerCase().includes(q) ?? false),
    )
  }
  return out
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatTimeHm(time: string): string {
  return time.slice(0, 5)
}
