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

export interface Point {
  x: number
  y: number
}

/** Quatro cantos de uma capa na foto, em ordem: superior-esq, superior-dir, inferior-dir, inferior-esq. */
export type Quad = [Point, Point, Point, Point]

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = dataUrl
  })
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Retângulo reto vira quadrilátero (cantos na ordem tl, tr, br, bl). */
export function rectToQuad(r: CropRect): Quad {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ]
}

/**
 * Coloca 4 cantos quaisquer na ordem canônica tl, tr, br, bl usando as somas
 * e diferenças das coordenadas (funciona bem para capas giradas em qualquer
 * sentido). Se ficar degenerado (cantos repetidos), devolve na ordem recebida.
 */
export function orderQuad(points: Point[]): Quad {
  const tl = points.reduce((m, p) => (p.x + p.y < m.x + m.y ? p : m))
  const br = points.reduce((m, p) => (p.x + p.y > m.x + m.y ? p : m))
  const tr = points.reduce((m, p) => (p.x - p.y > m.x - m.y ? p : m))
  const bl = points.reduce((m, p) => (p.x - p.y < m.x - m.y ? p : m))
  const ordered = [tl, tr, br, bl]
  const unique = new Set(ordered.map((p) => `${p.x},${p.y}`))
  if (unique.size < 4) return [points[0], points[1], points[2], points[3]] as Quad
  return [tl, tr, br, bl] as Quad
}

/**
 * "Endireita" o quadrilátero marcado (a capa, mesmo torta na foto) num
 * retângulo reto, via transformação de perspectiva, e devolve três versões:
 * - cover: capa compacta (JPEG, até 480px)
 * - ocr: versão para leitura — maior, em tons de cinza e com contraste reforçado
 * - ocrPlain: mesma versão para leitura, sem o realce
 */
export async function warpForScan(
  sourceDataUrl: string,
  quad: Quad,
): Promise<{ cover: string; ocr: string; ocrPlain: string }> {
  const img = await loadImage(sourceDataUrl)
  const sw = img.naturalWidth
  const sh = img.naturalHeight

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = sw
  srcCanvas.height = sh
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  if (!srcCtx) throw new Error('Canvas indisponível')
  srcCtx.drawImage(img, 0, 0)
  const srcData = srcCtx.getImageData(0, 0, sw, sh)

  const [tl, tr, br, bl] = quad
  const widthMax = Math.max(dist(tl, tr), dist(bl, br))
  const heightMax = Math.max(dist(tl, bl), dist(tr, br))
  if (!(widthMax > 1 && heightMax > 1)) throw new Error('Recorte inválido')

  const aspect = widthMax / heightMax
  const targetLong = Math.min(1500, Math.max(widthMax, heightMax))
  let outW: number
  let outH: number
  if (aspect >= 1) {
    outW = Math.max(1, Math.round(targetLong))
    outH = Math.max(1, Math.round(targetLong / aspect))
  } else {
    outH = Math.max(1, Math.round(targetLong))
    outW = Math.max(1, Math.round(targetLong * aspect))
  }

  const warped = warpQuad(srcData, sw, sh, quad, outW, outH)
  const ocrCanvas = document.createElement('canvas')
  ocrCanvas.width = outW
  ocrCanvas.height = outH
  const ocrCtx = ocrCanvas.getContext('2d')!
  ocrCtx.putImageData(warped, 0, 0)

  // Capa: reduz a versão já endireitada para no máximo 480px
  const coverScale = Math.min(1, 480 / Math.max(outW, outH))
  const coverCanvas = document.createElement('canvas')
  coverCanvas.width = Math.max(1, Math.round(outW * coverScale))
  coverCanvas.height = Math.max(1, Math.round(outH * coverScale))
  const coverCtx = coverCanvas.getContext('2d')!
  coverCtx.fillStyle = '#ffffff'
  coverCtx.fillRect(0, 0, coverCanvas.width, coverCanvas.height)
  coverCtx.drawImage(ocrCanvas, 0, 0, coverCanvas.width, coverCanvas.height)
  const cover = coverCanvas.toDataURL('image/jpeg', 0.82)

  const ocrPlain = ocrCanvas.toDataURL('image/jpeg', 0.92)
  enhanceForOcr(ocrCanvas)
  const ocr = ocrCanvas.toDataURL('image/jpeg', 0.92)

  return { cover, ocr, ocrPlain }
}

/**
 * Reamostra o quadrilátero de origem num retângulo reto de saída, usando a
 * homografia (perspectiva) e amostragem bilinear. É o que corrige a foto
 * torta: cada pixel de saída é buscado no ponto correspondente da foto.
 */
function warpQuad(src: ImageData, sw: number, sh: number, quad: Quad, outW: number, outH: number): ImageData {
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ]
  // Homografia que leva coordenadas da saída (reta) → coordenadas na foto
  const [a, b, c, d, e, f, g, h] = homographyDstToSrc(dst, quad)

  const out = new ImageData(outW, outH)
  const s = src.data
  const o = out.data
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = g * x + h * y + 1
      let sx = (a * x + b * y + c) / denom
      let sy = (d * x + e * y + f) / denom
      const oi = (y * outW + x) * 4
      if (sx < -1 || sy < -1 || sx > sw || sy > sh) {
        o[oi] = o[oi + 1] = o[oi + 2] = 255
        o[oi + 3] = 255
        continue
      }
      if (sx < 0) sx = 0
      else if (sx > sw - 1) sx = sw - 1
      if (sy < 0) sy = 0
      else if (sy > sh - 1) sy = sh - 1
      const x0 = sx | 0
      const y0 = sy | 0
      const x1 = x0 + 1 < sw ? x0 + 1 : x0
      const y1 = y0 + 1 < sh ? y0 + 1 : y0
      const fx = sx - x0
      const fy = sy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      for (let k = 0; k < 3; k++) {
        const top = s[i00 + k] + (s[i10 + k] - s[i00 + k]) * fx
        const bot = s[i01 + k] + (s[i11 + k] - s[i01 + k]) * fx
        o[oi + k] = top + (bot - top) * fy
      }
      o[oi + 3] = 255
    }
  }
  return out
}

