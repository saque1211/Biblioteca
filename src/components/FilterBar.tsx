import { useMemo, useState } from 'react'
import type { Book, BookCondition, BookFormat, Origin, ReadingStatus } from '../types'
import { CONDITION_LABELS, FORMAT_LABELS, ORIGIN_LABELS, READING_STATUS_LABELS } from '../types'
import { activeLoan, isOverdue } from '../utils/loans'
import { Select, TextInput } from './ui/Field'

export type SortKey = 'title' | 'author' | 'acquisitionDate' | 'rating' | 'price' | 'addedAt'

export type LoanFilter = '' | 'emprestado' | 'atrasado' | 'disponivel' | 'em-aula'

export interface Filters {
  text: string
  genre: string
  status: '' | ReadingStatus
  acquisitionCategory: string
  origin: '' | Origin
  minRating: number
  favoritesOnly: boolean
  author: string
  priceMin: string
  priceMax: string
  format: '' | BookFormat
  loan: LoanFilter
  language: string
  tag: string
  condition: '' | BookCondition
  publisher: string
  sort: SortKey
  sortAsc: boolean
}

export const DEFAULT_FILTERS: Filters = {
  text: '',
  genre: '',
  status: '',
  acquisitionCategory: '',
  origin: '',
  minRating: 0,
  favoritesOnly: false,
  author: '',
  priceMin: '',
  priceMax: '',
  format: '',
  loan: '',
  language: '',
  tag: '',
  condition: '',
  publisher: '',
  sort: 'addedAt',
  sortAsc: false,
}

export function applyFilters(books: Book[], f: Filters): Book[] {
  const text = f.text.trim().toLowerCase()
  const author = f.author.trim().toLowerCase()
  const min = f.priceMin === '' ? -Infinity : Number(f.priceMin)
  const max = f.priceMax === '' ? Infinity : Number(f.priceMax)

  const filtered = books.filter((b) => {
    if (text && !`${b.title} ${b.authors.join(' ')} ${b.isbn ?? ''}`.toLowerCase().includes(text)) return false
    if (f.genre && b.genre !== f.genre) return false
    if (f.status && b.readingStatus !== f.status) return false
    if (f.acquisitionCategory && b.acquisitionCategory !== f.acquisitionCategory) return false
    if (f.origin && b.origin !== f.origin) return false
    if (f.minRating > 0 && b.rating < f.minRating) return false
    if (f.favoritesOnly && !b.favorite) return false
    if (author && !b.authors.join(' ').toLowerCase().includes(author)) return false
    if (f.priceMin !== '' || f.priceMax !== '') {
      const price = b.pricePaid ?? 0
      if (price < min || price > max) return false
    }
    if (f.format && b.format !== f.format) return false
    if (f.loan) {
      const loan = activeLoan(b)
      if (f.loan === 'emprestado' && !loan) return false
      if (f.loan === 'disponivel' && loan) return false
      if (f.loan === 'atrasado' && !isOverdue(loan)) return false
      if (f.loan === 'em-aula' && !(b.classReadings ?? []).some((r) => !r.finishedAt)) return false
    }
    if (f.language && (b.language ?? '').toLowerCase() !== f.language.toLowerCase()) return false
    if (f.tag && !b.tags.includes(f.tag)) return false
    if (f.condition && b.condition !== f.condition) return false
    if (f.publisher && b.publisher !== f.publisher) return false
    return true
  })

  const dir = f.sortAsc ? 1 : -1
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
  filtered.sort((a, b) => {
    switch (f.sort) {
      case 'title':
        return dir * collator.compare(a.title, b.title)
      case 'author':
        return dir * collator.compare(a.authors[0] ?? '', b.authors[0] ?? '')
      case 'acquisitionDate':
        return dir * (a.acquisitionDate ?? '').localeCompare(b.acquisitionDate ?? '')
      case 'rating':
        return dir * (a.rating - b.rating)
      case 'price':
        return dir * ((a.pricePaid ?? 0) - (b.pricePaid ?? 0))
      case 'addedAt':
      default:
        return dir * a.addedAt.localeCompare(b.addedAt)
    }
  })
  return filtered
}

const SORT_LABELS: Record<SortKey, string> = {
  addedAt: 'Adicionado em',
  title: 'Título',
  author: 'Autor',
  acquisitionDate: 'Data de aquisição',
  rating: 'Avaliação',
  price: 'Valor pago',
}

interface FilterBarProps {
  books: Book[]
  filters: Filters
  onChange: (filters: Filters) => void
  resultCount: number
}

