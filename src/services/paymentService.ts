// src/services/paymentService.ts
import api from './api';

// --- INTERFACES ---
export interface Payment {
  id: number;
  comanda_id: number;
  sessao_caixa_id: number;
  forma_pagamento_id: number;
  valor: string;
  data_hora: string;
  usuario_id: number;
  detalhes?: string | null;
  grupo_uuid?: string | null;
  nome_forma_pagamento?: string;
  tipo_forma_pagamento?: string;
  numero_comanda?: string;
  nome_usuario_caixa?: string;
}

export interface ApiResponse {
    message: string;
    paymentId?: number;
    grupoUuid?: string;
    affectedRows?: number;
}

export type CreatePaymentPayload = {
    comandaIdentifier: string | number;
    forma_pagamento_id: number;
    valor: number;
    detalhes?: string | null;
    grupo_uuid?: string | null;
};

// --- Funções do Serviço Refatoradas ---

const registerPayment = async (payload: CreatePaymentPayload): Promise<ApiResponse> => {
  try {
    const { data } = await api.post<ApiResponse>('/payments', payload);
    return data;
  } catch (error: any) {
    console.error('Erro [Service] ao registrar pagamento único:', error);
    throw new Error(error.response?.data?.message || 'Falha ao registrar pagamento.');
  }
};

const getPaymentsByComandaId = async (comandaId: number): Promise<Payment[]> => {
    try {
        const { data } = await api.get<Payment[]>(`/payments/comanda/${comandaId}`);
        return data || [];
    } catch (error: any) {
        console.error(`Erro [Service] em getPaymentsByComandaId para ${comandaId}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar pagamentos da comanda ${comandaId}.`);
    }
};

const getPaymentsBySessionId = async (sessionId: number): Promise<Payment[]> => {
    try {
        const { data } = await api.get<Payment[]>(`/payments/session/${sessionId}`);
        return data || [];
    } catch (error: any) {
        console.error(`Erro [Service] ao buscar pagamentos da sessão ${sessionId}:`, error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar pagamentos da sessão.');
    }
};

export const paymentService = {
    registerPayment,
    getPaymentsByComandaId,
    getPaymentsBySessionId,
};