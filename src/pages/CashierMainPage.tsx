// src/pages/CashierMainPage.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext'; // Para pegar dados do usuário e logout

const CashierMainPage: React.FC = () => {
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        // Navegação para login é feita pelo ProtectedRoute ou pode ser adicionada aqui se necessário
    };

    return (
        <div className="flex flex-col h-screen">
            {/* Header Simples */}
            <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-semibold">eChef Caixa</h1>
                <div className='text-sm'>
                    <span>Usuário: {user?.nome || 'N/A'}</span>
                    <button onClick={handleLogout} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">
                        Logout
                    </button>
                </div>
            </header>

            {/* Conteúdo Principal */}
            <main className="flex-1 p-6 bg-gray-100 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Caixa Principal</h2>
                {/* TODO: Adicionar aqui:
                    - Status do Caixa (Aberto/Fechado) e botões de ação
                    - Campo de busca de comanda
                    - Área de exibição da comanda selecionada
                    - Área de registro de pagamento
                    - Botão para registrar movimentação
                */}
                <p>Conteúdo da tela do caixa virá aqui...</p>
            </main>
        </div>
    );
};

export default CashierMainPage;