/** Destino tras login: admin → panel; usuario → espera QR (no abrir sala sin escanear). */
export function resolvePostLoginPath(
  isAdmin: boolean,
  redirect?: string | null,
): string {
  if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  if (isAdmin) return '/admin'
  return '/inicio'
}
