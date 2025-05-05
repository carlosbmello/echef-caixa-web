import axios from 'axios';

alert('API Module Loading'); // Teste visível
console.log('=== API INITIALIZATION ===');

const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  console.log('Token found:', !!token);
  console.log('Full Request Details:', {
    url: `${config.baseURL}${config.url}`,
    method: config.method,
    headers: config.headers,
    data: config.data,
    timestamp: new Date().toISOString()
  });

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Authorization header set:', config.headers.Authorization);
  } else {
    console.warn('No token found in localStorage');
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
      statusText: response.statusText,
      data: response.data,
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('Response Interceptor Error:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    if (error.response?.status === 401) {
      console.warn('Authentication failed - redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(new Error('Authentication failed'));
    }

    return Promise.reject(error.response?.data || error);
  }
);

export default api;