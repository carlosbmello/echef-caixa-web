// src/services/sessionService.ts
import axios from 'axios';
import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';
const API_URL = `${API_BASE_URL}/sessions`;

// Interface para os dados de uma Sessão de Caixa (como a API retorna)
export interface Session {
  id: number;
  usuario_abertura_id: number;
  nome_usuario_abertura?: string;
  data_abertura: string;
  valor_abertura: string | number; // DECIMAL do backend pode vir como string
  usuario_fechamento_id?: number | null;
  nome_usuario_fechamento?: string | null;
  data_fechamento?: string | null;
  valor_fechamento_calculado?: string | number | null;
  valor_fechamento_informado?: string | number | null;
  diferenca_caixa?: string | number | null; // Renomeado de 'diferenca' para clareza
  observacao_fechamento?: string | null; // Renomeado de 'observacao'
  status?: 'aberta' | 'fechada';
  created_at?: string;
  updated_at?: string;
}

// <<< --- INÍCIO DAS DEFINIÇÕES DE PAYLOAD (ADICIONADAS E EXPORTADAS) --- >>>

// Tipo para o payload de Abertura de Sessão
export interface CreateSessionPayload {
    valor_abertura: number;
    observacao_abertura?: string | null;
}

// Tipo para o payload de Fechamento de Sessão
export interface CloseSessionPayload {
    valor_fechamento_informado: number;
    observacao_fechamento?: string | null;
}

// <<< --- FIM DAS DEFINIÇÕES DE PAYLOAD --- >>>


// Interface para a resposta da API que contém um objeto 'session'
interface SessionApiResponse {
    message: string;
    session: Session;
}

// Interface para a resposta da API que pode ou não conter uma sessão
interface LastOpenApiResponse {
    message?: string;
    session: Session | null;
}


// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) {
        console.error("[sessionService] Token de autenticação não encontrado.");
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
    }
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço (Ajustadas para usar os tipos de Payload) ---

// Abrir uma nova sessão de caixa (POST /open)
const openSession = async (payload: CreateSessionPayload): Promise<Session> => {
    try {
        const config = getAuthConfig();
        const response = await axios.post<SessionApiResponse>(`${API_URL}/open`, payload, config);
        return response.data.session;
    } catch (error: any) {
        console.error('Erro [Service] ao abrir sessão:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Falha ao abrir sessão.');
    }
};

// Buscar a última sessão aberta (GET /last-open)
const getLastOpenSession = async (): Promise<Session | null> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<LastOpenApiResponse>(`${API_URL}/last-open`, config);
        return response.data.session;
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null; // Cenário esperado: nenhuma sessão aberta encontrada.
        }
        console.error('Erro [Service] ao buscar última sessão aberta:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Falha ao buscar status do caixa.');
    }
};

// Fechar uma sessão de caixa existente (POST /:id/close)
const closeSession = async (sessionId: number, payload: CloseSessionPayload): Promise<Session> => {
     try {
        const config = getAuthConfig();
        const response = await axios.post<SessionApiResponse>(`${API_URL}/${sessionId}/close`, payload, config);
        return response.data.session;
    } catch (error: any) {
        console.error(`Erro [Service] ao fechar sessão ID ${sessionId}:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || `Falha ao fechar sessão.`);
    }
};


// Exporta o objeto de serviço com todas as funções
export const sessionService = {
    getLastOpenSession,
    openSession,
    closeSession,
    // Adicione outras funções aqui se as criar (ex: getAllSessions, getSessionById)
};