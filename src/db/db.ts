import Dexie, { type Table } from 'dexie'
import type { Book, ScheduleEntry } from '../types'

/** Converte os campos antigos loanedTo/loanDate no histórico `loans`. */
export function normalizeBook(book: Book): Book {
  if (book.loanedTo && !book.loans?.length) {
    book.loans = [
      {
        id: `legado-${book.loanedTo}-${book.loanDate ?? ''}`,
        name: book.loanedTo,
        takenAt: book.loanDate ?? book.addedAt.slice(0, 10),
      },
    ]
  }
  delete book.loanedTo
  delete book.loanDate
  return book
}

class BibliotecaDB extends Dexie {
  books!: Table<Book, number>
  schedule!: Table<ScheduleEntry, number>

  constructor() {
    super('biblioteca')
    this.version(1).stores({
      books: '++id, title, readingStatus, acquisitionCategory, favorite, addedAt, isbn',
      schedule: '++id, date, bookId',
    })
    this.version(2)
      .stores({
        books: '++id, title, readingStatus, acquisitionCategory, favorite, addedAt, isbn',
        schedule: '++id, date, bookId',
      })
      .upgrade((tx) => tx.table('books').toCollection().modify((book) => normalizeBook(book as Book)))
  }
}

export const db = new BibliotecaDB()

export type DbStatus = 'ok' | 'version-error' | 'blocked' | 'error'

/**
 * Confere se o banco abre nesta versão do app.
 * - 'blocked': outra janela/aba do app (possivelmente congelada em segundo
 *   plano no celular) segura o banco e impede a migração — a abertura fica
 *   pendurada para sempre; detectamos por tempo limite.
 * - 'version-error': versão antiga do app (em cache) com banco já migrado.
 */
export async function ensureDbOpen(timeoutMs = 4000): Promise<DbStatus> {
  const timeout = new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), timeoutMs))
  const open = db
    .open()
    .then((): DbStatus => 'ok')
    .catch((err): DbStatus =>
      err instanceof Error && err.name === 'VersionError' ? 'version-error' : 'error',
    )
  return Promise.race([open, timeout])
}

export async function addBook(book: Omit<Book, 'id'>): Promise<number> {
  return db.books.add(book as Book)
}

export async function updateBook(id: number, changes: Partial<Book>): Promise<void> {
  await db.books.update(id, changes)
}

export async function deleteBook(id: number): Promise<void> {
  await db.transaction('rw', db.books, db.schedule, async () => {
    await db.schedule.where('bookId').equals(id).delete()
    await db.books.delete(id)
  })
}

export async function scheduleBook(date: string, bookId: number): Promise<number> {
  return db.schedule.add({ date, bookId, done: false })
}

export async function unscheduleEntry(id: number): Promise<void> {
  await db.schedule.delete(id)
}

export async function toggleScheduleDone(entry: ScheduleEntry): Promise<void> {
  if (entry.id != null) await db.schedule.update(entry.id, { done: !entry.done })
}

export interface LibraryBackup {
  app: 'biblioteca'
  version: 1
  exportedAt: string
  books: Book[]
  schedule: ScheduleEntry[]
}

export async function exportLibrary(): Promise<LibraryBackup> {
  const [books, schedule] = await Promise.all([db.books.toArray(), db.schedule.toArray()])
  return { app: 'biblioteca', version: 1, exportedAt: new Date().toISOString(), books, schedule }
}

/**
 * Importa um backup substituindo a biblioteca atual.
 * IDs são preservados para manter os vínculos da agenda.
 */
export async function importLibrary(data: LibraryBackup): Promise<{ books: number; schedule: number }> {
  if (data.app !== 'biblioteca' || !Array.isArray(data.books)) {
    throw new Error('Arquivo de backup inválido')
  }
  await db.transaction('rw', db.books, db.schedule, async () => {
    await db.books.clear()
    await db.schedule.clear()
    await db.books.bulkAdd(data.books.map(normalizeBook))
    if (Array.isArray(data.schedule)) await db.schedule.bulkAdd(data.schedule)
  })
  return { books: data.books.length, schedule: data.schedule?.length ?? 0 }
}
