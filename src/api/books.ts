import type { ApiBookResult } from '../types'
import { searchGoogleBooks } from './googleBooks'
import { fetchOpenLibraryWork, searchOpenLibrary } from './openLibrary'
import { translateText } from './translate'

async function searchSources(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  try {
    const results = await searchGoogleBooks(query, signal)
    if (results.length > 0) return results
  } catch (err) {
    // Cancelamento do usuário (digitou de novo) não deve virar fallback
    if (err instanceof DOMException && err.name === 'AbortError') throw err
  }
  try {
    return await searchOpenLibrary(query, signal)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return []
  }
}

// Cache de buscas na sessão: a mesma consulta não bate de novo nas APIs
// (economiza a cota do Google Books e deixa a resposta instantânea).
const searchCache = new Map<string, ApiBookResult[]>()
const CACHE_LIMIT = 200

function cacheKey(query: string): string {
  return query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Busca com fallback em camadas:
 * 1. Google Books (edições PT primeiro) → 2. Open Library →
 * 3. consulta traduzida para o inglês (muitos livros só estão
 *    catalogados pelo título original) nas duas fontes de novo.
 * Resultados são guardados em cache por consulta.
 */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  const key = cacheKey(query)
  if (key) {
    const cached = searchCache.get(key)
    if (cached) return cached
  }

  const found = await searchOnce(query, signal)

  // Só guarda buscas bem-sucedidas (não cacheia "nada encontrado", que pode
  // ser um 429 temporário — assim uma nova tentativa ainda pode achar)
  if (key && found.length > 0) {
    if (searchCache.size >= CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value!)
    searchCache.set(key, found)
  }
  return found
}

async function searchOnce(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  const results = await searchSources(query, signal)
  if (results.length > 0) return results

  // Nada encontrado: tenta em inglês (ex.: "Os Últimos Jovens da Terra"
  // → "The Last Kids on Earth")
  const translated = await translateText(query, 'pt-BR', 'en')
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (!translated) return []
  return searchSources(translated, signal)
}

/**
 * Complementa em segundo plano os dados que a busca não trouxe
 * (sinopse e gênero via registro do "work" da Open Library).
 */
export async function enrichBookDetails(
  result: ApiBookResult,
): Promise<{ synopsis?: string; genre?: string }> {
  const out: { synopsis?: string; genre?: string } = {}
  if (result.synopsis) out.synopsis = result.synopsis
  if (result.genre) out.genre = result.genre

  // Registro do work da Open Library completa sinopse e gênero
  if ((!out.synopsis || !out.genre) && result.workKey) {
    try {
      const work = await fetchOpenLibraryWork(result.workKey, AbortSignal.timeout(4000))
      out.synopsis ??= work.description
      out.genre ??= work.genre
    } catch {
      // sem rede ou sem registro — segue sem
    }
  }

  // Livro do Google sem gênero: a Open Library pode ter o assunto (busca por ISBN)
  if (!out.genre && result.isbn) {
    try {
      const [match] = await searchOpenLibrary(result.isbn, AbortSignal.timeout(4000))
      out.genre = match?.genre
    } catch {
      // opcional — segue sem
    }
  }
  return out
}
