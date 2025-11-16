// src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authService, UserData } from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserData | null; // Armazena dados do usuário logado
  login: (token: string, userData: UserData) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticatedState, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = authService.getToken();
    const userData = authService.getUserData();
    if (token && userData) {
      // TODO: Idealmente, verificar validade do token com API aqui
      setIsAuthenticated(true);
      setUser(userData);
    }
    setIsLoading(false);
  }, []);

  const login = (token: string, userData: UserData) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  // Se ainda estiver carregando (verificando token inicial), pode mostrar um loader global
  // if (isLoading) {
  //   return <div>Carregando Aplicação...</div>;
  // }

  return (
    <AuthContext.Provider value={{ isAuthenticated: isAuthenticatedState, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};