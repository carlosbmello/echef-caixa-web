// echef-caixa-web/vite.config.ts

import { defineConfig, loadEnv, ServerOptions } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '');

  // --- LÓGICA CONDICIONAL PARA HTTPS ---
  const serverConfig: ServerOptions = {
    port: 5175,
    strictPort: true,
    host: true,
  };

  // SÓ executa a lógica de HTTPS se a variável de ambiente estiver definida
  if (env.USE_HTTPS === 'true') {
    try {
      serverConfig.https = {
        key: fs.readFileSync(path.resolve(__dirname, '../certs/local-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '../certs/local-cert.pem')),
      };
    } catch (e) {
      console.error('--- ERRO DE HTTPS ---');
      console.error('Não foi possível carregar os arquivos de certificado. Verifique se a pasta "certs" existe no diretório raiz do projeto e contém os arquivos .pem.');
      console.error('Para rodar em HTTP, remova a variável USE_HTTPS=true do seu arquivo .env');
      // process.exit(1); // Descomente se quiser que o processo pare em caso de erro
    }
  }
  // ------------------------------------

  return {
    plugins: [react()],
    
    server: serverConfig,

    preview: serverConfig,
  };
});