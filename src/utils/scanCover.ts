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
  /** 'good' = título veio de linhas limpas; 'weak' = só sobrou frase de capa */
  titleQuality?: 'good' | 'weak'
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
const NOT_AUTHOR = /\b(autora?|editora|edicao|edição|ilustra|traducao|tradução|adaptacao|adaptação|volume|livro|colecao|coleção|serie|série|best ?seller|mais vendidos?|inclui|paginas|páginas|texto integral|org\.|orgs\.|exemplares|vendid[oa]s|milh(ao|ão|oes|ões)|fenomeno|fenômeno|sucesso)\b/i

/** Remove prefixos comuns antes do nome do autor ("por Fulano", "texto de Fulana"). */
function stripAuthorPrefix(text: string): string {
  return text.replace(/^(texto\s+(de|por)|escrito\s+por|por|de)\s+/i, '').trim()
}

const CONNECTIVE = /^(de|da|do|das|dos|e)$/i

/**
 * Devolve o nome limpo quando o texto tem cara de nome de pessoa, ou null.
 * `dropped` conta letras soltas descartadas (ruído de logo/OCR) — quanto
 * menos descartes, mais confiável é o palpite.
 */
function asAuthorName(raw: string): { name: string; dropped: number } | null {
  const allTokens = stripAuthorPrefix(raw).split(/\s+/)
  const tokens = allTokens.filter((w) => w.length > 1 || CONNECTIVE.test(w))
  const dropped = allTokens.length - tokens.length
  const text = tokens.join(' ')
  if (text.length < 5 || text.length > 45) return null
  if (/\d/.test(text)) return null
  if (NOT_AUTHOR.test(text)) return null
  const words = text.split(/\s+/)
  if (words.length < 2 || words.length > 5) return null
  // Nome não começa nem termina com conectivo ("A Menina do" não é nome)
  if (CONNECTIVE.test(words[0]) || CONNECTIVE.test(words[words.length - 1])) return null
  const nameWords = words.filter((w) => !CONNECTIVE.test(w))
  // Pelo menos duas palavras "de nome", com 2+ letras cada ("A" não conta)
  if (nameWords.length < 2 || nameWords.some((w) => w.length < 2)) return null
  // Cada palavra: só letras (com acentos), iniciando maiúscula ou toda maiúscula
  const ok = nameWords.every(
    (w) => /^[A-ZÀ-Ú][A-Za-zÀ-úà-ú'.-]*$/.test(w) || /^[A-ZÀ-Ú'.-]{2,}$/.test(w),
  )
  return ok ? { name: text, dropped } : null
}

function looksLikeAuthor(raw: string): boolean {
  return asAuthorName(raw)?.dropped === 0
}

/**
 * Heurística de leitura de capa: o título costuma ser o texto maior;
 * o autor é uma linha com jeito de nome; a editora vem de uma lista conhecida.
 * Tudo é palpite editável — o formulário abre preenchido para conferência.
 */
