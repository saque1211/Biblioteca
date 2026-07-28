/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave da API do Google Books (opcional) — cota própria, busca confiável. */
  readonly VITE_GOOGLE_BOOKS_KEY?: string
  /** Canal do build: 'beta' no canal de teste, ausente na produção. */
  readonly VITE_CHANNEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
