import { useMemo, useState } from 'react'
import type { Book } from '../types'
import { Field, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

interface BatchCategoryModalProps {
  books: Book[]
  current: string | null
  onSet: (category: string) => void
  onClose: () => void
}

/** Define a categoria de aquisição aplicada automaticamente aos próximos livros adicionados. */
export function BatchCategoryModal({ books, current, onSet, onClose }: BatchCategoryModalProps) {
  const [value, setValue] = useState(current ?? '')

  const existing = useMemo(
    () => [...new Set(books.map((b) => b.acquisitionCategory).filter((c): c is string => !!c))].sort(),
    [books],
  )

  function apply(category: string) {
    const c = category.trim()
    if (!c) return
    onSet(c)
    onClose()
  }

  return (
    <Modal title="Categoria de aquisição em lote" onClose={onClose}>
      <p className="mb-4 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        Com uma categoria ativa, <strong>todos os próximos livros adicionados</strong> entram
        automaticamente com ela preenchida — útil para catalogar um lote de uma vez
        (ex.: “Doação Sicredi”).
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply(value)
        }}
      >
        <Field label="Nome da categoria">
          <TextInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ex.: Doação Sicredi"
            autoFocus
          />
        </Field>
        {existing.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              Categorias já usadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {existing.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => apply(c)}
                  className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-600 transition-colors hover:border-accent-500 hover:bg-accent-100/60 hover:text-accent-700 dark:border-ink-600 dark:text-paper-300 dark:hover:bg-accent-700/20"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-100 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-xl bg-accent-600 px-5 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98] disabled:opacity-40"
          >
            Ativar categoria
          </button>
        </div>
      </form>
    </Modal>
  )
}
