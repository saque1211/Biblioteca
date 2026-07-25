import { useRef, useState } from 'react'
import { exportLibrary, importLibrary, type LibraryBackup } from '../db/db'
import type { Book } from '../types'
import { downloadFile } from '../utils/download'
import { exportBooksToXlsx, importBooksFromXlsx } from '../utils/excel'
import { formatCurrency } from '../utils/format'
import { Modal } from './ui/Modal'

export type View = 'library' | 'calendar' | 'stats'

interface HeaderProps {
  books: Book[]
  view: View
  onViewChange: (view: View) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  batchCategory: string | null
  onOpenBatchCategory: () => void
  onClearBatchCategory: () => void
  onOpenSettings: () => void
  showInvested: boolean
  showBatchCategory: boolean
}

export function Header({
  books,
  view,
  onViewChange,
  theme,
  onToggleTheme,
  batchCategory,
  onOpenBatchCategory,
  onClearBatchCategory,
  onOpenSettings,
  showInvested,
  showBatchCategory,
}: HeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const total = books.length
  const read = books.filter((b) => b.readingStatus === 'lido').length
  const invested = books.reduce((sum, b) => sum + (b.pricePaid ?? 0), 0)

  async function handleExportJson() {
    const data = await exportLibrary()
    await downloadFile(
      `biblioteca-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    )
  }

  async function handleExportExcel() {
    await exportBooksToXlsx(books)
  }

  async function handleImportFile(file: File) {
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        // Planilha (formato MyLibrary): SOMA os livros à biblioteca atual
        const { added, skipped } = await importBooksFromXlsx(file)
        setImportMsg(
          skipped > 0
            ? `${added} livros importados ✓ (${skipped} já existiam)`
            : `${added} livros importados ✓`,
        )
      } else {
        const text = await file.text()
        const data = JSON.parse(text) as LibraryBackup
        if (total > 0 && !confirm(`Importar o backup JSON substituirá seus ${total} livros atuais. Continuar?`)) return
        const { books: n } = await importLibrary(data)
        setImportMsg(`${n} livros importados ✓`)
      }
    } catch {
      setImportMsg('Arquivo inválido')
    }
    setTimeout(() => setImportMsg(null), 5000)
  }

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-ink-800 text-paper-50 dark:bg-paper-100 dark:text-ink-800'
        : 'text-ink-500 hover:bg-paper-200/70 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-paper-200'
    }`

  return (
    <header className="border-b border-paper-200/80 bg-white/70 backdrop-blur-md dark:border-ink-700 dark:bg-ink-900/70">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-lg text-white shadow-card">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold leading-tight text-ink-800 dark:text-paper-100">
                Minha Biblioteca
              </h1>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {total} {total === 1 ? 'livro' : 'livros'} · {read} {read === 1 ? 'lido' : 'lidos'}
                {showInvested && invested > 0 && <> · {formatCurrency(invested)} investidos</>}
              </p>
            </div>
          </div>

          <nav className="order-3 flex w-full justify-center gap-1 rounded-full bg-paper-100 p-1 dark:bg-ink-800 sm:order-none sm:w-auto" aria-label="Seções">
            <button type="button" className={tabClass(view === 'library')} onClick={() => onViewChange('library')}>
              Biblioteca
            </button>
            <button type="button" className={tabClass(view === 'calendar')} onClick={() => onViewChange('calendar')}>
              Agenda
            </button>
            <button type="button" className={tabClass(view === 'stats')} onClick={() => onViewChange('stats')}>
              Estatísticas
            </button>
          </nav>

          <div className="flex items-center gap-1.5">
            {importMsg && <span className="text-xs text-accent-600 dark:text-accent-400">{importMsg}</span>}
            <IconButton title="Exportar biblioteca" onClick={() => setExportMenuOpen(true)}>
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </IconButton>
            <IconButton title="Importar biblioteca (.xlsx ou .json)" onClick={() => fileRef.current?.click()}>
              <path d="M12 15V3m0 0L8 7m4-4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </IconButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImportFile(f)
                e.target.value = ''
              }}
            />
            <IconButton title="Configurações" onClick={onOpenSettings}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round" />
            </IconButton>
            <IconButton title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} onClick={onToggleTheme}>
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4.5" />
                  <path d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.3-6.8l-1.5 1.5M6.7 17.3l-1.5 1.5m0-13.6l1.5 1.5m10.6 10.6l1.5 1.5" strokeLinecap="round" />
                </>
              ) : (
                <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" strokeLinejoin="round" />
              )}
            </IconButton>
          </div>
        </div>

        {/* Chip da categoria em lote ativa (só no perfil escolar/corporativo) */}
        {showBatchCategory && (
        <div className="mt-3 flex justify-center">
          {batchCategory ? (
            <div className="flex animate-pop items-center gap-2 rounded-full border border-accent-200 bg-accent-100 py-1.5 pl-4 pr-2 text-sm text-accent-700 shadow-card dark:border-accent-700/50 dark:bg-accent-700/25 dark:text-accent-200">
              <span>
                Adicionando como: <strong className="font-semibold">{batchCategory}</strong>
              </span>
              <button
                type="button"
                onClick={onClearBatchCategory}
                title="Desativar categoria em lote"
                className="flex h-6 w-6 items-center justify-center rounded-full text-accent-600 transition-colors hover:bg-accent-200 dark:text-accent-300 dark:hover:bg-accent-700/50"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenBatchCategory}
              className="rounded-full border border-dashed border-paper-300 px-4 py-1.5 text-xs text-ink-500 transition-colors hover:border-accent-400 hover:text-accent-600 dark:border-ink-600 dark:text-ink-400 dark:hover:border-accent-500 dark:hover:text-accent-400"
            >
              + Ativar categoria de aquisição em lote
            </button>
          )}
        </div>
        )}
      </div>

      {exportMenuOpen && (
        <Modal title="Exportar biblioteca" onClose={() => setExportMenuOpen(false)} maxWidth="max-w-sm">
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false)
                handleExportExcel()
              }}
              className="w-full rounded-xl border border-paper-200 p-3.5 text-left transition-colors hover:border-accent-500 hover:bg-paper-100 dark:border-ink-700 dark:hover:bg-ink-700"
            >
              <span className="block text-sm font-semibold text-ink-800 dark:text-paper-100">📊 Planilha Excel (.xlsx)</span>
              <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
                Lista de livros com capas — abre no Excel e pode ser reimportada
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false)
                handleExportJson()
              }}
              className="w-full rounded-xl border border-paper-200 p-3.5 text-left transition-colors hover:border-accent-500 hover:bg-paper-100 dark:border-ink-700 dark:hover:bg-ink-700"
            >
              <span className="block text-sm font-semibold text-ink-800 dark:text-paper-100">🗂 Backup completo (.json)</span>
              <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
                Recomendado — guarda tudo: empréstimos, agenda, estatísticas e fotos
              </span>
            </button>
          </div>
        </Modal>
      )}
    </header>
  )
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-paper-200/70 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-paper-200"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7}>
        {children}
      </svg>
    </button>
  )
}
