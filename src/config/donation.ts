/**
 * Dados de doação embutidos no app (iguais para todos os aparelhos).
 * Ficam no código — e não no armazenamento local — para aparecerem em
 * qualquer celular automaticamente. Só mudam quando o app é atualizado.
 */
export const DONATION = {
  /** Chave PIX usada ao copiar (formato E.164, o que os bancos colam melhor). */
  pixKey: '+5547999986287',
  /** Como a chave aparece na tela (mais legível). */
  pixDisplay: '+55 (47) 99998-6287',
  /** Recado exibido na tela de doações. */
  note: 'Sua doação ajuda a manter a biblioteca 💚',
} as const
