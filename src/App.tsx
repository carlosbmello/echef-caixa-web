// src/App.tsx (echef-caixa-web)
import { Routes, Route, Link } from 'react-router-dom'; // Importa Link para Not Found
import CashierLoginPage from './pages/CashierLoginPage';
import CashierMainPage from './pages/CashierMainPage';
import ProtectedRoute from './components/ProtectedRoute'; // Protege a rota principal

// Componente simples para 404
const NotFound = () => (
  <div className='flex flex-col items-center justify-center h-screen'>
    <h1 className='text-4xl font-bold text-red-500'>404 - Não Encontrado</h1>
    <Link to="/" className='mt-4 text-blue-600 hover:underline'>Voltar</Link>
  </div>
);

function App() {
  return (
    <Routes>
      {/* Rota de Login */}
      <Route path="/login" element={<CashierLoginPage />} />

      {/* Rota Principal Protegida */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CashierMainPage />} />
        {/* Outras rotas protegidas específicas do caixa poderiam vir aqui */}
      </Route>

      {/* Rota Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;