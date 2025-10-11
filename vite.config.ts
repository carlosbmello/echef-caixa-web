// echef-caixa-web/vite.config.ts

import { defineConfig, loadEnv, ServerOptions } from 'vite'; // <<< ADICIONE ServerOptions
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A função agora recebe apenas 'mode'
export default defineConfig(({ mode }) => { // <<< REMOVIDO 'command'
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '');

  // --- LÓGICA CONDICIONAL PARA HTTPS ---
  
  // <<< ALTERAÇÃO: Declare o tipo de serverConfig ---
  const serverConfig: ServerOptions = { // <<< TIPO EXplícito
    port: 5175,
    strictPort: true,
    host: true,
  };

  if (env.USE_HTTPS === 'true') {
    serverConfig.https = {
      key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost+3.pem')),
    };
  }
  // ------------------------------------

  return {
    plugins: [react()],
    
    server: serverConfig,

    preview: serverConfig,
  };
});