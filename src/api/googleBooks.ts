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
  // Subgêneros comuns de ficção (parte específica de "Fiction / …")
  fantasy: 'Fantasia',
  'science fiction': 'Ficção científica',
  romance: 'Romance',
  thrillers: 'Suspense',
  suspense: 'Suspense',
  'mystery & detective': 'Mistério',
  horror: 'Terror',
  classics: 'Clássicos',
  'action & adventure': 'Ação e aventura',
  adventure: 'Aventura',
  dystopian: 'Distopia',
  'short stories': 'Contos',
  'coming of age': 'Amadurecimento',
  historical: 'Histórico',
  war: 'Guerra',
  westerns: 'Faroeste',
  erotica: 'Erótico',
  'fairy tales, folk tales, legends & mythology': 'Contos e mitologia',
  // Não ficção
  'family & relationships': 'Família e relações',
  'health & fitness': 'Saúde',
  'sports & recreation': 'Esportes',
  nature: 'Natureza',
  pets: 'Animais de estimação',
  'crafts & hobbies': 'Artesanato e hobbies',
  'games & activities': 'Jogos',
  'political science': 'Política',
  law: 'Direito',
  medical: 'Medicina',
  mathematics: 'Matemática',
  'technology & engineering': 'Tecnologia',
  'foreign language study': 'Idiomas',
  reference: 'Referência',
  'juvenile nonfiction': 'Infantojuvenil',
  'body, mind & spirit': 'Corpo, mente e espírito',
  gardening: 'Jardinagem',
  architecture: 'Arquitetura',
  photography: 'Fotografia',
  'performing arts': 'Artes cênicas',
  'antiques & collectibles': 'Antiguidades e coleções',
  bibles: 'Bíblias',
  'literary collections': 'Coletâneas literárias',
  'language arts & disciplines': 'Linguagem',
  transportation: 'Transportes',
  'house & home': 'Casa e lar',
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
export async function searchGoogleBooks(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  const q = query.trim()
  if (!q) return []
  // Se parece um ISBN, busca direta por identificador
  const digits = q.replace(/[-\s]/g, '')
  const isIsbn = /^\d{9}[\dXx]$|^\d{13}$/.test(digits)
  const finalQuery = isIsbn ? `isbn:${digits}` : q
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(finalQuery)}&maxResults=10&printType=books`

  async function fetchItems(url: string): Promise<GoogleVolume[]> {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`Google Books respondeu ${res.status}`)
    const data = await res.json()
    return data.items ?? []
  }

  // Duas buscas em paralelo: edições em português primeiro, demais idiomas completando.
  // ISBN identifica uma edição exata, então dispensa a busca restrita a PT.
  const requests = isIsbn
    ? [fetchItems(base)]
    : [fetchItems(`${base}&langRestrict=pt`), fetchItems(base)]
  const settled = await Promise.allSettled(requests)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const items = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
  // Todas as chamadas falharam: propaga para acionar o fallback da Open Library
  if (items.length === 0 && settled.every((s) => s.status === 'rejected')) {
    throw (settled[0] as PromiseRejectedResult).reason
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
  return results.slice(0, 8)
}
