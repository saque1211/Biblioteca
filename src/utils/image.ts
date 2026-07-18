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
export async function cropForScan(sourceDataUrl: string, crop: CropRect): Promise<{ cover: string; ocr: string }> {
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

  const ocrCanvas = draw(1600)
  enhanceForOcr(ocrCanvas)
  const ocr = ocrCanvas.toDataURL('image/jpeg', 0.92)

  return { cover, ocr }
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
