// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC = React.memo(() => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation(); // Para guardar a rota que o usuário tentou acessar
  console.log("ProtectedRoute: Verificando...", { isLoading, isAuthenticated, pathname: location.pathname }); // <<< LOG

  // Mostra um loader enquanto verifica o estado inicial de autenticação
  if (isLoading) {
    console.log("ProtectedRoute: Ainda carregando auth..."); // <<< LOG
    return <div className='flex items-center justify-center h-screen'>Verificando autenticação...</div>;
  }

  // Se não estiver autenticado após a verificação, redireciona para /login
  // Passa a localização atual para que possamos redirecionar de volta após o login (opcional)
  if (!isAuthenticated) {
    console.log("ProtectedRoute: Não autenticado. Redirecionando para /login"); // <<< LOG
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se autenticado, renderiza o componente filho (Outlet)
  console.log("ProtectedRoute: Autenticado. Renderizando Outlet."); // <<< LOG
  return <Outlet />;
});

ProtectedRoute.displayName = 'ProtectedRoute';
export default ProtectedRoute;