// src/services/api.ts
import axios from 'axios';

// 1. Lê a variável de ambiente fornecida pelo Vite.
//    Se a variável não existir (como em testes), usa localhost como fallback.
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';

console.log('=== API INITIALIZATION ===');
console.log(`[API Service] A Base URL está configurada para: ${baseURL}`);

const api = axios.create({
  // 2. Usa a variável 'baseURL' que acabamos de definir.
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  console.log(`Buscando token com a chave 'authToken'. Encontrado: ${!!token}`);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request Interceptor Error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response Interceptor Error:', error.message);
    if (error.response?.status === 401) {
      console.warn('Authentication failed - redirecting to login');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;