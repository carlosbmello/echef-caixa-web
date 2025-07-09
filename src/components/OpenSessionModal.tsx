// src/components/OpenSessionModal.tsx
import React, { useState, useEffect } from 'react';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
// Importa o serviço e o TIPO DE PAYLOAD que ele espera
import { sessionService, CreateSessionPayload } from '../services/sessionService';
import { toast } from 'react-toastify';

interface OpenSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const OpenSessionModal: React.FC<OpenSessionModalProps> = ({ isOpen, onClose, onSuccess }) => {
    // Renomeado para clareza
    const [openingValue, setOpeningValue] = useState<number | undefined>(undefined);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleValueChange = (values: NumberFormatValues) => {
        setOpeningValue(values.floatValue); // Pega o valor numérico
    };

    const handleCloseAndReset = () => {
        setOpeningValue(undefined);
        setError(null);
        setIsProcessing(false);
        onClose();
    };

    const handleOpenSession = async () => {
        if (openingValue === undefined || openingValue < 0) {
            setError("Por favor, informe um valor inicial válido (mínimo R$ 0,00).");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // --- CORREÇÃO PRINCIPAL AQUI ---
            // Monta o payload conforme a interface `CreateSessionPayload`
            const payload: CreateSessionPayload = {
                valor_abertura: openingValue
                // observacao_abertura: "Alguma observação" // Opcional, se você adicionar um campo para isso
            };

            console.log(`[OpenSessionModal] Tentando abrir sessão com payload:`, payload);
            await sessionService.openSession(payload); // Envia o objeto payload

            toast.success("Caixa aberto com sucesso!");
            onSuccess(); // Notifica a página pai para recarregar os dados
            handleCloseAndReset(); // Fecha o modal e reseta o estado interno

        } catch (err: any) {
            console.error("[OpenSessionModal] Erro ao abrir sessão:", err);
            const errorMessage = err.response?.data?.message || err.message || "Falha ao abrir caixa.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    // Efeito para resetar o estado quando o modal for fechado
    useEffect(() => {
        if (!isOpen) {
            handleCloseAndReset();
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
             <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-semibold text-gray-800">Abrir Caixa</h2>
                     <button onClick={handleCloseAndReset} disabled={isProcessing} className="text-gray-400 hover:text-gray-700" aria-label="Fechar">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                 
                 {error && (
                     <div role="alert" className="mb-4 text-center text-red-700 bg-red-100 border border-red-300 p-3 rounded-md text-sm">
                         <p><b>Erro:</b> {error}</p>
                     </div>
                 )}

                 <div className="mb-5">
                     <label htmlFor="opening-value" className="block text-sm font-medium text-gray-700 mb-1">Valor Inicial (Troco) *</label>
                     <NumericFormat
                         id="opening-value"
                         value={openingValue === undefined ? '' : openingValue}
                         onValueChange={handleValueChange}
                         thousandSeparator="." decimalSeparator="," prefix="R$ "
                         decimalScale={2} fixedDecimalScale allowNegative={false}
                         placeholder="R$ 0,00"
                         className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg text-center focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                         autoFocus
                         disabled={isProcessing}
                         onKeyDown={(e) => { if (e.key === 'Enter') handleOpenSession(); }}
                     />
                     <p className='text-xs text-gray-500 mt-1 text-center'>Informe o valor disponível em caixa para troco.</p>
                 </div>

                 <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 mt-6">
                     <button type="button" onClick={handleCloseAndReset} disabled={isProcessing} className="w-full sm:w-auto justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        Cancelar
                     </button>
                     <button type="button" onClick={handleOpenSession} disabled={isProcessing || openingValue === undefined || openingValue < 0} className={`w-full sm:w-auto justify-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${isProcessing || openingValue === undefined || openingValue < 0 ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}>
                         {isProcessing ? 'Abrindo...' : 'Abrir Caixa'}
                     </button>
                 </div>
             </div>
        </div>
    );
};

export default OpenSessionModal;