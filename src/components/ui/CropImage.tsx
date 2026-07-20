import { useRef, useState } from 'react'
import type { CropRect } from '../../utils/image'

interface CropImageProps {
  src: string
  /** Recorte inicial em coordenadas naturais da imagem (ex.: detecção automática). */
  initialRect?: CropRect | null
  onConfirm: (crop: CropRect) => void
  onCancel: () => void
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null

const MIN_SIZE = 48 // px exibidos

/**
 * Ajuste de recorte com toque: arraste os cantos para marcar só a capa
 * (o recorte vira a capa do livro e é o que o leitor de texto analisa).
 */
export function CropImage({ src, initialRect, onConfirm, onCancel }: CropImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<CropRect | null>(null)
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect } | null>(null)

  function handleImageLoad() {
    const img = imgRef.current
    if (!img) return
    const w = img.clientWidth
    const h = img.clientHeight
    if (initialRect) {
      // Recorte detectado automaticamente (coordenadas naturais → exibidas)
      const factor = w / img.naturalWidth
      setRect({
        x: Math.max(0, initialRect.x * factor),
        y: Math.max(0, initialRect.y * factor),
        width: Math.min(w, initialRect.width * factor),
        height: Math.min(h, initialRect.height * factor),
      })
      return
    }
    // Sem detecção: margem de 6% de cada lado
    setRect({ x: w * 0.06, y: h * 0.06, width: w * 0.88, height: h * 0.88 })
  }

  function startDrag(mode: DragMode, e: React.PointerEvent) {
    if (!rect) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...rect } }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    const img = imgRef.current
    if (!d || !rect || !img) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const W = img.clientWidth
    const H = img.clientHeight
    const s = d.start
    let { x, y, width, height } = s

    if (d.mode === 'move') {
      x = Math.max(0, Math.min(W - s.width, s.x + dx))
      y = Math.max(0, Math.min(H - s.height, s.y + dy))
    } else {
      if (d.mode === 'nw' || d.mode === 'sw') {
        const nx = Math.max(0, Math.min(s.x + s.width - MIN_SIZE, s.x + dx))
        width = s.width + (s.x - nx)
        x = nx
      }
      if (d.mode === 'ne' || d.mode === 'se') {
        width = Math.max(MIN_SIZE, Math.min(W - s.x, s.width + dx))
      }
      if (d.mode === 'nw' || d.mode === 'ne') {
        const ny = Math.max(0, Math.min(s.y + s.height - MIN_SIZE, s.y + dy))
        height = s.height + (s.y - ny)
        y = ny
      }
      if (d.mode === 'sw' || d.mode === 'se') {
        height = Math.max(MIN_SIZE, Math.min(H - s.y, s.height + dy))
      }
    }
    setRect({ x, y, width, height })
  }

  function endDrag() {
    drag.current = null
  }

  function confirm() {
    const img = imgRef.current
    if (!img || !rect) return
    const factor = img.naturalWidth / img.clientWidth
    onConfirm({
      x: rect.x * factor,
      y: rect.y * factor,
      width: rect.width * factor,
      height: rect.height * factor,
    })
  }

  const handleClass =
    'absolute h-9 w-9 touch-none' // área de toque generosa; o visual é o ::after abaixo

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-ink-500 dark:text-ink-400">
        {initialRect
          ? 'Recorte automático aplicado — ajuste os cantos se precisar.'
          : 'Arraste os cantos para marcar só a capa.'}{' '}
        O recorte vira a capa do livro e melhora a leitura do texto.
      </p>
      <div
        ref={containerRef}
        className="relative mx-auto max-h-[55vh] w-fit touch-none select-none overflow-hidden rounded-xl"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Foto para recorte"
          onLoad={handleImageLoad}
          className="max-h-[55vh] w-auto max-w-full"
          draggable={false}
        />
        {rect && (
          <div
            className="absolute cursor-move border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onPointerDown={(e) => startDrag('move', e)}
          >
            {(
              [
                ['nw', '-left-4 -top-4', 'cursor-nwse-resize'],
                ['ne', '-right-4 -top-4', 'cursor-nesw-resize'],
                ['sw', '-left-4 -bottom-4', 'cursor-nesw-resize'],
                ['se', '-right-4 -bottom-4', 'cursor-nwse-resize'],
              ] as const
            ).map(([mode, pos, cursor]) => (
              <div
                key={mode}
                data-handle={mode}
                className={`${handleClass} ${pos} ${cursor} flex items-center justify-center`}
                onPointerDown={(e) => startDrag(mode, e)}
              >
                <span className="h-4.5 w-4.5 rounded-full border-2 border-accent-600 bg-white shadow-sm" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-paper-300 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
        >
          📷 Outra foto
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex-[2] rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
        >
          ✂️ Recortar e ler a capa
        </button>
      </div>
    </div>
  )
}
