import { useState } from 'react'
import { DONATION } from '../config/donation'
import { Modal } from './ui/Modal'

interface DonationModalProps {
  onClose: () => void
}

/**
 * Tela de doações: mostra a chave PIX embutida no app (igual para todos os
 * aparelhos) e um recado, com botão de copiar. É só para ver e copiar — a
 * chave fica no código do app, então só muda quando o app é atualizado.
 */
export function DonationModal({ onClose }: DonationModalProps) {
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(DONATION.pixKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Alguns navegadores bloqueiam a área de transferência — o usuário copia manualmente
    }
  }

  return (
    <Modal title="Doações" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4 text-center">
        <p className="text-3xl">💚</p>
        <p className="text-sm leading-relaxed text-ink-600 dark:text-paper-300">{DONATION.note}</p>
        <div className="rounded-xl border border-paper-200 bg-paper-50 p-3 dark:border-ink-700 dark:bg-ink-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Chave PIX (telefone)
          </p>
          <p className="mt-1 break-all text-sm font-medium text-ink-800 dark:text-paper-100">
            {DONATION.pixDisplay}
          </p>
        </div>
        <button
          type="button"
          onClick={copyKey}
          className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
        >
          {copied ? 'Copiado ✓' : '📋 Copiar chave PIX'}
        </button>
      </div>
    </Modal>
  )
}
