// src/services/printService.ts
import axios from 'axios';
import { authService } from './authService'; // Reutiliza autenticação
import { ItemPedido } from './itemPedidoService'; // Importa a interface de Item

// Ajustar se a URL base da API for diferente para impressão
const API_URL = 'http://localhost:3001/api/print';

// Interface para os dados enviados para a impressão de conferência
// Definir os campos que o backend precisará para formatar a nota
interface ConferenciaPayload {
    comandaIds: number[];
    items: ItemPedido[]; // Lista completa de itens como exibida
    totalConsumo: number;
    taxaServico: number;
    incluiuTaxa: boolean;
    acrescimos: number;
    descontos: number;
    totalAPagar: number;
    totalPago?: number; // Enviar o total pago também pode ser útil
    saldoDevedor?: number;
    numeroPessoas?: number; // Para mostrar divisão, se aplicável
    // Outros dados úteis (opcional):
    // nomeCliente?: string | null;
    // identificadorMesa?: string | null;
    // nomeOperadorCaixa?: string | null;
}

// Função para chamar o endpoint de impressão no backend
const printConferencia = async (payload: ConferenciaPayload): Promise<void> => {
    console.log("[printService] Enviando dados para impressão de conferência:", payload);
    // *** Endpoint AINDA PRECISA SER CRIADO NO BACKEND ***
    const endpoint = `${API_URL}/conferencia`; // Ex: POST /api/print/conferencia

    try {
        const config = { headers: { Authorization: `Bearer ${authService.getToken()}` } };
        await axios.post(endpoint, payload, config);
        console.log("[printService] Comando de impressão enviado com sucesso para a API.");
        // O backend cuidará de enviar para a impressora real.
    } catch (error) {
        console.error("Erro [FE Service] ao solicitar impressão de conferência:", error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || 'Falha ao comunicar com serviço de impressão.');
        } else {
            throw new Error('Erro de rede ou serviço de impressão indisponível.');
        }
    }
};

export const printService = {
    printConferencia,
};