// src/services/movementService.ts
import api from './api';

// --- INTERFACES ---
export interface Movement {
  id: number;
  sessao_caixa_id: number;
  usuario_id: number;
  tipo: 'entrada' | 'saida' | 'despesa';
  descricao: string;
  valor: string;
  data_hora: string;
  created_at?: string;
  updated_at?: string;
  nome_usuario?: string;
}

interface ApiResponse {
    message: string;
    movementId: number;
}

type CreateMovementPayload = {
    tipo: 'entrada' | 'saida' | 'despesa';
    descricao: string;
    valor: number;
};

// --- Funções do Serviço Refatoradas ---

const createMovement = async (payload: CreateMovementPayload): Promise<ApiResponse> => {
  try {
    const { data } = await api.post<ApiResponse>('/movements', payload);
    return data;
  } catch (error: any) {
    console.error('Erro [Service] ao registrar movimentação:', error);
    throw new Error(error.response?.data?.message || 'Falha ao registrar movimentação.');
  }
};

const getMovementsBySession = async (sessionId: number): Promise<Movement[]> => {
    try {
        const { data } = await api.get<Movement[]>(`/movements/session/${sessionId}`);
        return data || [];
    } catch (error: any) {
        console.error(`Erro [Service] ao buscar movimentações da sessão ${sessionId}:`, error);
        throw new Error(error.response?.data?.message || 'Falha ao buscar movimentações.');
    }
};

export const movementService = {
    createMovement,
    getMovementsBySession,
};