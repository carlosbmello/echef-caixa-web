// src/services/itemPedidoService.ts

// [CORREÇÃO] Importa a instância centralizada 'api'
import api from './api';

export interface ItemPedido {
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome: string;
  quantidade: string | number;
  preco_unitario_momento: string | number;
  observacao_item?: string | null;
  status_item?: string;
  data_hora_pedido?: string;
  nome_garcom?: string;
  numero_comanda?: string;
  cliente_nome_comanda?: string | null;
}

// [CORREÇÃO] A função getAuthConfig não é mais necessária aqui.

const getItemsByComandaId = async (comandaId: number): Promise<ItemPedido[]> => {
    console.log(`[itemPedidoService] Buscando itens para comanda ${comandaId}...`);
    
    // [CORREÇÃO] O caminho da rota no backend precisa corresponder.
    // Se a rota no backend para buscar itens de uma comanda é /comandas/:id/items
    // então a chamada deve ser assim. Ajuste se a sua rota for diferente.
    const endpoint = `/comandas/${comandaId}/items`;

    try {
        // [CORREÇÃO] A chamada agora usa 'api'. O token é adicionado automaticamente.
        const { data } = await api.get<ItemPedido[]>(endpoint);
        
        console.log(`[itemPedidoService] Itens recebidos para comanda ${comandaId}:`, data ? data.length : 0);
        return data || [];
    } catch (error: any) {
        console.error(`Erro [Service] ao buscar itens da comanda ${comandaId} (${endpoint}):`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar itens da comanda ${comandaId}.`);
    }
};

export const itemPedidoService = {
    getItemsByComandaId,
};