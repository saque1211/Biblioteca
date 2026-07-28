import type { Book } from '../types'

/**
 * Gera links de busca para as lojas — grátis, sem API nem servidor. Toca no
 * botão → abre a loja mostrando o livro e o preço atual. Se houver código de
 * afiliado, ele é incluído (você ganha comissão nas compras por esse link).
 */

function query(book: Book): string {
  const isbn = book.isbn?.replace(/[-\s]/g, '')
  if (isbn) return isbn
  return `${book.title} ${book.authors[0] ?? ''}`.trim()
}

/** Busca na Amazon Brasil (com tag de afiliado, se informada). */
export function amazonSearchUrl(book: Book, affiliateTag?: string): string {
  const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(query(book))}`
  const tag = affiliateTag?.trim()
  return tag ? `${url}&tag=${encodeURIComponent(tag)}` : url
}

/** Busca no Mercado Livre (busca por caminho, como o site faz). */
export function mercadoLivreSearchUrl(book: Book): string {
  const term = query(book)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(term)}`
}
