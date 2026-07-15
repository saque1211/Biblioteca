import { useRef, useState } from 'react'
import { fileToCoverDataUrl } from '../../utils/image'
import { Cover } from './Cover'
import { TextInput } from './Field'

interface CoverPickerProps {
  value?: string
  title: string
  onChange: (coverUrl: string | undefined) => void
}

/**
 * Escolha da capa: tirar foto / escolher da galeria (vira data URL compacta)
 * ou colar uma URL. A pré-visualização mostra o que será salvo.
 */
export function CoverPicker({ value, title, onChange }: CoverPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPhoto = value?.startsWith('data:')

  async function handleFile(file: File) {
    setError(null)
    setProcessing(true)
    try {
      onChange(await fileToCoverDataUrl(file))
    } catch {
      setError('Não foi possível usar essa imagem. Tente outra foto.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <Cover url={value} title={title || 'Capa'} className="h-24 w-16 shrink-0 rounded-lg shadow-sm" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={processing}
            className="rounded-xl border border-paper-300 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-accent-500 hover:text-accent-600 disabled:opacity-50 dark:border-ink-600 dark:text-paper-300 dark:hover:border-accent-500"
          >
            {processing ? 'Processando…' : '📷 Tirar foto / escolher imagem'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-xs text-ink-400 underline-offset-2 hover:text-rose-500 hover:underline dark:text-ink-500"
            >
              Remover capa
            </button>
          )}
        </div>
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
        <TextInput
          placeholder="…ou cole a URL de uma imagem"
          aria-label="URL da capa"
          value={isPhoto ? '' : (value ?? '')}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
        />
        {isPhoto && (
          <p className="text-[11px] text-ink-400 dark:text-ink-500">Usando foto enviada — digite uma URL para substituí-la.</p>
        )}
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
    </div>
  )
}
