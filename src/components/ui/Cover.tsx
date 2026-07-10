import { useEffect, useState } from 'react'

interface CoverProps {
  url?: string
  title: string
  className?: string
}

/** Capa do livro com fallback elegante quando não há imagem ou ela falha ao carregar. */
export function Cover({ url, title, className = '' }: CoverProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) {
    return <CoverFallback title={title} className={className} />
  }
  return (
    <img
      src={url}
      alt={`Capa de ${title}`}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}

function CoverFallback({ title, className = '' }: { title: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-paper-200 to-paper-300 p-1.5 text-center dark:from-ink-700 dark:to-ink-800 ${className}`}
      aria-hidden
    >
      <span className="line-clamp-3 text-[9px] font-medium leading-tight text-ink-500 dark:text-paper-300/70">
        {title}
      </span>
    </div>
  )
}
