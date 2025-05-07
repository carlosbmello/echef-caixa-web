// src/services/comandaService.ts
import axios from 'axios';
import { authService } from './authService';

// URL base da API para comandas
const API_URL = 'http://localhost:3001/api/comandas';

// Interface para representar uma Comanda
export interface Comanda {
  id: number;
  numero: string;
  // Ajustar status para os definidos no backend ('aberta', 'fechada', 'cancelada')
  status?: 'aberta' | 'fechada' | 'cancelada' | 'disponivel' | 'em_uso' | 'perdida';
  cliente_nome?: string | null;
  local_atual?: string | null;
  data_abertura?: string | null;
  data_fechamento?: string | null;
  total_atual_calculado?: number; // Espera-se que a API retorne isso em getAllComandas
  created_at?: string;
  updated_at?: string;
}

// Tipo para o payload de atualização de status individual
export type UpdateComandaPayload = {
    status: 'aberta' | 'fechada' | 'cancelada' | 'disponivel' | 'em_uso' | 'perdida'; // Ajustar conforme ENUM do backend
    local_atual?: string;
    cliente_nome?: string;
};

// Interface para resposta da API ao atualizar uma comanda
export interface UpdateApiResponse {
    message: string;
    comanda: Comanda; // A comanda atualizada
}

// **** INTERFACES PARA FECHAMENTO EM GRUPO ****
export interface CloseGroupPayload {
    comandaIds: number[];
    // taxaServico?: number; // Opcional, se for enviar
    // acrescimos?: number;  // Opcional
    // descontos?: number;   // Opcional
}

export interface CloseGroupResponse {
    message: string;
    affectedRows: number;
}
// **** FIM INTERFACES GRUPO ****


// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Buscar uma comanda pelo ID ou NÚMERO (GET /:identifier)
const getComandaByIdentifier = async (identifier: string | number): Promise<Comanda> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<Comanda>(`${API_URL}/${identifier}`, config);
        if (!response.data) throw new Error(`Comanda '${identifier}' não encontrada.`);
        return response.data;
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar comanda '${identifier}':`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error(`Comanda '${identifier}' não encontrada.`);
           throw new Error(error.response.data.message || `Erro ao buscar comanda.`);
        } else { throw new Error(`Erro de rede ou servidor indisponível.`); }
    }
};

// Buscar TODAS as comandas com filtros (GET /)
const getAllComandas = async (params?: { status?: string; }): Promise<Comanda[]> => {
    console.log('[comandaService] Buscando comandas com filtros:', params);
    try {
        const config = { ...getAuthConfig(), params: params || {} };
        const response = await axios.get<Comanda[]>(API_URL, config);
        return response.data || [];
    } catch (error) {
        console.error('Erro [FE Service] ao buscar todas as comandas:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Erro ao buscar comandas.');
        } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
};

// Atualizar o status (ou outros dados) de uma comanda (PUT /:id)
const updateComandaStatus = async (id: number, payload: UpdateComandaPayload): Promise<Comanda> => {
     try {
        const config = getAuthConfig();
        // A API retorna { message, comanda }
        const response = await axios.put<{ message: string, comanda: Comanda }>(`${API_URL}/${id}`, payload, config);
        return response.data.comanda; // Retorna a comanda atualizada
    } catch (error) {
        console.error(`Erro [FE Service] ao atualizar comanda ID ${id}:`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error(`Comanda com ID ${id} não encontrada para atualização.`);
           throw new Error(error.response.data.message || `Erro ao atualizar comanda.`);
        } else { throw new Error(`Erro de rede ou servidor indisponível.`); }
    }
};

// Função para chamar API para fechar um GRUPO de comandas (POST /fechar-grupo)
const closeComandaGroup = async (payload: CloseGroupPayload): Promise<CloseGroupResponse> => {
    console.log("[comandaService] Enviando POST para /fechar-grupo com payload:", payload);
    const endpoint = `${API_URL}/fechar-grupo`;
    try {
        const config = getAuthConfig();
        const response = await axios.post<CloseGroupResponse>(endpoint, payload, config);
        console.log("[comandaService] Resposta API /fechar-grupo:", response.data);
        return response.data;
    } catch (error) {
        console.error('Erro [FE Service] ao fechar grupo de comandas:', error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `Erro ${error.response.status} ao fechar grupo.`);
        } else {
            throw new Error('Erro de rede ou servidor indisponível ao fechar grupo.');
        }
    }
};


// Exporta o objeto de serviço
export const comandaService = {
    getComandaByIdentifier,
    updateComandaStatus,
    getAllComandas,
    closeComandaGroup, // <<< GARANTE QUE ESTÁ EXPORTADO
};