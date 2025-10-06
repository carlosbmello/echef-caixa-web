// echef-caixa-web/vite.config.ts

// Adicionados para lidar com caminhos e leitura de arquivos
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Definição moderna do __dirname para compatibilidade com ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Mantivemos sua configuração de porta original
    port: 5175,
    strictPort: true, // Opcional

    // Adicionada a configuração para habilitar HTTPS
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3.pem')),
    }
  }
})