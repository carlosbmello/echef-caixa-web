// src/services/api.ts (VERSÃO FINAL COM INTERCEPTOR 401 ROBUSTO)
import axios from 'axios';

// 1. Lê a variável de ambiente.
const envBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';

console.log('=== API INITIALIZATION ===');
// Adicionamos /admin aqui para facilitar a vida dos serviços
const adminBaseUrl = `${envBaseUrl}/admin`;
console.log(`[API Service] A Base URL está configurada para: ${adminBaseUrl}`);

const api = axios.create({
  baseURL: adminBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// --- 1. INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use((config) => {
  // Tenta pegar o token com os nomes mais comuns que você usou no projeto
  const token = localStorage.getItem('echef-token') || localStorage.getItem('authToken');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request Interceptor Error:', error);
  return Promise.reject(error);
});

// --- 2. INTERCEPTOR DE RESPOSTA (Trata o Erro 401) ---
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Verifica se é erro de autenticação (401 - Token inválido/expirado)
    if (error.response && error.response.status === 401) {
      console.warn('[API] Sessão expirada ou token inválido no Caixa. Redirecionando...');

      // 1. Limpa TODOS os possíveis dados de sessão para garantir
      // Isso cobre tanto o padrão novo ('echef-token') quanto o antigo ('authToken')
      localStorage.removeItem('echef-token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('echef-user');
      localStorage.removeItem('userData');

      // 2. Redireciona para o login se já não estiver lá
      if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
      }
    }
    
    // Retorna o erro para casos que não são 401 (ex: 404, 500)
    return Promise.reject(error);
  }
);

export default api;