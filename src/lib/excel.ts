export type ExcelValue = string | Date | null

const NAVY = 'FF2C438F'
const ZEBRA = 'FFF3F6FB'
const LINE = 'FFD5DDEA'

export function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExcelValue[][],
  widths: number[],
): void {
  const bytes = buildXlsx(sheetName, headers, rows, widths)
  const file = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(file).set(bytes)
  const blob = new Blob([file], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: ExcelValue[][],
  widths: number[],
): Uint8Array {
  const lastCol = colName(Math.max(headers.length - 1, 0))
  const lastRow = rows.length + 1
  return zipStore([
    { name: '[Content_Types].xml', text: contentTypes() },
    { name: '_rels/.rels', text: rootRels() },
    { name: 'xl/workbook.xml', text: workbookXml(sheetName) },
    { name: 'xl/_rels/workbook.xml.rels', text: workbookRels() },
    { name: 'xl/styles.xml', text: stylesXml() },
    {
      name: 'xl/worksheets/sheet1.xml',
      text: sheetXml(headers, rows, widths, `A1:${lastCol}${lastRow}`),
    },
  ])
}

function sheetXml(headers: string[], rows: ExcelValue[][], widths: number[], ref: string): string {
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join('')
  const headerCells = headers
    .map((header, index) => `<c r="${colName(index)}1" t="inlineStr" s="1"><is><t>${xml(header)}</t></is></c>`)
    .join('')
  const body = rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2
      const zebra = rowIndex % 2 === 1
      const cells = row
        .map((value, index) => cellXml(colName(index) + excelRow, value, zebra))
        .join('')
      return `<row r="${excelRow}" ht="20" customHeight="1">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${ref}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">${headerCells}</row>
    ${body}
  </sheetData>
  <autoFilter ref="${ref}"/>
</worksheet>`
}

function cellXml(ref: string, value: ExcelValue, zebra: boolean): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `<c r="${ref}" s="${zebra ? 5 : 2}"><v>${excelSerial(value)}</v></c>`
  }
  const text = value == null ? '' : String(value)
  if (!text) return `<c r="${ref}" s="${zebra ? 4 : 3}"/>`
  return `<c r="${ref}" t="inlineStr" s="${zebra ? 4 : 3}"><is><t>${xml(text)}</t></is></c>`
}

function excelSerial(date: Date): string {
  const ms = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  )
  return ((ms - Date.UTC(1899, 11, 30)) / 86400000).toFixed(6)
}

function colName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    name = String.fromCharCode(65 + rest) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD]/g, '')
}

function contentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function workbookRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${ZEBRA}"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="${LINE}"/></left>
      <right style="thin"><color rgb="${LINE}"/></right>
      <top style="thin"><color rgb="${LINE}"/></top>
      <bottom style="thin"><color rgb="${LINE}"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`
}

function zipStore(files: { name: string; text: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const now = new Date()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.text)
    const crc = crc32(data)
    const local = localHeader(name, data, crc, now)
    locals.push(local, data)
    centrals.push(centralHeader(name, data, crc, now, offset))
    offset += local.length + data.length
  }

  const central = concat(centrals)
  const end = eocd(files.length, central.length, offset)
  return concat([...locals, central, end])
}

function localHeader(name: Uint8Array, data: Uint8Array, crc: number, when: Date): Uint8Array {
  const { time, date } = dosStamp(when)
  const header = new Uint8Array(30 + name.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, time, true)
  view.setUint16(12, date, true)
  view.setUint32(14, crc, true)
  view.setUint32(18, data.length, true)
  view.setUint32(22, data.length, true)
  view.setUint16(26, name.length, true)
  header.set(name, 30)
  return header
}

function centralHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  when: Date,
  offset: number,
): Uint8Array {
  const { time, date } = dosStamp(when)
  const header = new Uint8Array(46 + name.length)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, time, true)
  view.setUint16(14, date, true)
  view.setUint32(16, crc, true)
  view.setUint32(20, data.length, true)
  view.setUint32(24, data.length, true)
  view.setUint16(28, name.length, true)
  view.setUint32(42, offset, true)
  header.set(name, 46)
  return header
}

function eocd(count: number, centralSize: number, centralOffset: number): Uint8Array {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, count, true)
  view.setUint16(10, count, true)
  view.setUint32(12, centralSize, true)
  view.setUint32(16, centralOffset, true)
  return header
}

function dosStamp(when: Date): { time: number; date: number } {
  const year = Math.max(when.getFullYear(), 1980)
  return {
    time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  CRC_TABLE[index] = crc
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
