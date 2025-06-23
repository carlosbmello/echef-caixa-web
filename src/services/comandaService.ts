// src/services/comandaService.ts
import axios from 'axios';
import { authService } from './authService'; // Assumindo que authService está correto

// URL base da API para comandas
// const API_BASE_URL = 'http://localhost:3001/api'; // URL base da API
// A URL base viria da variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api'; // Fallback opcional


const COMANDAS_API_ENDPOINT = `${API_BASE_URL}/comandas`; // Endpoint específico de comandas

// Interface para representar uma Comanda (ajustada para consistência)
// Esta interface deve refletir o que a API retorna para o Caixa.
// Pode ser mais simples que ComandaDetalhada do app de pedidos.
export interface Comanda {
  id: number;
  numero: string;
  status: 'aberta' | 'fechada' | 'paga' | 'cancelada' | string; // Permitindo outros status se o backend tiver
  cliente_nome?: string | null;
  local_atual?: string | null;       // Nome consistente com backend/pedidos-web
  data_abertura?: string | null;
  data_fechamento?: string | null;
  // Se a API para o caixa retorna total_atual_calculado (preferível) ou valor_total_calculado
  total_atual_calculado?: number | null; 
  // valor_total_calculado?: string | number | null; // Se a API do caixa retornar este
  created_at?: string;
  updated_at?: string;
  // Adicione o array de itens se o caixa precisar ver os itens antes de fechar
  // itens?: Array<{ produto_nome: string; quantidade: number; preco_total_item: number; }>; // Exemplo simplificado
}

// Tipo para o payload de atualização de status individual
export type UpdateComandaPayload = {
    status: 'aberta' | 'fechada' | 'paga' | 'cancelada' | string; // Ajustar conforme ENUM do backend
    local_atual?: string;
    cliente_nome?: string;
};

// Interface para resposta da API ao atualizar uma comanda
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

// Buscar uma comanda PELO NÚMERO (GET /numero/:numero)
// Renomeado para clareza, assumindo que o 'identifier' aqui é sempre o NÚMERO da comanda
const getComandaByNumero = async (numeroComanda: string): Promise<Comanda> => {
    console.log(`[Caixa Service] Buscando comanda por NÚMERO: '${numeroComanda}'`);
    try {
        const config = getAuthConfig();
        // CHAMA A ROTA CORRETA /api/comandas/numero/:numeroComanda
        const response = await axios.get<Comanda>(`${COMANDAS_API_ENDPOINT}/numero/${numeroComanda}`, config);
        
        if (!response.data) { // Embora Axios geralmente lance erro para 404
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
            throw error; // Relança o erro se já for uma instância de Error
        } else {
            throw new Error(`Erro de rede ou servidor indisponível ao buscar comanda.`);
        }
    }
};

// Se você também precisar buscar por ID NUMÉRICO no caixa-web em algum momento:
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
    } catch (error) { /* ... (tratamento de erro similar ao getComandaByNumero) ... */ throw error; }
};


// Buscar TODAS as comandas com filtros (GET /)
const getAllComandas = async (params?: { status?: string; }): Promise<Comanda[]> => {
    // ... (código como estava, parece ok) ...
    console.log('[Caixa Service] Buscando todas as comandas com filtros:', params);
    try {
        const config = { ...getAuthConfig(), params: params || {} };
        const response = await axios.get<Comanda[]>(COMANDAS_API_ENDPOINT, config);
        return response.data || [];
    } catch (error) { /* ... (tratamento de erro como estava) ... */ throw error; }
};

// Atualizar o status (ou outros dados) de uma comanda (PUT /:id)
const updateComandaStatus = async (id: number, payload: UpdateComandaPayload): Promise<Comanda> => {
    // ... (código como estava, parece ok, usa /:id que é o ID numérico) ...
    try {
        const config = getAuthConfig();
        const response = await axios.put<{ message: string, comanda: Comanda }>(`${COMANDAS_API_ENDPOINT}/${id}`, payload, config);
        return response.data.comanda;
    } catch (error) { /* ... (tratamento de erro como estava) ... */ throw error; }
};

// Função para chamar API para fechar um GRUPO de comandas (POST /fechar-grupo)
const closeComandaGroup = async (payload: CloseGroupPayload): Promise<CloseGroupResponse> => {
    // ... (código como estava, parece ok) ...
    const endpoint = `${COMANDAS_API_ENDPOINT}/fechar-grupo`;
    try {
        const config = getAuthConfig();
        const response = await axios.post<CloseGroupResponse>(endpoint, payload, config);
        return response.data;
    } catch (error) { /* ... (tratamento de erro como estava) ... */ throw error; }
};


// Exporta o objeto de serviço
export const comandaServiceCaixa = { // Renomeado para evitar conflito se você copiar para outro projeto
    getComandaByNumero,       // Função ajustada para buscar por número
    getComandaPorIdNumerico,  // Nova função opcional para buscar por ID
    updateComandaStatus,
    getAllComandas,
    closeComandaGroup,
};