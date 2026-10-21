/** Destino tras login: admin → panel; jefa → descarga; usuario → espera QR. */
export function resolvePostLoginPath(
  isAdmin: boolean,
  isJefa: boolean,
  redirect?: string | null,
): string {
  if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  if (isAdmin) return '/admin'
  if (isJefa) return '/admin/historial'
  return '/inicio'
}
