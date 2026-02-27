import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/cmc-api': {
        target: 'https://pro-api.coinmarketcap.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cmc-api/, '')
      }
    }
  },
  resolve: {
    mainFields: ['module', 'main', 'jsnext:main', 'jsnext'],
  }
})
