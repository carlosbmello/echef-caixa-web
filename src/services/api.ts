import axios from 'axios';

console.log('=== API INITIALIZATION ===');

const api = axios.create({
  baseURL: 'http://localhost:3010/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

api.interceptors.request.use((config) => {
  // 1. Busca o token com a chave correta
  const token = localStorage.getItem('authToken');
  
  // 2. Loga a variável correta ('token')
  console.log(`Buscando token com a chave 'authToken'. Encontrado: ${!!token}`);

  // Log dos detalhes da requisição (opcional, mas útil)
  console.log('Full Request Details:', {
    url: `${config.baseURL}${config.url}`,
    method: config.method,
    headers: config.headers,
    data: config.data,
    timestamp: new Date().toISOString()
  });

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Authorization header set.');
  } else {
    console.warn("No token found in localStorage with key 'authToken'.");
  }
  return config;
}, (error) => {
  console.error('Request Interceptor Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  return Promise.reject(new Error('Request failed'));
});

api.interceptors.response.use(
  (response) => {
    console.log('Response Interceptor Success:', {
      url: response.config.url,
      status: response.status,
      // data: response.data, // Pode ser útil descomentar para ver a resposta
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('Response Interceptor Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      timestamp: new Date().toISOString()
    });
    
    if (error.response?.status === 401) {
      console.warn('Authentication failed - redirecting to login');
      // Garante que está removendo a chave correta
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return Promise.reject(new Error('Authentication failed'));
    }

    return Promise.reject(error.response?.data || error);
  }
);

export default api;