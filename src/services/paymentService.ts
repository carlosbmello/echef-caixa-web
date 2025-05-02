// src/services/paymentService.ts <-- NOVO ARQUIVO em echef-caixa-web
import axios from 'axios';
import { authService } from './authService'; // Precisa do authService copiado também

// URL base da API para PAGAMENTOS
const API_URL = 'http://localhost:3001/api/payments';

// Interface para Pagamento (como a API retorna)
export interface Payment {
  id: number;
  comanda_id: number;
  sessao_caixa_id: number;
  forma_pagamento_id: number;
  valor: string; // Vem como string do DECIMAL
  data_hora: string; // Vem como string ISO
  usuario_id: number;
  detalhes?: string | null;
  // Campos JOIN que podem vir da API
  nome_forma_pagamento?: string;
  tipo_forma_pagamento?: string;
  numero_comanda?: string;
  nome_usuario_caixa?: string;
}

// Interface para a resposta da API no POST /
interface ApiResponse {
    message: string;
    paymentId: number;
}

// Tipo para payload de Criação (o que o Caixa envia)
export type CreatePaymentPayload = {
    comandaIdentifier: string | number; // ID ou Número da comanda
    forma_pagamento_id: number;
    valor: number; // Frontend envia número
    detalhes?: string | null;
};

// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Registrar um novo pagamento (POST /)
const registerPayment = async (payload: CreatePaymentPayload): Promise<{ message: string; paymentId: number }> => {
  try {
    const config = getAuthConfig();
    const response = await axios.post<ApiResponse>(API_URL, payload, config);
    return response.data;
  } catch (error) {
    console.error('Erro [FE Caixa Service] ao registrar pagamento:', error);
    if (axios.isAxiosError(error) && error.response) { throw new Error(error.response.data.message || 'Erro.'); }
    else { throw new Error('Erro de rede.'); }
  }
};

// Listar pagamentos de uma comanda específica (GET /comanda/:comandaId)
// Pode ser útil no Caixa também
const getPaymentsByComandaId = async (comandaId: number): Promise<Payment[]> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<Payment[]>(`${API_URL}/comanda/${comandaId}`, config);
        return response.data || [];
    } catch (error) {
        console.error(`Erro [FE Caixa Service] ao buscar pagamentos comanda ${comandaId}:`, error);
        if (axios.isAxiosError(error) && error.response) { throw new Error(error.response.data.message || 'Erro.'); }
        else { throw new Error('Erro de rede.'); }
    }
};


// Listar todos os pagamentos de uma sessão específica (GET /session/:sessionId)
// Usado na SessionDetailsPage (Admin) e potencialmente no fechamento do Caixa
const getPaymentsBySessionId = async (sessionId: number): Promise<Payment[]> => {
    try {
        const config = getAuthConfig();
        // Chama o endpoint do backend
        const response = await axios.get<Payment[]>(`${API_URL}/session/${sessionId}`, config);
        return response.data || []; // Retorna os dados ou array vazio
    } catch (error) {
        console.error(`Erro [FE Caixa Service] ao buscar pagamentos da sessão ${sessionId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 404) throw new Error(`Sessão com ID ${sessionId} não encontrada.`);
            // Outros erros (401, 403, 500)
            throw new Error(error.response.data.message || 'Erro ao buscar pagamentos da sessão.');
        } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};


// Exporta o objeto de serviço
export const paymentService = {
    registerPayment,
    getPaymentsByComandaId,
    getPaymentsBySessionId,
};