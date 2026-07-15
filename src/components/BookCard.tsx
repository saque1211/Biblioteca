import { useRef } from 'react'
import type { Book } from '../types'
import { authorsLabel } from '../utils/format'
import { activeLoan, isOverdue } from '../utils/loans'
import { Badge, StatusBadge } from './ui/Badge'
import { Cover } from './ui/Cover'
import { StarRating } from './ui/StarRating'

interface BookCardProps {
  book: Book
  onOpen: (book: Book) => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (book: Book) => void
  onEnterSelection: (book: Book) => void
}

const LONG_PRESS_MS = 450

export function BookCard({ book, onOpen, selectionMode, selected, onToggleSelect, onEnterSelection }: BookCardProps) {
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)

  function startPress() {
    longPressed.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      onEnterSelection(book)
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }

  function cancelPress() {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function handleClick() {
    if (longPressed.current) return // o toque longo já tratou este gesto
    if (selectionMode) onToggleSelect(book)
    else onOpen(book)
  }

  const loan = activeLoan(book)
  const overdue = isOverdue(loan)
  const inClass = (book.classReadings ?? []).filter((r) => !r.finishedAt)

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      aria-pressed={selectionMode ? selected : undefined}
      className={`group relative flex w-full animate-pop select-none items-start gap-4 rounded-2xl border bg-white p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:bg-ink-800 ${
        selected
          ? 'border-accent-500 ring-2 ring-accent-500/40'
          : 'border-paper-200/80 dark:border-ink-700'
      }`}
    >
      {selectionMode && (
        <span
          aria-hidden
          className={`absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm transition-colors ${
            selected
              ? 'border-accent-600 bg-accent-600 text-white'
              : 'border-paper-300 bg-white text-transparent dark:border-ink-600 dark:bg-ink-800'
          }`}
        >
          ✓
        </span>
      )}
      <Cover
        url={book.coverUrl}
        title={book.title}
        className="h-24 w-16 shrink-0 rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-ink-800 dark:text-paper-100">
            {book.title}
          </h3>
          {book.favorite && (
            <span className="shrink-0 text-rose-400" title="Favorito" aria-label="Favorito">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{authorsLabel(book.authors)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {book.genre && <Badge tone="accent">{book.genre}</Badge>}
          <StatusBadge status={book.readingStatus} />
          {loan && !overdue && <Badge tone="amber">Com {loan.name}</Badge>}
          {overdue && <Badge tone="red">Atrasado · {loan!.name}</Badge>}
          {inClass.length === 1 && (
            <Badge tone="blue">
              Em aula · {inClass[0].name || 'sem nome'}
              {inClass[0].currentPage ? ` (pág. ${inClass[0].currentPage})` : ''}
            </Badge>
          )}
          {inClass.length > 1 && <Badge tone="blue">Em aula · {inClass.length} crianças</Badge>}
        </div>

        {book.rating > 0 && (
          <div className="mt-2">
            <StarRating value={book.rating} size="sm" />
          </div>
        )}
      </div>
    </button>
  )
}
