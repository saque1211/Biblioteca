import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Servido em https://<usuario>.github.io/Biblioteca/
  base: '/Biblioteca/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Minha Biblioteca',
        short_name: 'Biblioteca',
        description: 'Biblioteca pessoal de livros — catálogo, busca, aquisição e agenda de leitura',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf9f7',
        theme_color: '#55643f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Arquivos do OCR (~7 MB) ficam fora do pré-cache: são baixados e
        // guardados apenas quando o scanner é usado pela primeira vez
        globIgnores: ['**/ocr/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Capas de livros: cache-first para funcionarem offline depois de vistas
        runtimeCaching: [
          {
            urlPattern: /\/ocr\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(books\.google\.com|covers\.openlibrary\.org)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-covers',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
