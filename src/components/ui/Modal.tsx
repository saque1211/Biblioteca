import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  /** false = não pode fechar sem concluir (sem X, sem Esc, sem clicar fora). */
  dismissable?: boolean
}

export function Modal({ title, onClose, children, maxWidth = 'max-w-lg', dismissable = true }: ModalProps) {
  useEffect(() => {
    if (!dismissable) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissable])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]"
        onClick={dismissable ? onClose : undefined}
      />
      <div className={`relative w-full ${maxWidth} max-h-[90vh] animate-pop overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-800`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ink-800 dark:text-paper-100">{title}</h2>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-paper-100 dark:text-ink-400 dark:hover:bg-ink-700"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
