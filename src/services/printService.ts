// src/services/printService.ts

// [CORREÇÃO] A importação do 'api' foi ajustada para não usar chaves {}
import api from './api';

interface PrintJobPayload {
  pontoId: number;
  jobType: 'clienteConta' | 'clientePagtos' | 'pedidos';
  jobData: any;
}

const imprimirPorPonto = async (
  pontoId: number,
  jobData: any,
  jobType: 'clienteConta' | 'clientePagtos'
): Promise<{ message: string }> => {
  try {
    const payload: PrintJobPayload = { pontoId, jobData, jobType };
    console.log('[printService] Enviando solicitação de impressão:', payload);
    
    // Assumindo que a rota genérica no backend seja POST /api/print/jobs
    const { data } = await api.post('/pedidos/imprimir-documento', payload);

    console.log('[printService] Resposta do backend:', data);
    return data;

  } catch (error: any) {
    console.error('[printService] Erro ao solicitar impressão:', error);
    throw new Error(error.response?.data?.message || 'Falha ao enviar para a fila de impressão.');
  }
};

export const printService = {
  imprimirPorPonto,
};