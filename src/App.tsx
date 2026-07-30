import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { enrichBookDetails } from './api/books'
import { toMyMemoryLang, translateText } from './api/translate'
import { BatchCategoryModal } from './components/BatchCategoryModal'
import { BookCard } from './components/BookCard'
import { BookDetailPanel } from './components/BookDetailPanel'
import { BulkEditModal } from './components/BulkEditModal'
import { CalendarView } from './components/CalendarView'
import { DonationModal } from './components/DonationModal'
import { EmptyState } from './components/EmptyState'
import { applyFilters, DEFAULT_FILTERS, FilterBar, type Filters } from './components/FilterBar'
import { Header, type View } from './components/Header'
import { ManualAddModal, type ManualAddInitial } from './components/ManualAddModal'
import { ProfileModal } from './components/ProfileModal'
import { ScanCoverModal } from './components/ScanCoverModal'
import { SearchBar } from './components/SearchBar'
import { SettingsModal } from './components/SettingsModal'
import { StatsView } from './components/StatsView'
import { addBook, db, deleteBook, ensureDbOpen, updateBook, type DbStatus } from './db/db'
import { useBatchCategory } from './hooks/useBatchCategory'
import { profileFlags, useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import type { ApiBookResult, Book } from './types'
import { formatDate, todayISO } from './utils/format'
import { coverFromIsbn } from './utils/isbnCover'
import { overdueBooks } from './utils/loans'
import { retroTranslateTitles } from './utils/retroTranslate'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { batchCategory, setBatchCategory } = useBatchCategory()
  const { settings, updateSettings } = useSettings()

  const [view, setView] = useState<View>('library')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [manualAdd, setManualAdd] = useState<ManualAddInitial | null>(null)
  const [manualWishlist, setManualWishlist] = useState(false)
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [donationsOpen, setDonationsOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const flags = profileFlags(settings.profile)
  const [searchPrefill, setSearchPrefill] = useState<string | null>(null)

  // Seleção múltipla (toque longo num card)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const selectionMode = selection.size > 0

  // Saúde do banco: uma versão antiga do app (em cache) com banco já migrado
  // falharia silenciosamente — detecta, tenta recarregar sozinho uma vez e,
  // se não resolver, mostra instruções em vez de quebrar calado
  const [dbStatus, setDbStatus] = useState<DbStatus>('ok')
  useEffect(() => {
    ensureDbOpen().then((status) => {
      const key = 'biblioteca-auto-reloaded'
      if (status === 'ok') {
        sessionStorage.removeItem(key)
        setDbStatus('ok')
        return
      }
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        location.reload()
        return
      }
      setDbStatus(status)
    })
  }, [])

  const books = useLiveQuery(() => db.books.toArray(), []) ?? []
  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedId) ?? null,
    [books, selectedId],
  )
  // A lista de desejos é separada da biblioteca: livros marcados como
  // `wishlist` ficam só na aba Desejos, não se misturam com o acervo.
  const ownedBooks = useMemo(() => books.filter((b) => !b.wishlist), [books])
  const wishlistBooks = useMemo(
    () => books.filter((b) => b.wishlist).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [books],
  )
  const visibleBooks = useMemo(() => applyFilters(ownedBooks, filters), [ownedBooks, filters])
  const selectedBooks = useMemo(
    () => books.filter((b) => b.id != null && selection.has(b.id)),
    [books, selection],
  )
  const overdue = useMemo(() => overdueBooks(ownedBooks), [ownedBooks])

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

  async function handleAddFromApi(result: ApiBookResult, wishlist = false) {
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
      // Item da lista de desejos: sem categoria de aquisição
      ...(wishlist ? { wishlist: true, acquisitionCategory: undefined, acquisitionDate: undefined } : {}),
    })

    // Capa faltando (comum em edições brasileiras no Google): tenta a Open
    // Library por ISBN em segundo plano
    if (!result.coverUrl && result.isbn) {
      coverFromIsbn(result.isbn).then((cover) => {
        if (cover) updateBook(id, { coverUrl: cover })
      })
    }

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

  async function handleAddManually(
    data: Pick<Book, 'title' | 'authors' | 'coverUrl' | 'genre' | 'isbn' | 'publisher' | 'publishedYear' | 'pageCount' | 'synopsis'>,
    wishlist = false,
  ) {
    const id = await addBook({ ...data, ...newBookDefaults(), ...(wishlist ? { wishlist: true } : {}) })
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

  if (dbStatus !== 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md animate-pop rounded-2xl border border-paper-200/80 bg-white p-6 text-center shadow-card dark:border-ink-700 dark:bg-ink-800">
          <p className="text-3xl">🔄</p>
          <h1 className="mt-3 font-serif text-lg font-semibold text-ink-800 dark:text-paper-100">
            O app precisa se atualizar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {dbStatus === 'version-error' &&
              'Este aparelho ainda está com uma versão antiga do app em cache. Seus livros estão seguros — toque em recarregar (pode precisar de 2 vezes) ou feche o app completamente e abra de novo.'}
            {dbStatus === 'blocked' &&
              'Outra janela deste app está segurando o armazenamento. Feche as outras abas do navegador com a biblioteca aberta (e o app da tela inicial, se estiver aberto em dois lugares) e toque em recarregar. Seus livros estão seguros.'}
            {dbStatus === 'error' &&
              'Não foi possível abrir o armazenamento. Feche outras abas/janelas deste app e toque em recarregar.'}
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-4 rounded-xl bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            Recarregar agora
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header
        books={ownedBooks}
        view={view}
        onViewChange={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
        batchCategory={batchCategory}
        onOpenBatchCategory={() => setBatchModalOpen(true)}
        onClearBatchCategory={() => setBatchCategory(null)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDonations={() => setDonationsOpen(true)}
        showInvested={flags.invested}
        showBatchCategory={flags.batchCategory}
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
              onAddManually={(title) => {
                setManualWishlist(false)
                setManualAdd({ title })
              }}
              onScan={() => setScanOpen(true)}
              batchCategory={batchCategory}
              startExpanded={ownedBooks.length === 0}
              prefillQuery={searchPrefill}
              onPrefillConsumed={() => setSearchPrefill(null)}
            />

            {ownedBooks.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <FilterBar
                  books={ownedBooks}
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
        {view === 'wishlist' && (
          <div className="space-y-6">
            <SearchBar
              onSelect={(r) => handleAddFromApi(r, true)}
              onAddManually={(title) => {
                setManualWishlist(true)
                setManualAdd({ title })
              }}
              onScan={() => setScanOpen(true)}
              hideScan
              batchCategory={null}
              startExpanded
              placeholder="Busque um livro para desejar…"
            />
            <p className="text-center text-[11px] text-ink-400 dark:text-ink-500">
              Livros que você quer comprar ficam aqui, separados da sua biblioteca.
            </p>

            {wishlistBooks.length === 0 ? (
              <div className="mx-auto max-w-md py-10 text-center">
                <p className="text-4xl">🔖</p>
                <h2 className="mt-3 font-serif text-lg font-semibold text-ink-800 dark:text-paper-100">
                  Sua lista de desejos está vazia
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                  Use a busca acima para adicionar livros que você quer comprar. Depois é só tocar em
                  “Ver na Amazon / Mercado Livre” para ver o preço e comprar.
                </p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-ink-500 dark:text-ink-400">
                  {wishlistBooks.length} {wishlistBooks.length === 1 ? 'livro desejado' : 'livros desejados'} · toque para ver onde comprar
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {wishlistBooks.map((book) => (
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
          </div>
        )}
        {view === 'calendar' && <CalendarView books={ownedBooks} />}
        {view === 'stats' && (
          <StatsView
            books={ownedBooks}
            showChildStats={flags.childStats}
            showInvested={flags.invested}
            onOpenFiltered={(partial) => {
              setFilters({ ...DEFAULT_FILTERS, ...partial })
              setView('library')
            }}
            onOpenBook={(id) => {
              setView('library')
              setSelectedId(id)
            }}
          />
        )}
      </main>

      <footer className="pb-8 text-center text-xs text-ink-400 dark:text-ink-500">
        Seus dados ficam salvos apenas neste dispositivo (IndexedDB) · Dados bibliográficos via Google Books e Open Library
      </footer>

      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          onClose={() => setSelectedId(null)}
          askReadOnReturn={settings.askReadOnReturn}
          showClassReading={flags.classReading}
        />
      )}

      {manualAdd !== null && (
        <ManualAddModal
          initial={manualAdd}
          onAdd={(data) => handleAddManually(data, manualWishlist)}
          onClose={() => {
            setManualAdd(null)
            setManualWishlist(false)
          }}
        />
      )}

      {scanOpen && (
        <ScanCoverModal
          onAddApi={handleAddFromApi}
          onManual={(prefill) => setManualAdd(prefill)}
          onSearchMore={(query) => setSearchPrefill(query)}
          onClose={() => setScanOpen(false)}
        />
      )}

      {batchModalOpen && (
        <BatchCategoryModal
          books={ownedBooks}
          current={batchCategory}
          onSet={setBatchCategory}
          onClose={() => setBatchModalOpen(false)}
        />
      )}

      {donationsOpen && (
        <DonationModal onClose={() => setDonationsOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
          onChangeProfile={() => {
            setSettingsOpen(false)
            setProfileModalOpen(true)
          }}
        />
      )}

      {/* Escolha do perfil: obrigatória na primeira vez, ou aberta pelas configurações */}
      {(settings.profile === undefined || profileModalOpen) && (
        <ProfileModal
          current={settings.profile}
          mandatory={settings.profile === undefined}
          onChoose={(profile) => {
            updateSettings({ profile })
            setProfileModalOpen(false)
          }}
          onClose={() => setProfileModalOpen(false)}
        />
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
