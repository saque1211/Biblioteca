import { searchBooks } from '../api/books'
import type { ApiBookResult } from '../types'
import { db } from '../db/db'
import type { Book } from '../types'
import { coverFromIsbn } from './isbnCover'

/**
 * Busca capas na internet para os livros que estão sem imagem — útil depois de
 * importar uma planilha (o formato MyLibrary só guarda o caminho local da capa,
 * que não é acessível, então esses livros entram sem imagem).
 *
 * Para cada livro sem capa, consulta pelo ISBN (edição exata) ou por
 * título + autor e usa a primeira capa encontrada (Google Books / Open Library).
 */

export interface CoverFetchProgress {
  done: number
  total: number
  found: number
}

/** Só aceitamos capas reais da web (não caminhos locais nem vazio). */
const REAL_COVER = /^https?:\/\/|^data:image\//

function needsCover(b: Book): boolean {
  return !b.coverUrl || !REAL_COVER.test(b.coverUrl)
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)

/**
 * Confere se o resultado é o mesmo livro, para não pegar a capa de outro livro
 * numa busca por título. Exige ao menos 2 palavras significativas em comum no
 * título (ou todas, se o título for muito curto).
 */
function sameBook(book: Book, result: ApiBookResult): boolean {
  const want = norm(book.title)
  if (want.length === 0) return true
  const have = new Set(norm(result.title))
  const common = want.filter((w) => have.has(w)).length
  return common >= Math.min(2, want.length)
}

function firstCover(results: ApiBookResult[]): string | undefined {
  return results.find((r) => r.coverUrl && REAL_COVER.test(r.coverUrl))?.coverUrl
}

/** Quantos livros estão sem capa (candidatos à busca). */
export async function countBooksWithoutCover(): Promise<number> {
  const books = await db.books.toArray()
  return books.filter(needsCover).length
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

/** Quantos livros processar ao mesmo tempo (mais rápido, sem estourar a cota). */
const CONCURRENCY = 5

/** Acha a capa de um livro: ISBN exato → Open Library por ISBN → por título. */
async function findCover(book: Book, signal?: AbortSignal): Promise<string | undefined> {
  const isbn = book.isbn?.replace(/[-\s]/g, '')
  let cover: string | undefined

  if (isbn) {
    try {
      cover = firstCover(await searchBooks(isbn, signal))
    } catch (err) {
      if (isAbort(err)) return undefined
    }
    if (!cover) cover = await coverFromIsbn(isbn)
  }

  if (!cover) {
    const titleQuery = `${book.title} ${book.authors[0] ?? ''}`.trim()
    if (titleQuery) {
      try {
        cover = firstCover((await searchBooks(titleQuery, signal)).filter((r) => sameBook(book, r)))
      } catch (err) {
        if (isAbort(err)) return undefined
      }
    }
  }
  return cover
}

/**
 * Percorre os livros SEM capa e tenta preencher a imagem — vários ao mesmo
 * tempo, para ser rápido. Livros que já têm foto são ignorados. Chama
 * `onProgress` a cada livro concluído e respeita `signal` para cancelamento.
 */
export async function fetchMissingCovers(
  onProgress: (p: CoverFetchProgress) => void,
  signal?: AbortSignal,
): Promise<CoverFetchProgress> {
  const books = (await db.books.toArray()).filter(needsCover)
  const total = books.length
  let done = 0
  let found = 0
  let next = 0

  async function worker() {
    while (!signal?.aborted) {
      const i = next++
      if (i >= books.length) return
      const book = books[i]
      const cover = await findCover(book, signal)
      if (cover && book.id != null) {
        await db.books.update(book.id, { coverUrl: cover })
        found++
      }
      done++
      onProgress({ done, total, found })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker))
  return { done, total, found }
}
