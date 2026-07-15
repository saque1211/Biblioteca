import { useCallback, useState } from 'react'

export interface AppSettings {
  /** Perguntar "devolvido apenas ou lido por completo?" ao devolver um livro. */
  askReadOnReturn: boolean
  /** Mostrar notificação do sistema quando houver devoluções atrasadas. */
  overdueNotifications: boolean
  /** Traduzir automaticamente o título de livros adicionados em outro idioma. */
  translateTitles: boolean
}

const DEFAULTS: AppSettings = {
  askReadOnReturn: true,
  overdueNotifications: true,
  translateTitles: true,
}

const KEY = 'biblioteca-settings'

function load(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(load)

  const updateSettings = useCallback((changes: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...changes }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, updateSettings }
}
