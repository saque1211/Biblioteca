import { createWorker } from 'tesseract.js'

export interface OcrLine {
  text: string
  height: number
  confidence: number
  order: number
}

export interface CoverGuesses {
  title?: string
  author?: string
  publisher?: string
  /** Texto completo lido, para depuração/exibição */
  rawText: string
}

/**
 * Lê o texto de uma foto de capa com OCR (Tesseract em WebAssembly, roda no
 * próprio aparelho). O modelo de português (~2 MB) é baixado na primeira vez.
 */
export async function ocrCover(
  imageDataUrl: string,
  onProgress?: (fraction: number) => void,
): Promise<OcrLine[]> {
  // Arquivos do leitor hospedados no próprio app (public/ocr): funciona sem
  // CDN e fica em cache offline depois do primeiro uso
  const base = `${location.origin}${import.meta.env.BASE_URL}ocr/`
  const worker = await createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(imageDataUrl, {}, { blocks: true, text: true })
    const lines: OcrLine[] = []
    let order = 0
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          const text = (line.text ?? '').replace(/\s+/g, ' ').trim()
          if (!text) continue
          lines.push({
            text,
            height: Math.max(1, line.bbox.y1 - line.bbox.y0),
            confidence: line.confidence ?? 0,
            order: order++,
          })
        }
      }
    }
    console.debug('[scanner] linhas lidas:', lines.map((l) => `"${l.text}" h=${l.height} c=${Math.round(l.confidence)}`))
    return lines
  } finally {
    await worker.terminate()
  }
}

/** Editoras brasileiras comuns, para reconhecer o nome na capa. */
const PUBLISHERS = [
  'Ática', 'Scipione', 'Moderna', 'FTD', 'Saraiva', 'Rocco', 'Record', 'Globo',
  'Companhia das Letras', 'Companhia das Letrinhas', 'Melhoramentos', 'Salamandra',
  'Intrínseca', 'Sextante', 'Arqueiro', 'Zahar', 'Positivo', 'Ciranda Cultural',
  'Todolivro', 'Vale das Letras', 'Girassol', 'Culturama', 'Panini', 'DarkSide',
  'Galera', 'Seguinte', 'Fundamento', 'Brinque-Book', 'Callis', 'Cortez',
  'Paulinas', 'Paulus', 'Vozes', 'Loyola', 'Autêntica', 'Dimensão', 'Lê',
  'Formato', 'RHJ', 'Miguilim', 'Compor', 'Aletria', 'Abacatte', 'Peirópolis',
  'Pallas', 'Nova Fronteira', 'José Olympio', 'Bertrand Brasil', 'Best Seller',
  'Suma', 'Objetiva', 'Alfaguara', 'Planeta', 'Academia', 'Principis',
  'Camelot', 'Pé da Letra', 'V&R', 'VR Editora', 'HarperCollins', 'Harper Kids',
  'Scholastic', 'Usborne', 'Caramelo', 'Escala', 'Leya', 'Gutenberg',
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Palavras comuns em capas que NÃO são nome de autor. */
const NOT_AUTHOR = /\b(editora|edicao|edição|ilustra|traducao|tradução|adaptacao|adaptação|volume|livro|colecao|coleção|serie|série|best ?seller|mais vendido|inclui|paginas|páginas|texto integral|org\.|orgs\.)\b/i

/** Remove prefixos comuns antes do nome do autor ("por Fulano", "texto de Fulana"). */
function stripAuthorPrefix(text: string): string {
  return text.replace(/^(texto\s+(de|por)|escrito\s+por|por|de)\s+/i, '').trim()
}

const CONNECTIVE = /^(de|da|do|das|dos|e)$/i

function looksLikeAuthor(raw: string): boolean {
  const text = stripAuthorPrefix(raw)
  if (text.length < 5 || text.length > 45) return false
  if (/\d/.test(text)) return false
  if (NOT_AUTHOR.test(text)) return false
  const words = text.split(/\s+/)
  if (words.length < 2 || words.length > 5) return false
  // Nome não começa nem termina com conectivo ("A Menina do" não é nome)
  if (CONNECTIVE.test(words[0]) || CONNECTIVE.test(words[words.length - 1])) return false
  const nameWords = words.filter((w) => !CONNECTIVE.test(w))
  // Pelo menos duas palavras "de nome", com 2+ letras cada ("A" não conta)
  if (nameWords.length < 2 || nameWords.some((w) => w.length < 2)) return false
  // Cada palavra: só letras (com acentos), iniciando maiúscula ou toda maiúscula
  return nameWords.every(
    (w) => /^[A-ZÀ-Ú][A-Za-zÀ-úà-ú'.-]*$/.test(w) || /^[A-ZÀ-Ú'.-]{2,}$/.test(w),
  )
}

/**
 * Heurística de leitura de capa: o título costuma ser o texto maior;
 * o autor é uma linha com jeito de nome; a editora vem de uma lista conhecida.
 * Tudo é palpite editável — o formulário abre preenchido para conferência.
 */
export function parseCoverLines(lines: OcrLine[]): CoverGuesses {
  const usable = lines.filter((l) => {
    if (l.confidence < 35 || l.text.length < 3) return false
    const letters = (l.text.match(/[A-Za-zÀ-úà-ú]/g) ?? []).length
    return letters / l.text.length >= 0.55
  })
  const rawText = lines.map((l) => l.text).join('\n')
  if (usable.length === 0) return { rawText }

  // Capas não têm layout padrão: o autor pode estar acima do título e em letra
  // grande. Linhas com jeito de nome de pessoa não entram no título — a menos
  // que TODAS as linhas grandes pareçam nome (livros cujo título é um nome).
  const maxHeight = Math.max(...usable.map((l) => l.height))
  const bigLines = usable.filter((l) => l.height >= maxHeight * 0.62)
  const bigNonName = bigLines.filter((l) => !looksLikeAuthor(l.text))
  const titleLines = (bigNonName.length > 0 ? bigNonName : bigLines)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
  let title = titleLines.map((l) => l.text).join(' ').trim()
  if (title.length > 90) title = titleLines.slice(0, 2).map((l) => l.text).join(' ').trim()
  if (title.length > 90) title = titleLines[0].text.trim()
  // Título em CAIXA ALTA vira Título Capitalizado
  if (title && title === title.toUpperCase()) {
    title = title
      .toLowerCase()
      .replace(/(^|\s)([a-zà-ú])/g, (m) => m.toUpperCase())
      .replace(/\s(De|Da|Do|Das|Dos|E|A|O|As|Os|Em|No|Na)\s/g, (m) => m.toLowerCase())
  }

  const titleIds = new Set(titleLines.map((l) => l.order))
  const authorLine = usable
    .filter((l) => !titleIds.has(l.order) && looksLikeAuthor(l.text))
    .sort((a, b) => b.height - a.height)[0]
  const author = authorLine ? stripAuthorPrefix(authorLine.text) : undefined

  // Editora: casa apenas palavras inteiras (senão "Lê" casaria dentro de "Vale"),
  // preferindo nomes mais longos
  const normalizedAll = normalize(rawText)
  const byLength = [...PUBLISHERS].sort((a, b) => b.length - a.length)
  let publisher = byLength.find((p) => {
    const escaped = normalize(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalizedAll)
  })
  if (!publisher) {
    const m = rawText.match(/editora\s+([A-Za-zÀ-úà-ú]+(?:\s+[A-Za-zÀ-úà-ú]+)?)/i)
    if (m) publisher = m[1].trim()
  }

  return { title: title || undefined, author, publisher, rawText }
}
