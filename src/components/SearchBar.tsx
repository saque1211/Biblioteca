import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../api/books'
import type { ApiBookResult } from '../types'
import { authorsLabel } from '../utils/format'
import { Cover } from './ui/Cover'

interface SearchBarProps {
  onSelect: (result: ApiBookResult) => Promise<void> | void
  onAddManually: (initialTitle: string) => void
  onScan: () => void
  batchCategory: string | null
  /** Começa aberta (ex.: biblioteca vazia); caso contrário fica minimizada. */
  startExpanded?: boolean
  /** Consulta vinda de fora (ex.: scanner) — abre a busca já preenchida. */
  prefillQuery?: string | null
  onPrefillConsumed?: () => void
  /** Esconde o botão de escanear (ex.: na lista de desejos). */
  hideScan?: boolean
  /** Texto do campo de busca. */
  placeholder?: string
}

export function SearchBar({ onSelect, onAddManually, onScan, batchCategory, startExpanded = false, prefillQuery, onPrefillConsumed, hideScan = false, placeholder }: SearchBarProps) {
  const [expanded, setExpanded] = useState(startExpanded)

  useEffect(() => {
    if (startExpanded) setExpanded(true)
  }, [startExpanded])

  useEffect(() => {
    if (prefillQuery == null) return
    setExpanded(true)
    setQuery(prefillQuery)
    onPrefillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillQuery])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApiBookResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Busca com debounce enquanto digita
  useEffect(() => {
    abortRef.current?.abort()
    setError(null)
    if (query.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setOpen(true)
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      try {
        const found = await searchBooks(query, controller.signal)
        setResults(found)
        setHighlighted(-1)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setResults([])
          setError('Não foi possível buscar agora. Verifique sua conexão ou adicione manualmente.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleSelect(result: ApiBookResult) {
    try {
      await onSelect(result)
    } catch {
      setError('Não foi possível salvar o livro. Feche o app completamente e abra de novo — se continuar, recarregue a página.')
      return
    }
    setJustAdded(result.title)
    setQuery('')
    setResults([])
    setOpen(false)
    setTimeout(() => setJustAdded(null), 2500)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 3

  const pillClass =
    'flex items-center gap-2 rounded-full border border-paper-300 bg-white px-4 py-1.5 text-xs font-medium text-ink-500 shadow-card transition-all hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-400 dark:hover:border-accent-500 dark:hover:text-accent-400'

  // Minimizada: só botões discretos para abrir a busca ou o scanner
  if (!expanded) {
    return (
      <div className="flex justify-center gap-2">
        <button type="button" onClick={() => setExpanded(true)} className={pillClass}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          Buscar e adicionar livro
        </button>
        {!hideScan && (
          <button type="button" onClick={onScan} className={pillClass}>
            📷 Escanear capa
          </button>
        )}
        {justAdded && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-pop whitespace-nowrap rounded-full bg-accent-600 px-4 py-1.5 text-sm font-medium text-white shadow-card">
            ✓ “{justAdded}” adicionado
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative mx-auto flex w-full max-w-2xl items-center gap-2">
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          autoFocus={!startExpanded}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 3 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Busque por título, autor ou ISBN para adicionar…'}
          aria-label="Buscar livro para adicionar"
          className="w-full rounded-2xl border border-paper-300 bg-white py-3.5 pl-12 pr-12 text-[15px] text-ink-700 shadow-card transition-all placeholder:text-ink-400 focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15 dark:border-ink-600 dark:bg-ink-800 dark:text-paper-100 dark:placeholder:text-ink-500"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-paper-300 border-t-accent-500" />
          </div>
        )}
      </div>
      {!hideScan && (
        <button
          type="button"
          title="Escanear capa com a câmera"
          aria-label="Escanear capa com a câmera"
          onClick={onScan}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-paper-200/70 hover:text-accent-600 dark:text-ink-500 dark:hover:bg-ink-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M4 8a2 2 0 0 1 2-2h1.5l1.2-1.8A1.5 1.5 0 0 1 10 3.5h4a1.5 1.5 0 0 1 1.3.7L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" strokeLinejoin="round" />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
        </button>
      )}
      {!startExpanded && (
        <button
          type="button"
          aria-label="Fechar busca"
          onClick={() => {
            setQuery('')
            setOpen(false)
            setExpanded(false)
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-paper-200/70 hover:text-ink-600 dark:text-ink-500 dark:hover:bg-ink-700"
        >
          ✕
        </button>
      )}

      {justAdded && (
        <div className="absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 animate-pop whitespace-nowrap rounded-full bg-accent-600 px-4 py-1.5 text-sm font-medium text-white shadow-card">
          ✓ “{justAdded}” adicionado à biblioteca
        </div>
      )}

      {showDropdown && (
        <div className="absolute z-30 mt-2 w-full animate-slide-up overflow-hidden rounded-2xl border border-paper-200 bg-white shadow-panel dark:border-ink-700 dark:bg-ink-800">
          {batchCategory && (
            <div className="border-b border-paper-200 bg-accent-100/60 px-4 py-2 text-xs text-accent-700 dark:border-ink-700 dark:bg-accent-700/20 dark:text-accent-200">
              Os livros adicionados entrarão na categoria <strong>{batchCategory}</strong>
            </div>
          )}
          {error && <p className="px-4 py-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {!error && results.length === 0 && !loading && (
            <p className="px-4 py-4 text-sm text-ink-500 dark:text-ink-400">Nenhum resultado encontrado.</p>
          )}
          {!error && results.length === 0 && loading && (
            <p className="px-4 py-4 text-sm text-ink-400 dark:text-ink-500">Buscando…</p>
          )}
          <ul className="max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <li key={r.externalId}>
                <button
                  type="button"
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    highlighted === i ? 'bg-paper-100 dark:bg-ink-700' : ''
                  }`}
                >
                  <Cover url={r.coverThumb} title={r.title} className="h-14 w-10 shrink-0 rounded-md shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-700 dark:text-paper-100">{r.title}</p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                      {authorsLabel(r.authors)}
                      {r.publishedYear ? ` · ${r.publishedYear}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
                    + Adicionar
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onAddManually(query)
            }}
            className="w-full border-t border-paper-200 px-4 py-3 text-left text-sm font-medium text-accent-600 transition-colors hover:bg-paper-100 dark:border-ink-700 dark:text-accent-400 dark:hover:bg-ink-700"
          >
            Não encontrou? Adicionar “{query}” manualmente →
          </button>
        </div>
      )}
    </div>
  )
}