/** Homografia (8 coeficientes, o 9º é 1) que mapeia os pontos `dst` em `src`. */
function homographyDstToSrc(dst: Point[], src: Point[]): number[] {
  const A: number[][] = []
  const rhs: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i]
    const { x: X, y: Y } = src[i]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    rhs.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    rhs.push(Y)
  }
  return solveLinear(A, rhs)
}

/** Eliminação de Gauss com pivotamento parcial para um sistema n×n. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const m = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-9) throw new Error('Sistema singular')
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const pv = m[col][col]
    for (let c = col; c <= n; c++) m[col][c] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = m[r][col]
      if (factor === 0) continue
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

/**
 * Detecção automática dos quatro cantos do livro na foto — inclusive quando
 * a capa está girada/torta. Separa o livro do fundo mais uniforme (mesa, cama…)
 * e pega os quatro pontos extremos do primeiro plano. Se o fundo for confuso,
 * cai para a caixa reta de `autoDetectCrop`, e por fim para `null` (recorte
 * manual sempre disponível).
 */
export async function autoDetectQuad(sourceDataUrl: string): Promise<Quad | null> {
  const img = await loadImage(sourceDataUrl)
  const maxDim = 260
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(8, Math.round(img.naturalWidth * scale))
  const h = Math.max(8, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx) {
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    const small = detectQuadFromForeground(data, w, h)
    if (small) {
      const factor = 1 / scale
      return orderQuad(small.map((p) => ({ x: p.x * factor, y: p.y * factor })))
    }
  }
  // Fundo confuso: usa a caixa reta como aproximação
  const rect = await autoDetectCrop(sourceDataUrl).catch(() => null)
  return rect ? rectToQuad(rect) : null
}

/**
 * Acha os 4 cantos do primeiro plano (o livro) contra o fundo estimado pela
 * moldura da foto. Trabalha na resolução reduzida; devolve `null` quando o
 * resultado não parece um livro.
 */
function detectQuadFromForeground(data: Uint8ClampedArray, w: number, h: number): Quad | null {
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.06))
  const isBorder = (x: number, y: number) => x < ring || y < ring || x >= w - ring || y >= h - ring

  let br = 0
  let bg = 0
  let bb = 0
  let bn = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBorder(x, y)) continue
      const i = (y * w + x) * 4
      br += data[i]
      bg += data[i + 1]
      bb += data[i + 2]
      bn++
    }
  }
  if (bn === 0) return null
  br /= bn
  bg /= bn
  bb /= bn

  let varSum = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBorder(x, y)) continue
      const i = (y * w + x) * 4
      const dr = data[i] - br
      const dg = data[i + 1] - bg
      const db = data[i + 2] - bb
      varSum += dr * dr + dg * dg + db * db
    }
  }
  const bgStd = Math.sqrt(varSum / bn)
  const threshold = Math.max(34, bgStd * 2.2)

  const fg = new Uint8Array(w * h)
  let count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dr = data[i] - br
      const dg = data[i + 1] - bg
      const db = data[i + 2] - bb
      if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) {
        fg[y * w + x] = 1
        count++
      }
    }
  }
  const frac = count / (w * h)
  // Fundo confuso (quase tudo é "primeiro plano") ou capa pequena demais
  if (frac < 0.1 || frac > 0.92) return null

  // Erosão leve: tira respingos isolados que puxariam os cantos para o lugar errado
  const eroded = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!fg[y * w + x]) continue
      const n = fg[(y - 1) * w + x] + fg[(y + 1) * w + x] + fg[y * w + x - 1] + fg[y * w + x + 1]
      if (n >= 3) eroded[y * w + x] = 1
    }
  }

  let tl: Point | null = null
  let tr: Point | null = null
  let brc: Point | null = null
  let bl: Point | null = null
  let tlv = Infinity
  let brv = -Infinity
  let trv = -Infinity
  let blv = Infinity
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!eroded[y * w + x]) continue
      const sum = x + y
      const diff = x - y
      if (sum < tlv) {
        tlv = sum
        tl = { x, y }
      }
      if (sum > brv) {
        brv = sum
        brc = { x, y }
      }
      if (diff > trv) {
        trv = diff
        tr = { x, y }
      }
      if (diff < blv) {
        blv = diff
        bl = { x, y }
      }
    }
  }
  if (!tl || !tr || !brc || !bl) return null

  const quad: Quad = [tl, tr, brc, bl]

  // Sanidade: precisa parecer uma capa (área e proporção plausíveis, sem lados minúsculos)
  const area = quadArea(quad)
  if (area / (w * h) < 0.12) return null
  const widthMax = Math.max(dist(tl, tr), dist(bl, brc))
  const heightMax = Math.max(dist(tl, bl), dist(tr, brc))
  const minSide = Math.min(dist(tl, tr), dist(tr, brc), dist(brc, bl), dist(bl, tl))
  if (minSide < Math.min(w, h) * 0.12) return null
  const aspect = widthMax / heightMax
  if (aspect < 0.3 || aspect > 1.8) return null

  return quad
}

/** Área do quadrilátero (fórmula do cadarço). */
function quadArea(q: Quad): number {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

/**
 * Detecção automática do livro na foto (caixa reta): procura a região
 * retangular com bordas/contraste (o livro) contra o fundo mais uniforme.
 * Serve de aproximação quando a detecção dos quatro cantos não se convence.
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
