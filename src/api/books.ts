import type { ApiBookResult } from '../types'
import { searchGoogleBooks } from './googleBooks'
import { fetchOpenLibraryDescription, searchOpenLibrary } from './openLibrary'

/**
 * Busca com fallback: tenta a Google Books primeiro (dados mais completos,
 * inclusive sinopse) e, se ela falhar ou não retornar nada, usa a Open Library.
 * As duas são gratuitas e não exigem chave de API.
 */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  try {
    const results = await searchGoogleBooks(query, signal)
    if (results.length > 0) return results
  } catch (err) {
    // Cancelamento do usuário (digitou de novo) não deve virar fallback
    if (err instanceof DOMException && err.name === 'AbortError') throw err
  }
  return searchOpenLibrary(query, signal)
}

/**
 * Resultados da Open Library chegam sem sinopse; tenta completá-la a partir
 * do registro do "work" sem bloquear a adição por mais que alguns segundos.
 */
export async function enrichSynopsis(result: ApiBookResult): Promise<string | undefined> {
  if (result.synopsis || !result.workKey) return result.synopsis
  try {
    return await fetchOpenLibraryDescription(result.workKey, AbortSignal.timeout(4000))
  } catch {
    return undefined
  }
}
