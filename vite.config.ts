// echef-caixa-web/vite.config.ts

import { defineConfig, loadEnv } from 'vite'; // Importe o loadEnv
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A configuração agora é uma função para poder ler as variáveis de ambiente
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do arquivo .env apropriado
  const env = loadEnv(mode, process.cwd(), '');

  // Define as configurações HTTPS apenas se USE_HTTPS for 'true'
  const httpsConfig = env.USE_HTTPS === 'true' 
    ? {
        key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-pem')),
      }
    : undefined; // Se não, a configuração https será indefinida, desativando-a.

  return {
    plugins: [react()],
    
    // Configuração para o servidor de DESENVOLVIMENTO (npm run dev)
    server: {
      port: 5175,
      strictPort: true,
      https: httpsConfig, // Usa a configuração condicional
    },

    // Configuração para o servidor de PREVIEW (npm run preview)
    preview: {
      port: 5175,
      strictPort: true,
      host: true,
      https: httpsConfig, // Usa a mesma configuração condicional
    }
  };
});