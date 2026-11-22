import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  envPrefix: ['VITE_', 'PUBLIC_'],
  server: {
    // Фіксований порт, бо адреси в .env.development містять 5173
    port: 5173,
    strictPort: true,
    proxy: {
      // Browser asks /bestdori/..., the dev server asks bestdori.com/...
      '/bestdori': {
        target: 'https://bestdori.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bestdori/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
      '/proxy/storage': {
        target: 'https://storage.bdon.moe',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/storage/, ''),
      },
      '/proxy/assets': {
        target: 'https://assets.bdon.moe',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/assets/, ''),
      },
    },
  },
})