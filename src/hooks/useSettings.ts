import { useCallback, useState } from 'react'

/** Perfil de uso: define quais recursos e estatísticas aparecem. */
export type Profile = 'pessoal' | 'corporativo'

export interface AppSettings {
  /** Tipo de conta escolhido; undefined = ainda não escolheu (mostra a tela inicial). */
  profile?: Profile
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

export interface ProfileFlags {
  /** Seção "Leitura em aula" no livro. */
  classReading: boolean
  /** Estatísticas por criança (leituras/empréstimos/mais lidos). */
  childStats: boolean
  /** Categoria de aquisição em lote (doações). */
  batchCategory: boolean
  /** Resumo de valor investido na coleção. */
  invested: boolean
}

/** Recursos ligados/desligados conforme o perfil. */
export function profileFlags(profile: Profile | undefined): ProfileFlags {
  const corp = profile === 'corporativo'
  return {
    classReading: corp,
    childStats: corp,
    batchCategory: corp,
    invested: !corp,
  }
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