export function parseCoverLines(lines: OcrLine[]): CoverGuesses {
  // Fontes estilizadas de capa derrubam a "confiança" do OCR mesmo quando o
  // texto sai quase certo — então relaxamos o corte em etapas até achar algo
  const withLetters = lines.filter((l) => {
    if (l.text.length < 3) return false
    const letters = (l.text.match(/[A-Za-zÀ-úà-ú]/g) ?? []).length
    return letters / l.text.length >= 0.55
  })
  const tallest = Math.max(0, ...withLetters.map((l) => l.height))
  // Linhas confiáveis entram sempre; linhas GRANDES (títulos) entram mesmo com
  // confiança baixa — fontes de capa derrubam a métrica sem errar tanto o texto
  let usable = withLetters.filter(
    (l) => l.confidence >= 35 || (l.height >= tallest * 0.5 && l.confidence >= 8),
  )
  if (usable.length === 0) usable = withLetters
  const rawText = lines.map((l) => l.text).join('\n')
  if (usable.length === 0) return { rawText }

  // Remove tokens meio-letra-meio-número ("do2", "4e") — lixo típico de OCR.
  // Pontuação grudada nas bordas é descartada ("NAMORADO)" → "NAMORADO");
  // palavras só de letras ou só de números (ex.: "1984") ficam
  function cleanLineText(text: string): string {
    return text
      .split(/\s+/)
      .map((w) => w.replace(/^[^A-Za-zÀ-úà-ú0-9]+|[^A-Za-zÀ-úà-ú0-9]+$/g, ''))
      .filter((w) => /^[A-Za-zÀ-úà-ú'-]+$/.test(w) || /^\d+$/.test(w))
      .join(' ')
      .trim()
  }

  // Capas não têm layout padrão: o autor pode estar acima do título e em letra
  // grande. Linhas com jeito de nome de pessoa não entram no título — a menos
  // que TODAS as linhas grandes pareçam nome (livros cujo título é um nome).
  const maxHeight = Math.max(...usable.map((l) => l.height))
  // Preferência por linhas grandes e confiáveis; se nada sobrar, aceita as
  // grandes de baixa confiança (o usuário confere no formulário)
  let bigLines = usable.filter((l) => l.height >= maxHeight * 0.62 && l.confidence >= 45)
  if (bigLines.length === 0) bigLines = usable.filter((l) => l.height >= maxHeight * 0.62)
  // Preferência: sem nomes e sem frases de capa → sem frases de capa → tudo.
  // Frases tipo "Autora de A Empregada" só entram se não sobrar mais nada.
  const noPhrase = bigLines.filter((l) => !NOT_AUTHOR.test(l.text))
  // Nome de autor dividido em duas linhas grandes e vizinhas ("FREIDA" /
  // "McFADDEN") também não deve entrar no título. Só o MELHOR par sai
  // (menos descartes de ruído; desempate por tamanho) — excluir todos os
  // pares possíveis esvaziaria títulos como "MCFADDEN | O NAMORADO".
  const pairs: { orders: [number, number]; name: string; dropped: number; height: number }[] = []
  const bigOrdered = [...noPhrase].sort((a, b) => a.order - b.order)
  for (let i = 0; i + 1 < bigOrdered.length; i++) {
    const a = bigOrdered[i]
    const b = bigOrdered[i + 1]
    const ratio = a.height / b.height
    if (b.order - a.order !== 1 || ratio < 0.55 || ratio > 1.8) continue
    const named = asAuthorName(`${a.text} ${b.text}`)
    if (named) pairs.push({ orders: [a.order, b.order], ...named, height: Math.max(a.height, b.height) })
  }
  const bestPair = pairs.sort((p, q) => p.dropped - q.dropped || q.height - p.height)[0]
  const pairNameOrders = new Set<number>(bestPair ? bestPair.orders : [])
  const bigNonName = noPhrase.filter((l) => !looksLikeAuthor(l.text) && !pairNameOrders.has(l.order))
  const titleCandidates =
    bigNonName.length > 0 ? bigNonName : noPhrase.length > 0 ? noPhrase : bigLines
  const titleQuality: 'good' | 'weak' = noPhrase.length > 0 ? 'good' : 'weak'
  const titleLines = titleCandidates.sort((a, b) => a.order - b.order).slice(0, 3)
  let title = titleLines.map((l) => cleanLineText(l.text)).filter(Boolean).join(' ').trim()
  if (title.length > 90) title = titleLines.slice(0, 2).map((l) => cleanLineText(l.text)).join(' ').trim()
  if (title.length > 90) title = cleanLineText(titleLines[0].text)
  // Título em CAIXA ALTA vira Título Capitalizado
  if (title && title === title.toUpperCase()) {
    title = title
      .toLowerCase()
      .replace(/(^|\s)([a-zà-ú])/g, (m) => m.toUpperCase())
      .replace(/\s(De|Da|Do|Das|Dos|E|A|O|As|Os|Em|No|Na)\s/g, (m) => m.toLowerCase())
  }

  const titleIds = new Set(titleLines.map((l) => l.order))
  const nonTitle = usable.filter((l) => !titleIds.has(l.order))
  const authorCandidates: { name: string; height: number; dropped: number }[] = []
  for (const l of nonTitle) {
    const named = asAuthorName(l.text)
    if (named) authorCandidates.push({ ...named, height: l.height })
  }
  // Nomes divididos em duas linhas ("FREIDA" em cima, "McFADDEN" embaixo):
  // testa também pares de linhas vizinhas com tamanhos parecidos
  const ordered = [...nonTitle].sort((a, b) => a.order - b.order)
  for (let i = 0; i + 1 < ordered.length; i++) {
    const a = ordered[i]
    const b = ordered[i + 1]
    const ratio = a.height / b.height
    if (ratio < 0.55 || ratio > 1.8) continue
    const named = asAuthorName(`${a.text} ${b.text}`)
    if (named) authorCandidates.push({ ...named, height: Math.max(a.height, b.height) })
  }
  let author = authorCandidates.sort((x, y) => x.dropped - y.dropped || y.height - x.height)[0]?.name

  // Último recurso: uma única palavra grande com cara de sobrenome
  // ("McFADQEN" quando o primeiro nome não foi lido) — melhor um palpite
  // editável do que campo vazio
  if (!author && title) {
    const titleNorm = normalize(title)
    // Considera todas as linhas com letras (mesmo confiança 0) — o formato
    // exigido da palavra já corta o ruído
    author = withLetters
      .filter((l) => !titleIds.has(l.order))
      .map((l) => ({ line: l, word: cleanLineText(l.text) }))
      .filter(({ line, word }) => {
        if (line.height < maxHeight * 0.2) return false
        if (!/^[A-Za-zÀ-úà-ú'.-]{5,20}$/.test(word)) return false
        if (!/^[A-ZÀ-Ú]/.test(word)) return false
        if (NOT_AUTHOR.test(word)) return false
        return !titleNorm.includes(normalize(word))
      })
      .sort((a, b) => b.line.height - a.line.height)[0]?.word
  }

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

  return { title: title || undefined, author, publisher, titleQuality: title ? titleQuality : undefined, rawText }
}

function normalizeWord(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * O catálogo às vezes devolve algo sem relação quando a consulta sai
 * embaralhada — só mostramos resultados que compartilham ao menos uma
 * palavra significativa (4+ letras) com o texto lido da capa.
 */
export function resultMatchesReading(
  lines: OcrLine[],
  result: { title: string; authors: string[] },
): boolean {
  const readWords = new Set<string>()
  for (const line of lines) {
    for (const raw of line.text.split(/\s+/)) {
      const w = normalizeWord(raw.replace(/^[^A-Za-zÀ-úà-ú]+|[^A-Za-zÀ-úà-ú]+$/g, ''))
      if (w.length >= 4) readWords.add(w)
    }
  }
  if (readWords.size === 0) return true // nada legível — não dá para julgar
  const haystack = normalizeWord(`${result.title} ${result.authors.join(' ')}`)
  for (const w of readWords) {
    if (haystack.includes(w)) return true
  }
  return false
}

/**
 * Consulta de resgate para os catálogos: junta as melhores palavras lidas
 * (maiores e mais confiáveis). A busca dos catálogos é tolerante a erros,
 * então mesmo uma leitura imperfeita costuma achar o livro certo.
 */
export function buildSearchQuery(lines: OcrLine[]): string | undefined {
  // Frases de capa ("Autora de…", "mais vendidos") poluem a busca — só entram
  // se não houver mais nada legível
  const preferred = lines.filter((l) => !NOT_AUTHOR.test(l.text))
  const pool = preferred.length >= 1 ? preferred : lines
  const maxHeight = Math.max(0, ...pool.map((l) => l.height))
  const words: string[] = []
  const seen = new Set<string>()
  // Sem filtro de confiança: mesmo leituras "inseguras" ('MCFADDENG',
  // 'NAMORADO)') costumam bastar para o catálogo achar o livro certo
  for (const line of [...pool].sort((a, b) => b.height - a.height)) {
    if (line.height < maxHeight * 0.25) continue
    for (const raw of line.text.split(/\s+/)) {
      const w = raw.replace(/^[^A-Za-zÀ-úà-ú]+|[^A-Za-zÀ-úà-ú]+$/g, '')
      if (w.length < 3 || !/^[A-Za-zÀ-úà-ú'-]+$/.test(w)) continue
      const key = w.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      words.push(w)
      if (words.length >= 8) return words.join(' ')
    }
  }
  return words.length >= 1 ? words.join(' ') : undefined
}
