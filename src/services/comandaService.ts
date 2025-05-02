// src/services/comandaService.ts
import axios from 'axios';
import { authService } from './authService';

// URL base da API para comandas
const API_URL = 'http://localhost:3001/api/comandas';

// Interface para representar uma Comanda (como a API retorna no GET /:identifier)
// Inclui o total calculado que adicionamos no controller do backend
export interface Comanda {
  id: number;
  numero: string;
  status: 'disponivel' | 'em_uso' | 'fechada' | 'perdida';
  cliente_nome?: string | null;
  local_atual?: string | null; // Campo de texto livre
  data_abertura?: string | null; // ISO String
  data_fechamento?: string | null; // ISO String
  // valor_total_calculado: string; // O backend não armazena mais, calculamos sob demanda
  total_atual_calculado?: number; // <<< Vem da função getComanda no controller
  created_at?: string;
  updated_at?: string;
  // Adicionar itens e pagamentos aqui se a API for modificada para retorná-los
  // itens?: any[]; // Exemplo
  // pagamentos?: any[]; // Exemplo
}

// Tipo para o payload de atualização de status (ex: fechar comanda)
type UpdateComandaPayload = {
    status: 'disponivel' | 'em_uso' | 'fechada' | 'perdida';
    // Adicionar outros campos se necessário atualizar via PUT geral
    local_atual?: string;
    cliente_nome?: string;
};

// Interface para resposta da API ao atualizar
interface UpdateApiResponse {
    message: string;
    comanda: Comanda;
}

// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Buscar uma comanda pelo ID ou NÚMERO (GET /:identifier)
// A API no backend já inclui o total calculado nesta rota
const getComandaByIdentifier = async (identifier: string | number): Promise<Comanda> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<Comanda>(`${API_URL}/${identifier}`, config);
        if (!response.data) {
            throw new Error(`Comanda '${identifier}' não encontrada.`);
        }
        return response.data;
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar comanda '${identifier}':`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) {
                 throw new Error(`Comanda '${identifier}' não encontrada.`);
             }
           // Outros erros (401, 403, 500)
           throw new Error(error.response.data.message || `Erro ao buscar comanda.`);
        } else { throw new Error(`Erro de rede ou servidor indisponível.`); }
    }
};

// Atualizar o status (ou outros dados) de uma comanda (PUT /:id)
// Usado principalmente para marcar como 'fechada' após pagamento
const updateComandaStatus = async (id: number, payload: UpdateComandaPayload): Promise<Comanda> => {
     try {
        const config = getAuthConfig();
        const response = await axios.put<UpdateApiResponse>(`${API_URL}/${id}`, payload, config);
        return response.data.comanda;
    } catch (error) {
        console.error(`Erro [FE Service] ao atualizar comanda ID ${id}:`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error(`Comanda com ID ${id} não encontrada.`);
             // Outros erros (400, 401, 403, 500)
           throw new Error(error.response.data.message || `Erro ao atualizar comanda.`);
        } else { throw new Error(`Erro de rede ou servidor indisponível.`); }
    }
};


// Exporta o objeto de serviço
export const comandaService = {
    getComandaByIdentifier,
    updateComandaStatus,
    // Adicionar outras funções se necessário (listar, criar - embora criar seja menos comum no caixa)
};