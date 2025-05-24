// src/main.tsx (echef-caixa-web)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Importa Tailwind/CSS global
import { BrowserRouter } from 'react-router-dom'; // Roteamento
import { AuthProvider } from './contexts/AuthContext.tsx'; // Autenticação

import 'react-toastify/dist/ReactToastify.css'; // <-- ADICIONADA IMPORTAÇÃO DO CSS

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider> {/* Envolve com AuthProvider */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);