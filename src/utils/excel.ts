import { db } from '../db/db'
import type { Book } from '../types'

/**
 * Importa/exporta planilhas .xlsx no formato do app MyLibrary
 * (aba "Livros" com as colunas Título, Autores(as), Coletâneas, Categoria(s),
 * Data de publicação, Editora, Páginas, ISBN, Lido, Período de leitura,
 * Comentários, Sumário, Caminho da capa).
 * A biblioteca SheetJS é carregada sob demanda para não pesar o app.
 */

const HEADERS = [
  'Título',
  'Autores(as)',
  'Coletâneas',
  'Categoria(s)',
  'Data de publicação',
  'Editora',
  'Páginas',
  'ISBN',
  'Lido',
  'Período de leitura',
  'Comentários',
  'Sumário',
  'Caminho da capa',
] as const

function normalizeKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** "10/07/2026" → "2026-07-10"; qualquer coisa ilegível → undefined */
function brDateToISO(value: string): string | undefined {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function isoToBrDate(iso?: string): string {
  if (!iso) return '?'
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : '?'
}

function yearFrom(value: unknown): string | undefined {
  const m = String(value ?? '').match(/(\d{4})/)
  return m?.[1]
}

export interface ExcelImportSummary {
  added: number
  skipped: number
}

/**
 * Importa livros de uma planilha, SOMANDO à biblioteca atual.
 * Livros já existentes (mesmo ISBN, ou mesmo título+autor) são pulados.
 */
export async function importBooksFromXlsx(file: File): Promise<ExcelImportSummary> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })

  const existing = await db.books.toArray()
  const seenIsbn = new Set(existing.map((b) => b.isbn?.replace(/[-\s]/g, '')).filter(Boolean))
  const seenTitle = new Set(
    existing.map((b) => `${normalizeKey(b.title)}|${normalizeKey(b.authors[0] ?? '')}`),
  )

  const toAdd: Book[] = []
  let totalRows = 0
  for (const sheetName of workbook.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    })
    // Localiza a linha de cabeçalho (contém "Título")
    const headerIndex = rows.findIndex((r) => r.some((c) => normalizeKey(String(c)) === 'titulo'))
    if (headerIndex === -1) continue
    const header = rows[headerIndex].map((c) => normalizeKey(String(c)))
    const col = (name: string) => header.indexOf(normalizeKey(name))
    const cTitle = col('Título')
    const cAuthors = col('Autores(as)')
    const cCollections = col('Coletâneas')
    const cCategory = col('Categoria(s)')
    const cPubDate = col('Data de publicação')
    const cPublisher = col('Editora')
    const cPages = col('Páginas')
    const cIsbn = col('ISBN')
    const cRead = col('Lido')
    const cPeriod = col('Período de leitura')
    const cComments = col('Comentários')
    const cSummary = col('Sumário')
    const cCover = col('Caminho da capa')
    const cell = (row: unknown[], index: number) =>
      index >= 0 ? String(row[index] ?? '').trim() : ''

    for (const row of rows.slice(headerIndex + 1)) {
      const title = cell(row, cTitle)
      if (!title) continue
      totalRows++

      const isbn = cell(row, cIsbn).replace(/[-\s]/g, '') || undefined
      const authors = cell(row, cAuthors)
        .split(/\s*[/;]\s*/)
        .map((a) => a.trim())
        .filter(Boolean)
      const key = `${normalizeKey(title)}|${normalizeKey(authors[0] ?? '')}`
      if ((isbn && seenIsbn.has(isbn)) || seenTitle.has(key)) continue
      if (isbn) seenIsbn.add(isbn)
      seenTitle.add(key)

      const lido = normalizeKey(cell(row, cRead)) === 'sim'
      const [startRaw, endRaw] = cell(row, cPeriod).split('-').map((p) => p.trim())
      const readingStart = startRaw ? brDateToISO(startRaw) : undefined
      const readingEnd = endRaw ? brDateToISO(endRaw) : undefined
      const tags = cell(row, cCollections)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const coverPath = cell(row, cCover)
      const pages = cell(row, cPages).match(/\d+/)?.[0]

      toAdd.push({
        title,
        authors,
        genre: cell(row, cCategory).split(',')[0]?.trim() || undefined,
        publishedYear: yearFrom(cell(row, cPubDate)),
        publisher: cell(row, cPublisher) || undefined,
        pageCount: pages ? Number(pages) : undefined,
        isbn,
        readingStatus: lido ? 'lido' : readingStart && !readingEnd ? 'lendo' : 'nao-lido',
        readingStart,
        readingEnd,
        notes: cell(row, cComments) || undefined,
        synopsis: cell(row, cSummary) || undefined,
        // Caminhos locais de outro app não são acessíveis; só URLs valem
        coverUrl: /^https?:\/\//.test(coverPath) ? coverPath : undefined,
        tags,
        rating: 0,
        favorite: false,
        addedAt: new Date().toISOString(),
      })
    }
  }

  if (toAdd.length > 0) await db.books.bulkAdd(toAdd)
  return { added: toAdd.length, skipped: totalRows - toAdd.length }
}

/** Exporta a biblioteca em .xlsx no mesmo formato de colunas do MyLibrary. */
export async function exportBooksToXlsx(books: Book[]): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = books.map((b) => {
    const period =
      b.readingStart || b.readingEnd
        ? `${isoToBrDate(b.readingStart)} - ${isoToBrDate(b.readingEnd)}`
        : ''
    return [
      b.title,
      b.authors.join(' / '),
      b.tags.join(', '),
      b.genre ?? '',
      b.publishedYear ?? '',
      b.publisher ?? '',
      b.pageCount != null ? String(b.pageCount) : '',
      b.isbn ?? '',
      b.readingStatus === 'lido' ? 'Sim' : 'Não',
      period,
      b.notes ?? '',
      b.synopsis ?? '',
      b.coverUrl?.startsWith('http') ? b.coverUrl : '',
    ]
  })
  const sheet = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Livros')
  XLSX.writeFile(workbook, `biblioteca-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
