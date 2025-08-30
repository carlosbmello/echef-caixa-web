// src/services/transacaoService.ts
import  api  from './api'; // Supondo que você tenha um arquivo api.ts com a instância do axios configurada

// Interface para o payload que o frontend enviará
export interface FinalizarTransacaoPayload {
    comandaIds: number[];
    pagamentos: Array<{
        forma_pagamento_id: number;
        valor: number;
        nome_forma_pagamento?: string; // Útil para a lógica do backend
    }>;
    taxa_servico: number;
    acrescimos: number;
    descontos: number;
}

// Interface para a resposta da API
export interface FinalizarTransacaoResponse {
    message: string;
    transacao_uuid: string;
}

/**
 * Envia todos os dados de um fechamento de conta para o backend.
 * @param payload Os dados da transação.
 * @returns A resposta da API.
 */
const finalizar = async (payload: FinalizarTransacaoPayload): Promise<FinalizarTransacaoResponse> => {
    try {
        console.log('[transacaoService] Enviando payload para finalizar transação:', payload);
        const { data } = await api.post<FinalizarTransacaoResponse>('/transacoes/finalizar', payload);
        console.log('[transacaoService] Resposta da API:', data);
        return data;
    } catch (error: any) {
        console.error('[transacaoService] Erro ao finalizar transação:', error);
        throw new Error(error.response?.data?.message || 'Falha ao finalizar a transação.');
    }
};

export const transacaoService = {
    finalizar,
};