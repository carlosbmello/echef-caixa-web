// src/App.tsx (echef-caixa-web)
import { Routes, Route, Navigate } from 'react-router-dom'; // Adicionado Navigate
import CashierLoginPage from './pages/CashierLoginPage';
import CashierMainPage from './pages/CashierMainPage';
import ProtectedRoute from './components/ProtectedRoute'; // Protege a rota principal
import { ToastContainer } from 'react-toastify'; // <-- ADICIONADA IMPORTAÇÃO DO CONTAINER
import { useAuth } from './contexts/AuthContext'; // Importar useAuth para o redirect

// Componente simples para 404
// const NotFound = () => (
//  <div className='flex flex-col items-center justify-center h-screen'>
//    <h1 className='text-4xl font-bold text-red-500'>404 - Não Encontrado</h1>
//    {/* Opcional: Link para a página principal se autenticado, ou para login */}
//    <Link to="/" className='mt-4 text-blue-600 hover:underline'>Voltar para o Início</Link>
//  </div>
// );

function App() {
  const { isAuthenticated } = useAuth(); // Usar o hook useAuth aqui para o redirect

  return (
    <> {/* Adicionado Fragment para envolver Routes e ToastContainer */}
      <Routes>
        {/* Rota de Login */}
        <Route path="/login" element={<CashierLoginPage />} />

        {/* Rota Principal Protegida */}
        <Route element={<ProtectedRoute />}> {/* Este ProtectedRoute gerencia o acesso */}
          <Route path="/" element={<CashierMainPage />} />
          {/* Outras rotas protegidas específicas do caixa poderiam vir aqui */}
        </Route>

        {/* Rota Catch-all */}
        {/* Ajustado para redirecionar para / se autenticado e rota não existe, senão para /login */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} 
        />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      /> {/* <-- ADICIONADO O TOAST CONTAINER */}
    </>
  );
}

export default App;