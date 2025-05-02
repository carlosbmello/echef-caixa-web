// src/services/sessionService.ts
import axios from 'axios';
import { authService } from './authService';

const API_URL = 'http://localhost:3001/api/sessions'; // URL base para sessões

// Interface para representar uma Sessão de Caixa (como a API retorna)
export interface Session {
  id: number;
  usuario_abertura_id: number;
  data_abertura: string; // Vem como string ISO 8601
  valor_abertura: string; // Vem como string do DECIMAL
  usuario_fechamento_id?: number | null;
  data_fechamento?: string | null; // Vem como string ISO 8601
  valor_fechamento_calculado?: string | null; // Vem como string do DECIMAL
  valor_fechamento_informado?: string | null; // Vem como string do DECIMAL
  diferenca?: string | null; // Vem como string do DECIMAL
  observacao?: string | null;
  status: 'aberto' | 'fechado';
  created_at?: string;
  updated_at?: string;
  // Campos dos JOINs (vindos da API)
  nome_usuario_abertura?: string;
  nome_usuario_fechamento?: string;
}

// Interface para a resposta da API em POST /open e POST /:id/close
interface SessionApiResponse {
    message: string;
    session: Session;
}

// Interface para a resposta da API em GET /last-open
interface LastOpenApiResponse {
    message: string;
    session: Session | null; // Pode ser null se não houver sessão aberta
}


// Tipo para payload de Abertura
type OpenSessionPayload = {
    valor_abertura: number; // Frontend enviará número
};

// Tipo para payload de Fechamento
type CloseSessionPayload = {
    valor_fechamento_informado: number; // Frontend enviará número
    observacao?: string | null;
};


// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Abrir uma nova sessão de caixa (POST /open)
const openSession = async (payload: OpenSessionPayload): Promise<Session> => {
  try {
    const config = getAuthConfig();
    // Envia para o endpoint específico /open
    const response = await axios.post<SessionApiResponse>(`${API_URL}/open`, payload, config);
    return response.data.session;
  } catch (error) {
    console.error('Erro [FE Service] ao abrir sessão:', error);
    if (axios.isAxiosError(error) && error.response) {
        // Pode ser 400 (Valor inválido), 401/403 (Permissão), 409 (Já aberta), 500
        throw new Error(error.response.data.message || 'Erro ao abrir sessão.');
    } else { throw new Error('Erro de rede ou servidor indisponível.'); }
  }
};

// Buscar a última sessão aberta (GET /last-open)
const getLastOpenSession = async (): Promise<Session | null> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<LastOpenApiResponse>(`${API_URL}/last-open`, config);
        // A API retorna um objeto com a chave 'session' que pode ser null
        return response.data.session;
    } catch (error) {
         console.error('Erro [FE Service] ao buscar última sessão aberta:', error);
        if (axios.isAxiosError(error) && error.response) {
             // Pode ser 401/403 (Permissão), 500
             throw new Error(error.response.data.message || 'Erro ao buscar sessão aberta.');
         } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};

// Listar todas as sessões (GET /) - Requer Admin
// Aceita filtros opcionais como query parameters
const getAllSessions = async (filters?: { status?: 'aberto' | 'fechado'; startDate?: string; endDate?: string }): Promise<Session[]> => {
    try {
        const config = getAuthConfig();
        const params = filters; // Passa os filtros diretamente como query params
        const response = await axios.get<Session[]>(API_URL, { ...config, params });
        return response.data || [];
    } catch (error) {
         console.error('Erro [FE Service] ao listar sessões:', error);
         if (axios.isAxiosError(error) && error.response) {
              // Pode ser 401/403 (Permissão), 500
              throw new Error(error.response.data.message || 'Erro ao listar sessões.');
          } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};

// Buscar uma sessão específica por ID (GET /:id) - Requer Admin
const getSessionById = async (id: number): Promise<Session> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<Session>(`${API_URL}/${id}`, config);
        if (!response.data) throw new Error(`Sessão com ID ${id} não encontrada.`);
        return response.data;
    } catch (error) {
         console.error(`Erro [FE Service] ao buscar sessão ID ${id}:`, error);
         if (axios.isAxiosError(error) && error.response) {
              if (error.response.status === 404) throw new Error(`Sessão com ID ${id} não encontrada.`);
             // Outros erros (401, 403, 500)
             throw new Error(error.response.data.message || `Erro ao buscar sessão.`);
         } else { throw new Error(`Erro de rede ou servidor indisponível.`); }
    }
};

// Fechar uma sessão de caixa (POST /:id/close)
const closeSession = async (id: number, payload: CloseSessionPayload): Promise<Session> => {
     try {
        const config = getAuthConfig();
        // Envia para o endpoint específico /:id/close
        const response = await axios.post<SessionApiResponse>(`${API_URL}/${id}/close`, payload, config);
        return response.data.session; // Retorna a sessão atualizada (fechada)
    } catch (error) {
         console.error(`Erro [FE Service] ao fechar sessão ID ${id}:`, error);
         if (axios.isAxiosError(error) && error.response) {
              if (error.response.status === 404) throw new Error(`Sessão com ID ${id} não encontrada.`);
              if (error.response.status === 400) throw new Error(error.response.data.message || 'Não foi possível fechar a sessão (verifique status ou dados).');
             // Outros erros (401, 403, 500)
             throw new Error(error.response.data.message || `Erro ao fechar sessão.`);
         } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};


// Exporta o objeto de serviço com todas as funções
export const sessionService = {
    openSession,
    getLastOpenSession,
    getAllSessions,
    getSessionById,
    closeSession,
};