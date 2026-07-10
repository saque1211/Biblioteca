export function formatCurrency(value?: number): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function todayISO(): string {
  const now = new Date()
  return toISODate(now)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function authorsLabel(authors: string[]): string {
  if (authors.length === 0) return 'Autor desconhecido'
  if (authors.length <= 2) return authors.join(' e ')
  return `${authors[0]} e outros`
}
