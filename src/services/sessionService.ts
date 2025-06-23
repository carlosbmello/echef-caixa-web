// src/services/sessionService.ts
import axios from 'axios';
import { authService } from './authService';

// Log de Carregamento (útil para depurar problemas de cache/import)
console.log('>>> Módulo sessionService.ts CARREGADO <<<', new Date().toLocaleTimeString());

// const API_URL = 'http://localhost:3001/api/sessions'; // Endpoint para SESSÕES
// A URL base viria da variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api'; // Fallback opcional

const API_URL = `${API_BASE_URL}/sessions`; // Constrói a URL específica

// Interface para os dados de uma Sessão
export interface Session {
    id: number;
    usuario_abertura_id: number;
    nome_usuario_abertura?: string;
    data_abertura: string;
    valor_abertura: string | number;
    usuario_fechamento_id?: number | null;
    nome_usuario_fechamento?: string | null;
    data_fechamento?: string | null;
    valor_fechamento_calculado?: string | number | null;
    valor_fechamento_informado?: string | number | null;
    diferenca_caixa?: string | number | null;
    observacao?: string | null;
    status?: 'aberta' | 'fechada';
}

// Função auxiliar para obter cabeçalho de autenticação
const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) {
        console.error("[sessionService] Token de autenticação não encontrado ao chamar getAuthConfig.");
        throw new Error('Token de autenticação não encontrado.');
    }
    return { headers: { Authorization: `Bearer ${token}` } };
};

// --- Funções do Serviço ---

// Buscar a última sessão aberta (GET /last-open)
const getLastOpenSession = async (): Promise<Session | null> => {
    console.log("[sessionService] Buscando última sessão aberta (GET /last-open)...");
    try {
        const config = getAuthConfig();
        const response = await axios.get<{ message: string; session: Session | null }>(`${API_URL}/last-open`, config);
        console.log("[sessionService] Resposta getLastOpenSession:", response.data);
        return response.data.session;
    } catch (error) {
        console.error('Erro [FE Service] ao buscar última sessão aberta:', error);
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            console.log("[sessionService] Nenhuma sessão aberta encontrada (404).");
            return null;
        }
        // Não mascara outros erros, deixa o componente tratar
        if (axios.isAxiosError(error) && error.response) {
             throw new Error(error.response.data.message || `Erro ${error.response.status} ao buscar status caixa.`);
        }
        throw new Error('Falha ao buscar status do caixa.');
    }
};

// Abrir uma nova sessão de caixa (POST /open)
const openSession = async (valorInicial: number): Promise<Session> => {
    console.log(`[sessionService] Iniciando openSession com valor: ${valorInicial}`);
    try {
        const config = getAuthConfig(); // Pega o cabeçalho com token
        const payload = { valor_abertura: valorInicial }; // Monta o corpo da requisição

        // **** LOG ADICIONADO PARA VER O PAYLOAD ****
        console.log('[sessionService] Payload sendo enviado para POST /open:', payload);
        // ******************************************

        const response = await axios.post<{ message: string, session: Session }>(`${API_URL}/open`, payload, config);
        console.log("[sessionService] Resposta POST /open:", response.data);
        return response.data.session; // Retorna o objeto session criado

    } catch (error) {
        console.error('Erro [FE Service] ao abrir sessão:', error);
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 409) { throw new Error('Já existe uma sessão de caixa aberta.'); }
            // Retorna a mensagem de erro específica do backend (ex: valor inválido)
            throw new Error(error.response.data.message || `Erro ${error.response.status} ao tentar abrir o caixa.`);
        } else {
            throw new Error('Erro de rede ou servidor indisponível ao abrir caixa.');
        }
    }
};

// Fechar uma sessão de caixa existente (POST /:id/close)
const closeSession = async (sessionId: number, valorInformado: number, observacao?: string): Promise<Session> => {
    console.log(`>>> Chamando sessionService.closeSession (ID: ${sessionId}) <<<`, new Date().toLocaleTimeString());
    const endpoint = `${API_URL}/${sessionId}/close`;
    try {
        const config = getAuthConfig();
        const payload = {
            valor_fechamento_informado: valorInformado,
            observacao: observacao || null,
        };
        console.log(`[sessionService] Payload sendo enviado para POST ${endpoint}:`, payload); // Log do payload de fechamento
        const response = await axios.post<{ message: string, session: Session }>(endpoint, payload, config);
        console.log(`[sessionService] Resposta POST ${endpoint}:`, response.data);
        return response.data.session;
    } catch (error) {
        console.error(`Erro [FE Service] ao fechar sessão ${sessionId}:`, error);
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data.message || `Erro ${error.response.status} ao fechar caixa.`);
        } else {
            throw new Error('Erro de rede ou servidor indisponível ao fechar caixa.');
        }
    }
};


// Exporta o objeto de serviço com todas as funções
export const sessionService = {
    getLastOpenSession,
    openSession,
    closeSession,
};