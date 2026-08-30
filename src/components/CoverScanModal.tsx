import { useRef, useState } from 'react'
import { autoDetectQuad, fileToCoverDataUrl, warpForScan, type Quad } from '../utils/image'
import { CropImage } from './ui/CropImage'
import { Modal } from './ui/Modal'

interface CoverScanModalProps {
  /** Recebe a capa recortada (data URL) pronta para salvar. */
  onCapture: (coverUrl: string) => void
  onClose: () => void
}

type Phase = 'pick' | 'crop' | 'working' | 'error'

/**
 * Scanner de capa simples para um livro que já existe: foto → recorte
 * automático (ajustável) → a imagem recortada vira a capa. É a mesma etapa
 * visual do scanner de adicionar livro, sem a leitura de texto/busca.
 */
export function CoverScanModal({ onCapture, onClose }: CoverScanModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [autoQuad, setAutoQuad] = useState<Quad | null>(null)

  function pickPhoto(source: 'camera' | 'gallery') {
    const input = fileRef.current
    if (!input) return
    if (source === 'camera') input.setAttribute('capture', 'environment')
    else input.removeAttribute('capture')
    input.click()
  }

  async function handleFile(file: File) {
    try {
      const src = await fileToCoverDataUrl(file, 1800, 0.92)
      setPhotoSrc(src)
      setAutoQuad(await autoDetectQuad(src).catch(() => null))
      setPhase('crop')
    } catch {
      setPhase('error')
    }
  }

  async function handleCrop(quad: Quad) {
    if (!photoSrc) return
    setPhase('working')
    try {
      const { cover } = await warpForScan(photoSrc, quad)
      onCapture(cover)
      onClose()
    } catch {
      setPhase('error')
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
            Fotografe (ou escolha da galeria) a capa do livro. Você recorta e a
            imagem vira a capa deste exemplar.
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
        </div>
      )}

      {phase === 'crop' && photoSrc && (
        <CropImage src={photoSrc} initialQuad={autoQuad} onConfirm={handleCrop} onCancel={() => setPhase('pick')} />
      )}

      {phase === 'working' && (
        <p className="py-8 text-center text-sm text-ink-500 dark:text-ink-400">Preparando a capa…</p>
      )}

      {phase === 'error' && (
        <div className="space-y-4 text-center">
          <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Não foi possível usar essa imagem. Tente outra foto.
          </p>
          <button
            type="button"
            onClick={() => setPhase('pick')}
            className="w-full rounded-xl border border-paper-300 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </Modal>
  )
}
