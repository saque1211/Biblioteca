import { searchBooks } from '../api/books'
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

  for (const book of books) {
    if (signal?.aborted) break
    const isbn = book.isbn?.replace(/[-\s]/g, '')
    const query = isbn || `${book.title} ${book.authors[0] ?? ''}`.trim()
    let cover: string | undefined
    if (query) {
      try {
        const results = await searchBooks(query, signal)
        // Com ISBN, a busca já traz a edição exata; caso contrário, pega o
        // primeiro resultado que tenha capa de verdade.
        const match = results.find((r) => r.coverUrl && REAL_COVER.test(r.coverUrl))
        cover = match?.coverUrl
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') break
        // Sem rede ou sem resultado para este livro — segue para o próximo.
      }
    }
    // 2ª fonte de capa: Open Library por ISBN (muitas edições que o Google
    // acha sem imagem têm capa aqui)
    if (!cover && isbn) cover = await coverFromIsbn(isbn)
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
