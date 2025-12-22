// src/services/sessionService.ts
import api from './api';

// --- INTERFACES ---
export interface Session {
  id: number;
  usuario_abertura_id: number;
  nome_usuario_abertura?: string;
  data_abertura: string;
  valor_abertura: string | number;
  usuario_fechamento_id?: number | null;
  nome_usuario_fechamento?: string | null;
  data_fechamento?: string | null;
  valor_fechamento_calculado?: string | number | null;
  valor_fechamento_informado?: string | number | null;
  diferenca_caixa?: string | number | null;
  observacao_fechamento?: string | null;
  status?: 'aberta' | 'fechada';
  created_at?: string;
  updated_at?: string;
}

export interface CreateSessionPayload {
    valor_abertura: number;
    observacao_abertura?: string | null;
}

export interface CloseSessionPayload {
    valor_fechamento_informado: number;
    observacao_fechamento?: string | null;
}

// Interfaces de resposta alinhadas com o Backend atual
interface OpenSessionResponse {
    message: string;
    sessionId: number;
}

interface CloseSessionResponse {
    message: string;
    resumo: any; // O backend retorna um resumo financeiro aqui
}

// --- Funções do Serviço (Corrigidas) ---

const openSession = async (payload: CreateSessionPayload): Promise<OpenSessionResponse> => {
    try {
        // Backend retorna { message, sessionId }
        const response = await api.post<OpenSessionResponse>('/sessions/open', payload);
        return response.data;
    } catch (error: any) {
        console.error('Erro [Service] ao abrir sessão:', error);
        throw new Error(error.response?.data?.message || 'Falha ao abrir sessão.');
    }
};

const getLastOpenSession = async (): Promise<Session | null> => {
    try {
        // [CORREÇÃO CRÍTICA]: O Backend retorna o objeto Session DIRETAMENTE ou null.
        // Não existe wrapper { session: ... }
        const response = await api.get<Session | null>('/sessions/last-open');
        
        // Se o body for vazio ou null, significa que não tem sessão
        if (!response.data) {
            return null;
        }

        return response.data;
    } catch (error: any) {
        // Se o backend retornar 404, tratamos como "sem sessão"
        if (error.response?.status === 404) {
            return null;
        }
        console.error('Erro [Service] ao buscar última sessão aberta:', error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar status do caixa.');
    }
};

const closeSession = async (sessionId: number, payload: CloseSessionPayload): Promise<CloseSessionResponse> => {
     try {
        // [CORREÇÃO DE ROTA]: No backend a rota é /sessions/close/:id
        const response = await api.post<CloseSessionResponse>(`/sessions/close/${sessionId}`, payload);
        return response.data;
    } catch (error: any) {
        console.error(`Erro [Service] ao fechar sessão ID ${sessionId}:`, error);
        throw new Error(error.response?.data?.message || 'Falha ao fechar sessão.');
    }
};

export const sessionService = {
    getLastOpenSession,
    openSession,
    closeSession,
};