import { useEffect, useRef, useState } from 'react'
import { searchBooks } from '../api/books'
import type { ApiBookResult } from '../types'
import { authorsLabel } from '../utils/format'
import { Cover } from './ui/Cover'

interface SearchBarProps {
  onSelect: (result: ApiBookResult) => Promise<void> | void
  onAddManually: (initialTitle: string) => void
  batchCategory: string | null
}

export function SearchBar({ onSelect, onAddManually, batchCategory }: SearchBarProps) {
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
    await onSelect(result)
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

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-2xl">
      <div className="relative">
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
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 3 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Busque por título, autor ou ISBN para adicionar…"
          aria-label="Buscar livro para adicionar"
          className="w-full rounded-2xl border border-paper-300 bg-white py-3.5 pl-12 pr-12 text-[15px] text-ink-700 shadow-card transition-all placeholder:text-ink-400 focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15 dark:border-ink-600 dark:bg-ink-800 dark:text-paper-100 dark:placeholder:text-ink-500"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-paper-300 border-t-accent-500" />
          </div>
        )}
      </div>

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
