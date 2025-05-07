// src/services/paymentService.ts
import axios from 'axios';
import { authService } from './authService';

// Log de Carregamento (útil para depurar problemas de cache/import)
console.log('>>> Módulo paymentService.ts CARREGADO <<<', new Date().toLocaleTimeString());

const API_URL = 'http://localhost:3001/api/payments';

// Interface para Pagamento (como a API retorna)
export interface Payment {
  id: number;
  comanda_id: number; // Pode ser null se for um pagamento de grupo não associado a uma comanda específica
  sessao_caixa_id: number;
  forma_pagamento_id: number;
  valor: string;
  data_hora: string;
  usuario_id: number;
  detalhes?: string | null;
  grupo_uuid?: string | null; // Para agrupar pagamentos de múltiplas comandas
  // Campos JOIN que podem vir da API ao buscar
  nome_forma_pagamento?: string;
  tipo_forma_pagamento?: string;
  numero_comanda?: string;
  nome_usuario_caixa?: string;
}

// Interface para a resposta da API ao criar/registrar pagamentos
export interface ApiResponse {
    message: string;
    paymentId?: number;
    grupoUuid?: string;
    affectedRows?: number;
}

// Tipo para payload de Criação de pagamento individual (se ainda usado)
export type CreatePaymentPayload = {
    comandaIdentifier: string | number;
    forma_pagamento_id: number;
    valor: number;
    detalhes?: string | null;
    grupo_uuid?: string | null; // Pode ser usado para pagamentos individuais que fazem parte de um grupo "lógico"
};

// Payload para pagamento em grupo
export type CreateGroupPaymentPayload = {
    comandaIds: number[];
    forma_pagamento_id: number;
    valor: number;
    detalhes?: string | null;
};

// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    // **** LOG PARA VERIFICAR O TOKEN ****
    console.log("[getAuthConfig] Token obtido:", token);
    // ************************************
    if (!token) {
        // Lançar um erro aqui é importante para que as chamadas de API falhem claramente
        // se não houver token, em vez de prosseguir sem autenticação.
        throw new Error('Acesso negado. Nenhum token fornecido.');
    }
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Registrar um novo pagamento ÚNICO (POST /)
// Esta função pode ser usada para pagamentos diretos a uma comanda ou
// internamente pelo registerGroupPayment se a estratégia for registrar um pagamento "mestre" para o grupo.
const registerPayment = async (payload: CreatePaymentPayload): Promise<ApiResponse> => {
  console.log("[paymentService SINGLE] Enviando payload:", payload);
  try {
    const config = getAuthConfig();
    const response = await axios.post<ApiResponse>(API_URL, payload, config); // Rota base POST /api/payments
    console.log("[paymentService SINGLE] Resposta API:", response.data);
    return response.data;
  } catch (error) {
    console.error('Erro [FE Service] ao registrar pagamento único:', error);
    if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.message || `Erro ${error.response.status} ao registrar pagamento.`);
    } else {
        throw new Error('Erro de rede ao registrar pagamento.');
    }
  }
};

// Registrar pagamento para GRUPO (POST /grupo)
const registerGroupPayment = async (payload: CreateGroupPaymentPayload): Promise<ApiResponse> => {
    console.log("[paymentService GRUPO] Enviando payload para /grupo:", payload);
    const endpoint = `${API_URL}/grupo`;
    try {
        const config = getAuthConfig();
        const response = await axios.post<ApiResponse>(endpoint, payload, config);
        console.log("[paymentService GRUPO] Resposta API /grupo:", response.data);
        return response.data;
    } catch (error) {
        console.error('Erro [FE Service] ao registrar pagamento em grupo:', error);
        if (axios.isAxiosError(error) && error.response) {
            // A mensagem de erro do backend (ex: "Acesso negado...") será usada se disponível
            throw new Error(error.response.data.message || `Erro ${error.response.status} ao registrar pagamento em grupo.`);
        } else {
            throw new Error('Erro de rede ou servidor indisponível ao registrar pagamento em grupo.');
        }
    }
};

// Listar pagamentos de uma comanda específica (GET /comanda/:comandaId)
const getPaymentsByComandaId = async (comandaId: number): Promise<Payment[]> => {
    console.log(`>>> [paymentService] INÍCIO getPaymentsByComandaId para comanda ${comandaId}`); // LOG 1
    const endpoint = `${API_URL}/comanda/${comandaId}`;
    let config;
    try {
        console.log(`>>> [paymentService] Tentando getAuthConfig para comanda ${comandaId}`); // LOG 2
        config = getAuthConfig();
        console.log(`>>> [paymentService] getAuthConfig SUCESSO para comanda ${comandaId}. Config:`, !!config); // LOG 3

        console.log(`>>> [paymentService] Tentando axios.get para ${endpoint}`); // LOG 4
        const response = await axios.get<Payment[]>(endpoint, config);
        console.log(`>>> [paymentService] Pagamentos recebidos SUCESSO para comanda ${comandaId}:`, response.data ? response.data.length : 0); // LOG 5
        return response.data || [];
    } catch (error) {
        console.error(`>>> [paymentService] ERRO CATCH em getPaymentsByComandaId para ${comandaId} (${endpoint}):`, error); // LOG 6
        console.log(`>>> [paymentService] getPaymentsByComandaId: ERRO, retornando array vazio para comanda ${comandaId}`); // LOG 7
        return [];
    }
};

// Listar todos os pagamentos de uma sessão específica (GET /session/:sessionId)
const getPaymentsBySessionId = async (sessionId: number): Promise<Payment[]> => {
    console.log(`[paymentService] Buscando pagamentos para sessão ${sessionId}...`);
    try {
        const config = getAuthConfig(); // <<< IMPORTANTE: Adicionar autenticação
        const response = await axios.get<Payment[]>(`${API_URL}/session/${sessionId}`, config);
        console.log(`[paymentService] Pagamentos recebidos para sessão ${sessionId}:`, response.data ? response.data.length : 0);
        return response.data || [];
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar pagamentos da sessão ${sessionId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 404) throw new Error(`Sessão com ID ${sessionId} não encontrada ou sem pagamentos.`);
            throw new Error(error.response.data.message || 'Erro ao buscar pagamentos da sessão.');
        } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};

// Exporta o objeto de serviço
export const paymentService = {
    registerPayment,
    getPaymentsByComandaId,
    getPaymentsBySessionId,
    registerGroupPayment,
};