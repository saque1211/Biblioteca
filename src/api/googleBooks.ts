import type { ApiBookResult } from '../types'

interface GoogleVolume {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    categories?: string[]
    language?: string
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: { smallThumbnail?: string; thumbnail?: string }
  }
}

/** Tradução simplificada das categorias mais comuns do Google Books. */
const GENRE_PT: Record<string, string> = {
  fiction: 'Ficção',
  'juvenile fiction': 'Infantojuvenil',
  'young adult fiction': 'Jovem adulto',
  'biography & autobiography': 'Biografia',
  history: 'História',
  'comics & graphic novels': 'HQ / Graphic novel',
  'business & economics': 'Negócios',
  'self-help': 'Autoajuda',
  religion: 'Religião',
  philosophy: 'Filosofia',
  poetry: 'Poesia',
  drama: 'Drama',
  science: 'Ciência',
  computers: 'Computação',
  psychology: 'Psicologia',
  cooking: 'Culinária',
  education: 'Educação',
  'literary criticism': 'Crítica literária',
  'social science': 'Ciências sociais',
  travel: 'Viagem',
  art: 'Arte',
  music: 'Música',
  'true crime': 'Crime real',
  humor: 'Humor',
}

function translateGenre(category?: string): string | undefined {
  if (!category) return undefined
  // Google usa "Fiction / Fantasy / Epic" — pegamos a parte mais específica
  const parts = category.split('/').map((p) => p.trim())
  const specific = parts[parts.length - 1]
  const translated = GENRE_PT[specific.toLowerCase()] ?? GENRE_PT[parts[0].toLowerCase()]
  return translated ?? specific
}

function secureUrl(url?: string): string | undefined {
  return url?.replace(/^http:\/\//, 'https://')
}

function toResult(v: GoogleVolume): ApiBookResult | null {
  const info = v.volumeInfo
  if (!info?.title) return null
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier
  return {
    externalId: v.id,
    title: info.title,
    authors: info.authors ?? [],
    coverUrl: secureUrl(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    coverThumb: secureUrl(info.imageLinks?.smallThumbnail ?? info.imageLinks?.thumbnail),
    genre: translateGenre(info.categories?.[0]),
    isbn: isbn13 ?? isbn10,
    publisher: info.publisher,
    publishedYear: info.publishedDate?.slice(0, 4),
    pageCount: info.pageCount,
    synopsis: info.description,
    language: info.language,
  }
}

/**
 * Busca livros na Google Books API (sem chave, endpoint público).
 * Aceita título, autor ou ISBN.
 */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  const q = query.trim()
  if (!q) return []
  // Se parece um ISBN, busca direta por identificador
  const digits = q.replace(/[-\s]/g, '')
  const isIsbn = /^\d{9}[\dXx]$|^\d{13}$/.test(digits)
  const finalQuery = isIsbn ? `isbn:${digits}` : q
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(finalQuery)}&maxResults=8&printType=books&langRestrict=pt`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Google Books respondeu ${res.status}`)
  const data = await res.json()
  let items: GoogleVolume[] = data.items ?? []

  // Se a busca restrita a PT não trouxe nada, tenta sem restrição de idioma
  if (items.length === 0 && !isIsbn) {
    const fallbackUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(finalQuery)}&maxResults=8&printType=books`
    const res2 = await fetch(fallbackUrl, { signal })
    if (res2.ok) {
      const data2 = await res2.json()
      items = data2.items ?? []
    }
  }

  const results: ApiBookResult[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const r = toResult(item)
    if (!r) continue
    const key = `${r.title.toLowerCase()}|${r.authors.join(',').toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(r)
  }
  return results
}
