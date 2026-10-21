import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  envPrefix: ['VITE_', 'PUBLIC_'],
  server: {
    proxy: {
      // Browser asks /bestdori/..., the dev server asks bestdori.com/...
      '/bestdori': {
        target: 'https://bestdori.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bestdori/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
    },
  },
})