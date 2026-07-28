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

/**
 * Percorre os livros sem capa e tenta preencher a imagem. Chama `onProgress` a
 * cada livro e respeita `signal` para cancelamento. Um pequeno atraso entre as
 * consultas evita estourar os limites das APIs gratuitas.
 */
export async function fetchMissingCovers(
  onProgress: (p: CoverFetchProgress) => void,
  signal?: AbortSignal,
): Promise<CoverFetchProgress> {
  const books = (await db.books.toArray()).filter(needsCover)
  const total = books.length
  let done = 0
  let found = 0

  const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

  for (const book of books) {
    if (signal?.aborted) break
    const isbn = book.isbn?.replace(/[-\s]/g, '')
    let cover: string | undefined
    let aborted = false

    // 1) Com ISBN: tenta a edição exata (Google) e a capa da Open Library por ISBN
    if (isbn) {
      try {
        cover = firstCover(await searchBooks(isbn, signal))
      } catch (err) {
        if (isAbort(err)) aborted = true
      }
      if (aborted) break
      if (!cover) cover = await coverFromIsbn(isbn)
    }

    // 2) Sem capa ainda: busca por título + autor (pega a capa de QUALQUER
    //    edição do mesmo livro — é a mesma capa que aparece na busca normal),
    //    conferindo que o resultado é realmente o mesmo livro
    if (!cover) {
      const titleQuery = `${book.title} ${book.authors[0] ?? ''}`.trim()
      if (titleQuery) {
        try {
          const results = (await searchBooks(titleQuery, signal)).filter((r) => sameBook(book, r))
          cover = firstCover(results)
        } catch (err) {
          if (isAbort(err)) break
        }
      }
    }

    if (cover && book.id != null) {
      await db.books.update(book.id, { coverUrl: cover })
      found++
    }
    done++
    onProgress({ done, total, found })
    // Pausa curta para respeitar os limites das APIs gratuitas.
    if (!signal?.aborted) await new Promise((r) => setTimeout(r, 250))
  }

  return { done, total, found }
}