export function FilterBar({ books, filters, onChange, resultCount }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  const distinct = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort(new Intl.Collator('pt-BR').compare)

  const genres = useMemo(() => distinct(books.map((b) => b.genre)), [books])
  const categories = useMemo(() => distinct(books.map((b) => b.acquisitionCategory)), [books])
  const languages = useMemo(() => distinct(books.map((b) => b.language)), [books])
  const tags = useMemo(() => distinct(books.flatMap((b) => b.tags)), [books])
  const publishers = useMemo(() => distinct(books.map((b) => b.publisher)), [books])

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const activeCount = [
    filters.genre, filters.status, filters.acquisitionCategory, filters.origin,
    filters.author, filters.priceMin, filters.priceMax, filters.format,
    filters.loan, filters.language, filters.tag, filters.condition, filters.publisher,
    filters.minRating > 0 ? 'r' : '', filters.favoritesOnly ? 'f' : '',
  ].filter(Boolean).length

  return (
    <div className="rounded-2xl border border-paper-200/80 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <TextInput
            type="search"
            placeholder="Filtrar minha biblioteca…"
            aria-label="Filtrar biblioteca por texto"
            value={filters.text}
            onChange={(e) => set('text', e.target.value)}
          />
        </div>
        <Select
          value={filters.sort}
          aria-label="Ordenar por"
          onChange={(e) => set('sort', e.target.value as SortKey)}
          className="!w-auto"
        >
          {Object.entries(SORT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>Ordenar: {l}</option>
          ))}
        </Select>
        <button
          type="button"
          title={filters.sortAsc ? 'Crescente' : 'Decrescente'}
          onClick={() => set('sortAsc', !filters.sortAsc)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-paper-300 text-ink-500 transition-colors hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:text-ink-400"
        >
          {filters.sortAsc ? '↑' : '↓'}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            expanded || activeCount > 0
              ? 'border-accent-500 bg-accent-100/60 text-accent-700 dark:bg-accent-700/20 dark:text-accent-300'
              : 'border-paper-300 text-ink-500 hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:text-ink-400'
          }`}
        >
          Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid animate-slide-up grid-cols-2 gap-2.5 border-t border-paper-200 pt-3 dark:border-ink-700 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={filters.genre} aria-label="Gênero" onChange={(e) => set('genre', e.target.value)}>
            <option value="">Gênero: todos</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select value={filters.status} aria-label="Status de leitura" onChange={(e) => set('status', e.target.value as Filters['status'])}>
            <option value="">Status: todos</option>
            {Object.entries(READING_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={filters.acquisitionCategory} aria-label="Categoria de aquisição" onChange={(e) => set('acquisitionCategory', e.target.value)}>
            <option value="">Doador/categoria: todos</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={filters.loan} aria-label="Situação de empréstimo" onChange={(e) => set('loan', e.target.value as LoanFilter)}>
            <option value="">Empréstimo: todos</option>
            <option value="emprestado">Emprestados agora</option>
            <option value="atrasado">Devolução atrasada</option>
            <option value="em-aula">Em leitura em aula</option>
            <option value="disponivel">Disponíveis</option>
          </Select>
          <Select value={filters.origin} aria-label="Origem" onChange={(e) => set('origin', e.target.value as Filters['origin'])}>
            <option value="">Origem: todas</option>
            {Object.entries(ORIGIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={filters.format} aria-label="Formato" onChange={(e) => set('format', e.target.value as Filters['format'])}>
            <option value="">Formato: todos</option>
            {Object.entries(FORMAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={String(filters.minRating)} aria-label="Avaliação mínima" onChange={(e) => set('minRating', Number(e.target.value))}>
            <option value="0">Avaliação: todas</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ou mais</option>)}
          </Select>
          <Select value={filters.condition} aria-label="Estado de conservação" onChange={(e) => set('condition', e.target.value as Filters['condition'])}>
            <option value="">Conservação: todas</option>
            {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          {languages.length > 0 && (
            <Select value={filters.language} aria-label="Idioma" onChange={(e) => set('language', e.target.value)}>
              <option value="">Idioma: todos</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          )}
          {tags.length > 0 && (
            <Select value={filters.tag} aria-label="Tag" onChange={(e) => set('tag', e.target.value)}>
              <option value="">Tag: todas</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          )}
          {publishers.length > 0 && (
            <Select value={filters.publisher} aria-label="Editora" onChange={(e) => set('publisher', e.target.value)}>
              <option value="">Editora: todas</option>
              {publishers.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
          <TextInput
            type="text" inputMode="search" placeholder="Autor…"
            aria-label="Filtrar por autor"
            value={filters.author}
            onChange={(e) => set('author', e.target.value)}
          />
          <TextInput
            type="number" min={0} placeholder="Valor mín. (R$)"
            aria-label="Valor mínimo pago"
            value={filters.priceMin}
            onChange={(e) => set('priceMin', e.target.value)}
          />
          <TextInput
            type="number" min={0} placeholder="Valor máx. (R$)"
            aria-label="Valor máximo pago"
            value={filters.priceMax}
            onChange={(e) => set('priceMax', e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-paper-300 px-3 py-2 text-sm text-ink-600 dark:border-ink-600 dark:text-paper-300">
            <input
              type="checkbox"
              checked={filters.favoritesOnly}
              onChange={(e) => set('favoritesOnly', e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent-600)]"
            />
            Só favoritos
          </label>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS, text: filters.text, sort: filters.sort, sortAsc: filters.sortAsc })}
              className="col-span-2 text-left text-sm text-ink-500 underline-offset-2 hover:text-accent-600 hover:underline sm:col-span-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
        {resultCount} {resultCount === 1 ? 'livro encontrado' : 'livros encontrados'}
      </p>
    </div>
  )
}
