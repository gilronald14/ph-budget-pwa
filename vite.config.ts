import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ph-budget-pwa/',
  build: {
    outDir: 'docs'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PH Budget',
        short_name: 'Budget',
        description: 'Personal budgeting for Philippine pay periods',
        theme_color: '#0d1b2a',
        background_color: '#0d1b2a',
        display: 'standalone',
        start_url: '/ph-budget-pwa/',
        icons: [
          {
            src: '/ph-budget-pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/ph-budget-pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})