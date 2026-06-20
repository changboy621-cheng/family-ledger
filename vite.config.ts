import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon-192.png'],
      manifest: {
        name: '家帳 FamilyLedger',
        short_name: '家帳',
        start_url: '/',
        display: 'standalone',
        background_color: '#F8FAFC',
        theme_color: '#1D9E75',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true
      }
    })
  ]
});
