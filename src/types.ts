export type ReadingStatus = 'nao-lido' | 'lendo' | 'lido' | 'abandonado'
export type BookCondition = 'novo' | 'seminovo' | 'usado' | 'danificado'
export type BookFormat = 'capa-dura' | 'brochura' | 'ebook' | 'audiobook'
export type Origin = 'comprado' | 'presente' | 'doacao' | 'heranca' | 'sebo' | 'outro'

export interface Book {
  id?: number
  // Dados bibliográficos (vindos da API ou manuais)
  title: string
  authors: string[]
  coverUrl?: string
  genre?: string
  isbn?: string
  publisher?: string
  publishedYear?: string
  pageCount?: number
  synopsis?: string

  // Aquisição
  origin?: Origin
  acquisitionCategory?: string
  acquisitionDate?: string
  pricePaid?: number
  purchasePlace?: string

  // Leitura
  readingStatus: ReadingStatus
  rating: number
  readingStart?: string
  readingEnd?: string

  // Exemplar físico
  condition?: BookCondition
  physicalLocation?: string
  format?: BookFormat
  language?: string

  // Empréstimo
  loanedTo?: string
  loanDate?: string

  // Pessoal
  favorite: boolean
  tags: string[]
  notes?: string

  addedAt: string
}

export interface ScheduleEntry {
  id?: number
  date: string // YYYY-MM-DD
  bookId: number
  done: boolean
}

export interface ApiBookResult {
  externalId: string
  title: string
  authors: string[]
  coverUrl?: string
  coverThumb?: string
  genre?: string
  isbn?: string
  publisher?: string
  publishedYear?: string
  pageCount?: number
  synopsis?: string
  language?: string
}

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  'nao-lido': 'Não lido',
  lendo: 'Lendo',
  lido: 'Lido',
  abandonado: 'Abandonado',
}

export const CONDITION_LABELS: Record<BookCondition, string> = {
  novo: 'Novo',
  seminovo: 'Seminovo',
  usado: 'Usado',
  danificado: 'Danificado',
}

export const FORMAT_LABELS: Record<BookFormat, string> = {
  'capa-dura': 'Capa dura',
  brochura: 'Brochura',
  ebook: 'eBook',
  audiobook: 'Audiobook',
}

export const ORIGIN_LABELS: Record<Origin, string> = {
  comprado: 'Comprado',
  presente: 'Presente',
  doacao: 'Doação',
  heranca: 'Herança',
  sebo: 'Sebo',
  outro: 'Outro',
}
