// src/services/sessionService.ts
import api from './api';

// --- INTERFACES (permanecem as mesmas) ---
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

interface SessionApiResponse {
    message: string;
    session: Session;
}

interface LastOpenApiResponse {
    message?: string;
    session: Session | null;
}

// --- Funções do Serviço (Refatoradas) ---

const openSession = async (payload: CreateSessionPayload): Promise<Session> => {
    try {
        const { data } = await api.post<SessionApiResponse>('/sessions/open', payload);
        return data.session;
    } catch (error: any) {
        console.error('Erro [Service] ao abrir sessão:', error);
        throw new Error(error.response?.data?.message || 'Falha ao abrir sessão.');
    }
};

const getLastOpenSession = async (): Promise<Session | null> => {
    try {
        const { data } = await api.get<LastOpenApiResponse>('/sessions/last-open');
        return data.session;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        console.error('Erro [Service] ao buscar última sessão aberta:', error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar status do caixa.');
    }
};

const closeSession = async (sessionId: number, payload: CloseSessionPayload): Promise<Session> => {
     try {
        const { data } = await api.post<SessionApiResponse>(`/sessions/${sessionId}/close`, payload);
        return data.session;
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