import { useEffect, useState } from 'react'
import { translateText } from '../api/translate'
import { deleteBook, updateBook } from '../db/db'
import type { Book, BookCondition, BookFormat, ClassReading, LoanRecord, Origin, ReadingStatus } from '../types'
import { CONDITION_LABELS, FORMAT_LABELS, ORIGIN_LABELS, READING_STATUS_LABELS } from '../types'
import { authorsLabel } from '../utils/format'
import { ClassReadingSection } from './ClassReadingSection'
import { LoanSection } from './LoanSection'
import { Badge } from './ui/Badge'
import { Cover } from './ui/Cover'
import { CoverPicker } from './ui/CoverPicker'
import { Field, FieldGroup, Select, TextArea, TextInput } from './ui/Field'
import { StarRating } from './ui/StarRating'

interface BookDetailPanelProps {
  book: Book
  onClose: () => void
  askReadOnReturn: boolean
  showClassReading: boolean
}

/** Painel lateral de detalhes: dados bibliográficos + informações pessoais editáveis. */
export function BookDetailPanel({ book, onClose, askReadOnReturn, showClassReading }: BookDetailPanelProps) {
  const [draft, setDraft] = useState<Book>(book)
  const [tagInput, setTagInput] = useState('')
  const [saved, setSaved] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translateMsg, setTranslateMsg] = useState<string | null>(null)

  // Recarrega o rascunho só quando OUTRO livro é aberto — atualizações de
  // fundo (empréstimo salvo na hora, tradução) não podem apagar edições em curso
  useEffect(() => {
    setDraft(book)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id])

  /**
   * Empréstimos são gravados imediatamente (sem esperar "Salvar alterações"):
   * emprestar/devolver é uma ação, não uma edição de formulário — e as
   * estatísticas dependem desses registros.
   */
  function setLoansNow(loans: LoanRecord[]) {
    setDraft((d) => ({ ...d, loans }))
    if (book.id != null) updateBook(book.id, { loans })
  }

  /** Leituras em aula também gravam na hora (página em que parou, conclusão). */
  function setClassReadingsNow(classReadings: ClassReading[]) {
    setDraft((d) => ({ ...d, classReadings }))
    if (book.id != null) updateBook(book.id, { classReadings })
  }

  // Fecha com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function set<K extends keyof Book>(key: K, value: Book[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function save() {
    if (book.id == null) return
    const { id: _id, ...changes } = draft
    await updateBook(book.id, changes)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  async function handleDelete() {
    if (book.id == null) return
    if (!confirm(`Remover “${book.title}” da biblioteca?`)) return
    await deleteBook(book.id)
    onClose()
  }

  async function handleTranslateTitle() {
    setTranslating(true)
    setTranslateMsg(null)
    const translated = await translateText(draft.title, 'auto', 'pt-BR')
    setTranslating(false)
    if (translated) {
      setDraft((d) => ({ ...d, title: translated, originalTitle: d.originalTitle ?? d.title }))
      setTranslateMsg('Traduzido — salve para confirmar')
    } else {
      setTranslateMsg('Já está em português ou a tradução está indisponível agora')
    }
    setTimeout(() => setTranslateMsg(null), 4000)
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !draft.tags.includes(t)) set('tags', [...draft.tags, t])
    setTagInput('')
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Detalhes de ${book.title}`}>
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl animate-slide-in flex-col bg-paper-50 shadow-panel dark:bg-ink-900">
        {/* Cabeçalho fixo */}
        <div className="flex items-start gap-4 border-b border-paper-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
          <Cover url={draft.coverUrl} title={draft.title} className="h-32 w-22 shrink-0 rounded-xl shadow-card" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold leading-tight text-ink-800 dark:text-paper-100">
              {draft.title}
            </h2>
            {draft.originalTitle && draft.originalTitle !== draft.title && (
              <p className="mt-0.5 text-xs italic text-ink-400 dark:text-ink-500">
                Título original: {draft.originalTitle}
              </p>
            )}
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{authorsLabel(draft.authors)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.genre && <Badge tone="accent">{draft.genre}</Badge>}
              {draft.publishedYear && <Badge>{draft.publishedYear}</Badge>}
              {draft.pageCount ? <Badge>{draft.pageCount} págs.</Badge> : null}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <StarRating value={draft.rating} onChange={(v) => set('rating', v)} />
              <button
                type="button"
                onClick={() => set('favorite', !draft.favorite)}
                title={draft.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 ${
                  draft.favorite ? 'text-rose-500' : 'text-ink-400 hover:text-rose-400'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill={draft.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6}>
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-paper-200 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {draft.synopsis && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-ink-600 dark:text-paper-300">
                Sinopse
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                {draft.synopsis}
              </p>
            </details>
          )}

          <SectionTitle>Leitura</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status de leitura">
              <Select value={draft.readingStatus} onChange={(e) => set('readingStatus', e.target.value as ReadingStatus)}>
                {Object.entries(READING_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select value={draft.format ?? ''} onChange={(e) => set('format', (e.target.value || undefined) as BookFormat | undefined)}>
                <option value="">—</option>
                {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Início da leitura">
              <TextInput type="date" value={draft.readingStart ?? ''} onChange={(e) => set('readingStart', e.target.value || undefined)} />
            </Field>
            <Field label="Término da leitura">
              <TextInput type="date" value={draft.readingEnd ?? ''} onChange={(e) => set('readingEnd', e.target.value || undefined)} />
            </Field>
          </div>

          <SectionTitle>Aquisição</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem / procedência">
              <Select value={draft.origin ?? ''} onChange={(e) => set('origin', (e.target.value || undefined) as Origin | undefined)}>
                <option value="">—</option>
                {Object.entries(ORIGIN_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Categoria de aquisição">
              <TextInput
                placeholder="ex.: Doação Sicredi"
                value={draft.acquisitionCategory ?? ''}
                onChange={(e) => set('acquisitionCategory', e.target.value || undefined)}
              />
            </Field>
            <Field label="Data de aquisição">
              <TextInput type="date" value={draft.acquisitionDate ?? ''} onChange={(e) => set('acquisitionDate', e.target.value || undefined)} />
            </Field>
            <Field label="Valor pago (R$)">
              <TextInput
                type="number" min={0} step="0.01" placeholder="0,00"
                value={draft.pricePaid ?? ''}
                onChange={(e) => set('pricePaid', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Local de compra">
                <TextInput placeholder="Livraria, site, sebo…" value={draft.purchasePlace ?? ''} onChange={(e) => set('purchasePlace', e.target.value || undefined)} />
              </Field>
            </div>
          </div>

          <SectionTitle>Exemplar</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado de conservação">
              <Select value={draft.condition ?? ''} onChange={(e) => set('condition', (e.target.value || undefined) as BookCondition | undefined)}>
                <option value="">—</option>
                {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Idioma">
              <TextInput placeholder="ex.: Português" value={draft.language ?? ''} onChange={(e) => set('language', e.target.value || undefined)} />
            </Field>
            <div className="col-span-2">
              <Field label="Localização física">
                <TextInput placeholder="ex.: Estante da sala, prateleira 2" value={draft.physicalLocation ?? ''} onChange={(e) => set('physicalLocation', e.target.value || undefined)} />
              </Field>
            </div>
          </div>

          {showClassReading && (
            <>
              <SectionTitle>Leitura em aula</SectionTitle>
              <ClassReadingSection draft={draft} onChange={setClassReadingsNow} />
            </>
          )}

          <SectionTitle>Empréstimo</SectionTitle>
          <LoanSection draft={draft} onChange={setLoansNow} askReadOnReturn={askReadOnReturn} />

          <SectionTitle>Tags personalizadas</SectionTitle>
          <div>
            <div className="flex gap-2">
              <TextInput
                placeholder="Nova tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <button
                type="button"
                onClick={addTag}
                className="shrink-0 rounded-xl border border-paper-300 px-4 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:text-paper-300"
              >
                Adicionar
              </button>
            </div>
            {draft.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.tags.map((t) => (
                  <Badge key={t} className="pr-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remover tag ${t}`}
                      onClick={() => set('tags', draft.tags.filter((x) => x !== t))}
                      className="ml-0.5 rounded-full px-1 hover:bg-ink-600/10 dark:hover:bg-paper-100/10"
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <SectionTitle>Notas / resenha pessoal</SectionTitle>
          <TextArea
            rows={5}
            placeholder="Suas impressões sobre o livro…"
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || undefined)}
          />

          <SectionTitle>Dados bibliográficos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Título">
                <TextInput value={draft.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  type="button"
                  disabled={translating}
                  onClick={handleTranslateTitle}
                  className="text-xs font-medium text-accent-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-accent-400"
                >
                  {translating ? 'Traduzindo…' : '🌐 Traduzir título para o português'}
                </button>
                {translateMsg && <span className="animate-fade-in text-xs text-ink-400 dark:text-ink-500">{translateMsg}</span>}
              </div>
            </div>
            <div className="col-span-2">
              <Field label="Autor(es) — separados por vírgula">
                <TextInput
                  value={draft.authors.join(', ')}
                  onChange={(e) => set('authors', e.target.value.split(',').map((a) => a.trim()).filter(Boolean))}
                />
              </Field>
            </div>
            <Field label="Gênero">
              <TextInput value={draft.genre ?? ''} onChange={(e) => set('genre', e.target.value || undefined)} />
            </Field>
            <Field label="ISBN">
              <TextInput value={draft.isbn ?? ''} onChange={(e) => set('isbn', e.target.value || undefined)} />
            </Field>
            <Field label="Editora">
              <TextInput value={draft.publisher ?? ''} onChange={(e) => set('publisher', e.target.value || undefined)} />
            </Field>
            <Field label="Ano de publicação">
              <TextInput value={draft.publishedYear ?? ''} onChange={(e) => set('publishedYear', e.target.value || undefined)} />
            </Field>
            <Field label="Nº de páginas">
              <TextInput
                type="number" min={0}
                value={draft.pageCount ?? ''}
                onChange={(e) => set('pageCount', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
            <div className="col-span-2">
              <FieldGroup label="Capa">
                <CoverPicker value={draft.coverUrl} title={draft.title} onChange={(v) => set('coverUrl', v)} />
              </FieldGroup>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-rose-500 underline-offset-2 transition-colors hover:text-rose-600 hover:underline"
          >
            Remover livro da biblioteca
          </button>
        </div>

        {/* Rodapé fixo */}
        <div className="flex items-center justify-end gap-3 border-t border-paper-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-800">
          {saved && <span className="animate-fade-in text-sm text-accent-600 dark:text-accent-400">Alterações salvas ✓</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-100 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-accent-600 px-5 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            Salvar alterações
          </button>
        </div>
      </aside>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-paper-200 pb-1.5 text-[13px] font-semibold uppercase tracking-wider text-ink-600 dark:border-ink-700 dark:text-paper-300">
      {children}
    </h3>
  )
}
