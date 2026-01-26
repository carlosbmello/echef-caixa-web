// src/services/api.ts (VERSÃO HÍBRIDA NUVEM/LOCAL)
import axios from 'axios';

const getBaseURL = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // 1. VERIFICA SE ESTÁ NO AMBIENTE LOCAL (Mini PC ou Servidor de Borda)
    // Identifica se o acesso é via localhost, IP de rede ou domínio .local
    const isLocal = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || 
        hostname.endsWith('.local');

    if (isLocal) {
        // No servidor local, usamos a porta 3010 diretamente para garantir o funcionamento offline
        return `${protocol}//${hostname}:3010/api/admin`;
    }

    // 2. AMBIENTE DE NUVEM (PRODUÇÃO)
    // Na nuvem, o Nginx já gerencia o SSL e o redirecionamento da porta 443 para a 3010.
    // Usamos o subdomínio central da API.
    return `https://api.neverlandbar.com.br/api/admin`;
};

const API_BASE_URL = getBaseURL();

console.log('=== API INITIALIZATION ===');
console.log(`[API Service] Conectando em: ${API_BASE_URL}`);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// --- 1. INTERCEPTOR DE REQUISIÇÃO (Mantenha como está) ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('echef-token') || localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request Interceptor Error:', error);
  return Promise.reject(error);
});

// --- 2. INTERCEPTOR DE RESPOSTA (Mantenha como está) ---
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API] Sessão expirada no Caixa. Redirecionando...');
      localStorage.removeItem('echef-token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('echef-user');
      localStorage.removeItem('userData');

      if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;