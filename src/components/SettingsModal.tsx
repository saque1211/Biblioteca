import { useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { Modal } from './ui/Modal'

interface SettingsModalProps {
  settings: AppSettings
  onUpdate: (changes: Partial<AppSettings>) => void
  onClose: () => void
}

export function SettingsModal({ settings, onUpdate, onClose }: SettingsModalProps) {
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )

  async function toggleNotifications(enabled: boolean) {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
    }
    onUpdate({ overdueNotifications: enabled })
  }

  return (
    <Modal title="Configurações" onClose={onClose}>
      <div className="space-y-4">
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
