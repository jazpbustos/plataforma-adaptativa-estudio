import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // El front llama a /api/... y Vite lo reenvía a FastAPI.
    // Mismo origen => la cookie de sesión funciona sin configurar CORS.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
