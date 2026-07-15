import { useState } from 'react'
import type { Book } from '../types'
import { CoverPicker } from './ui/CoverPicker'
import { Field, FieldGroup, TextArea, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

interface ManualAddModalProps {
  initialTitle: string
  onAdd: (data: Pick<Book, 'title' | 'authors' | 'coverUrl' | 'genre' | 'isbn' | 'publisher' | 'publishedYear' | 'pageCount' | 'synopsis'>) => Promise<void> | void
  onClose: () => void
}

/** Formulário para adicionar um livro que não apareceu na busca da API. */
export function ManualAddModal({ initialTitle, onAdd, onClose }: ManualAddModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [authors, setAuthors] = useState('')
  const [genre, setGenre] = useState('')
  const [isbn, setIsbn] = useState('')
  const [publisher, setPublisher] = useState('')
  const [publishedYear, setPublishedYear] = useState('')
  const [pageCount, setPageCount] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [synopsis, setSynopsis] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await onAdd({
      title: title.trim(),
      authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
      genre: genre.trim() || undefined,
      isbn: isbn.trim() || undefined,
      publisher: publisher.trim() || undefined,
      publishedYear: publishedYear.trim() || undefined,
      pageCount: pageCount === '' ? undefined : Number(pageCount),
      coverUrl: coverUrl || undefined,
      synopsis: synopsis.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal title="Adicionar livro manualmente" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título *">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <Field label="Autor(es) — separados por vírgula">
          <TextInput value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="ex.: Machado de Assis" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gênero">
            <TextInput value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ex.: Romance" />
          </Field>
          <Field label="ISBN">
            <TextInput value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          </Field>
          <Field label="Editora">
            <TextInput value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          </Field>
          <Field label="Ano de publicação">
            <TextInput value={publishedYear} onChange={(e) => setPublishedYear(e.target.value)} placeholder="ex.: 1899" />
          </Field>
          <Field label="Nº de páginas">
            <TextInput type="number" min={0} value={pageCount} onChange={(e) => setPageCount(e.target.value)} />
          </Field>
        </div>
        <FieldGroup label="Capa">
          <CoverPicker value={coverUrl || undefined} title={title} onChange={(v) => setCoverUrl(v ?? '')} />
        </FieldGroup>
        <Field label="Sinopse">
          <TextArea rows={3} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
        </Field>
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
            className="rounded-xl bg-accent-600 px-5 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.98]"
          >
            Adicionar à biblioteca
          </button>
        </div>
      </form>
    </Modal>
  )
}
