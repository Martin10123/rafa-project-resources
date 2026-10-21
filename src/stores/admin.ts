import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEMO_SEDES, isSedeUuid, loadSedes } from '../lib/sedes'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Horario, Perfil, Registro, Sala, Sede, TipoCierre } from '../types'

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
  sede_id: string | null
  sede_nombre: string
  usuario_email: string
  usuario_nombre: string | null
  cerrado_por_nombre: string | null
  cerrado_por_email: string | null
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
      sede_id: DEMO_SEDES[0].id,
    },
    {
      id: MOCK_SALA_2,
      nombre: 'Sala Sistemas B',
      ubicacion: 'Bloque 2 — Piso 3',
      token_qr: 'demo-token-sala-b',
      activa: true,
      sede_id: DEMO_SEDES[1].id,
    },
  ]
  const perfiles: Perfil[] = [
    {
      id: MOCK_USER_1,
      email: 'estudiante1@tecnocomfenalco.edu.co',
      nombre: 'Ana García',
      sede_id: DEMO_SEDES[0].id,
    },
    {
      id: MOCK_USER_2,
      email: 'estudiante2@tecnocomfenalco.edu.co',
      nombre: 'Luis Pérez',
      sede_id: DEMO_SEDES[1].id,
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
  sedes: Sede[],
): HistorialRow[] {
  const sm = new Map(salas.map((s) => [s.id, s]))
  const pm = perfilMap(perfiles)
  const sedeName = new Map(sedes.map((s) => [s.id, s.nombre]))
  return registros
    .map((r) => {
      const sala = sm.get(r.sala_id)
      const p = pm.get(r.usuario_id)
      const cerrador = r.cerrado_por ? pm.get(r.cerrado_por) : undefined
      return {
        ...r,
        sala_nombre: sala?.nombre ?? '—',
        sede_id: sala?.sede_id ?? null,
        sede_nombre: sala?.sede_id ? (sedeName.get(sala.sede_id) ?? 'Sin sede') : 'Sin sede',
        usuario_email: p?.email ?? '—',
        usuario_nombre: p?.nombre ?? null,
        cerrado_por_nombre: cerrador?.nombre ?? null,
        cerrado_por_email: cerrador?.email ?? null,
      }
    })
    .sort((a, b) => b.entrada.localeCompare(a.entrada))
}

export const useAdminStore = defineStore('admin', () => {
  const demoMode = computed(() => !isSupabaseConfigured)
  const loading = ref(false)
  const dashboardSalas = ref<SalaEstado[]>([])
  const historialRows = ref<HistorialRow[]>([])
  const historialTotal = ref(0)
  const historialMs = ref<number | null>(null)
  const salasList = ref<Sala[]>([])
  const sedesList = ref<Sede[]>([])
  const horariosList = ref<Horario[]>([])
  const perfilesList = ref<Perfil[]>([])
  const margenGraciaMinutos = ref(15)
  const auditoriaRows = ref<AuditoriaRow[]>([])
  const auditoriaTotal = ref(0)
  const auditoriaMs = ref<number | null>(null)

  const CACHE_TTL_MS = 3 * 60 * 1000
  const fetchedAt = {
    dashboard: 0,
    salas: 0,
    config: 0,
    auditoria: 0,
    perfiles: 0,
  }
  let historialSourceKey = ''
  let historialFetchedAt = 0
  let auditoriaKey = ''

  function cacheFresh(at: number) {
    return at > 0 && Date.now() - at < CACHE_TTL_MS
  }

  function invalidateDerived() {
    historialFetchedAt = 0
    historialSourceKey = ''
    auditoriaKey = ''
    fetchedAt.auditoria = 0
    fetchedAt.dashboard = 0
  }

  function historialQueryKey(
    filters: {
      desde: Date | null
      hasta: Date | null
      salaId: string | null
      sedeId: string | null
      usuarioQuery: string
    },
    page: { first: number; rows: number },
  ) {
    return JSON.stringify({
      desde: filters.desde ? startOfDayIso(filters.desde) : null,
      hasta: filters.hasta ? endOfDayIso(filters.hasta) : null,
      salaId: filters.salaId,
      sedeId: filters.sedeId,
      usuario: filters.usuarioQuery.trim().toLowerCase(),
      first: page.first,
      rows: page.rows,
    })
  }

  let occupancyChannel: RealtimeChannel | null = null
  let occupancyTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleOccupancyRefresh() {
    if (occupancyTimer) clearTimeout(occupancyTimer)
    occupancyTimer = setTimeout(() => {
      occupancyTimer = null
      historialFetchedAt = 0
      void fetchDashboard({ silent: true })
    }, 200)
  }

  function startOccupancyWatch() {
    if (!supabase || occupancyChannel) return
    occupancyChannel = supabase
      .channel('admin-registros-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registros' },
        () => {
          scheduleOccupancyRefresh()
        },
      )
      .subscribe()
  }

  function stopOccupancyWatch() {
    if (occupancyTimer) clearTimeout(occupancyTimer)
    occupancyTimer = null
    if (occupancyChannel && supabase) {
      void supabase.removeChannel(occupancyChannel)
      occupancyChannel = null
    }
  }

  async function fetchDashboard(options?: { silent?: boolean }) {
    if (!options?.silent) loading.value = true
    try {
      if (demoMode.value) {
        dashboardSalas.value = buildSalaEstado(mock.salas, mock.registros, mock.perfiles)
        fetchedAt.dashboard = Date.now()
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
      fetchedAt.dashboard = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function closeRegistro(registroId: string) {
    invalidateDerived()
    const salida = new Date().toISOString()
    if (demoMode.value) {
      const r = mock.registros.find((x) => x.id === registroId)
      if (!r || r.salida) return
      r.salida = salida
      r.tipo_cierre = 'admin'
      await fetchDashboard({ silent: true })
      return
    }
    const { error } = await supabase!
      .from('registros')
      .update({ salida, tipo_cierre: 'admin' as TipoCierre })
      .eq('id', registroId)
      .is('salida', null)
    if (error) throw error
    await fetchDashboard({ silent: true })
  }

  async function closeAllInSala(salaId: string) {
    invalidateDerived()
    const salida = new Date().toISOString()
    if (demoMode.value) {
      for (const r of mock.registros) {
        if (r.sala_id === salaId && r.salida === null) {
          r.salida = salida
          r.tipo_cierre = 'admin'
        }
      }
      await fetchDashboard({ silent: true })
      return
    }
    const { error } = await supabase!
      .from('registros')
      .update({ salida, tipo_cierre: 'admin' as TipoCierre })
      .eq('sala_id', salaId)
      .is('salida', null)
    if (error) throw error
    await fetchDashboard({ silent: true })
  }

  async function fetchHistorial(
    filters: HistorialFiltros,
    page: { first: number; rows: number },
    options?: { force?: boolean },
  ) {
    const key = historialQueryKey(filters, page)
    if (!options?.force && key === historialSourceKey && cacheFresh(historialFetchedAt)) return

    const started = performance.now()
    loading.value = true
    try {
      if (demoMode.value) {
        const all = applyHistorialFilters(
          buildHistorialRows(
            mock.registros,
            mock.salas,
            mock.perfiles,
            sedesList.value.length ? sedesList.value : DEMO_SEDES,
          ),
          filters,
        )
        historialTotal.value = all.length
        historialRows.value = all.slice(page.first, page.first + page.rows)
      } else {
        const pageRows = await consultarHistorial(filters, page.first, page.first + page.rows - 1)
        historialTotal.value = pageRows.total
        historialRows.value = pageRows.rows
      }
      historialMs.value = Math.round(performance.now() - started)
      historialSourceKey = key
      historialFetchedAt = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function fetchHistorialTodos(filters: HistorialFiltros): Promise<{ rows: HistorialRow[]; total: number }> {
    if (demoMode.value) {
      const rows = applyHistorialFilters(
        buildHistorialRows(
          mock.registros,
          mock.salas,
          mock.perfiles,
          sedesList.value.length ? sedesList.value : DEMO_SEDES,
        ),
        filters,
      )
      return { rows, total: rows.length }
    }

    const pageSize = 200
    const rows: HistorialRow[] = []
    let total = 0
    for (let from = 0; from < 5000; from += pageSize) {
      const page = await consultarHistorial(filters, from, from + pageSize - 1)
      total = page.total
      rows.push(...page.rows)
      if (rows.length >= total || page.rows.length < pageSize) break
    }
    return { rows, total }
  }

  async function salasMinimas(): Promise<Pick<Sala, 'id' | 'nombre' | 'sede_id'>[]> {
    if (salasList.value.length) {
      return salasList.value.map((s) => ({ id: s.id, nombre: s.nombre, sede_id: s.sede_id }))
    }
    const { data, error } = await supabase!.from('salas').select('id, nombre, sede_id')
    if (error) throw error
    return (data ?? []) as Pick<Sala, 'id' | 'nombre' | 'sede_id'>[]
  }

  async function consultarHistorial(
    filters: HistorialFiltros,
    from: number,
    to: number,
  ): Promise<{ rows: HistorialRow[]; total: number }> {
    const salas = await salasMinimas()
    let allowed = salas
    if (isSedeUuid(filters.sedeId)) allowed = salas.filter((s) => s.sede_id === filters.sedeId)
    else if (filters.sedeId === 'none') allowed = salas.filter((s) => !s.sede_id)

    if (filters.sedeId && filters.sedeId !== 'all' && allowed.length === 0) {
      return { rows: [], total: 0 }
    }

    const salaById = new Map(allowed.map((s) => [s.id, s]))
    const usuarioOr = filtroUsuarioOr(filters.usuarioQuery)
    const embed = usuarioOr ? 'perfiles!inner(email, nombre)' : 'perfiles(email, nombre)'
    let query = supabase!
      .from('registros')
      .select(
        `id, sala_id, usuario_id, motivo, entrada, salida, tipo_cierre, cerrado_por, ${embed}`,
        { count: 'exact' },
      )
      .order('entrada', { ascending: false })

    if (filters.sedeId && filters.sedeId !== 'all') {
      query = query.in(
        'sala_id',
        allowed.map((s) => s.id),
      )
    }
    if (filters.salaId) query = query.eq('sala_id', filters.salaId)
    if (filters.desde) query = query.gte('entrada', startOfDayIso(filters.desde))
    if (filters.hasta) query = query.lte('entrada', endOfDayIso(filters.hasta))
    if (usuarioOr) query = query.or(usuarioOr, { referencedTable: 'perfiles' })

    const { data, error, count } = await query.range(from, Math.max(from, to))
    if (error) throw error

    const filas = (data ?? []) as FilaRegistro[]
    const cerradorIds = [
      ...new Set(filas.map((row) => row.cerrado_por).filter((id): id is string => Boolean(id))),
    ]
    const perfilById = new Map<string, { email: string; nombre: string | null }>()
    if (cerradorIds.length) {
      const { data: perfiles, error: perfilesError } = await supabase!
        .from('perfiles')
        .select('id, email, nombre')
        .in('id', cerradorIds)
      if (perfilesError) throw perfilesError
      for (const perfil of perfiles ?? []) {
        perfilById.set(perfil.id as string, {
          email: perfil.email as string,
          nombre: (perfil.nombre as string | null) ?? null,
        })
      }
    }

    const sedeName = new Map(sedesList.value.map((s) => [s.id, s.nombre]))
    const rows = filas.map((row) => {
      const perfil = perfilEmbebido(row.perfiles)
      const sala = salaById.get(row.sala_id)
      const cerrador = row.cerrado_por ? perfilById.get(row.cerrado_por) : undefined
      return {
        id: row.id,
        sala_id: row.sala_id,
        usuario_id: row.usuario_id,
        motivo: row.motivo,
        entrada: row.entrada,
        salida: row.salida,
        tipo_cierre: row.tipo_cierre,
        cerrado_por: row.cerrado_por,
        sala_nombre: sala?.nombre ?? '—',
        sede_id: sala?.sede_id ?? null,
        sede_nombre: sala?.sede_id ? (sedeName.get(sala.sede_id) ?? 'Sin sede') : 'Sin sede',
        usuario_email: perfil?.email ?? '—',
        usuario_nombre: perfil?.nombre ?? null,
        cerrado_por_nombre: cerrador?.nombre ?? null,
        cerrado_por_email: cerrador?.email ?? null,
      }
    })
    return { rows, total: count ?? rows.length }
  }

  async function fetchSalasAndHorarios(options?: { force?: boolean }) {
    if (!options?.force && cacheFresh(fetchedAt.salas)) return
    loading.value = true
    try {
      if (demoMode.value) {
        salasList.value = [...mock.salas]
        horariosList.value = [...mock.horarios]
        fetchedAt.salas = Date.now()
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
      fetchedAt.salas = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function saveSala(payload: {
    id?: string
    nombre: string
    ubicacion: string | null
    activa: boolean
    sedeId: string
  }) {
    invalidateDerived()
    fetchedAt.salas = 0
    if (demoMode.value) {
      if (payload.id) {
        const s = mock.salas.find((x) => x.id === payload.id)
        if (s) {
          s.nombre = payload.nombre
          s.ubicacion = payload.ubicacion
          s.activa = payload.activa
          s.sede_id = payload.sedeId
        }
      } else {
        mock.salas.push({
          id: crypto.randomUUID(),
          nombre: payload.nombre,
          ubicacion: payload.ubicacion,
          token_qr: newToken(),
          activa: payload.activa,
          sede_id: payload.sedeId,
        })
      }
      await fetchSalasAndHorarios({ force: true })
      return
    }
    if (payload.id) {
      const { error } = await supabase!
        .from('salas')
        .update({
          nombre: payload.nombre,
          ubicacion: payload.ubicacion,
          activa: payload.activa,
          sede_id: payload.sedeId,
        })
        .eq('id', payload.id)
      if (error) throw error
    } else {
      const { error } = await supabase!.from('salas').insert({
        nombre: payload.nombre,
        ubicacion: payload.ubicacion,
        activa: payload.activa,
        sede_id: payload.sedeId,
        token_qr: newToken(),
      })
      if (error) throw error
    }
    await fetchSalasAndHorarios({ force: true })
  }

  async function rotateSalaToken(salaId: string) {
    invalidateDerived()
    fetchedAt.salas = 0
    const token = newToken()
    if (demoMode.value) {
      const s = mock.salas.find((x) => x.id === salaId)
      if (s) s.token_qr = token
      await fetchSalasAndHorarios({ force: true })
      return token
    }
    const { error } = await supabase!.from('salas').update({ token_qr: token }).eq('id', salaId)
    if (error) throw error
    await fetchSalasAndHorarios({ force: true })
    return token
  }

  async function saveHorario(payload: {
    id?: string
    sala_id: string
    dia_semana: number
    hora_inicio: string
    hora_fin: string
  }) {
    invalidateDerived()
    fetchedAt.salas = 0
    if (demoMode.value) {
      if (payload.id) {
        const h = mock.horarios.find((x) => x.id === payload.id)
        if (h) Object.assign(h, payload)
      } else {
        mock.horarios.push({ ...payload, id: crypto.randomUUID() })
      }
      await fetchSalasAndHorarios({ force: true })
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
    await fetchSalasAndHorarios({ force: true })
  }

  async function guardarFranjaDias(payload: {
    salaId: string
    dias: number[]
    horaInicio: string
    horaFin: string
    replaceIds?: string[]
  }) {
    const replaceIds = payload.replaceIds ?? []
    const dias = [...new Set(payload.dias)].sort((a, b) => a - b)
    invalidateDerived()
    fetchedAt.salas = 0
    if (demoMode.value) {
      if (replaceIds.length) {
        mock.horarios = mock.horarios.filter((h) => !replaceIds.includes(h.id))
      }
      for (const dia of dias) {
        mock.horarios.push({
          id: crypto.randomUUID(),
          sala_id: payload.salaId,
          dia_semana: dia,
          hora_inicio: payload.horaInicio,
          hora_fin: payload.horaFin,
        })
      }
      await fetchSalasAndHorarios({ force: true })
      return
    }
    if (replaceIds.length) {
      const { error } = await supabase!.from('horarios').delete().in('id', replaceIds)
      if (error) throw error
    }
    if (dias.length) {
      const { error } = await supabase!.from('horarios').insert(
        dias.map((dia) => ({
          sala_id: payload.salaId,
          dia_semana: dia,
          hora_inicio: payload.horaInicio,
          hora_fin: payload.horaFin,
        })),
      )
      if (error) throw error
    }
    await fetchSalasAndHorarios({ force: true })
  }

  async function deleteHorario(horarioId: string) {
    invalidateDerived()
    fetchedAt.salas = 0
    if (demoMode.value) {
      mock.horarios = mock.horarios.filter((h) => h.id !== horarioId)
      await fetchSalasAndHorarios({ force: true })
      return
    }
    const { error } = await supabase!.from('horarios').delete().eq('id', horarioId)
    if (error) throw error
    await fetchSalasAndHorarios({ force: true })
  }

  async function fetchConfig(options?: { force?: boolean }) {
    if (!options?.force && cacheFresh(fetchedAt.config)) return
    if (demoMode.value) {
      margenGraciaMinutos.value = mock.margenGracia
      fetchedAt.config = Date.now()
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
    fetchedAt.config = Date.now()
  }

  async function saveMargenGracia(minutos: number) {
    fetchedAt.auditoria = 0
    if (demoMode.value) {
      mock.margenGracia = minutos
      margenGraciaMinutos.value = minutos
      fetchedAt.config = Date.now()
      return
    }
    const { error } = await supabase!
      .from('config_sistema')
      .update({ valor: String(minutos) })
      .eq('clave', 'margen_gracia_minutos')
    if (error) throw error
    margenGraciaMinutos.value = minutos
    fetchedAt.config = Date.now()
  }

  async function fetchAuditoria(
    page: { first: number; rows: number } = { first: 0, rows: 20 },
    options?: { force?: boolean },
  ) {
    const key = `${page.first}:${page.rows}`
    if (!options?.force && key === auditoriaKey && cacheFresh(fetchedAt.auditoria)) return

    const started = performance.now()
    loading.value = true
    try {
      if (demoMode.value) {
        const all = [...mock.auditoria].sort((a, b) => b.ocurrido_en.localeCompare(a.ocurrido_en))
        auditoriaTotal.value = all.length
        auditoriaRows.value = all.slice(page.first, page.first + page.rows)
      } else {
        const { data, error, count } = await supabase!
          .from('auditoria')
          .select('id, ocurrido_en, actor_id, accion, entidad, entidad_id, detalle', { count: 'exact' })
          .order('ocurrido_en', { ascending: false })
          .range(page.first, page.first + page.rows - 1)
        if (error) throw error
        auditoriaRows.value = (data ?? []) as AuditoriaRow[]
        auditoriaTotal.value = count ?? auditoriaRows.value.length
      }
      auditoriaMs.value = Math.round(performance.now() - started)
      auditoriaKey = key
      fetchedAt.auditoria = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function fetchPerfilesForFilter(options?: { force?: boolean }) {
    if (!options?.force && cacheFresh(fetchedAt.perfiles)) return
    if (demoMode.value) {
      perfilesList.value = [...mock.perfiles]
      fetchedAt.perfiles = Date.now()
      return
    }
    const { data, error } = await supabase!
      .from('perfiles')
      .select('id, email, nombre, sede_id')
      .order('email')
    if (error) throw error
    perfilesList.value = (data ?? []) as Perfil[]
    fetchedAt.perfiles = Date.now()
  }

  async function fetchSedes() {
    sedesList.value = await loadSedes()
  }

  function resetMockDemo() {
    mock = createMockState()
  }

  return {
    demoMode,
    loading,
    dashboardSalas,
    historialRows,
    historialTotal,
    historialMs,
    salasList,
    sedesList,
    horariosList,
    perfilesList,
    margenGraciaMinutos,
    auditoriaRows,
    auditoriaTotal,
    auditoriaMs,
    fetchDashboard,
    startOccupancyWatch,
    stopOccupancyWatch,
    closeRegistro,
    closeAllInSala,
    fetchHistorial,
    fetchHistorialTodos,
    fetchSalasAndHorarios,
    fetchSedes,
    saveSala,
    rotateSalaToken,
    saveHorario,
    guardarFranjaDias,
    deleteHorario,
    fetchConfig,
    saveMargenGracia,
    fetchAuditoria,
    fetchPerfilesForFilter,
    resetMockDemo,
  }
})

type HistorialFiltros = {
  desde: Date | null
  hasta: Date | null
  salaId: string | null
  sedeId: string | null
  usuarioQuery: string
}

type FilaRegistro = {
  id: string
  sala_id: string
  usuario_id: string
  motivo: string
  entrada: string
  salida: string | null
  tipo_cierre: TipoCierre | null
  cerrado_por: string | null
  perfiles: { email: string; nombre: string | null } | { email: string; nombre: string | null }[] | null
}

function perfilEmbebido(value: FilaRegistro['perfiles']) {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function filtroUsuarioOr(q: string): string | null {
  const clean = q.trim().replace(/[%*,()"\\]/g, '')
  if (!clean) return null
  return `email.ilike."%${clean}%",nombre.ilike."%${clean}%"`
}

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
  filters: { usuarioQuery: string; salaId: string | null; sedeId: string | null },
): HistorialRow[] {
  let out = rows
  if (isSedeUuid(filters.sedeId)) out = out.filter((r) => r.sede_id === filters.sedeId)
  else if (filters.sedeId === 'none') out = out.filter((r) => !r.sede_id)
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
