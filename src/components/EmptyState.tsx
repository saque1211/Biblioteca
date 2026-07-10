export function EmptyState() {
  return (
    <div className="animate-slide-up py-16 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-100 to-paper-200 shadow-card dark:from-accent-700/30 dark:to-ink-800">
        <svg viewBox="0 0 24 24" className="h-11 w-11 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" strokeWidth={1.4}>
          <path d="M12 6.5C10.5 4.9 8.4 4 6 4c-1 0-2 .15-3 .5v15c1-.35 2-.5 3-.5 2.4 0 4.5.9 6 2.5 1.5-1.6 3.6-2.5 6-2.5 1 0 2 .15 3 .5v-15c-1-.35-2-.5-3-.5-2.4 0-4.5.9-6 2.5z" strokeLinejoin="round" />
          <path d="M12 6.5v15" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="font-serif text-2xl font-semibold text-ink-800 dark:text-paper-100">
        Sua biblioteca começa aqui
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        Busque seu primeiro livro na barra acima — digite o título, autor ou ISBN e os
        detalhes serão preenchidos automaticamente. Capa, gênero, editora, tudo pronto
        para você organizar sua coleção.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-400 dark:text-ink-500">
        <kbd className="rounded-lg border border-paper-300 bg-paper-100 px-2 py-1 dark:border-ink-600 dark:bg-ink-800">
          ex.: Dom Casmurro
        </kbd>
        <span>ou</span>
        <kbd className="rounded-lg border border-paper-300 bg-paper-100 px-2 py-1 dark:border-ink-600 dark:bg-ink-800">
          9788535914849
        </kbd>
      </div>
    </div>
  )
}
