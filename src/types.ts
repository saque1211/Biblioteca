export type ReadingStatus = 'nao-lido' | 'lendo' | 'lido' | 'abandonado'
export type BookCondition = 'novo' | 'seminovo' | 'usado' | 'danificado'
export type BookFormat = 'capa-dura' | 'brochura' | 'ebook' | 'audiobook'
export type Origin = 'comprado' | 'presente' | 'doacao' | 'heranca' | 'sebo' | 'outro'

/** Um empréstimo (ativo ou passado) de um exemplar para uma criança/leitor. */
export interface LoanRecord {
  id: string
  name: string // para quem foi emprestado
  takenAt: string // data em que foi pego
  dueAt?: string // data prevista de devolução (undefined = sem data definida)
  returnedAt?: string // preenchido quando devolvido
  completed?: boolean // true = leu por completo
}

export interface Book {
  id?: number
  // Dados bibliográficos (vindos da API ou manuais)
  title: string
  originalTitle?: string // título original quando o exibido foi traduzido
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

  // Empréstimos (o ativo é o que não tem returnedAt)
  loans?: LoanRecord[]
  /** @deprecated campos antigos, migrados para `loans` */
  loanedTo?: string
  /** @deprecated */
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
  /** Chave do "work" na Open Library (ex.: /works/OL456216W) para buscar a sinopse depois. */
  workKey?: string
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
