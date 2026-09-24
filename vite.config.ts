import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['tahir-logo.svg', 'tahir-icon-192.svg', 'tahir-icon-512.svg', 'tahir-icon-maskable.svg'],
      manifest: {
        name: 'Tahir Tracker - Personal Finance & Household',
        short_name: 'Tahir Tracker',
        description: 'Personal Finance & Household Tracker - Utility Bills, Loans, Milk, Petrol & Rent Management',
        theme_color: '#071724',
        background_color: '#071724',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/tahir-icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/tahir-icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/tahir-icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  }
});
