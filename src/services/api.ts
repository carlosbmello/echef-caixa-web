// src/services/api.ts (VERSÃO DINÂMICA)
import axios from 'axios';

// --- LÓGICA DE URL DINÂMICA ---
const getBaseURL = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // 1. VERIFICA SE É AMBIENTE LOCAL (Mini PC ou Dev)
    // Se o endereço for localhost, IP de rede local ou 127.0.0.1
    const isLocal = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname.startsWith('192.168.') || 
        hostname.endsWith('.local');

    if (isLocal) {
        // Lógica para o Servidor Local (Mantém o funcionamento offline)
        return `${protocol}//${hostname}:3010/api/admin`;
    }

    // 2. AMBIENTE DE NUVEM (PRODUÇÃO)
    // Na nuvem, o Nginx já redireciona a porta 443 para a 3010 internamente.
    // Usamos o subdomínio dedicado da API que você criou no CloudPanel.
    return `https://api.neverlandbar.com.br/api/admin`;
};

const API_BASE_URL = getBaseURL();

console.log('[API Service] Conectando em:', API_BASE_URL);

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
});


// --- 1. INTERCEPTOR DE REQUISIÇÃO ---
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

// --- 2. INTERCEPTOR DE RESPOSTA ---
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