import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// When deploying to GitHub Pages the site is served from
// https://<user>.github.io/<repo>/ , so the base must match the repo name.
// Override with BASE_PATH when deploying to Vercel/Netlify/Cloudflare (use "/").
const base = process.env.BASE_PATH ?? '/Personal-Work-Place-Tool/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../src/core'),
      '@shared': resolve(__dirname, '../src/shared'),
    },
  },
  server: {
    // Allow Vite's dev server to import the shared core from the parent dir.
    fs: { allow: ['..'] },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Productivity Dashboard',
        short_name: 'Productivity',
        description:
          'Privacy-focused, offline-first productivity dashboard: time tracking, tasks, energy/focus check-ins, and weekly insights.',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
});
