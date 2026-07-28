/**
 * Busca a capa de um livro pela Open Library usando o ISBN. É uma fonte extra
 * de capas (muitas edições brasileiras têm capa aqui, mas não no Google Books).
 *
 * `?default=false` faz a Open Library devolver 404 quando não há capa, em vez
 * de uma imagem em branco — então detectamos se a capa existe carregando a
 * imagem e conferindo se ela tem tamanho real.
 */
export function coverFromIsbn(isbn?: string, timeoutMs = 3000): Promise<string | undefined> {
  const clean = isbn?.replace(/[-\s]/g, '')
  if (!clean) return Promise.resolve(undefined)

  const url = `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`
  return new Promise((resolve) => {
    let done = false
    const finish = (value: string | undefined) => {
      if (done) return
      done = true
      resolve(value)
    }
    const img = new Image()
    // Uma capa real tem largura > 1px; o "pixel em branco" da OL tem 1px
    img.onload = () => finish(img.naturalWidth > 1 ? url : undefined)
    img.onerror = () => finish(undefined)
    img.src = url
    setTimeout(() => finish(undefined), timeoutMs)
  })
}
