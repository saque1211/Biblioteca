/** Ponte opcional injetada pelo app Android (WebView) para salvar arquivos. */
interface AndroidDownloaderBridge {
  saveBase64: (dataUrl: string, filename: string, mime: string) => void
}

function androidBridge(): AndroidDownloaderBridge | undefined {
  const b = (window as unknown as { AndroidDownloader?: AndroidDownloaderBridge }).AndroidDownloader
  return b && typeof b.saveBase64 === 'function' ? b : undefined
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Baixa um arquivo. No navegador usa o mecanismo padrão (blob + link);
 * dentro do app Android, entrega ao app nativo, que salva em Downloads
 * (a WebView sozinha não consegue baixar blobs).
 */
export async function downloadFile(filename: string, data: Blob | string, mime: string): Promise<void> {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const bridge = androidBridge()
  if (bridge) {
    const dataUrl = await blobToDataUrl(blob)
    bridge.saveBase64(dataUrl, filename, mime)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
