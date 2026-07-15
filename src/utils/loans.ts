import type { Book, LoanRecord } from '../types'
import { todayISO } from './format'

/** Empréstimo em aberto (livro está fora agora). */
export function activeLoan(book: Book): LoanRecord | undefined {
  return book.loans?.find((l) => !l.returnedAt)
}

/** Empréstimo em aberto e com a devolução prevista já vencida. */
export function isOverdue(loan: LoanRecord | undefined, today = todayISO()): boolean {
  return !!loan && !loan.returnedAt && !!loan.dueAt && loan.dueAt < today
}

export function overdueBooks(books: Book[]): { book: Book; loan: LoanRecord }[] {
  const today = todayISO()
  const result: { book: Book; loan: LoanRecord }[] = []
  for (const book of books) {
    const loan = activeLoan(book)
    if (loan && isOverdue(loan, today)) result.push({ book, loan })
  }
  return result
}

export function newLoanId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
