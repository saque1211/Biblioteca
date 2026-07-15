/**
 * Tradução gratuita, sem chave de API, com duas fontes:
 * 1. Endpoint público do Google Tradutor (client=gtx) — rápido e confiável
 * 2. MyMemory como reserva (https://mymemory.translated.net)
 * Toda chamada é best-effort: em erro ou limite, devolve undefined e o app
 * segue sem tradução.
 */

export interface TranslationResult {
  /** false = serviço indisponível (vale tentar de novo depois) */
  available: boolean
  /** tradução; undefined com available=true significa "já está no idioma de destino" */
  translated?: string
}

/** `from` aceita 'auto' para detectar o idioma de origem. */
export async function translateWithStatus(
  text: string,
  from: string,
  to: string,
  timeoutMs = 6000,
): Promise<TranslationResult> {
  const trimmed = text.trim()
  if (!trimmed || from === to) return { available: true }
  const src = toGoogleLang(from)
  const dst = toGoogleLang(to)

  const viaGoogle = await googleTranslate(trimmed, src, dst, timeoutMs)
  if (viaGoogle !== null) return { available: true, translated: viaGoogle || undefined }

  // Google indisponível: tenta o MyMemory
  const viaMyMemory = await myMemoryTranslate(trimmed, from, to, timeoutMs)
  return viaMyMemory ? { available: true, translated: viaMyMemory } : { available: false }
}

export async function translateText(
  text: string,
  from: string,
  to: string,
  timeoutMs = 6000,
): Promise<string | undefined> {
  return (await translateWithStatus(text, from, to, timeoutMs)).translated
}

/**
 * Devolve a tradução, '' quando não é preciso traduzir (já está no idioma
 * de destino) ou null quando o serviço falhou e vale tentar a reserva.
 */
async function googleTranslate(text: string, from: string, to: string, timeoutMs: number): Promise<string | '' | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const data = await res.json()
    const detected: string | undefined = typeof data?.[2] === 'string' ? data[2] : undefined
    if (detected && detected.slice(0, 2) === to.slice(0, 2)) return '' // já está no idioma de destino
    const segments: unknown = data?.[0]
    if (!Array.isArray(segments)) return null
    const translated = segments
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim()
    if (!translated || translated.toLowerCase() === text.toLowerCase()) return ''
    return translated
  } catch {
    return null
  }
}

async function myMemoryTranslate(text: string, from: string, to: string, timeoutMs: number): Promise<string | undefined> {
  try {
    const pair = `${from === 'auto' ? 'Autodetect' : from}|${to}`
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return undefined
    const data = await res.json()
    if (Number(data?.responseStatus) !== 200) return undefined
    const translated: string | undefined = data?.responseData?.translatedText
    const clean = translated?.trim()
    if (!clean || clean.toUpperCase().includes('MYMEMORY WARNING')) return undefined
    if (clean.toLowerCase() === text.toLowerCase()) return undefined
    return clean
  } catch {
    return undefined
  }
}

function toGoogleLang(code: string): string {
  if (code === 'auto') return 'auto'
  return code.toLowerCase().slice(0, 2)
}

/** Código ou rótulo de idioma (Google/Open Library) → código de tradução. */
export function toMyMemoryLang(language?: string): string | undefined {
  if (!language) return undefined
  const value = language.toLowerCase()
  // Rótulos por extenso usados nos registros vindos da Open Library
  const labels: Record<string, string> = {
    'português': 'pt-BR', 'inglês': 'en', 'espanhol': 'es', 'francês': 'fr',
    'alemão': 'de', 'italiano': 'it', 'japonês': 'ja',
  }
  if (labels[value]) return labels[value]
  const map: Record<string, string> = {
    pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', ja: 'ja',
  }
  return map[value.slice(0, 2)]
}
