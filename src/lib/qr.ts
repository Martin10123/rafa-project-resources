import QRCode from 'qrcode'

export type SalaQrOptions = {
  /** URL base del sitio (p. ej. import.meta.env.VITE_APP_URL). */
  baseUrl?: string
  /** Ancho del QR en píxeles. */
  width?: number
  /** Margen blanco alrededor del código. */
  margin?: number
}

const DEFAULT_WIDTH = 320
const DEFAULT_MARGIN = 2

/** Normaliza la base URL sin barra final. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * Construye la URL pública de check-in de una sala (incluye token en query `t`).
 */
export function buildSalaCheckinUrl(
  salaId: string,
  token: string,
  baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const root = normalizeBaseUrl(baseUrl)
  const params = new URLSearchParams({ t: token })
  return `${root}/sala/${encodeURIComponent(salaId)}?${params.toString()}`
}

/**
 * Genera un data URL (PNG) listo para `<img :src="...">` o descarga.
 */
export async function generateSalaQrDataUrl(
  salaId: string,
  token: string,
  options: SalaQrOptions = {},
): Promise<string> {
  const baseUrl =
    options.baseUrl ??
    (import.meta.env.VITE_APP_URL as string | undefined) ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  const url = buildSalaCheckinUrl(salaId, token, baseUrl)

  return QRCode.toDataURL(url, {
    width: options.width ?? DEFAULT_WIDTH,
    margin: options.margin ?? DEFAULT_MARGIN,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#2c438f',
      light: '#ffffff',
    },
  })
}
