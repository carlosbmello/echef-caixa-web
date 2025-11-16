// src/services/comandaService.ts

// [CORREÇÃO] Importa a nossa instância centralizada do Axios Ajustes
import api from './api';

// [CORREÇÃO] Importa apenas os TIPOS que precisamos
import type { ItemPedido } from './itemPedidoService';
import type { Payment } from './paymentService';

// --- INTERFACES ---

export interface Comanda {
  id: number;
  numero: string;
  status: 'aberta' | 'fechada' | 'paga' | 'cancelada' | string;
  cliente_nome?: string | null;
  local_atual?: string | null;
  data_abertura?: string | null;
  data_fechamento?: string | null;
  total_atual_calculado?: number | null; 
  itens?: ItemPedido[]; 
  created_at?: string;
  updated_at?: string;
}

export interface Lancamento {
  id: number;
  transacao_uuid: string;
  tipo_lancamento: 'consumo' | 'taxa_servico' | 'acrescimo' | 'desconto' | 'pagamento';
  descricao: string;
  valor: string;
  forma_pagamento_id?: number;
  nome_forma_pagamento?: string;
  data_hora: string;
}

export interface ComandaFechadaResumo {
    id: number;
    numero: string;
    cliente_nome: string | null;
    data_fechamento: string;
    valor_total_pago: number;
}

export interface ConsultaDetalheResponse {
    comandas: Comanda[];
    pagamentos: Payment[];
    lancamentos: Lancamento[];
}

export type UpdateComandaPayload = {
    status: 'aberta' | 'fechada' | 'paga' | 'cancelada' | string;
    local_atual?: string;
    cliente_nome?: string;
};

export interface UpdateApiResponse {
    message: string;
    comanda: Comanda; 
}

export interface CloseGroupPayload {
    comandaIds: number[];
}

export interface CloseGroupResponse {
    message: string;
    affectedRows: number;
}

// --- Funções do Serviço Refatoradas ---

const getComandaByNumero = async (numeroComanda: string): Promise<Comanda> => {
    console.log(`[Caixa Service] Buscando comanda por NÚMERO: '${numeroComanda}'`);
    try {
        const { data } = await api.get<Comanda>(`/comandas/numero/${numeroComanda}`);
        if (!data) {
            throw new Error(`Comanda '${numeroComanda}' não encontrada.`);
        }
        console.log(`[Caixa Service] Comanda número '${numeroComanda}' encontrada:`, data);
        return data;
    } catch (error: any) {
        console.error(`Erro [Caixa Service] ao buscar comanda por NÚMERO '${numeroComanda}':`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar comanda ${numeroComanda}.`);
    }
};

const getComandaPorIdNumerico = async (comandaId: number): Promise<Comanda> => {
    console.log(`[Caixa Service] Buscando comanda por ID NUMÉRICO: ${comandaId}`);
    try {
        const { data } = await api.get<Comanda>(`/comandas/id/${comandaId}`);
        if (!data) {
            throw new Error(`Comanda com ID '${comandaId}' não encontrada.`);
        }
        return data;
    } catch (error: any) {
        console.error(`Erro [Caixa Service] ao buscar comanda por ID '${comandaId}':`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar comanda ${comandaId}.`);
    }
};

const consultarListaFechadas = async (dataInicial: string, dataFinal: string): Promise<ComandaFechadaResumo[]> => {
    try {
        const { data } = await api.get<ComandaFechadaResumo[]>('/comandas/consultar-lista', {
            params: { dataInicial, dataFinal }
        });
        return data || [];
    } catch (error: any) {
        console.error('Erro [Service] ao consultar lista de comandas fechadas:', error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar comandas fechadas.');
    }
};

const consultarDetalheFechada = async (numeroComanda: string): Promise<ConsultaDetalheResponse> => {
    try {
        const { data } = await api.get<ConsultaDetalheResponse>(`/comandas/consultar-detalhe/${numeroComanda}`);
        return data;
    } catch (error: any) {
        console.error(`Erro [Service] ao consultar detalhes da comanda ${numeroComanda}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar detalhes da comanda ${numeroComanda}.`);
    }
};

const getAllComandas = async (params?: { status?: string; }): Promise<Comanda[]> => {
    console.log('[Caixa Service_v1] Buscando todas as comandas com filtros:', params);
    try {
        const { data } = await api.get<Comanda[]>('/comandas', { params: params || {} });
        return data || [];
    } catch (error: any) {
        console.error('Erro [Service] ao buscar todas as comandas:', error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar comandas.');
    }
};

const updateComandaStatus = async (id: number, payload: UpdateComandaPayload): Promise<Comanda> => {
    try {
        const { data } = await api.put<{ message: string, comanda: Comanda }>(`/comandas/${id}`, payload);
        return data.comanda;
    } catch (error: any) {
        console.error(`Erro [Service] ao atualizar comanda ${id}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao atualizar comanda ${id}.`);
    }
};

const closeComandaGroup = async (payload: CloseGroupPayload): Promise<CloseGroupResponse> => {
    try {
        const { data } = await api.post<CloseGroupResponse>('/comandas/fechar-grupo', payload);
        return data;
    } catch (error: any) {
        console.error('Erro [Service] ao fechar grupo de comandas:', error);
        throw new Error(error.response?.data?.message || 'Falha ao fechar grupo de comandas.');
    }
};

export const comandaServiceCaixa = {
    getComandaByNumero,
    getComandaPorIdNumerico,
    updateComandaStatus,
    getAllComandas,
    closeComandaGroup,
    consultarListaFechadas,
    consultarDetalheFechada
};