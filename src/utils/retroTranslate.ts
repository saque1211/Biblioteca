import { translateWithStatus } from '../api/translate'
import { updateBook } from '../db/db'
import type { Book } from '../types'

const CHECKED_KEY = 'biblioteca-titles-checked'
const MAX_PER_SESSION = 20

function loadChecked(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveChecked(checked: Set<number>) {
  localStorage.setItem(CHECKED_KEY, JSON.stringify([...checked]))
}

/**
 * Traduz para o português, em segundo plano, os títulos de livros já
 * existentes na biblioteca (adicionados antes da tradução automática ou
 * quando o serviço estava indisponível). Livros já verificados ficam
 * anotados no localStorage para não repetir chamadas; se o serviço
 * estiver fora do ar, tenta de novo numa próxima abertura do app.
 */
export async function retroTranslateTitles(books: Book[]): Promise<void> {
  const checked = loadChecked()
  const pending = books.filter(
    (b) => b.id != null && !b.originalTitle && !checked.has(b.id),
  )

  let processed = 0
  for (const book of pending) {
    if (processed >= MAX_PER_SESSION) break
    processed++
    const result = await translateWithStatus(book.title, 'auto', 'pt-BR')
    if (!result.available) return // serviço fora do ar — tenta na próxima sessão
    if (result.translated) {
      await updateBook(book.id!, { title: result.translated, originalTitle: book.title })
    }
    checked.add(book.id!)
    saveChecked(checked)
    // Pausa curta para não estourar o limite do serviço gratuito
    await new Promise((r) => setTimeout(r, 350))
  }
}
