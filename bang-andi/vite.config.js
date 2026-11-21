import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'CV Amanah Barokah - Manajemen Komoditas & Keuangan',
        short_name: 'Amanah Barokah',
        description: 'Aplikasi Manajemen Keuangan & Stok Bisnis Komoditas CV Amanah Barokah',
        theme_color: '#071A24',
        background_color: '#071A24',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: {
    host: true, // Auto expose to LAN / Wi-Fi for iPad & HP
    port: 5173,
  },
  preview: {
    host: true, // Auto expose to LAN / Wi-Fi
    port: 4173,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
