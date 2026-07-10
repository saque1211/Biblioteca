import type { ReactNode } from 'react'
import type { ReadingStatus } from '../../types'
import { READING_STATUS_LABELS } from '../../types'

type BadgeTone = 'neutral' | 'accent' | 'blue' | 'green' | 'amber' | 'red'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-paper-200/70 text-ink-600 dark:bg-ink-700 dark:text-paper-300',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<ReadingStatus, BadgeTone> = {
  'nao-lido': 'neutral',
  lendo: 'blue',
  lido: 'green',
  abandonado: 'red',
}

export function StatusBadge({ status }: { status: ReadingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{READING_STATUS_LABELS[status]}</Badge>
}
