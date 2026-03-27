import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // jsPDF bundles html2canvas + dompurify for its .html() method.
      // We only use .addImage() — mark them external to save ~221KB.
      external: ['html2canvas', 'dompurify'],
    },
  },
})
