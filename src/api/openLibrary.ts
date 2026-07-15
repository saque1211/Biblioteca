import type { ApiBookResult } from '../types'

interface OpenLibraryDoc {
  key: string // ex.: "/works/OL456216W"
  title?: string
  author_name?: string[]
  first_publish_year?: number
  publisher?: string[]
  number_of_pages_median?: number
  subject?: string[]
  language?: string[]
  cover_i?: number
  isbn?: string[]
}

const SEARCH_FIELDS =
  'key,title,author_name,first_publish_year,publisher,number_of_pages_median,subject,language,cover_i,isbn'

/** Códigos MARC de 3 letras usados pela Open Library → rótulo em português. */
const LANGUAGE_PT: Record<string, string> = {
  por: 'Português',
  eng: 'Inglês',
  spa: 'Espanhol',
  fre: 'Francês',
  ger: 'Alemão',
  ita: 'Italiano',
  jpn: 'Japonês',
}

/** Assuntos frequentes da Open Library → gênero em português. */
const SUBJECT_PT: Record<string, string> = {
  fiction: 'Ficção',
  'brazilian fiction': 'Ficção brasileira',
  'science fiction': 'Ficção científica',
  fantasy: 'Fantasia',
  romance: 'Romance',
  mystery: 'Mistério',
  thriller: 'Suspense',
  horror: 'Terror',
  poetry: 'Poesia',
  drama: 'Drama',
  history: 'História',
  biography: 'Biografia',
  philosophy: 'Filosofia',
  psychology: 'Psicologia',
  'self-help': 'Autoajuda',
  religion: 'Religião',
  'comics & graphic novels': 'HQ / Graphic novel',
  'juvenile fiction': 'Infantojuvenil',
  'young adult fiction': 'Jovem adulto',
  classics: 'Clássicos',
  'literary criticism': 'Crítica literária',
  adventure: 'Aventura',
}

function pickGenre(subjects?: string[]): string | undefined {
  if (!subjects || subjects.length === 0) return undefined
  for (const s of subjects) {
    const translated = SUBJECT_PT[s.toLowerCase()]
    if (translated) return translated
  }
  // Sem correspondência conhecida: usa o primeiro assunto curto (evita frases longas)
  const short = subjects.find((s) => s.length <= 30)
  return short
}

function pickLanguage(codes?: string[]): string | undefined {
  if (!codes || codes.length === 0) return undefined
  const preferred = codes.find((c) => c === 'por') ?? codes[0]
  return LANGUAGE_PT[preferred] ?? preferred
}

function toResult(doc: OpenLibraryDoc): ApiBookResult | null {
  if (!doc.title) return null
  const isbn13 = doc.isbn?.find((i) => i.length === 13)
  return {
    externalId: doc.key,
    title: doc.title,
    authors: doc.author_name ?? [],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    coverThumb: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : undefined,
    genre: pickGenre(doc.subject),
    isbn: isbn13 ?? doc.isbn?.[0],
    publisher: doc.publisher?.[0],
    publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    pageCount: doc.number_of_pages_median,
    language: pickLanguage(doc.language),
    workKey: doc.key,
  }
}

/** Busca na Open Library (https://openlibrary.org/developers/api) — gratuita, sem chave. */
export async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<ApiBookResult[]> {
  const q = query.trim()
  if (!q) return []
  const digits = q.replace(/[-\s]/g, '')
  const isIsbn = /^\d{9}[\dXx]$|^\d{13}$/.test(digits)
  const params = new URLSearchParams({ limit: '8', fields: SEARCH_FIELDS, lang: 'pt' })
  if (isIsbn) params.set('q', `isbn:${digits}`)
  else params.set('q', q)

  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal })
  if (!res.ok) throw new Error(`Open Library respondeu ${res.status}`)
  const data = await res.json()
  const docs: OpenLibraryDoc[] = data.docs ?? []
  return docs.map(toResult).filter((r): r is ApiBookResult => r !== null)
}

export interface OpenLibraryWork {
  description?: string
  genre?: string
}

/**
 * A busca da Open Library não traz sinopse; ela (e assuntos extras) vivem no
 * registro do "work". Chamada ao adicionar o livro, com falha silenciosa.
 */
export async function fetchOpenLibraryWork(workKey: string, signal?: AbortSignal): Promise<OpenLibraryWork> {
  const res = await fetch(`https://openlibrary.org${workKey}.json`, { signal })
  if (!res.ok) return {}
  const data = await res.json()
  const desc = data.description
  const description =
    typeof desc === 'string' ? desc : typeof desc?.value === 'string' ? desc.value : undefined
  const subjects: string[] | undefined = Array.isArray(data.subjects) ? data.subjects : undefined
  return { description, genre: pickGenre(subjects) }
}

export async function fetchOpenLibraryDescription(workKey: string, signal?: AbortSignal): Promise<string | undefined> {
  return (await fetchOpenLibraryWork(workKey, signal)).description
}
