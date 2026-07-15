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
