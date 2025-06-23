// src/services/paymentMethodService.ts
import axios from 'axios';
import { authService } from './authService';

// const API_URL = 'http://localhost:3001/api/payment-methods'; // URL base
// A URL base viria da variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api'; // Fallback opcional

const API_URL = `${API_BASE_URL}/payment-methods`; // Constrói a URL específica

// Interface para Forma de Pagamento (como a API retorna)
export interface PaymentMethod {
  id: number;
  nome: string;
  tipo: 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'voucher' | 'outro'; // Tipos do ENUM
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Interface para resposta da API (POST, PUT, GET by ID)
interface ApiResponse {
    message: string;
    paymentMethod: PaymentMethod;
}

// Tipo para payload de Criação/Edição
// Omit 'id', 'created_at', 'updated_at'. Os outros podem ser parciais no update.
// Garantir que 'nome' e 'tipo' sejam obrigatórios na criação.
type PaymentMethodPayload = Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>>;
type CreatePaymentMethodPayload = Required<Pick<PaymentMethodPayload, 'nome' | 'tipo'>> & PaymentMethodPayload;
type UpdatePaymentMethodPayload = PaymentMethodPayload;


const getAuthConfig = () => {
    const token = authService.getToken();
    if (!token) throw new Error('Token de autenticação não encontrado.');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// Buscar todas as formas de pagamento (com filtro opcional por ativo)
// A API já tem a lógica de permissão para listar todas vs. só ativas
const getAllPaymentMethods = async (filter?: { ativo?: boolean }): Promise<PaymentMethod[]> => {
  try {
    const config = getAuthConfig();
    const params = filter; // Passa o filtro como query params se existir
    const response = await axios.get<PaymentMethod[]>(API_URL, { ...config, params });
    return response.data || [];
  } catch (error) {
    console.error('Erro [FE Service] ao buscar formas de pagamento:', error);
    if (axios.isAxiosError(error) && error.response) { throw new Error(error.response.data.message || 'Erro.'); }
    else { throw new Error('Erro de rede.'); }
  }
};

// Buscar uma forma de pagamento pelo ID (API só permite Admin)
const getPaymentMethodById = async (id: number): Promise<PaymentMethod> => {
    try {
        const config = getAuthConfig();
        const response = await axios.get<PaymentMethod>(`${API_URL}/${id}`, config);
        if (!response.data) throw new Error('Forma de pagamento não encontrada.');
        return response.data;
    } catch (error) {
        console.error(`Erro [FE Service] ao buscar forma pagto ID ${id}:`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error('Forma de pagamento não encontrada.');
           throw new Error(error.response.data.message || `Erro.`);
        } else { throw new Error(`Erro de rede.`); }
    }
};

// Criar uma nova forma de pagamento (API só permite Admin)
const createPaymentMethod = async (methodData: CreatePaymentMethodPayload): Promise<PaymentMethod> => {
    try {
        const config = getAuthConfig();
        const response = await axios.post<ApiResponse>(API_URL, methodData, config);
        return response.data.paymentMethod;
    } catch (error) {
        console.error('Erro [FE Service] ao criar forma pagto:', error);
        if (axios.isAxiosError(error) && error.response) { throw new Error(error.response.data.message || `Erro.`); }
        else { throw new Error('Erro de rede.'); }
    }
};

// Atualizar uma forma de pagamento existente (API só permite Admin)
const updatePaymentMethod = async (id: number, methodData: UpdatePaymentMethodPayload): Promise<PaymentMethod> => {
     try {
        if (Object.keys(methodData).length === 0) throw new Error("Nenhum dado para atualizar.")
        const config = getAuthConfig();
        const response = await axios.put<ApiResponse>(`${API_URL}/${id}`, methodData, config);
        return response.data.paymentMethod;
    } catch (error) {
        console.error(`Erro [FE Service] ao atualizar forma pagto ${id}:`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error('Forma de pagamento não encontrada.');
            throw new Error(error.response.data.message || `Erro.`);
        } else { throw new Error('Erro de rede.'); }
    }
};

// Deletar uma forma de pagamento (API só permite Admin)
const deletePaymentMethod = async (id: number): Promise<{ message: string }> => {
     try {
        const config = getAuthConfig();
        const response = await axios.delete<{ message: string }>(`${API_URL}/${id}`, config);
        return response.data || { message: 'Forma de pagamento excluída.' };
    } catch (error) {
        console.error(`Erro [FE Service] ao deletar forma pagto ${id}:`, error);
        if (axios.isAxiosError(error) && error.response) {
             if (error.response.status === 404) throw new Error('Forma de pagamento não encontrada.');
             if (error.response.status === 409) throw new Error(error.response.data.message || 'Erro: Forma de pagamento em uso.'); // Conflito FK
            throw new Error(error.response.data.message || `Erro.`);
        } else { throw new Error('Erro de rede.'); }
    }
};


export const paymentMethodService = {
  getAllPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};