// src/services/authService.ts
import axios from 'axios';
import api from './api'; // Importamos 'api' para pegar a baseURL

interface LoginCredentials { email: string; senha: string; }

export interface UserData { id: number; nome: string; email: string; role: string; }

interface LoginResponse { message: string; token: string; user: UserData; }

const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    // Usamos o axios diretamente, mas pegamos a baseURL da nossa instância 'api'
    const response = await axios.post<LoginResponse>(`${api.defaults.baseURL}/auth/login`, credentials);
    return response.data;
  } catch (error) {
    console.error('Erro no serviço de login:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Erro ao tentar fazer login.');
    } else {
      throw new Error('Erro de rede ou servidor indisponível ao tentar fazer login.');
    }
  }
};

const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    console.log('Usuário deslogado (localStorage limpo).');
};

const getToken = (): string | null => {
    return localStorage.getItem('authToken');
};

const getUserData = (): UserData | null => {
     const data = localStorage.getItem('userData');
     try {
         return data ? JSON.parse(data) : null;
     } catch (e) {
         console.error("Erro ao parsear userData:", e);
         return null;
     }
};

const isAuthenticated = (): boolean => {
    return !!getToken();
};

export const authService = { login, logout, getToken, getUserData, isAuthenticated };