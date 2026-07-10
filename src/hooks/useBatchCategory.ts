import { useCallback, useState } from 'react'

const KEY = 'biblioteca-batch-category'

/**
 * Categoria de aquisição em lote: quando ativa, todo livro adicionado
 * recebe automaticamente essa categoria (ex.: "Doação Sicredi").
 * Persistida em localStorage para sobreviver a recarregamentos.
 */
export function useBatchCategory() {
  const [batchCategory, setBatchCategoryState] = useState<string | null>(
    () => localStorage.getItem(KEY),
  )

  const setBatchCategory = useCallback((value: string | null) => {
    setBatchCategoryState(value)
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  }, [])

  return { batchCategory, setBatchCategory }
}
