// src/components/CloseSessionModal.tsx
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { sessionService, Session, CloseSessionPayload } from '../services/sessionService'; // Certifique-se que CloseSessionPayload é exportado
import { toast } from 'react-toastify';

// Funções auxiliares de formatação
const formatCurrencyModal = (value: string | number | null | undefined): string => {
    const n = Number(String(value).replace(',', '.'));
    return isNaN(n) ? 'R$ 0,00' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const formatDateTimeModal = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
        return format(new Date(dateString), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch {
        return '?';
    }
};

// Interface de Props CORRIGIDA
interface CloseSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sessionToClose: Session | null; // Usaremos ESTE nome, pois é mais claro
}

const CloseSessionModal: React.FC<CloseSessionModalProps> = ({ isOpen, onClose, onSuccess, sessionToClose }) => {
    // Estados internos do modal
    const [valorInformado, setValorInformado] = useState<number | undefined>(undefined);
    const [observacao, setObservacao] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleValueChange = (values: NumberFormatValues) => {
        setValorInformado(values.floatValue);
    };

    const handleCloseAndReset = () => {
        setValorInformado(undefined);
        setObservacao('');
        setError(null);
        setIsLoading(false);
        onClose(); // Chama a função da página pai para fechar
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Previne o recarregamento da página
        if (!sessionToClose) {
            setError("Dados da sessão a ser fechada não foram encontrados.");
            return;
        }
        if (valorInformado === undefined || valorInformado < 0) {
            setError("Por favor, informe um valor contado em caixa válido.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const payload: CloseSessionPayload = {
                valor_fechamento_informado: valorInformado,
                observacao_fechamento: observacao.trim() || null, // Usa observacao_fechamento para consistência
            };

            console.log(`[CloseSessionModal] Fechando sessão ID ${sessionToClose.id} com payload:`, payload);
            await sessionService.closeSession(sessionToClose.id, payload);

            toast.success("Caixa fechado com sucesso!");
            onSuccess(); // Notifica a página pai sobre o sucesso (para recarregar os dados)
            handleCloseAndReset(); // Fecha o modal e reseta seus estados

        } catch (err: any) {
            console.error("[CloseSessionModal] Erro ao fechar sessão:", err);
            const errorMessage = err.response?.data?.message || err.message || "Falha ao fechar o caixa.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Reseta o estado do modal quando ele é fechado externamente
    useEffect(() => {
        if (!isOpen) {
            handleCloseAndReset();
        }
    }, [isOpen]);

    if (!isOpen || !sessionToClose) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Fechar Caixa (Sessão #{sessionToClose.id})</h2>
                    <button onClick={handleCloseAndReset} disabled={isLoading} className="text-gray-400 hover:text-gray-700" aria-label="Fechar">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {error && (
                    <div role="alert" className="mb-4 text-center text-red-700 bg-red-100 border border-red-300 p-3 rounded-md text-sm">
                        <p><b>Erro:</b> {error}</p>
                    </div>
                )}

                <div className='text-sm space-y-1 border rounded p-3 mb-4 bg-gray-50'>
                     <p className='flex justify-between'><span>Abertura:</span> <span>{formatDateTimeModal(sessionToClose.data_abertura)}</span></p>
                     <p className='flex justify-between'><span>Operador:</span> <span>{sessionToClose.nome_usuario_abertura || sessionToClose.usuario_abertura_id}</span></p>
                     <p className='flex justify-between'><span>Valor Inicial:</span> <span className='font-medium'>{formatCurrencyModal(sessionToClose.valor_abertura)}</span></p>
                     {/* Idealmente, o valor calculado viria da API antes de abrir o modal */}
                     <p className='flex justify-between'><span>Saldo Calculado (Sistema):</span> <span className='font-medium text-blue-600'>{formatCurrencyModal(sessionToClose.valor_fechamento_calculado)}</span></p>
                 </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="valor-informado" className="block text-sm font-medium text-gray-700 mb-1">Valor Contado em Caixa *</label>
                        <NumericFormat
                            id="valor-informado"
                            value={valorInformado === undefined ? '' : valorInformado}
                            onValueChange={handleValueChange}
                            thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false}
                            placeholder="R$ 0,00" disabled={isLoading} required autoFocus
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg text-center focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="observacao" className="block text-sm font-medium text-gray-700 mb-1">Observação de Fechamento (Opcional)</label>
                        <textarea id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={isLoading}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                                  placeholder='Ex: Diferença no caixa, sangria não registrada, etc.' />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 pt-4 border-t">
                        <button type="button" onClick={handleCloseAndReset} disabled={isLoading} className="w-full sm:w-auto justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={isLoading || valorInformado === undefined || valorInformado < 0} className={`w-full sm:w-auto justify-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${isLoading || valorInformado === undefined || valorInformado < 0 ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}>
                            {isLoading ? 'Fechando...' : 'Confirmar Fechamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloseSessionModal;