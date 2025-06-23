// src/services/itemPedidoService.ts
import axios from 'axios';
import { authService } from './authService';

// A URL base viria da variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api'; // Fallback opcional

const API_URL_PEDIDOS = `${API_BASE_URL}/pedidos`; // Constrói a URL específica

// const API_URL_PEDIDOS = 'http://localhost:3001/api/pedidos';

export interface ItemPedido {
  id: number;
  pedido_id: number;
  produto_id: number;
  nome_produto: string;
  quantidade: string | number;
  preco_unitario_momento: string | number;
  observacao_item?: string | null;
  status_item?: string;
  data_hora_pedido?: string;
  nome_garcom?: string;
  numero_comanda?: string;
}

const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token não encontrado.'); // Este erro ainda é lançado, pois é crítico
    return { headers: { Authorization: `Bearer ${token}` } };
};

const getItemsByComandaId = async (comandaId: number): Promise<ItemPedido[]> => {
     console.log(`[itemPedidoService] Buscando itens REAIS para comanda ${comandaId}...`);
    const endpoint = `${API_URL_PEDIDOS}/comanda/${comandaId}/items`;

    try {
        const config = getAuthConfig();
        const response = await axios.get<ItemPedido[]>(endpoint, config);
        console.log(`[itemPedidoService] Itens recebidos para comanda ${comandaId}:`, response.data ? response.data.length : 0);
        return response.data || [];
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar itens da comanda ${comandaId} (${endpoint}):`, error);
        // **** MUDANÇA AQUI: Retorna array vazio em vez de lançar erro ****
        // Isso garante que a promise sempre resolve, mesmo que com dados vazios.
        return [];
        // ****************************************************************
    }
};

export const itemPedidoService = {
    getItemsByComandaId,
};