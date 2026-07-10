interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md'
}

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const interactive = !!onChange
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'

  return (
    <div className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : undefined} aria-label="Avaliação">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star === value ? 0 : star)}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            className={`${interactive ? 'cursor-pointer transition-transform hover:scale-115' : 'cursor-default'} disabled:pointer-events-none`}
          >
            <svg
              viewBox="0 0 20 20"
              className={`${dim} transition-colors ${
                filled ? 'fill-amber-400 stroke-amber-400' : 'fill-none stroke-ink-400/60 dark:stroke-ink-500'
              }`}
              strokeWidth={1.4}
            >
              <path d="M10 1.8l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.4l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.8z" strokeLinejoin="round" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
