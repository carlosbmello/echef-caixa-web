// src/services/itemPedidoService.ts
import axios from 'axios';
import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api';
const API_URL_PEDIDOS = `${API_BASE_URL}/pedidos`;

export interface ItemPedido {
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome: string; // <<< NOME CORRETO, JÁ ESTAVA OK AQUI
  quantidade: string | number;
  preco_unitario_momento: string | number;
  observacao_item?: string | null;
  status_item?: string;
  data_hora_pedido?: string;
  nome_garcom?: string;
  numero_comanda?: string;

  // --- ADICIONE ESTE CAMPO OPCIONAL ---
  // Esta propriedade não vem da API de itens, mas será adicionada
  // dinamicamente no frontend (em CashierMainPage.tsx).
  // Por isso, é opcional (marcada com '?').
  cliente_nome_comanda?: string | null;
}

const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

const getItemsByComandaId = async (comandaId: number): Promise<ItemPedido[]> => {
    console.log(`[itemPedidoService] Buscando itens para comanda ${comandaId}...`);
    const endpoint = `${API_URL_PEDIDOS}/comanda/${comandaId}/items`;

    try {
        const config = getAuthConfig();
        const response = await axios.get<ItemPedido[]>(endpoint, config);
        console.log(`[itemPedidoService] Itens recebidos para comanda ${comandaId}:`, response.data ? response.data.length : 0);
        return response.data || [];
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar itens da comanda ${comandaId} (${endpoint}):`, error);
        return []; // Retorna array vazio em caso de erro para não quebrar a UI
    }
};

export const itemPedidoService = {
    getItemsByComandaId,
};