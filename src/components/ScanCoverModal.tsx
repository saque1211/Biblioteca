import { useRef, useState } from 'react'
import { searchBooks } from '../api/books'
import type { ApiBookResult } from '../types'
import { authorsLabel } from '../utils/format'
import { cropForScan, fileToCoverDataUrl, type CropRect } from '../utils/image'
import { ocrCover, parseCoverLines, type CoverGuesses } from '../utils/scanCover'
import { Cover } from './ui/Cover'
import { CropImage } from './ui/CropImage'
import { Modal } from './ui/Modal'

export interface ScanManualPrefill {
  title?: string
  authors?: string[]
  publisher?: string
  coverUrl?: string
}

interface ScanCoverModalProps {
  onAddApi: (result: ApiBookResult) => Promise<void> | void
  onManual: (prefill: ScanManualPrefill) => void
  onClose: () => void
}

type Phase = 'pick' | 'crop' | 'reading' | 'results' | 'error'

/**
 * Scanner de capa: foto → OCR no aparelho → palpites de título/autor/editora
 * → busca nos catálogos. A foto tirada vira a capa do livro adicionado.
 */
export function ScanCoverModal({ onAddApi, onManual, onClose }: ScanCoverModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [progress, setProgress] = useState(0)
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [guesses, setGuesses] = useState<CoverGuesses | null>(null)
  const [apiResults, setApiResults] = useState<ApiBookResult[]>([])
  const [adding, setAdding] = useState(false)

  /** Abre a câmera (capture) ou o seletor de arquivos/galeria. */
  function pickPhoto(source: 'camera' | 'gallery') {
    const input = fileRef.current
    if (!input) return
    if (source === 'camera') input.setAttribute('capture', 'environment')
    else input.removeAttribute('capture')
    input.click()
  }

  async function handleFile(file: File) {
    try {
      // Versão grande o suficiente para recorte + leitura nítida
      setPhotoSrc(await fileToCoverDataUrl(file, 1800, 0.92))
      setPhase('crop')
    } catch {
      setPhase('error')
    }
  }

  async function handleCrop(crop: CropRect) {
    if (!photoSrc) return
    setPhase('reading')
    setProgress(0)
    try {
      const { cover: cropped, ocr } = await cropForScan(photoSrc, crop)
      setCover(cropped)

      const lines = await ocrCover(ocr, setProgress)
      const parsed = parseCoverLines(lines)
      setGuesses(parsed)

      // Busca nos catálogos com o que foi lido
      if (parsed.title) {
        try {
          const query = [parsed.title, parsed.author].filter(Boolean).join(' ')
          setApiResults((await searchBooks(query)).slice(0, 4))
        } catch {
          setApiResults([])
        }
      }
      setPhase('results')
    } catch {
      setPhase('error')
    }
  }

  function manualPrefill(): ScanManualPrefill {
    return {
      title: guesses?.title,
      authors: guesses?.author ? [guesses.author] : undefined,
      publisher: guesses?.publisher,
      coverUrl: cover ?? undefined,
    }
  }

  async function addFromApi(r: ApiBookResult) {
    if (adding) return
    setAdding(true)
    try {
      // A foto tirada vira a capa do exemplar
      await onAddApi({ ...r, coverUrl: cover ?? r.coverUrl, coverThumb: cover ?? r.coverThumb })
      onClose()
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal title="Escanear capa" onClose={onClose}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {phase === 'pick' && (
        <div className="space-y-4 text-center">
          <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Fotografe a capa do livro de frente, bem iluminada e ocupando a foto toda.
            O app lê o texto da capa, tenta descobrir <strong>título, autor e editora</strong>,
            busca o livro nos catálogos — e a foto vira a capa do exemplar.
          </p>
          <button
            type="button"
            onClick={() => pickPhoto('camera')}
            className="w-full rounded-2xl bg-accent-600 py-3.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
          >
            📷 Fotografar capa
          </button>
          <button
            type="button"
            onClick={() => pickPhoto('gallery')}
            className="w-full rounded-2xl border border-paper-300 py-3 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
          >
            🖼️ Escolher foto da galeria
          </button>
          <p className="text-[11px] text-ink-400 dark:text-ink-500">
            A leitura acontece no seu aparelho. Na primeira vez, um pacote de leitura
            de português (~2 MB) é baixado.
          </p>
        </div>
      )}

      {phase === 'crop' && photoSrc && (
        <CropImage src={photoSrc} onConfirm={handleCrop} onCancel={() => setPhase('pick')} />
      )}

      {phase === 'reading' && (
        <div className="space-y-4 py-4 text-center">
          {cover && <Cover url={cover} title="Capa" className="mx-auto h-40 w-28 rounded-xl shadow-card" />}
          <p className="text-sm text-ink-600 dark:text-paper-300">Lendo o texto da capa…</p>
          <div className="mx-auto h-2 w-56 overflow-hidden rounded-full bg-paper-200 dark:bg-ink-700">
            <div
              className="h-full rounded-full bg-accent-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {cover && <Cover url={cover} title="Capa" className="h-28 w-20 shrink-0 rounded-lg shadow-card" />}
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                O que foi lido da capa
              </p>
              <p className="mt-1 text-ink-700 dark:text-paper-100">
                <strong>{guesses?.title ?? '— título não identificado —'}</strong>
              </p>
              {guesses?.author && <p className="text-ink-500 dark:text-ink-400">{guesses.author}</p>}
              {guesses?.publisher && (
                <p className="text-xs text-ink-400 dark:text-ink-500">Editora: {guesses.publisher}</p>
              )}
            </div>
          </div>

          {apiResults.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                É um destes? (dados completos do catálogo)
              </p>
              <ul className="space-y-1">
                {apiResults.map((r) => (
                  <li key={r.externalId}>
                    <button
                      type="button"
                      disabled={adding}
                      onClick={() => addFromApi(r)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-paper-100 disabled:opacity-50 dark:hover:bg-ink-700"
                    >
                      <Cover url={r.coverThumb} title={r.title} className="h-12 w-8 shrink-0 rounded shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-700 dark:text-paper-100">{r.title}</p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                          {authorsLabel(r.authors)}
                          {r.publishedYear ? ` · ${r.publishedYear}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
                        + Adicionar
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onManual(manualPrefill())
                onClose()
              }}
              className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
            >
              {apiResults.length > 0 ? 'Nenhum destes — usar os dados lidos' : 'Usar os dados lidos (conferir e adicionar)'}
            </button>
            <button
              type="button"
              onClick={() => setPhase('pick')}
              className="w-full rounded-xl border border-paper-300 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
            >
              📷 Tirar outra foto
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4 text-center">
          {cover && <Cover url={cover} title="Capa" className="mx-auto h-32 w-22 rounded-xl shadow-card" />}
          <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Não foi possível ler o texto da capa agora (verifique a conexão — o leitor
            precisa baixar um pacote na primeira vez). A foto ainda pode ser usada como capa.
          </p>
          <div className="space-y-2">
            {cover && (
              <button
                type="button"
                onClick={() => {
                  onManual({ coverUrl: cover })
                  onClose()
                }}
                className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700"
              >
                Adicionar manualmente com esta foto
              </button>
            )}
            <button
              type="button"
              onClick={() => setPhase('pick')}
              className="w-full rounded-xl border border-paper-300 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
