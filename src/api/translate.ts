/**
 * Tradução gratuita via MyMemory (https://mymemory.translated.net/doc/spec.php).
 * Sem chave de API; uso limitado por dia, então toda chamada é best-effort:
 * em caso de erro ou limite, devolve undefined e o app segue sem tradução.
 */
export async function translateText(
  text: string,
  from: string,
  to: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  const trimmed = text.trim()
  if (!trimmed || from === to) return undefined
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${from}|${to}`
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return undefined
    const data = await res.json()
    const translated: string | undefined = data?.responseData?.translatedText
    if (!translated || data?.responseStatus !== 200) return undefined
    const clean = translated.trim()
    // Respostas inúteis: vazio, igual à entrada ou mensagens de erro da API
    if (!clean || clean.toUpperCase().includes('MYMEMORY WARNING')) return undefined
    if (clean.toLowerCase() === trimmed.toLowerCase()) return undefined
    return clean
  } catch {
    return undefined
  }
}

/** Código ou rótulo de idioma (Google/Open Library) → código usado pelo MyMemory. */
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
