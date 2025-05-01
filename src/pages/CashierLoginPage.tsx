// src/pages/CashierLoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

const CashierLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/"; // Para onde voltar após login

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setIsLoading(true);
    try {
      const response = await authService.login({ email, senha });
      // --- VALIDAÇÃO DE ROLE ---
      // Só permite login se for caixa ou admin
      if (response.user.role !== 'caixa' && response.user.role !== 'admin') {
          throw new Error("Acesso não permitido para esta função.");
      }
      // --- FIM VALIDAÇÃO ---
      login(response.token, response.user);
      navigate(from, { replace: true });
    } catch (err: any) { setError(err.message || 'Falha no login.'); }
    finally { setIsLoading(false); }
  };

  return (
    // Layout simples centralizado
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200">
      <form onSubmit={handleLogin} className="p-8 bg-white rounded-xl shadow-lg w-full max-w-xs sm:max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">eChef Caixa</h1>
        {error && <p className="mb-4 text-center text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        <div className="mb-4">
          <label className="block text-gray-600 text-sm font-semibold mb-2" htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="mb-6">
          <label className="block text-gray-600 text-sm font-semibold mb-2" htmlFor="password">Senha</label>
          <input id="password" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={isLoading}
                className={`w-full px-4 py-2 font-bold text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isLoading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};
export default CashierLoginPage;