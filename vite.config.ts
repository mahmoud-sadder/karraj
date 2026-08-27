import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The GLB dwarfs the JS; keep the warning threshold meaningful for code.
    chunkSizeWarningLimit: 900,
  },
})
