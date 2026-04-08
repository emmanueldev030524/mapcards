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
      output: {
        manualChunks(id) {
          if (id.includes('maplibre-gl')) return 'maplibre'
          if (id.includes('@turf')) return 'turf'
          // jsPDF is intentionally NOT forced into a manual chunk so
          // Rolldown treats it as a pure dynamic-import dependency of
          // exportPdf.ts (which is itself dynamically imported on first
          // PDF export). This keeps the ~540KB chunk out of the initial
          // modulepreload set.
        },
      },
    },
  },
})
