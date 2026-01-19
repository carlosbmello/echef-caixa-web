// src/services/api.ts (VERSÃO DINÂMICA)
import axios from 'axios';

// --- LÓGICA DE URL DINÂMICA ---
const protocol = window.location.protocol;
const hostname = window.location.hostname;
const port = '3010'; 

const dynamicBaseURL = `${protocol}//${hostname}:${port}/api`;
const adminBaseUrl = `${dynamicBaseURL}/admin`;

console.log('=== API INITIALIZATION ===');
console.log(`[API Service] Conectando dinamicamente em: ${adminBaseUrl}`);

const api = axios.create({
  baseURL: adminBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
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