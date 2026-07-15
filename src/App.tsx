import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { enrichBookDetails } from './api/books'
import { toMyMemoryLang, translateText } from './api/translate'
import { BatchCategoryModal } from './components/BatchCategoryModal'
import { BookCard } from './components/BookCard'
import { BookDetailPanel } from './components/BookDetailPanel'
import { BulkEditModal } from './components/BulkEditModal'
import { CalendarView } from './components/CalendarView'
import { EmptyState } from './components/EmptyState'
import { applyFilters, DEFAULT_FILTERS, FilterBar, type Filters } from './components/FilterBar'
import { Header, type View } from './components/Header'
import { ManualAddModal } from './components/ManualAddModal'
import { SearchBar } from './components/SearchBar'
import { SettingsModal } from './components/SettingsModal'
import { StatsView } from './components/StatsView'
import { addBook, db, deleteBook, updateBook } from './db/db'
import { useBatchCategory } from './hooks/useBatchCategory'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import type { ApiBookResult, Book } from './types'
import { formatDate, todayISO } from './utils/format'
import { overdueBooks } from './utils/loans'
import { retroTranslateTitles } from './utils/retroTranslate'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { batchCategory, setBatchCategory } = useBatchCategory()
  const { settings, updateSettings } = useSettings()

  const [view, setView] = useState<View>('library')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [manualAddTitle, setManualAddTitle] = useState<string | null>(null)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Seleção múltipla (toque longo num card)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const selectionMode = selection.size > 0

  const books = useLiveQuery(() => db.books.toArray(), []) ?? []
  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedId) ?? null,
    [books, selectedId],
  )
  const visibleBooks = useMemo(() => applyFilters(books, filters), [books, filters])
  const selectedBooks = useMemo(
    () => books.filter((b) => b.id != null && selection.has(b.id)),
    [books, selection],
  )
  const overdue = useMemo(() => overdueBooks(books), [books])

  // Tradução retroativa: livros salvos antes da tradução automática (ou com
  // o serviço indisponível na época) ganham título em português ao abrir o app
  const retroRan = useRef(false)
  useEffect(() => {
    if (retroRan.current || !settings.translateTitles || books.length === 0) return
    retroRan.current = true
    retroTranslateTitles(books)
  }, [books, settings.translateTitles])

  // Notificação do sistema para atrasos (uma vez por dia, ao abrir o app)
  useEffect(() => {
    if (!settings.overdueNotifications || overdue.length === 0) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const key = 'biblioteca-overdue-notified'
    if (localStorage.getItem(key) === todayISO()) return
    localStorage.setItem(key, todayISO())
    const lines = overdue.slice(0, 4).map(({ book, loan }) => `“${book.title}” com ${loan.name || 'sem nome'}`)
    new Notification(`${overdue.length} ${overdue.length === 1 ? 'livro atrasado' : 'livros atrasados'}`, {
      body: lines.join('\n'),
      icon: 'pwa-192.png',
    })
  }, [overdue, settings.overdueNotifications])

  function newBookDefaults(): Pick<Book, 'readingStatus' | 'rating' | 'favorite' | 'tags' | 'addedAt' | 'acquisitionCategory' | 'acquisitionDate'> {
    return {
      readingStatus: 'nao-lido',
      rating: 0,
      favorite: false,
      tags: [],
      addedAt: new Date().toISOString(),
      acquisitionCategory: batchCategory ?? undefined,
      acquisitionDate: batchCategory ? todayISO() : undefined,
    }
  }

  async function handleAddFromApi(result: ApiBookResult) {
    const id = await addBook({
      title: result.title,
      authors: result.authors,
      coverUrl: result.coverUrl,
      genre: result.genre,
      isbn: result.isbn,
      publisher: result.publisher,
      publishedYear: result.publishedYear,
      pageCount: result.pageCount,
      synopsis: result.synopsis,
      language: languageLabel(result.language),
      ...newBookDefaults(),
    })

    // Complementos em segundo plano (não atrasam a adição):
    // sinopse/gênero faltantes e tradução do título para o português
    if (!result.synopsis || !result.genre) {
      enrichBookDetails(result).then(({ synopsis, genre }) => {
        const changes: Partial<Book> = {}
        if (synopsis && !result.synopsis) changes.synopsis = synopsis
        if (genre && !result.genre) changes.genre = genre
        if (Object.keys(changes).length) updateBook(id, changes)
      })
    }
    // Detecção automática de idioma: traduz o título mesmo quando o catálogo
    // não informa (ou informa errado) o idioma do livro
    const sourceLang = toMyMemoryLang(result.language)
    if (settings.translateTitles && sourceLang !== 'pt-BR') {
      translateText(result.title, sourceLang ?? 'auto', 'pt-BR').then((translated) => {
        if (translated) updateBook(id, { title: translated, originalTitle: result.title })
      })
    }
  }

  async function handleAddManually(data: Pick<Book, 'title' | 'authors' | 'coverUrl' | 'genre' | 'isbn' | 'publisher' | 'publishedYear' | 'pageCount' | 'synopsis'>) {
    const id = await addBook({ ...data, ...newBookDefaults() })
    if (settings.translateTitles) {
      translateText(data.title, 'auto', 'pt-BR').then((translated) => {
        if (translated) updateBook(id, { title: translated, originalTitle: data.title })
      })
    }
  }

  function toggleSelect(book: Book) {
    if (book.id == null) return
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(book.id!)) next.delete(book.id!)
      else next.add(book.id!)
      return next
    })
  }

  async function handleBulkDelete() {
    if (!confirm(`Remover ${selection.size} livros da biblioteca?`)) return
    for (const id of selection) await deleteBook(id)
    setSelection(new Set())
  }

  return (
    <div className="min-h-screen">
      <Header
        books={books}
        view={view}
        onViewChange={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
        batchCategory={batchCategory}
        onOpenBatchCategory={() => setBatchModalOpen(true)}
        onClearBatchCategory={() => setBatchCategory(null)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Alerta de devoluções atrasadas */}
      {settings.overdueNotifications && overdue.length > 0 && (
        <div className="border-b border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm text-rose-800 dark:text-rose-200 sm:px-6">
            <span aria-hidden>⏰</span>
            <strong>{overdue.length === 1 ? 'Devolução atrasada:' : `${overdue.length} devoluções atrasadas:`}</strong>
            {overdue.slice(0, 3).map(({ book, loan }) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  setView('library')
                  setSelectedId(book.id ?? null)
                }}
                className="underline decoration-rose-400 underline-offset-2 hover:decoration-2"
              >
                “{book.title}” com {loan.name || 'sem nome'} (desde {formatDate(loan.dueAt)})
              </button>
            ))}
            {overdue.length > 3 && (
              <button
                type="button"
                onClick={() => {
                  setView('library')
                  setFilters({ ...DEFAULT_FILTERS, loan: 'atrasado' })
                }}
                className="underline underline-offset-2"
              >
                +{overdue.length - 3} — ver todos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de ações da seleção múltipla */}
      {selectionMode && (
        <div className="sticky top-0 z-30 border-b border-accent-200 bg-accent-100/95 backdrop-blur dark:border-accent-700/50 dark:bg-accent-700/30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
            <span className="text-sm font-semibold text-accent-700 dark:text-accent-200">
              {selection.size} {selection.size === 1 ? 'livro selecionado' : 'livros selecionados'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelection(new Set(visibleBooks.filter((b) => b.id != null).map((b) => b.id!)))}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-accent-700 transition-colors hover:bg-accent-200/60 dark:text-accent-200 dark:hover:bg-accent-700/40"
              >
                Selecionar todos
              </button>
              <button
                type="button"
                onClick={() => setBulkEditOpen(true)}
                className="rounded-full bg-accent-600 px-4 py-1.5 text-xs font-semibold text-white shadow-card transition-all hover:bg-accent-700"
              >
                Editar em comum
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setSelection(new Set())}
                aria-label="Cancelar seleção"
                className="flex h-7 w-7 items-center justify-center rounded-full text-accent-700 transition-colors hover:bg-accent-200/60 dark:text-accent-200 dark:hover:bg-accent-700/40"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {view === 'library' && (
          <div className="space-y-6">
            <SearchBar
              onSelect={handleAddFromApi}
              onAddManually={(title) => setManualAddTitle(title)}
              batchCategory={batchCategory}
            />

            {books.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <FilterBar
                  books={books}
                  filters={filters}
                  onChange={setFilters}
                  resultCount={visibleBooks.length}
                />
                {visibleBooks.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-500 dark:text-ink-400">
                    Nenhum livro corresponde aos filtros atuais.
                  </p>
                ) : (
                  <>
                    <p className="text-center text-[11px] text-ink-400 dark:text-ink-500">
                      Dica: segure o dedo sobre um livro para selecionar vários de uma vez
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {visibleBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          onOpen={(b) => setSelectedId(b.id ?? null)}
                          selectionMode={selectionMode}
                          selected={book.id != null && selection.has(book.id)}
                          onToggleSelect={toggleSelect}
                          onEnterSelection={toggleSelect}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {view === 'calendar' && <CalendarView books={books} />}
        {view === 'stats' && <StatsView books={books} />}
      </main>

      <footer className="pb-8 text-center text-xs text-ink-400 dark:text-ink-500">
        Seus dados ficam salvos apenas neste dispositivo (IndexedDB) · Dados bibliográficos via Google Books e Open Library
      </footer>

      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          onClose={() => setSelectedId(null)}
          askReadOnReturn={settings.askReadOnReturn}
        />
      )}

      {manualAddTitle !== null && (
        <ManualAddModal
          initialTitle={manualAddTitle}
          onAdd={handleAddManually}
          onClose={() => setManualAddTitle(null)}
        />
      )}

      {batchModalOpen && (
        <BatchCategoryModal
          books={books}
          current={batchCategory}
          onSet={setBatchCategory}
          onClose={() => setBatchModalOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal settings={settings} onUpdate={updateSettings} onClose={() => setSettingsOpen(false)} />
      )}

      {bulkEditOpen && (
        <BulkEditModal
          books={selectedBooks}
          onDone={() => {
            setBulkEditOpen(false)
            setSelection(new Set())
          }}
          onClose={() => setBulkEditOpen(false)}
        />
      )}
    </div>
  )
}

const LANGUAGE_PT: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  ja: 'Japonês',
}

function languageLabel(code?: string): string | undefined {
  if (!code) return undefined
  return LANGUAGE_PT[code.toLowerCase().slice(0, 2)] ?? code
}
