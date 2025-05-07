// src/components/CloseSessionModal.tsx
import React, { useState, useEffect } from 'react';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { sessionService, Session } from '../services/sessionService'; // Ajuste o caminho se necessário

// Função auxiliar local
const formatCurrencyModal = (value: string | number | null | undefined): string => { const n=Number(String(value).replace(',','.')); return isNaN(n)?'R$ 0,00':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); };
const formatDateTimeModal = (dateString: string | null | undefined): string => { if (!dateString) return '-'; try { return format(new Date(dateString), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return '?'; } };

interface CloseSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    openSessionData: Session | null; // Recebe os dados da sessão ATUALMENTE aberta
}

const CloseSessionModal: React.FC<CloseSessionModalProps> = ({ isOpen, onClose, onSuccess, openSessionData }) => {
    const [valorInformado, setValorInformado] = useState<number | undefined>(undefined);
    const [observacao, setObservacao] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // TODO Opcional: Adicionar estado para guardar resumo financeiro buscado da API

    const handleValueChange = (values: NumberFormatValues) => {
        setValorInformado(values.floatValue);
    };

    const handleCloseSession = async () => {
        if (!openSessionData) { setError("Dados da sessão não encontrados."); return; }
        if (valorInformado === undefined || valorInformado < 0) { setError("Informe o valor contado em caixa."); return; }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`[CloseSessionModal] Fechando ID ${openSessionData.id} com valor: ${valorInformado}`);
            await sessionService.closeSession(openSessionData.id, valorInformado, observacao.trim() || undefined);

            console.log("[CloseSessionModal] Caixa fechado com sucesso!");
            onSuccess();
            onClose();
            // Reset local states
            setValorInformado(undefined);
            setObservacao('');

        } catch (err: any) { console.error("[CloseSessionModal] Erro:", err); setError(err.message || "Falha ao fechar o caixa."); }
        finally { setIsLoading(false); }
    };

    // Reset state when modal is closed externally
    useEffect(() => {
        if (!isOpen) {
            setValorInformado(undefined);
            setObservacao('');
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]);


    if (!isOpen || !openSessionData) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 scale-100">
                <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">Fechar Caixa (Sessão #{openSessionData.id})</h2>

                {error && ( <div role="alert" className="mb-4 text-center text-red-700 bg-red-100 border border-red-300 p-3 rounded-md text-sm"><p><b>Erro:</b> {error}</p></div> )}

                {/* Resumo Informativo */}
                 <div className='text-sm space-y-1 border rounded p-3 mb-4 bg-gray-50'>
                     <p className='flex justify-between'><span>Abertura:</span> <span>{formatDateTimeModal(openSessionData.data_abertura)}</span></p>
                     <p className='flex justify-between'><span>Operador:</span> <span>{openSessionData.nome_usuario_abertura || openSessionData.usuario_abertura_id}</span></p>
                     <p className='flex justify-between'><span>Valor Inicial:</span> <span className='font-medium'>{formatCurrencyModal(openSessionData.valor_abertura)}</span></p>
                     {/* Idealmente exibir aqui o Saldo Calculado atualizado */}
                     {/* <p className='flex justify-between'><span>Saldo Calculado:</span> <span className='font-medium text-blue-600'>{formatCurrencyModal(VALOR_CALCULADO_API)}</span></p> */}
                 </div>

                <div className="mb-4">
                    <label htmlFor="valor-informado" className="block text-sm font-medium text-gray-700 mb-1"> Valor Contado em Caixa * </label>
                    <NumericFormat
                        id="valor-informado"
                        value={valorInformado === undefined ? '' : valorInformado}
                        onValueChange={handleValueChange}
                        thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false}
                        placeholder="R$ 0,00" disabled={isLoading} required autoFocus
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg text-center focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                    />
                </div>

                 {/* Exibição da diferença (será calculada pelo backend no final) */}
                 {/* <p className='text-center text-sm mb-4'>Diferença será calculada ao confirmar.</p> */}

                <div className="mb-5">
                    <label htmlFor="observacao" className="block text-sm font-medium text-gray-700 mb-1"> Observação (Opcional) </label>
                    <textarea id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={isLoading} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" placeholder='Diferença? Sangria? Quebra?' />
                </div>

                <div className="flex justify-between items-center gap-4 mt-6">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"> Cancelar </button>
                    <button type="button" onClick={handleCloseSession} disabled={isLoading || valorInformado === undefined || valorInformado < 0} className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${isLoading || valorInformado === undefined || valorInformado < 0 ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}> {isLoading ? 'Fechando...' : 'Confirmar Fechamento'} </button>
                </div>
            </div>
        </div>
    );
};

export default CloseSessionModal;