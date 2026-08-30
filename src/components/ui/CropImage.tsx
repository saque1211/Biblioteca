import { useEffect, useRef, useState } from 'react'
import { orderQuad, type Point, type Quad } from '../../utils/image'

interface CropImageProps {
  src: string
  /** Quadrilátero inicial em coordenadas naturais da imagem (ex.: detecção automática). */
  initialQuad?: Quad | null
  onConfirm: (quad: Quad) => void
  onCancel: () => void
}

/** Ponto guardado como fração [0,1] do tamanho exibido — imune a redimensionamento/rotação da tela. */
type FracPoint = { x: number; y: number }

type Drag = { kind: 'corner'; index: number } | { kind: 'body'; last: Point } | null

const DEFAULT_INSET = 0.06

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Ajuste de recorte com toque: arraste os quatro cantos para cercar só a capa,
 * mesmo que a foto esteja torta. Ao confirmar, a capa é endireitada (correção
 * de perspectiva) e vira a capa do livro — é também o que o leitor de texto analisa.
 */
export function CropImage({ src, initialQuad, onConfirm, onCancel }: CropImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [pts, setPts] = useState<FracPoint[] | null>(null)
  const drag = useRef<Drag>(null)

  // Nova foto: recomeça o recorte na próxima carga da imagem
  useEffect(() => {
    setPts(null)
  }, [src])

  function handleImageLoad() {
    const img = imgRef.current
    if (!img || pts) return
    if (initialQuad) {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      setPts(initialQuad.map((p) => ({ x: clamp01(p.x / nw), y: clamp01(p.y / nh) })))
      return
    }
    const a = DEFAULT_INSET
    const b = 1 - DEFAULT_INSET
    setPts([
      { x: a, y: a },
      { x: b, y: a },
      { x: b, y: b },
      { x: a, y: b },
    ])
  }

  function fracFromEvent(e: React.PointerEvent): Point {
    const img = imgRef.current!
    const r = img.getBoundingClientRect()
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }
  }

  function startCorner(index: number, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { kind: 'corner', index }
  }

  function startBody(e: React.PointerEvent) {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { kind: 'body', last: fracFromEvent(e) }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !pts) return
    const f = fracFromEvent(e)
    if (d.kind === 'corner') {
      setPts((prev) => prev!.map((p, i) => (i === d.index ? f : p)))
      return
    }
    // Move o quadrilátero inteiro, sem deixar nenhum canto sair da imagem
    let mnx = 1
    let mny = 1
    let mxx = 0
    let mxy = 0
    for (const p of pts) {
      mnx = Math.min(mnx, p.x)
      mny = Math.min(mny, p.y)
      mxx = Math.max(mxx, p.x)
      mxy = Math.max(mxy, p.y)
    }
    const ux = Math.max(-mnx, Math.min(1 - mxx, f.x - d.last.x))
    const uy = Math.max(-mny, Math.min(1 - mxy, f.y - d.last.y))
    setPts((prev) => prev!.map((p) => ({ x: p.x + ux, y: p.y + uy })))
    d.last = { x: d.last.x + ux, y: d.last.y + uy }
  }

  function endDrag() {
    drag.current = null
  }

  function confirm() {
    const img = imgRef.current
    if (!img || !pts) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    onConfirm(orderQuad(pts.map((p) => ({ x: p.x * nw, y: p.y * nh }))))
  }

  const polyPoints = pts ? pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ') : ''
  const maskPath = pts
    ? `M0,0 H100 V100 H0 Z M ${pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' L ')} Z`
    : ''

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-ink-500 dark:text-ink-400">
        {initialQuad
          ? 'Cantos detectados — arraste para ajustar se precisar.'
          : 'Arraste os quatro cantos para cercar só a capa.'}{' '}
        Mesmo torta, a capa é endireitada ao recortar.
      </p>
      <div
        className="relative mx-auto w-fit touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Foto para recorte"
          onLoad={handleImageLoad}
          className="block max-h-[55vh] w-auto max-w-full rounded-xl"
          draggable={false}
        />
        {pts && (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path d={maskPath} fillRule="evenodd" fill="rgba(0,0,0,0.55)" />
              <polygon
                points={polyPoints}
                fill="transparent"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onPointerDown={startBody}
              />
            </svg>
            {pts.map((p, i) => (
              <div
                key={i}
                data-corner={i}
                className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                onPointerDown={(e) => startCorner(i, e)}
              >
                <span className="h-4.5 w-4.5 rounded-full border-2 border-accent-600 bg-white shadow-sm" />
              </div>
            ))}
          </>
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
          ✂️ Recortar e endireitar
        </button>
      </div>
    </div>
  )
}
