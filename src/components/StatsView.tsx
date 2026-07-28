import { useMemo } from 'react'
import type { Book } from '../types'
import { READING_STATUS_LABELS } from '../types'
import { formatCurrency } from '../utils/format'
import { isOverdue } from '../utils/loans'
import { monthsAgo, type Filters } from './FilterBar'
import { Cover } from './ui/Cover'

interface StatsViewProps {
  books: Book[]
  /** Mostrar estatísticas por criança (perfil escolar/corporativo). */
  showChildStats: boolean
  /** Mostrar valor investido na coleção (perfil pessoal). */
  showInvested: boolean
  /** Abre a Biblioteca já filtrada pelo que foi clicado. */
  onOpenFiltered: (filters: Partial<Filters>) => void
  /** Abre o painel de detalhes de um livro específico. */
  onOpenBook: (id: number) => void
}

interface Ranked {
  label: string
  count: number
  cover?: { url?: string; title: string }
  /** Filtro aplicado ao clicar no item (quando faz sentido navegar). */
  filter?: Partial<Filters>
  /** Ou abre um livro específico. */
  bookId?: number
}

function rank(map: Map<string, Ranked>): Ranked[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10)
}

/** Estatísticas da biblioteca — tudo clicável, levando à Biblioteca filtrada. */
export function StatsView({ books, showChildStats, showInvested, onOpenFiltered, onOpenBook }: StatsViewProps) {
  const stats = useMemo(() => {
    const readers = new Map<string, Ranked>()
    const borrowers = new Map<string, Ranked>()
    const mostRead = new Map<string, Ranked>()
    const genresRead = new Map<string, Ranked>()
    let totalLoans = 0
    let completedLoans = 0
    let activeCount = 0
    let overdueCount = 0
    let inClassCount = 0

    function countCompletedReading(name: string, book: Book) {
      completedLoans++
      const r = readers.get(name) ?? { label: name, count: 0 }
      r.count++
      readers.set(name, r)

      const key = `${book.id}`
      const m = mostRead.get(key) ?? {
        label: book.title,
        count: 0,
        cover: { url: book.coverUrl, title: book.title },
        bookId: book.id,
      }
      m.count++
      mostRead.set(key, m)

      if (book.genre) {
        const g = genresRead.get(book.genre) ?? { label: book.genre, count: 0, filter: { genre: book.genre } }
        g.count++
        genresRead.set(book.genre, g)
      }
    }

    for (const book of books) {
      for (const reading of book.classReadings ?? []) {
        if (reading.finishedAt) countCompletedReading(reading.name.trim() || 'Sem nome', book)
        else inClassCount++
      }
      for (const loan of book.loans ?? []) {
        totalLoans++
        const name = loan.name.trim() || 'Sem nome'
        if (!loan.returnedAt) {
          activeCount++
          if (isOverdue(loan)) overdueCount++
        }
        const b = borrowers.get(name) ?? { label: name, count: 0 }
        b.count++
        borrowers.set(name, b)
        if (loan.completed) countCompletedReading(name, book)
      }
    }

    const genresOwned = new Map<string, Ranked>()
    const donors = new Map<string, Ranked>()
    const authorsOwned = new Map<string, Ranked>()
    for (const book of books) {
      if (book.genre) {
        const g = genresOwned.get(book.genre) ?? { label: book.genre, count: 0, filter: { genre: book.genre } }
        g.count++
        genresOwned.set(book.genre, g)
      }
      if (book.acquisitionCategory) {
        const d = donors.get(book.acquisitionCategory) ?? {
          label: book.acquisitionCategory,
          count: 0,
          filter: { acquisitionCategory: book.acquisitionCategory },
        }
        d.count++
        donors.set(book.acquisitionCategory, d)
      }
      for (const author of book.authors) {
        const name = author.trim()
        if (!name) continue
        const a = authorsOwned.get(name) ?? { label: name, count: 0, filter: { author: name } }
        a.count++
        authorsOwned.set(name, a)
      }
    }

    const statusCount: Record<string, number> = {}
    for (const book of books) statusCount[book.readingStatus] = (statusCount[book.readingStatus] ?? 0) + 1

    // Leitura recente (pela data de término), acumulada por período
    const cut = { 1: monthsAgo(1), 3: monthsAgo(3), 6: monthsAgo(6), 12: monthsAgo(12) }
    const recent = { 1: 0, 3: 0, 6: 0, 12: 0 }
    for (const book of books) {
      if (!book.readingEnd) continue
      const d = new Date(book.readingEnd)
      if (Number.isNaN(d.getTime())) continue
      if (d >= cut[1]) recent[1]++
      if (d >= cut[3]) recent[3]++
      if (d >= cut[6]) recent[6]++
      if (d >= cut[12]) recent[12]++
    }

    // Distribuição de avaliações (livros com nota)
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let ratedCount = 0
    let ratingSum = 0
    for (const book of books) {
      if (book.rating > 0) {
        ratingDist[book.rating] = (ratingDist[book.rating] ?? 0) + 1
        ratedCount++
        ratingSum += book.rating
      }
    }

    const readBooks = books.filter((b) => b.readingStatus === 'lido')
    const pagesRead = readBooks.reduce((s, b) => s + (b.pageCount ?? 0), 0)

    return {
      totalBooks: books.length,
      invested: books.reduce((s, b) => s + (b.pricePaid ?? 0), 0),
      favorites: books.filter((b) => b.favorite).length,
      totalLoans,
      completedLoans,
      activeCount,
      overdueCount,
      inClassCount,
      readers: rank(readers),
      borrowers: rank(borrowers),
      mostRead: rank(mostRead),
      genresRead: rank(genresRead),
      genresOwned: rank(genresOwned),
      donors: rank(donors),
      authorsOwned: rank(authorsOwned),
      statusCount,
      recent,
      ratingDist,
      ratedCount,
      avgRating: ratedCount ? ratingSum / ratedCount : 0,
      pagesRead,
      readTotal: readBooks.length,
    }
  }, [books])

  if (books.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-ink-500 dark:text-ink-400">
        Adicione livros à biblioteca para ver as estatísticas.
      </p>
    )
  }

  const readCount = stats.statusCount['lido'] ?? 0
  const openBook = (id?: number) => id != null && onOpenBook(id)

  return (
    <div className="animate-slide-up space-y-6">
      <p className="text-center text-[11px] text-ink-400 dark:text-ink-500">
        Toque em qualquer número, barra ou item para ver esses livros na Biblioteca 👆
      </p>

      {/* Cartões de resumo (clicáveis) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard value={stats.totalBooks} label="livros no acervo" onClick={() => onOpenFiltered({})} />
        {showChildStats ? (
          <>
            <SummaryCard
              value={stats.completedLoans}
              label="leituras completas"
              highlight={stats.inClassCount > 0 ? `${stats.inClassCount} lendo em aula` : undefined}
              highlightTone="info"
              onClick={stats.inClassCount > 0 ? () => onOpenFiltered({ loan: 'em-aula' }) : undefined}
            />
            <SummaryCard
              value={stats.activeCount}
              label="emprestados agora"
              highlight={stats.overdueCount > 0 ? `${stats.overdueCount} em atraso` : undefined}
              onClick={() => onOpenFiltered({ loan: 'emprestado' })}
            />
          </>
        ) : (
          <>
            <SummaryCard value={readCount} label="livros lidos" onClick={() => onOpenFiltered({ status: 'lido' })} />
            <SummaryCard value={stats.favorites} label="favoritos" onClick={() => onOpenFiltered({ favoritesOnly: true })} />
          </>
        )}
        {showInvested && <SummaryCard value={formatCurrency(stats.invested)} label="investidos no acervo" small />}
        {!showInvested && showChildStats && (
          <SummaryCard value={stats.favorites} label="favoritos" onClick={() => onOpenFiltered({ favoritesOnly: true })} />
        )}
      </div>

      {/* Leitura recente — clique para ver os livros lidos no período */}
      <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
        <h3 className="font-serif text-base font-semibold text-ink-800 dark:text-paper-100">📅 Leitura recente</h3>
        <p className="mb-3 text-xs text-ink-400 dark:text-ink-500">livros terminados no período — toque para ver</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PeriodChip label="Último mês" value={stats.recent[1]} onClick={() => onOpenFiltered({ readWithin: '1' })} />
          <PeriodChip label="Últimos 3 meses" value={stats.recent[3]} onClick={() => onOpenFiltered({ readWithin: '3' })} />
          <PeriodChip label="Últimos 6 meses" value={stats.recent[6]} onClick={() => onOpenFiltered({ readWithin: '6' })} />
          <PeriodChip label="Últimos 12 meses" value={stats.recent[12]} onClick={() => onOpenFiltered({ readWithin: '12' })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
          <span>Total lidos: <strong>{stats.readTotal}</strong></span>
          {stats.pagesRead > 0 && <span>Páginas lidas: <strong>{stats.pagesRead.toLocaleString('pt-BR')}</strong></span>}
          {stats.ratedCount > 0 && <span>Nota média: <strong>{stats.avgRating.toFixed(1)} ★</strong></span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {showChildStats && (
          <>
            <RankCard title="📚 Leituras por criança" subtitle="livros lidos por completo" items={stats.readers} unit="livro(s)" empty="Nenhuma leitura completa registrada ainda — marque “Leu por completo” ao receber uma devolução." />
            <RankCard title="🤝 Empréstimos por criança" subtitle="total de vezes que pegou livros" items={stats.borrowers} unit="empréstimo(s)" empty="Nenhum empréstimo registrado ainda." />
            <RankCard title="⭐ Livros mais lidos" subtitle="pelas devoluções com leitura completa" items={stats.mostRead} unit="leitura(s)" withCovers empty="Ainda sem leituras completas." onOpenBook={openBook} />
            <RankCard title="🏷️ Gêneros mais lidos" subtitle="das leituras completas" items={stats.genresRead} unit="leitura(s)" empty="Ainda sem leituras completas." onOpenFiltered={onOpenFiltered} />
          </>
        )}
        <RankCard title="📖 Gêneros do acervo" subtitle="composição da biblioteca" items={stats.genresOwned} unit="livro(s)" empty="Nenhum gênero cadastrado." onOpenFiltered={onOpenFiltered} />
        <RankCard title="✍️ Autores mais presentes" subtitle="quem mais aparece no acervo" items={stats.authorsOwned} unit="livro(s)" empty="Nenhum autor cadastrado." onOpenFiltered={onOpenFiltered} />
        <RankCard title={showChildStats ? '💚 Doadores / origem' : '🏷️ Categorias'} subtitle="por categoria de aquisição" items={stats.donors} unit="livro(s)" empty="Nenhuma categoria cadastrada." onOpenFiltered={onOpenFiltered} />

        {/* Distribuição de avaliações */}
        {stats.ratedCount > 0 && (
          <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
            <h3 className="font-serif text-base font-semibold text-ink-800 dark:text-paper-100">⭐ Avaliações</h3>
            <p className="mb-3 text-xs text-ink-400 dark:text-ink-500">como você avaliou seus livros — toque para ver</p>
            <ol className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.ratingDist[star] ?? 0
                const maxRating = Math.max(1, ...Object.values(stats.ratingDist))
                return (
                  <li key={star}>
                    <button
                      type="button"
                      disabled={count === 0}
                      onClick={() => onOpenFiltered({ minRating: star })}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors enabled:hover:bg-paper-100 disabled:opacity-40 dark:enabled:hover:bg-ink-700"
                    >
                      <span className="w-14 shrink-0 text-xs text-amber-500">{'★'.repeat(star)}</span>
                      <div className="min-w-0 flex-1 h-1.5 overflow-hidden rounded-full bg-paper-100 dark:bg-ink-700">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.max(count ? 8 : 0, (count / maxRating) * 100)}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-ink-500 dark:text-ink-400">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Status de leitura do acervo (clicável) */}
      <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
        <h3 className="mb-3 font-serif text-base font-semibold text-ink-800 dark:text-paper-100">Status do acervo</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(READING_STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpenFiltered({ status: key as Filters['status'] })}
              className="rounded-full border border-paper-200 px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-accent-500 hover:text-accent-600 dark:border-ink-700 dark:text-paper-300 dark:hover:border-accent-500"
            >
              {label}: <strong>{stats.statusCount[key] ?? 0}</strong>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onOpenFiltered({ favoritesOnly: true })}
            className="rounded-full border border-paper-200 px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-accent-500 hover:text-accent-600 dark:border-ink-700 dark:text-paper-300 dark:hover:border-accent-500"
          >
            Favoritos: <strong>{stats.favorites}</strong>
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ value, label, highlight, highlightTone = 'alert', small, onClick }: { value: number | string; label: string; highlight?: string; highlightTone?: 'alert' | 'info'; small?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      <p className={`font-serif font-semibold text-ink-800 dark:text-paper-100 ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{label}</p>
      {highlight && (
        <p className={`mt-1 text-[11px] font-semibold ${highlightTone === 'alert' ? 'text-rose-500' : 'text-sky-600 dark:text-sky-400'}`}>
          {highlight}
        </p>
      )}
    </>
  )
  const base = 'rounded-2xl border border-paper-200/80 bg-white p-4 text-center shadow-card dark:border-ink-700 dark:bg-ink-800'
  if (!onClick) return <div className={base}>{inner}</div>
  return (
    <button type="button" onClick={onClick} className={`${base} transition-all hover:border-accent-500 hover:shadow-panel active:scale-[0.98]`}>
      {inner}
    </button>
  )
}

function PeriodChip({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={value === 0}
      onClick={onClick}
      className="rounded-xl border border-paper-200 p-3 text-center transition-all enabled:hover:border-accent-500 enabled:hover:shadow-card enabled:active:scale-[0.98] disabled:opacity-40 dark:border-ink-700"
    >
      <p className="font-serif text-xl font-semibold text-accent-600 dark:text-accent-400">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-500 dark:text-ink-400">{label}</p>
    </button>
  )
}

interface RankCardProps {
  title: string
  subtitle: string
  items: Ranked[]
  unit: string
  empty: string
  withCovers?: boolean
  onOpenFiltered?: (filters: Partial<Filters>) => void
  onOpenBook?: (id?: number) => void
}

function RankCard({ title, subtitle, items, unit, empty, withCovers, onOpenFiltered, onOpenBook }: RankCardProps) {
  const max = items[0]?.count ?? 1
  return (
    <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
      <h3 className="font-serif text-base font-semibold text-ink-800 dark:text-paper-100">{title}</h3>
      <p className="mb-3 text-xs text-ink-400 dark:text-ink-500">{subtitle}</p>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-ink-500 dark:text-ink-400">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => {
            const clickable =
              (item.filter && onOpenFiltered) || (item.bookId != null && onOpenBook)
            const handleClick = () => {
              if (item.bookId != null && onOpenBook) onOpenBook(item.bookId)
              else if (item.filter && onOpenFiltered) onOpenFiltered(item.filter)
            }
            const row = (
              <>
                <span className="w-5 shrink-0 text-right text-xs font-semibold text-ink-400 dark:text-ink-500">{i + 1}º</span>
                {withCovers && item.cover && (
                  <Cover url={item.cover.url} title={item.cover.title} className="h-9 w-6 shrink-0 rounded shadow-sm" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-700 dark:text-paper-100">{item.label}</p>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-paper-100 dark:bg-ink-700">
                    <div
                      className="h-full rounded-full bg-accent-500 transition-all"
                      style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink-500 dark:text-ink-400">
                  {item.count} {unit}
                </span>
              </>
            )
            return (
              <li key={item.label + i}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={handleClick}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-paper-100 dark:hover:bg-ink-700"
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center gap-2.5 px-1.5 py-1">{row}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
