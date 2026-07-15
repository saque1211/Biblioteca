import type { Book, ClassReading } from '../types'
import { formatDate, todayISO } from '../utils/format'
import { newLoanId } from '../utils/loans'
import { Badge } from './ui/Badge'
import { TextInput } from './ui/Field'

interface ClassReadingSectionProps {
  draft: Book
  onChange: (readings: ClassReading[]) => void
}

/**
 * Leituras em aula: o livro fica na biblioteca e cada criança tem um
 * marcador com a página em que parou, atualizado a cada aula.
 * Assim como os empréstimos, as mudanças são gravadas na hora.
 */
export function ClassReadingSection({ draft, onChange }: ClassReadingSectionProps) {
  const readings = draft.classReadings ?? []
  const active = readings.filter((r) => !r.finishedAt)
  const finished = readings
    .filter((r) => r.finishedAt)
    .sort((a, b) => (b.finishedAt! < a.finishedAt! ? -1 : 1))

  function add() {
    onChange([
      ...readings,
      { id: newLoanId(), name: '', startedAt: todayISO(), updatedAt: todayISO() },
    ])
  }

  function update(id: string, changes: Partial<ClassReading>) {
    onChange(readings.map((r) => (r.id === id ? { ...r, ...changes, updatedAt: todayISO() } : r)))
  }

  function remove(id: string) {
    onChange(readings.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600 dark:text-paper-300">
          {active.length === 0
            ? 'Nenhuma leitura em aula agora'
            : `${active.length} ${active.length === 1 ? 'criança lendo' : 'crianças lendo'} em aula`}
        </span>
        <button
          type="button"
          onClick={add}
          className="rounded-full border border-accent-500 px-4 py-1.5 text-xs font-semibold text-accent-600 transition-colors hover:bg-accent-100/60 dark:text-accent-400 dark:hover:bg-accent-700/20"
        >
          + Nova leitura em aula
        </button>
      </div>

      {active.map((reading) => (
        <div
          key={reading.id}
          className="space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-900/15"
        >
          <div className="flex items-center gap-2">
            <TextInput
              placeholder="Nome da criança"
              value={reading.name}
              onChange={(e) => update(reading.id, { name: e.target.value })}
            />
            <button
              type="button"
              aria-label="Remover leitura em aula"
              onClick={() => remove(reading.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600 dark:text-paper-300">
            <span>Parou na página</span>
            <TextInput
              type="number"
              min={0}
              max={draft.pageCount || undefined}
              inputMode="numeric"
              className="!w-24"
              placeholder="0"
              aria-label="Página em que parou"
              value={reading.currentPage ?? ''}
              onChange={(e) =>
                update(reading.id, { currentPage: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
            {draft.pageCount ? <span className="text-xs text-ink-400 dark:text-ink-500">de {draft.pageCount}</span> : null}
            <span className="ml-auto text-[11px] text-ink-400 dark:text-ink-500">
              atualizado em {formatDate(reading.updatedAt)}
            </span>
          </div>
          {draft.pageCount && reading.currentPage ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-ink-700">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${Math.min(100, (reading.currentPage / draft.pageCount) * 100)}%` }}
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => update(reading.id, { finishedAt: todayISO(), currentPage: draft.pageCount ?? reading.currentPage })}
            className="w-full rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            📖 Concluiu a leitura
          </button>
        </div>
      ))}

      {finished.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-ink-500 dark:text-ink-400">
            Leituras em aula concluídas ({finished.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {finished.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500 dark:text-ink-400">
                <span className="font-medium text-ink-600 dark:text-paper-300">{r.name || 'Sem nome'}</span>
                <span>{formatDate(r.startedAt)} → {formatDate(r.finishedAt)}</span>
                <Badge tone="green">Leu por completo</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
