import { useMemo } from 'react'
import type { Book } from '../types'
import { READING_STATUS_LABELS } from '../types'
import { formatCurrency } from '../utils/format'
import { isOverdue } from '../utils/loans'
import { Cover } from './ui/Cover'

interface StatsViewProps {
  books: Book[]
}

interface Ranked {
  label: string
  count: number
  extra?: string
  cover?: { url?: string; title: string }
}

function rank(map: Map<string, Ranked>): Ranked[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10)
}

/** Estatísticas da biblioteca: leitores, livros e gêneros mais lidos, acervo. */
export function StatsView({ books }: StatsViewProps) {
  const stats = useMemo(() => {
    const readers = new Map<string, Ranked>()
    const borrowers = new Map<string, Ranked>()
    const mostRead = new Map<string, Ranked>()
    const genresRead = new Map<string, Ranked>()
    let totalLoans = 0
    let completedLoans = 0
    let activeCount = 0
    let overdueCount = 0

    for (const book of books) {
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
        if (loan.completed) {
          completedLoans++
          const r = readers.get(name) ?? { label: name, count: 0 }
          r.count++
          readers.set(name, r)

          const key = `${book.id}`
          const m = mostRead.get(key) ?? {
            label: book.title,
            count: 0,
            cover: { url: book.coverUrl, title: book.title },
          }
          m.count++
          mostRead.set(key, m)

          if (book.genre) {
            const g = genresRead.get(book.genre) ?? { label: book.genre, count: 0 }
            g.count++
            genresRead.set(book.genre, g)
          }
        }
      }
    }

    const genresOwned = new Map<string, Ranked>()
    const donors = new Map<string, Ranked>()
    for (const book of books) {
      if (book.genre) {
        const g = genresOwned.get(book.genre) ?? { label: book.genre, count: 0 }
        g.count++
        genresOwned.set(book.genre, g)
      }
      if (book.acquisitionCategory) {
        const d = donors.get(book.acquisitionCategory) ?? { label: book.acquisitionCategory, count: 0 }
        d.count++
        donors.set(book.acquisitionCategory, d)
      }
    }

    const statusCount: Record<string, number> = {}
    for (const book of books) statusCount[book.readingStatus] = (statusCount[book.readingStatus] ?? 0) + 1

    return {
      totalBooks: books.length,
      invested: books.reduce((s, b) => s + (b.pricePaid ?? 0), 0),
      favorites: books.filter((b) => b.favorite).length,
      totalLoans,
      completedLoans,
      activeCount,
      overdueCount,
      readers: rank(readers),
      borrowers: rank(borrowers),
      mostRead: rank(mostRead),
      genresRead: rank(genresRead),
      genresOwned: rank(genresOwned),
      donors: rank(donors),
      statusCount,
    }
  }, [books])

  if (books.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-ink-500 dark:text-ink-400">
        Adicione livros à biblioteca para ver as estatísticas.
      </p>
    )
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard value={stats.totalBooks} label="livros no acervo" />
        <SummaryCard value={stats.completedLoans} label="leituras completas" />
        <SummaryCard value={stats.activeCount} label="emprestados agora" highlight={stats.overdueCount > 0 ? `${stats.overdueCount} em atraso` : undefined} />
        <SummaryCard value={formatCurrency(stats.invested)} label="investidos no acervo" small />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankCard title="📚 Leituras por criança" subtitle="livros lidos por completo" items={stats.readers} unit="livro(s)" empty="Nenhuma leitura completa registrada ainda — marque “Leu por completo” ao receber uma devolução." />
        <RankCard title="🤝 Empréstimos por criança" subtitle="total de vezes que pegou livros" items={stats.borrowers} unit="empréstimo(s)" empty="Nenhum empréstimo registrado ainda." />
        <RankCard title="⭐ Livros mais lidos" subtitle="pelas devoluções com leitura completa" items={stats.mostRead} unit="leitura(s)" withCovers empty="Ainda sem leituras completas." />
        <RankCard title="🏷️ Gêneros mais lidos" subtitle="das leituras completas" items={stats.genresRead} unit="leitura(s)" empty="Ainda sem leituras completas." />
        <RankCard title="📖 Gêneros do acervo" subtitle="composição da biblioteca" items={stats.genresOwned} unit="livro(s)" empty="Nenhum gênero cadastrado." />
        <RankCard title="💚 Doadores / origem" subtitle="por categoria de aquisição" items={stats.donors} unit="livro(s)" empty="Nenhum doador/categoria cadastrado." />
      </div>

      {/* Status de leitura do acervo */}
      <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
        <h3 className="mb-3 font-serif text-base font-semibold text-ink-800 dark:text-paper-100">Status do acervo</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600 dark:text-paper-300">
          {Object.entries(READING_STATUS_LABELS).map(([key, label]) => (
            <span key={key}>
              {label}: <strong>{stats.statusCount[key] ?? 0}</strong>
            </span>
          ))}
          <span>Favoritos: <strong>{stats.favorites}</strong></span>
          <span>Total de empréstimos: <strong>{stats.totalLoans}</strong></span>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ value, label, highlight, small }: { value: number | string; label: string; highlight?: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-paper-200/80 bg-white p-4 text-center shadow-card dark:border-ink-700 dark:bg-ink-800">
      <p className={`font-serif font-semibold text-ink-800 dark:text-paper-100 ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{label}</p>
      {highlight && <p className="mt-1 text-[11px] font-semibold text-rose-500">{highlight}</p>}
    </div>
  )
}

interface RankCardProps {
  title: string
  subtitle: string
  items: Ranked[]
  unit: string
  empty: string
  withCovers?: boolean
}

function RankCard({ title, subtitle, items, unit, empty, withCovers }: RankCardProps) {
  const max = items[0]?.count ?? 1
  return (
    <div className="rounded-2xl border border-paper-200/80 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-800">
      <h3 className="font-serif text-base font-semibold text-ink-800 dark:text-paper-100">{title}</h3>
      <p className="mb-3 text-xs text-ink-400 dark:text-ink-500">{subtitle}</p>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-ink-500 dark:text-ink-400">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.label + i} className="flex items-center gap-2.5">
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
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
