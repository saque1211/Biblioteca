import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, scheduleBook, toggleScheduleDone, unscheduleEntry } from '../db/db'
import type { Book, ScheduleEntry } from '../types'
import { authorsLabel, toISODate, todayISO } from '../utils/format'
import { Cover } from './ui/Cover'
import { Modal } from './ui/Modal'
import { TextInput } from './ui/Field'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface CalendarViewProps {
  books: Book[]
}

/** Agenda mensal: associe um livro a cada dia e marque como concluído. */
export function CalendarView({ books }: CalendarViewProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [pickingDate, setPickingDate] = useState<string | null>(null)

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const entries = useLiveQuery(
    () => db.schedule.where('date').startsWith(monthPrefix).toArray(),
    [monthPrefix],
  )

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const e of entries ?? []) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [entries])

  const booksById = useMemo(() => new Map(books.map((b) => [b.id!, b])), [books])

  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  // Grade do calendário: células vazias antes do dia 1 + dias do mês
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const today = todayISO()

  return (
    <div className="animate-slide-up">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-ink-800 dark:text-paper-100">
          {MONTHS[month]} <span className="font-normal text-ink-500 dark:text-ink-400">{year}</span>
        </h2>
        <div className="flex items-center gap-1">
          <NavButton label="Mês anterior" onClick={() => changeMonth(-1)}>‹</NavButton>
          <button
            type="button"
            onClick={() => {
              setYear(now.getFullYear())
              setMonth(now.getMonth())
            }}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-paper-200/70 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            Hoje
          </button>
          <NavButton label="Próximo mês" onClick={() => changeMonth(1)}>›</NavButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-paper-200/80 bg-white shadow-card dark:border-ink-700 dark:bg-ink-800">
        <div className="grid grid-cols-7 border-b border-paper-200 dark:border-ink-700">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="min-h-20 border-b border-r border-paper-100 dark:border-ink-700/50 sm:min-h-28" />
            const dateISO = toISODate(new Date(year, month, day))
            const dayEntries = entriesByDate.get(dateISO) ?? []
            const isToday = dateISO === today
            return (
              <button
                key={dateISO}
                type="button"
                onClick={() => setPickingDate(dateISO)}
                className="group relative min-h-20 border-b border-r border-paper-100 p-1.5 text-left align-top transition-colors hover:bg-paper-100/70 dark:border-ink-700/50 dark:hover:bg-ink-700/40 sm:min-h-28"
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? 'bg-accent-600 text-white'
                      : 'text-ink-500 dark:text-ink-400'
                  }`}
                >
                  {day}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {dayEntries.map((entry) => {
                    const book = booksById.get(entry.bookId)
                    if (!book) return null
                    return (
                      <div key={entry.id} className="relative" title={`${book.title}${entry.done ? ' — concluído' : ''}`}>
                        <Cover
                          url={book.coverUrl}
                          title={book.title}
                          className={`h-10 w-7 rounded shadow-sm sm:h-14 sm:w-10 ${entry.done ? 'opacity-60' : ''}`}
                        />
                        {entry.done && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-600 text-[9px] text-white shadow-sm">
                            ✓
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <span className="absolute bottom-1 right-1.5 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-ink-500">
                  +
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {pickingDate && (
        <DayModal
          date={pickingDate}
          books={books}
          entries={entriesByDate.get(pickingDate) ?? []}
          booksById={booksById}
          onClose={() => setPickingDate(null)}
        />
      )}
    </div>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink-500 transition-colors hover:bg-paper-200/70 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-700"
    >
      {children}
    </button>
  )
}

interface DayModalProps {
  date: string
  books: Book[]
  entries: ScheduleEntry[]
  booksById: Map<number, Book>
  onClose: () => void
}

function DayModal({ date, books, entries, booksById, onClose }: DayModalProps) {
  const [search, setSearch] = useState('')
  const [y, m, d] = date.split('-')
  const label = `${d} de ${MONTHS[Number(m) - 1]} de ${y}`

  const scheduledIds = new Set(entries.map((e) => e.bookId))
  const candidates = books.filter((b) => {
    if (b.id == null || scheduledIds.has(b.id)) return false
    const q = search.trim().toLowerCase()
    return !q || `${b.title} ${b.authors.join(' ')}`.toLowerCase().includes(q)
  })

  return (
    <Modal title={`Leitura de ${label}`} onClose={onClose}>
      {entries.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Agendado para este dia</p>
          {entries.map((entry) => {
            const book = booksById.get(entry.bookId)
            if (!book) return null
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-paper-200 p-2.5 dark:border-ink-700">
                <Cover url={book.coverUrl} title={book.title} className="h-12 w-8 shrink-0 rounded shadow-sm" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${entry.done ? 'text-ink-400 line-through dark:text-ink-500' : 'text-ink-700 dark:text-paper-100'}`}>
                    {book.title}
                  </p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">{authorsLabel(book.authors)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleScheduleDone(entry)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    entry.done
                      ? 'bg-accent-100 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200'
                      : 'border border-paper-300 text-ink-500 hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:text-ink-400'
                  }`}
                >
                  {entry.done ? '✓ Concluído' : 'Concluir'}
                </button>
                <button
                  type="button"
                  aria-label="Remover agendamento"
                  onClick={() => entry.id != null && unscheduleEntry(entry.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        Escolher um livro da biblioteca
      </p>
      {books.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
          Sua biblioteca ainda está vazia — adicione livros primeiro.
        </p>
      ) : (
        <>
          <TextInput
            type="search"
            placeholder="Filtrar por título ou autor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={async () => {
                    await scheduleBook(date, book.id!)
                    setSearch('')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-paper-100 dark:hover:bg-ink-700"
                >
                  <Cover url={book.coverUrl} title={book.title} className="h-12 w-8 shrink-0 rounded shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-700 dark:text-paper-100">{book.title}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{authorsLabel(book.authors)}</p>
                  </div>
                  <span className="text-xs font-medium text-accent-600 dark:text-accent-400">Agendar</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <p className="py-3 text-center text-sm text-ink-500 dark:text-ink-400">Nenhum livro disponível.</p>
            )}
          </ul>
        </>
      )}
    </Modal>
  )
}
