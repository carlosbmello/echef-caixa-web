// src/services/movementService.ts
import axios from 'axios';
import { authService } from './authService';

// URL base da API para movimentações
// const API_URL = 'http://localhost:3001/api/movements';

// A URL base viria da variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api'; // Fallback opcional

const API_URL = `${API_BASE_URL}/movements`; // Constrói a URL específica

// Tipo para as movimentações (como vem da API no GET /session/:id)
export interface Movement {
  id: number;
  sessao_caixa_id: number;
  usuario_id: number;
  tipo: 'entrada' | 'saida' | 'despesa';
  descricao: string;
  valor: string; // Vem como string do DECIMAL
  data_hora: string; // Vem como string ISO 8601
  created_at?: string;
  updated_at?: string;
  // Campo do JOIN (vindo da API)
  nome_usuario?: string;
}

// Interface para a resposta da API no POST /
interface ApiResponse {
    message: string;
    movementId: number; // Assumindo que a API retorna o ID da nova movimentação
}

// Tipo para o payload de Criação
// Não precisa de ID, sessao_caixa_id (vem do backend), usuario_id (vem do token), data_hora
type CreateMovementPayload = {
    tipo: 'entrada' | 'saida' | 'despesa';
    descricao: string;
    valor: number; // Frontend envia número
};


// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Registrar uma nova movimentação de caixa (POST /)
// A API do backend pega a sessão aberta atual automaticamente
const createMovement = async (payload: CreateMovementPayload): Promise<{ message: string; movementId: number }> => {
  try {
    const config = getAuthConfig();
    const response = await axios.post<ApiResponse>(API_URL, payload, config);
    return response.data; // Retorna { message, movementId }
  } catch (error) {
    console.error('Erro [FE Service] ao registrar movimentação:', error);
    if (axios.isAxiosError(error) && error.response) {
        // Pode ser 400 (Validação, caixa fechado), 401/403 (Permissão), 500
        throw new Error(error.response.data.message || 'Erro ao registrar movimentação.');
    } else { throw new Error('Erro de rede ou servidor indisponível.'); }
  }
};

// Listar todas as movimentações de uma sessão específica (GET /session/:sessionId)
// Requer Admin na API
const getMovementsBySession = async (sessionId: number): Promise<Movement[]> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<Movement[]>(`${API_URL}/session/${sessionId}`, config);
        return response.data || []; // Retorna array vazio se não houver
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar movimentações da sessão ${sessionId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 404) throw new Error(`Sessão com ID ${sessionId} não encontrada.`);
            // Outros erros (401, 403, 500)
            throw new Error(error.response.data.message || 'Erro ao buscar movimentações.');
        } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};


// Exporta o objeto de serviço
export const movementService = {
    createMovement,
    getMovementsBySession,
    // Não teremos update/delete por enquanto
};