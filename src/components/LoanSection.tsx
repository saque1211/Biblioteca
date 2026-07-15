import { useState } from 'react'
import type { Book, LoanRecord } from '../types'
import { formatDate, todayISO } from '../utils/format'
import { activeLoan, isOverdue, newLoanId } from '../utils/loans'
import { Badge } from './ui/Badge'
import { Field, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

interface LoanSectionProps {
  draft: Book
  onChange: (loans: LoanRecord[]) => void
  askReadOnReturn: boolean
}

/**
 * Controle de empréstimo do exemplar: ativa/desativa, registra para quem foi,
 * quando, devolução prevista, e guarda o histórico para as estatísticas.
 */
export function LoanSection({ draft, onChange, askReadOnReturn }: LoanSectionProps) {
  const loans = draft.loans ?? []
  const current = activeLoan(draft)
  const [confirmReturn, setConfirmReturn] = useState(false)
  const history = loans.filter((l) => l.returnedAt).sort((a, b) => (b.returnedAt! < a.returnedAt! ? -1 : 1))

  function startLoan() {
    onChange([...loans, { id: newLoanId(), name: '', takenAt: todayISO() }])
  }

  function updateCurrent(changes: Partial<LoanRecord>) {
    if (!current) return
    onChange(loans.map((l) => (l.id === current.id ? { ...l, ...changes } : l)))
  }

  function cancelLoan() {
    if (!current) return
    onChange(loans.filter((l) => l.id !== current.id))
  }

  function finishReturn(completed?: boolean) {
    updateCurrent({ returnedAt: todayISO(), completed })
    setConfirmReturn(false)
  }

  function handleReturnClick() {
    if (askReadOnReturn) setConfirmReturn(true)
    else finishReturn(undefined)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600 dark:text-paper-300">
          {current ? (
            <>
              Emprestado{' '}
              {isOverdue(current) && <Badge tone="red" className="ml-1">Devolução atrasada</Badge>}
            </>
          ) : (
            'Este livro está na biblioteca'
          )}
        </span>
        {current ? (
          <button
            type="button"
            onClick={cancelLoan}
            className="text-xs text-ink-400 underline-offset-2 hover:text-rose-500 hover:underline dark:text-ink-500"
          >
            Cancelar empréstimo
          </button>
        ) : (
          <button
            type="button"
            onClick={startLoan}
            className="rounded-full bg-accent-600 px-4 py-1.5 text-xs font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            Emprestar livro
          </button>
        )}
      </div>

      {current && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
          <Field label="Nome da criança / leitor">
            <TextInput
              placeholder="Quem levou o livro"
              value={current.name}
              onChange={(e) => updateCurrent({ name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data em que foi pego">
              <TextInput type="date" value={current.takenAt} onChange={(e) => updateCurrent({ takenAt: e.target.value || todayISO() })} />
            </Field>
            <Field label="Devolução prevista">
              <TextInput
                type="date"
                value={current.dueAt ?? ''}
                disabled={current.dueAt === undefined}
                className="disabled:opacity-40"
                onChange={(e) => updateCurrent({ dueAt: e.target.value || undefined })}
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
            <input
              type="checkbox"
              checked={current.dueAt === undefined}
              onChange={(e) => updateCurrent({ dueAt: e.target.checked ? undefined : todayISO() })}
              className="h-4 w-4 accent-[var(--color-accent-600)]"
            />
            Data de entrega não definida
          </label>
          <button
            type="button"
            onClick={handleReturnClick}
            className="w-full rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            ✓ Livro devolvido
          </button>
        </div>
      )}

      {history.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-ink-500 dark:text-ink-400">
            Histórico de empréstimos ({history.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {history.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500 dark:text-ink-400">
                <span className="font-medium text-ink-600 dark:text-paper-300">{l.name || 'Sem nome'}</span>
                <span>{formatDate(l.takenAt)} → {formatDate(l.returnedAt)}</span>
                {l.completed === true && <Badge tone="green">Leu por completo</Badge>}
                {l.completed === false && <Badge>Apenas devolvido</Badge>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {confirmReturn && current && (
        <Modal title="Devolução do livro" onClose={() => setConfirmReturn(false)} maxWidth="max-w-sm">
          <p className="mb-4 text-sm leading-relaxed text-ink-600 dark:text-paper-300">
            {current.name ? <strong>{current.name}</strong> : 'A criança'} leu{' '}
            <em>“{draft.title}”</em> por completo ou apenas devolveu?
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => finishReturn(true)}
              className="rounded-xl bg-accent-600 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
            >
              📖 Leu por completo
            </button>
            <button
              type="button"
              onClick={() => finishReturn(false)}
              className="rounded-xl border border-paper-300 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
            >
              Apenas devolvido
            </button>
            <button
              type="button"
              onClick={() => setConfirmReturn(false)}
              className="py-1 text-xs text-ink-400 hover:text-ink-600 dark:text-ink-500"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-ink-400 dark:text-ink-500">
            Essa pergunta pode ser desativada nas configurações ⚙️
          </p>
        </Modal>
      )}
    </div>
  )
}
