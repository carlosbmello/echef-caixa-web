// src/services/comandaService.ts
import axios from 'axios';
import { authService } from './authService';
import type { ItemPedido } from './itemPedidoService';
import type { Payment } from './paymentService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';
const COMANDAS_API_ENDPOINT = `${API_BASE_URL}/comandas`;

// --- [CORREÇÃO] INTERFACES AGRUPADAS E SEM DUPLICAÇÃO ---

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

// [CORREÇÃO] Apenas uma definição da interface, usando o tipo 'Comanda'
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

const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

const getComandaByNumero = async (numeroComanda: string): Promise<Comanda> => {
    console.log(`[Caixa Service] Buscando comanda por NÚMERO: '${numeroComanda}'`);
    try {
        const config = getAuthConfig();
        const response = await axios.get<Comanda>(`${COMANDAS_API_ENDPOINT}/numero/${numeroComanda}`, config);
        
        if (!response.data) {
            console.warn(`[Caixa Service] Comanda número '${numeroComanda}' não encontrada (API retornou sem dados).`);
            throw new Error(`Comanda '${numeroComanda}' não encontrada.`);
        }
        console.log(`[Caixa Service] Comanda número '${numeroComanda}' encontrada:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Erro [Caixa Service] ao buscar comanda por NÚMERO '${numeroComanda}':`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) {
                throw new Error(`Comanda '${numeroComanda}' não encontrada.`);
             }
           throw new Error(error.response.data.message || `Erro ${error.response.status} ao buscar comanda.`);
        } else if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(`Erro de rede ou servidor indisponível ao buscar comanda.`);
        }
    }
};

const getComandaPorIdNumerico = async (comandaId: number): Promise<Comanda> => {
    console.log(`[Caixa Service] Buscando comanda por ID NUMÉRICO: ${comandaId}`);
    try {
        const config = getAuthConfig();
        const response = await axios.get<Comanda>(`${COMANDAS_API_ENDPOINT}/id/${comandaId}`, config);
        if (!response.data) {
             console.warn(`[Caixa Service] Comanda ID '${comandaId}' não encontrada (API retornou sem dados).`);
            throw new Error(`Comanda com ID '${comandaId}' não encontrada.`);
        }
        return response.data;
    } catch (error) { throw error; }
};

const consultarListaFechadas = async (dataInicial: string, dataFinal: string): Promise<ComandaFechadaResumo[]> => {
    try {
        const config = { ...getAuthConfig(), params: { dataInicial, dataFinal } };
        const response = await axios.get<ComandaFechadaResumo[]>(`${COMANDAS_API_ENDPOINT}/consultar-lista`, config);
        return response.data || [];
    } catch (error: any) {
        console.error('Erro [Service] ao consultar lista de comandas fechadas:', error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar comandas fechadas.');
    }
};

const consultarDetalheFechada = async (numeroComanda: string): Promise<ConsultaDetalheResponse> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<ConsultaDetalheResponse>(`${COMANDAS_API_ENDPOINT}/consultar-detalhe/${numeroComanda}`, config);
        return response.data;
    } catch (error: any) {
        console.error(`Erro [Service] ao consultar detalhes da comanda ${numeroComanda}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar detalhes da comanda ${numeroComanda}.`);
    }
};

const getAllComandas = async (params?: { status?: string; }): Promise<Comanda[]> => {
    console.log('[Caixa Service] Buscando todas as comandas com filtros:', params);
    try {
        const config = { ...getAuthConfig(), params: params || {} };
        const response = await axios.get<Comanda[]>(COMANDAS_API_ENDPOINT, config);
        return response.data || [];
    } catch (error) { throw error; }
};

const updateComandaStatus = async (id: number, payload: UpdateComandaPayload): Promise<Comanda> => {
    try {
        const config = getAuthConfig();
        const response = await axios.put<{ message: string, comanda: Comanda }>(`${COMANDAS_API_ENDPOINT}/${id}`, payload, config);
        return response.data.comanda;
    } catch (error) { throw error; }
};

const closeComandaGroup = async (payload: CloseGroupPayload): Promise<CloseGroupResponse> => {
    const endpoint = `${COMANDAS_API_ENDPOINT}/fechar-grupo`;
    try {
        const config = getAuthConfig();
        const response = await axios.post<CloseGroupResponse>(endpoint, payload, config);
        return response.data;
    } catch (error) { throw error; }
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