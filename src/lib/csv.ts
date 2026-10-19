function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map((cell) => escapeCell(cell)).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
