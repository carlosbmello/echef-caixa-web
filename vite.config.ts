// echef-caixa-web/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  
  // Configuração para o servidor de DESENVOLVIMENTO (npm run dev)
  server: {
    port: 5175,
    strictPort: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3.pem')),
    }
  },

  // --- ADICIONE ESTA NOVA SEÇÃO ---
  // Configuração para o servidor de PREVIEW (npm run preview)
  preview: {
    port: 5175,
    strictPort: true,
    host: true, // Garante que seja acessível pela rede
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3.pem')),
    }
  }
})