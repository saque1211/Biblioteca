import { useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { clearLibrary, countDuplicateBooks, removeDuplicateBooks } from '../db/db'
import { Modal } from './ui/Modal'

interface SettingsModalProps {
  settings: AppSettings
  onUpdate: (changes: Partial<AppSettings>) => void
  onClose: () => void
  onChangeProfile: () => void
}

export function SettingsModal({ settings, onUpdate, onClose, onChangeProfile }: SettingsModalProps) {
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )
  const [maintMsg, setMaintMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function toggleNotifications(enabled: boolean) {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
    }
    onUpdate({ overdueNotifications: enabled })
  }

  async function handleRemoveDuplicates() {
    if (working) return
    setWorking(true)
    setMaintMsg(null)
    const dups = await countDuplicateBooks()
    if (dups === 0) {
      setMaintMsg('Nenhum livro duplicado encontrado ✓')
      setWorking(false)
      return
    }
    if (confirm(`Foram encontrados ${dups} livro(s) duplicado(s) (mesmo ISBN ou título+autor). Remover as cópias, mantendo uma de cada?`)) {
      const removed = await removeDuplicateBooks()
      setMaintMsg(`${removed} duplicado(s) removido(s) ✓`)
    }
    setWorking(false)
  }

  async function handleClearLibrary() {
    if (working) return
    if (!confirm('Isto vai APAGAR TODA a biblioteca (livros, empréstimos e agenda). Essa ação não pode ser desfeita. Deseja continuar?')) return
    if (!confirm('Tem certeza? Recomendamos exportar um backup antes. Apagar tudo agora?')) return
    setWorking(true)
    await clearLibrary()
    setMaintMsg('Biblioteca apagada.')
    setWorking(false)
  }

  return (
    <Modal title="Configurações" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-paper-200 p-3 dark:border-ink-700">
          <span>
            <span className="block text-sm font-medium text-ink-700 dark:text-paper-100">Tipo de conta</span>
            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
              {settings.profile === 'corporativo'
                ? '🏫 Escolar / Corporativa'
                : settings.profile === 'pessoal'
                ? '📖 Pessoal'
                : 'Não definido'}
            </span>
          </span>
          <button
            type="button"
            onClick={onChangeProfile}
            className="shrink-0 rounded-xl border border-paper-300 px-4 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-accent-500 hover:text-accent-600 dark:border-ink-600 dark:text-paper-300"
          >
            Trocar
          </button>
        </div>
        <SettingRow
          title="Perguntar se leu por completo"
          description="Ao marcar um livro como devolvido, perguntar se a criança apenas devolveu ou leu por completo (alimenta as estatísticas de leitura)."
          checked={settings.askReadOnReturn}
          onChange={(v) => onUpdate({ askReadOnReturn: v })}
        />
        <SettingRow
          title="Aviso de devolução atrasada"
          description="Mostrar alerta no topo do app (e notificação do sistema, se permitida) quando um livro passar da data prevista de devolução."
          checked={settings.overdueNotifications}
          onChange={toggleNotifications}
        />
        {settings.overdueNotifications && notifPermission === 'denied' && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            As notificações do sistema estão bloqueadas pelo navegador — o aviso aparecerá
            apenas dentro do app. Para liberar, toque no cadeado na barra de endereço.
          </p>
        )}
        <SettingRow
          title="Traduzir títulos automaticamente"
          description="Quando um livro em outro idioma for adicionado, traduzir o título para o português (o original fica guardado nos detalhes)."
          checked={settings.translateTitles}
          onChange={(v) => onUpdate({ translateTitles: v })}
        />

        {/* Manutenção da biblioteca */}
        <div className="space-y-2 border-t border-paper-200 pt-4 dark:border-ink-700">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Manutenção
          </p>
          <button
            type="button"
            disabled={working}
            onClick={handleRemoveDuplicates}
            className="w-full rounded-xl border border-paper-300 px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:border-accent-500 hover:bg-paper-100 disabled:opacity-50 dark:border-ink-600 dark:text-paper-100 dark:hover:bg-ink-700"
          >
            🧹 Remover livros duplicados
            <span className="mt-0.5 block text-[11px] font-normal text-ink-500 dark:text-ink-400">
              Mantém uma cópia de cada (mesmo ISBN ou título + autor)
            </span>
          </button>
          <button
            type="button"
            disabled={working}
            onClick={handleClearLibrary}
            className="w-full rounded-xl border border-rose-300 px-4 py-2.5 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-900/30"
          >
            🗑 Apagar toda a biblioteca
            <span className="mt-0.5 block text-[11px] font-normal text-rose-500/80 dark:text-rose-300/70">
              Remove todos os livros e dados — não pode ser desfeito
            </span>
          </button>
          {maintMsg && (
            <p className="animate-fade-in rounded-lg bg-paper-100 px-3 py-2 text-xs text-ink-600 dark:bg-ink-700 dark:text-paper-200">
              {maintMsg}
            </p>
          )}
        </div>
      </div>
      <p className="mt-5 text-center text-[11px] text-ink-400 dark:text-ink-500">
        O aviso de atraso é verificado quando o app é aberto.
      </p>
    </Modal>
  )
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-ink-700 dark:text-paper-100">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{description}</span>
      </span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-paper-300 transition-colors peer-checked:bg-accent-600 dark:bg-ink-600" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
