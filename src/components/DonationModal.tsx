import { useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { Modal } from './ui/Modal'

interface DonationModalProps {
  settings: AppSettings
  onClose: () => void
}

/**
 * Tela de doações: mostra a chave PIX configurada pelo dono (com botão de
 * copiar) e um recado opcional. É só para ver e copiar — a configuração da
 * chave fica nas Configurações, para que quem só quer doar não consiga alterá-la.
 */
export function DonationModal({ settings, onClose }: DonationModalProps) {
  const hasKey = !!settings.pixKey?.trim()
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    if (!settings.pixKey) return
    try {
      await navigator.clipboard.writeText(settings.pixKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Alguns navegadores bloqueiam a área de transferência — o usuário copia manualmente
    }
  }

  return (
    <Modal title="Doações" onClose={onClose} maxWidth="max-w-sm">
      {hasKey ? (
        <div className="space-y-4 text-center">
          <p className="text-3xl">💚</p>
          <p className="text-sm leading-relaxed text-ink-600 dark:text-paper-300">
            {settings.donationNote?.trim() || 'Toda contribuição ajuda a manter a biblioteca. Obrigado!'}
          </p>
          <div className="rounded-xl border border-paper-200 bg-paper-50 p-3 dark:border-ink-700 dark:bg-ink-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Chave PIX
            </p>
            <p className="mt-1 break-all text-sm font-medium text-ink-800 dark:text-paper-100">
              {settings.pixKey}
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
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-3xl">💚</p>
          <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Nenhuma chave PIX configurada ainda. Abra as <strong>Configurações</strong> ⚙️
            e cadastre sua chave na seção “Doações” — ela aparecerá aqui para quem quiser ajudar.
          </p>
        </div>
      )}
    </Modal>
  )
}
