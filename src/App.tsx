import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BatchCategoryModal } from './components/BatchCategoryModal'
import { BookCard } from './components/BookCard'
import { BookDetailPanel } from './components/BookDetailPanel'
import { CalendarView } from './components/CalendarView'
import { EmptyState } from './components/EmptyState'
import { applyFilters, DEFAULT_FILTERS, FilterBar, type Filters } from './components/FilterBar'
import { Header } from './components/Header'
import { ManualAddModal } from './components/ManualAddModal'
import { SearchBar } from './components/SearchBar'
import { enrichSynopsis } from './api/books'
import { addBook, db, updateBook } from './db/db'
import { useBatchCategory } from './hooks/useBatchCategory'
import { useTheme } from './hooks/useTheme'
import type { ApiBookResult, Book } from './types'
import { todayISO } from './utils/format'

type View = 'library' | 'calendar'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { batchCategory, setBatchCategory } = useBatchCategory()

  const [view, setView] = useState<View>('library')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [manualAddTitle, setManualAddTitle] = useState<string | null>(null)
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  const books = useLiveQuery(() => db.books.toArray(), []) ?? []
  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedId) ?? null,
    [books, selectedId],
  )
  const visibleBooks = useMemo(() => applyFilters(books, filters), [books, filters])

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
    // Resultados da Open Library não trazem sinopse na busca; completa em segundo plano
    if (!result.synopsis && result.workKey) {
      enrichSynopsis(result).then((synopsis) => {
        if (synopsis) updateBook(id, { synopsis })
      })
    }
  }

  async function handleAddManually(data: Pick<Book, 'title' | 'authors' | 'coverUrl' | 'genre' | 'isbn' | 'publisher' | 'publishedYear' | 'pageCount' | 'synopsis'>) {
    await addBook({ ...data, ...newBookDefaults() })
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
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {view === 'library' ? (
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleBooks.map((book) => (
                      <BookCard key={book.id} book={book} onOpen={(b) => setSelectedId(b.id ?? null)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <CalendarView books={books} />
        )}
      </main>

      <footer className="pb-8 text-center text-xs text-ink-400 dark:text-ink-500">
        Seus dados ficam salvos apenas neste dispositivo (IndexedDB) · Dados bibliográficos via Google Books e Open Library
      </footer>

      {selectedBook && <BookDetailPanel book={selectedBook} onClose={() => setSelectedId(null)} />}

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
  return LANGUAGE_PT[code] ?? code
}
