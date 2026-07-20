/**
 * Converte uma foto escolhida pelo usuário em uma capa compacta (data URL).
 * Redimensiona para no máximo 480px no maior lado e comprime em JPEG,
 * para não inflar o IndexedDB nem os backups JSON.
 */
export async function fileToCoverDataUrl(file: File, maxSize = 480, quality = 0.82): Promise<string> {
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  // Fundo branco para fotos com transparência (PNG)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = dataUrl
  })
}

/**
 * Recorta a região marcada e devolve duas versões:
 * - cover: capa compacta (JPEG, até 480px)
 * - ocr: versão para leitura — maior, em tons de cinza e com contraste
 *   reforçado (o OCR enxerga muito melhor assim)
 */
export async function cropForScan(
  sourceDataUrl: string,
  crop: CropRect,
): Promise<{ cover: string; ocr: string; ocrPlain: string }> {
  const img = await loadImage(sourceDataUrl)
  const sx = Math.max(0, Math.round(crop.x))
  const sy = Math.max(0, Math.round(crop.y))
  const sw = Math.min(img.naturalWidth - sx, Math.round(crop.width))
  const sh = Math.min(img.naturalHeight - sy, Math.round(crop.height))

  function draw(maxSize: number): HTMLCanvasElement {
    const scale = Math.min(1.5, maxSize / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * scale))
    canvas.height = Math.max(1, Math.round(sh * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  const coverCanvas = draw(480)
  const cover = coverCanvas.toDataURL('image/jpeg', 0.82)

  const plainCanvas = draw(1600)
  const ocrPlain = plainCanvas.toDataURL('image/jpeg', 0.92)
  enhanceForOcr(plainCanvas)
  const ocr = plainCanvas.toDataURL('image/jpeg', 0.92)

  return { cover, ocr, ocrPlain }
}

/**
 * Detecção automática do livro na foto: procura a região retangular com
 * bordas/contraste (o livro) contra o fundo mais uniforme (mesa, cama…).
 * Melhor esforço — devolve null quando não encontra nada plausível, e o
 * recorte manual continua disponível para ajuste fino.
 */
export async function autoDetectCrop(sourceDataUrl: string): Promise<CropRect | null> {
  const img = await loadImage(sourceDataUrl)
  const maxDim = 240
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(8, Math.round(img.naturalWidth * scale))
  const h = Math.max(8, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  // Luminância + magnitude de gradiente (bordas)
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  const colSum = new Float32Array(w)
  const rowSum = new Float32Array(h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const g =
        Math.abs(lum[y * w + x + 1] - lum[y * w + x - 1]) +
        Math.abs(lum[(y + 1) * w + x] - lum[(y - 1) * w + x])
      if (g > 24) {
        colSum[x] += g
        rowSum[y] += g
      }
    }
  }

  function bounds(sums: Float32Array): [number, number] | null {
    const max = Math.max(...sums)
    if (max <= 0) return null
    const threshold = max * 0.12
    let start = -1
    let end = -1
    for (let i = 0; i < sums.length; i++) {
      if (sums[i] >= threshold) {
        if (start === -1) start = i
        end = i
      }
    }
    return start === -1 ? null : [start, end]
  }

  const cols = bounds(colSum)
  const rows = bounds(rowSum)
  if (!cols || !rows) return null

  // Margem de 2% e volta às coordenadas originais
  const mx = w * 0.02
  const my = h * 0.02
  const x0 = Math.max(0, cols[0] - mx)
  const y0 = Math.max(0, rows[0] - my)
  const x1 = Math.min(w, cols[1] + mx)
  const y1 = Math.min(h, rows[1] + my)
  const bw = x1 - x0
  const bh = y1 - y0

  // Sanidade: precisa parecer um livro (nem minúsculo, nem proporção absurda)
  const areaFraction = (bw * bh) / (w * h)
  const aspect = bw / bh
  if (areaFraction < 0.12 || aspect < 0.3 || aspect > 1.6) return null

  const factor = 1 / scale
  return { x: x0 * factor, y: y0 * factor, width: bw * factor, height: bh * factor }
}

/** Tons de cinza + esticamento de contraste (percentis 2–98). */
function enhanceForOcr(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = image.data
  const histogram = new Uint32Array(256)
  const total = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = lum // guarda temporariamente no canal R
    histogram[lum]++
  }
  let low = 0
  let high = 255
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += histogram[v]
    if (acc >= total * 0.02) {
      low = v
      break
    }
  }
  acc = 0
  for (let v = 255; v >= 0; v--) {
    acc += histogram[v]
    if (acc >= total * 0.02) {
      high = v
      break
    }
  }
  const range = Math.max(1, high - low)
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i] - low) / range) * 255)))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // formato não suportado pelo atalho — tenta via <img>
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem'))
    }
    img.src = url
  })
}
