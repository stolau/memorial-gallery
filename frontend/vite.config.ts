/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/media': { target: 'http://localhost:5000', changeOrigin: true },
      '/event-media': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
