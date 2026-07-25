import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // heic2any is a large WASM codec (~1.35MB) lazy-loaded only when the
    // user converts a HEIC file — silence the threshold warning for it.
    chunkSizeWarningLimit: 1500,
  },
})


