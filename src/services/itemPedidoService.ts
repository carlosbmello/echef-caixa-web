// src/services/itemPedidoService.ts
import axios from 'axios';
import { authService } from './authService';

// ATENÇÃO: Ajustar URL base se necessário
const API_URL = 'http://localhost:3001/api/pedidos'; // Usamos a base de pedidos

// Interface Mock (igual à da CashierMainPage) - Substituir pela real da API depois
export interface ItemPedido {
  id: number;
  pedido_id: number;
  nome_produto: string;
  quantidade: string | number;
  preco_unitario_momento: string;
  observacao_item?: string | null;
  // Adicionar outros campos se a API retornar (ex: status_item)
}


const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// Função para buscar todos os ITENS de uma comanda específica
// *** ATENÇÃO: Endpoint GET /api/pedidos/comanda/:comandaId/items ainda precisa ser criado no BACKEND! ***
const getItemsByComandaId = async (comandaId: number): Promise<ItemPedido[]> => {
     console.warn(`[itemPedidoService] Tentando buscar itens para comanda ${comandaId}, mas a API backend (GET /api/pedidos/comanda/:comandaId/items) pode não estar implementada. USANDO MOCK.`);

     // --- INÍCIO DO MOCK ---
     if (comandaId === 1) { // Exemplo: retorna mock só para comanda ID 1
         return [
             { id: 101, pedido_id: 1, nome_produto: "X-Salada (Mock)", quantidade: "2.000", preco_unitario_momento: "30.00", observacao_item: "Sem picles" },
             { id: 102, pedido_id: 1, nome_produto: "Coca-Cola (Mock)", quantidade: "1.000", preco_unitario_momento: "5.50", observacao_item: null },
             { id: 103, pedido_id: 2, nome_produto: "Batata Frita (Mock)", quantidade: "1.000", preco_unitario_momento: "15.00", observacao_item: "Bem passada"}
         ];
     } else {
         return []; // Retorna vazio para outras comandas no mock
     }
     // --- FIM DO MOCK ---

    /* CÓDIGO QUANDO A API EXISTIR:
    try {
        const config = getAuthConfig();
        // Chama o endpoint específico do backend
        const response = await axios.get<ItemPedido[]>(`${API_URL}/comanda/${comandaId}/items`, config);
        return response.data || [];
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar itens da comanda ${comandaId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 404) throw new Error(`Comanda com ID ${comandaId} não encontrada.`);
            throw new Error(error.response.data.message || 'Erro ao buscar itens da comanda.');
        } else { throw new Error('Erro de rede ou servidor indisponível.'); }
    }
    */
};


export const itemPedidoService = {
    getItemsByComandaId,
};