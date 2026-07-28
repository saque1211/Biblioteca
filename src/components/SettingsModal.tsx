import { useRef, useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { clearLibrary, countDuplicateBooks, removeDuplicateBooks } from '../db/db'
import { countBooksWithoutCover, fetchMissingCovers, type CoverFetchProgress } from '../utils/fetchCovers'
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
  const [coverProgress, setCoverProgress] = useState<CoverFetchProgress | null>(null)
  const coverAbort = useRef<AbortController | null>(null)
  const [pixDraft, setPixDraft] = useState(settings.pixKey ?? '')
  const [noteDraft, setNoteDraft] = useState(settings.donationNote ?? '')
  const [pixSaved, setPixSaved] = useState(false)

  function savePix() {
    onUpdate({
      pixKey: pixDraft.trim() || undefined,
      donationNote: noteDraft.trim() || undefined,
    })
    setPixSaved(true)
    setTimeout(() => setPixSaved(false), 2000)
  }

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

  async function handleFetchCovers() {
    if (working) return
    setWorking(true)
    setMaintMsg(null)
    const missing = await countBooksWithoutCover()
    if (missing === 0) {
      setMaintMsg('Todos os livros já têm capa ✓')
      setWorking(false)
      return
    }
    if (
      !confirm(
        `${missing} livro(s) estão sem capa. Buscar as capas na internet agora? Isso pode levar alguns minutos — mantenha o app aberto.`,
      )
    ) {
      setWorking(false)
      return
    }
    const controller = new AbortController()
    coverAbort.current = controller
    setCoverProgress({ done: 0, total: missing, found: 0 })
    try {
      const result = await fetchMissingCovers((p) => setCoverProgress(p), controller.signal)
      setMaintMsg(
        controller.signal.aborted
          ? `Busca interrompida — ${result.found} capa(s) encontrada(s).`
          : `${result.found} capa(s) encontrada(s) de ${result.total} livro(s) sem imagem ✓`,
      )
    } catch {
      setMaintMsg('Não foi possível concluir a busca de capas.')
    }
    setCoverProgress(null)
    coverAbort.current = null
    setWorking(false)
  }

  function handleCancelCovers() {
    coverAbort.current?.abort()
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

        {/* Doações (só o dono, aqui nas configurações, altera a chave) */}
        <div className="space-y-2 border-t border-paper-200 pt-4 dark:border-ink-700">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Doações
          </p>
          <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            A chave abaixo aparece na tela de doações (💚 no topo) para quem quiser ajudar.
            Só quem abre estas configurações consegue alterá-la.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-paper-300">Chave PIX</span>
            <input
              value={pixDraft}
              onChange={(e) => setPixDraft(e.target.value)}
              placeholder="e-mail, telefone, CPF/CNPJ ou chave aleatória"
              className="w-full rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-accent-500 dark:border-ink-600 dark:bg-ink-900 dark:text-paper-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-paper-300">Recado (opcional)</span>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="ex.: Sua doação ajuda a manter a biblioteca da turma 💚"
              className="w-full rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-accent-500 dark:border-ink-600 dark:bg-ink-900 dark:text-paper-100"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={savePix}
              className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-accent-700 active:scale-[0.99]"
            >
              Salvar chave
            </button>
            {pixSaved && <span className="animate-fade-in text-xs text-accent-600 dark:text-accent-400">Salvo ✓</span>}
          </div>
        </div>

        {/* Manutenção da biblioteca */}
        <div className="space-y-2 border-t border-paper-200 pt-4 dark:border-ink-700">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Manutenção
          </p>
          <button
            type="button"
            disabled={working}
            onClick={handleFetchCovers}
            className="w-full rounded-xl border border-paper-300 px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:border-accent-500 hover:bg-paper-100 disabled:opacity-50 dark:border-ink-600 dark:text-paper-100 dark:hover:bg-ink-700"
          >
            🖼 Buscar capas faltantes
            <span className="mt-0.5 block text-[11px] font-normal text-ink-500 dark:text-ink-400">
              Procura na internet (por ISBN ou título) as capas dos livros importados sem imagem
            </span>
          </button>
          {coverProgress && (
            <div className="animate-fade-in space-y-1.5 rounded-xl bg-paper-100 px-3 py-2.5 dark:bg-ink-700">
              <div className="flex items-center justify-between text-xs text-ink-600 dark:text-paper-200">
                <span>
                  Buscando capas… {coverProgress.done}/{coverProgress.total} · {coverProgress.found} encontrada(s)
                </span>
                <button
                  type="button"
                  onClick={handleCancelCovers}
                  className="font-semibold text-rose-600 hover:underline dark:text-rose-300"
                >
                  Parar
                </button>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-300 dark:bg-ink-600">
                <div
                  className="h-full rounded-full bg-accent-600 transition-[width] duration-300"
                  style={{ width: `${coverProgress.total ? (coverProgress.done / coverProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
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
