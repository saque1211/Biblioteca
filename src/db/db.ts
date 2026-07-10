import Dexie, { type Table } from 'dexie'
import type { Book, ScheduleEntry } from '../types'

class BibliotecaDB extends Dexie {
  books!: Table<Book, number>
  schedule!: Table<ScheduleEntry, number>

  constructor() {
    super('biblioteca')
    this.version(1).stores({
      books: '++id, title, readingStatus, acquisitionCategory, favorite, addedAt, isbn',
      schedule: '++id, date, bookId',
    })
  }
}

export const db = new BibliotecaDB()

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
    await db.books.bulkAdd(data.books)
    if (Array.isArray(data.schedule)) await db.schedule.bulkAdd(data.schedule)
  })
  return { books: data.books.length, schedule: data.schedule?.length ?? 0 }
}
