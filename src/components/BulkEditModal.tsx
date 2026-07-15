import { useState } from 'react'
import { db } from '../db/db'
import type { Book, BookCondition, BookFormat, Origin, ReadingStatus } from '../types'
import { CONDITION_LABELS, FORMAT_LABELS, ORIGIN_LABELS, READING_STATUS_LABELS } from '../types'
import { Field, Select, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

interface BulkEditModalProps {
  books: Book[] // livros selecionados
  onDone: () => void
  onClose: () => void
}

/**
 * Edição em comum dos livros selecionados: só os campos preenchidos
 * são aplicados; os demais ficam como estão em cada livro.
 */
export function BulkEditModal({ books, onDone, onClose }: BulkEditModalProps) {
  const [category, setCategory] = useState('')
  const [origin, setOrigin] = useState<'' | Origin>('')
  const [status, setStatus] = useState<'' | ReadingStatus>('')
  const [condition, setCondition] = useState<'' | BookCondition>('')
  const [format, setFormat] = useState<'' | BookFormat>('')
  const [genre, setGenre] = useState('')
  const [location, setLocation] = useState('')
  const [language, setLanguage] = useState('')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [addTags, setAddTags] = useState('')
  const [saving, setSaving] = useState(false)

  const hasChanges = !!(category || origin || status || condition || format || genre || location || language || acquisitionDate || addTags.trim())

  async function apply(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges || saving) return
    setSaving(true)
    const newTags = addTags.split(',').map((t) => t.trim()).filter(Boolean)
    await db.transaction('rw', db.books, async () => {
      for (const book of books) {
        if (book.id == null) continue
        const changes: Partial<Book> = {}
        if (category) changes.acquisitionCategory = category
        if (origin) changes.origin = origin
        if (status) changes.readingStatus = status
        if (condition) changes.condition = condition
        if (format) changes.format = format
        if (genre) changes.genre = genre
        if (location) changes.physicalLocation = location
        if (language) changes.language = language
        if (acquisitionDate) changes.acquisitionDate = acquisitionDate
        if (newTags.length) changes.tags = [...new Set([...book.tags, ...newTags])]
        await db.books.update(book.id, changes)
      }
    })
    onDone()
  }

  return (
    <Modal title={`Editar ${books.length} livros de uma vez`} onClose={onClose}>
      <p className="mb-4 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
        Preencha apenas o que quer aplicar a todos os livros selecionados — campos em
        branco não mudam nada.
      </p>
      <form onSubmit={apply} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Doador / categoria de aquisição">
            <TextInput placeholder="ex.: Doação Sicredi" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="Origem">
            <Select value={origin} onChange={(e) => setOrigin(e.target.value as '' | Origin)}>
              <option value="">— não alterar —</option>
              {Object.entries(ORIGIN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Status de leitura">
            <Select value={status} onChange={(e) => setStatus(e.target.value as '' | ReadingStatus)}>
              <option value="">— não alterar —</option>
              {Object.entries(READING_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Estado de conservação">
            <Select value={condition} onChange={(e) => setCondition(e.target.value as '' | BookCondition)}>
              <option value="">— não alterar —</option>
              {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Formato">
            <Select value={format} onChange={(e) => setFormat(e.target.value as '' | BookFormat)}>
              <option value="">— não alterar —</option>
              {Object.entries(FORMAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Gênero">
            <TextInput placeholder="ex.: Aventura" value={genre} onChange={(e) => setGenre(e.target.value)} />
          </Field>
          <Field label="Localização física">
            <TextInput placeholder="ex.: Estante 2" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Idioma">
            <TextInput placeholder="ex.: Português" value={language} onChange={(e) => setLanguage(e.target.value)} />
          </Field>
          <Field label="Data de aquisição">
            <TextInput type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
          </Field>
          <Field label="Adicionar tags (vírgula)">
            <TextInput placeholder="ex.: infantil, 2026" value={addTags} onChange={(e) => setAddTags(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-100 dark:text-ink-400 dark:hover:bg-ink-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!hasChanges || saving}
            className="rounded-xl bg-accent-600 px-5 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? 'Aplicando…' : `Aplicar a ${books.length} livros`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
