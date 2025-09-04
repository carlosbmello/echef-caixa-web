// src/services/paymentMethodService.ts
import api from './api';

// --- INTERFACES (permanecem as mesmas) ---
export interface PaymentMethod {
  id: number;
  nome: string;
  tipo: 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'voucher' | 'outro';
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ApiResponse {
    message: string;
    paymentMethod: PaymentMethod;
}

type PaymentMethodPayload = Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>>;
type CreatePaymentMethodPayload = Required<Pick<PaymentMethodPayload, 'nome' | 'tipo'>> & PaymentMethodPayload;
type UpdatePaymentMethodPayload = PaymentMethodPayload;

// --- Funções do Serviço (Refatoradas) ---

const getAllPaymentMethods = async (filter?: { ativo?: boolean }): Promise<PaymentMethod[]> => {
  try {
    const { data } = await api.get<PaymentMethod[]>('/payment-methods', { params: filter });
    return data || [];
  } catch (error: any) {
    console.error('Erro [Service] ao buscar formas de pagamento:', error);
    throw new Error(error.response?.data?.message || 'Falha ao buscar formas de pagamento.');
  }
};

const getPaymentMethodById = async (id: number): Promise<PaymentMethod> => {
    try {
        const { data } = await api.get<PaymentMethod>(`/payment-methods/${id}`);
        return data;
    } catch (error: any) {
        console.error(`Erro [Service] ao buscar forma pagto ID ${id}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao buscar forma de pagamento ${id}.`);
    }
};

const createPaymentMethod = async (methodData: CreatePaymentMethodPayload): Promise<PaymentMethod> => {
    try {
        const { data } = await api.post<ApiResponse>('/payment-methods', methodData);
        return data.paymentMethod;
    } catch (error: any) {
        console.error('Erro [Service] ao criar forma pagto:', error);
        throw new Error(error.response?.data?.message || 'Falha ao criar forma de pagamento.');
    }
};

const updatePaymentMethod = async (id: number, methodData: UpdatePaymentMethodPayload): Promise<PaymentMethod> => {
     try {
        if (Object.keys(methodData).length === 0) throw new Error("Nenhum dado para atualizar.");
        const { data } = await api.put<ApiResponse>(`/payment-methods/${id}`, methodData);
        return data.paymentMethod;
    } catch (error: any) {
        console.error(`Erro [Service] ao atualizar forma pagto ${id}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao atualizar forma de pagamento ${id}.`);
    }
};

const deletePaymentMethod = async (id: number): Promise<{ message: string }> => {
     try {
        const { data } = await api.delete<{ message: string }>(`/payment-methods/${id}`);
        return data || { message: 'Forma de pagamento excluída.' };
    } catch (error: any) {
        console.error(`Erro [Service] ao deletar forma pagto ${id}:`, error);
        throw new Error(error.response?.data?.message || `Falha ao deletar forma de pagamento ${id}.`);
    }
};

export const paymentMethodService = {
  getAllPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
};