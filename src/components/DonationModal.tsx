import { useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { Modal } from './ui/Modal'

interface DonationModalProps {
  settings: AppSettings
  onUpdate: (changes: Partial<AppSettings>) => void
  onClose: () => void
}

/**
 * Tela de doações: mostra a chave PIX configurada pelo dono (com botão de
 * copiar) e um recado opcional. Enquanto não houver chave, permite configurá-la.
 */
export function DonationModal({ settings, onUpdate, onClose }: DonationModalProps) {
  const hasKey = !!settings.pixKey?.trim()
  const [editing, setEditing] = useState(!hasKey)
  const [keyDraft, setKeyDraft] = useState(settings.pixKey ?? '')
  const [noteDraft, setNoteDraft] = useState(settings.donationNote ?? '')
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

  function saveConfig() {
    onUpdate({
      pixKey: keyDraft.trim() || undefined,
      donationNote: noteDraft.trim() || undefined,
    })
    setEditing(false)
  }

  return (
    <Modal title="Doações" onClose={onClose} maxWidth="max-w-sm">
      {editing ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            Configure a chave PIX que aparecerá aqui para quem quiser ajudar a
            biblioteca. Você pode alterar isso quando quiser.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-paper-300">Chave PIX</span>
            <input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="e-mail, telefone, CPF/CNPJ ou chave aleatória"
              className="w-full rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-accent-500 dark:border-ink-600 dark:bg-ink-900 dark:text-paper-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-paper-300">Recado (opcional)</span>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="ex.: Sua doação ajuda a manter a biblioteca da turma 💚"
              className="w-full rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-accent-500 dark:border-ink-600 dark:bg-ink-900 dark:text-paper-100"
            />
          </label>
          <div className="flex gap-2">
            {hasKey && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-paper-300 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-accent-500 dark:border-ink-600 dark:text-paper-300"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={saveConfig}
              className="flex-[2] rounded-xl bg-accent-600 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-ink-400 underline-offset-2 hover:text-accent-600 hover:underline dark:text-ink-500"
          >
            Editar chave / recado
          </button>
        </div>
      )}
    </Modal>
  )
}
