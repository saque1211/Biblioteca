import type { Profile } from '../hooks/useSettings'
import { Modal } from './ui/Modal'

interface ProfileModalProps {
  current?: Profile
  /** Primeira vez: obrigatório escolher (sem botão fechar). */
  mandatory?: boolean
  onChoose: (profile: Profile) => void
  onClose?: () => void
}

/** Escolha do tipo de conta — muda recursos e estatísticas do app. */
export function ProfileModal({ current, mandatory, onChoose, onClose }: ProfileModalProps) {
  return (
    <Modal
      title={mandatory ? 'Bem-vindo à Minha Biblioteca 📚' : 'Tipo de conta'}
      onClose={onClose ?? (() => {})}
      dismissable={!mandatory}
      maxWidth="max-w-md"
    >
      <p className="mb-4 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        {mandatory
          ? 'Como você vai usar o app? Isso ajusta o que aparece — dá para trocar depois nas configurações.'
          : 'Trocar o tipo de conta ajusta os recursos e as estatísticas que aparecem.'}
      </p>
      <div className="space-y-2.5">
        <ProfileCard
          selected={current === 'pessoal'}
          emoji="📖"
          title="Pessoal"
          description="Minha coleção de livros: leitura, favoritos, avaliações e quanto investi."
          onClick={() => onChoose('pessoal')}
        />
        <ProfileCard
          selected={current === 'corporativo'}
          emoji="🏫"
          title="Escolar / Corporativa"
          description="Biblioteca para emprestar: leitura em aula, empréstimos por criança, doações e estatísticas de quem leu o quê."
          onClick={() => onChoose('corporativo')}
        />
      </div>
    </Modal>
  )
}

function ProfileCard({
  selected,
  emoji,
  title,
  description,
  onClick,
}: {
  selected: boolean
  emoji: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card ${
        selected
          ? 'border-accent-500 bg-accent-100/50 dark:bg-accent-700/20'
          : 'border-paper-200 dark:border-ink-700'
      }`}
    >
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-800 dark:text-paper-100">{title}</span>
          {selected && <span className="text-[11px] font-semibold text-accent-600 dark:text-accent-400">✓ atual</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{description}</span>
      </span>
    </button>
  )
}
