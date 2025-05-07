// src/components/OpenSessionModal.tsx
import React, { useState, useEffect } from 'react'; // <<< useEffect ADICIONADO AQUI
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { sessionService } from '../services/sessionService'; // Ajuste o caminho se necessário

interface OpenSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Chamado após abrir com sucesso
}

// Função auxiliar local para formatação
const formatCurrencyModal = (value: string | number | null | undefined): string => {
    const number = Number(String(value).replace(',', '.'));
    if (value === null || value === undefined || isNaN(number)) return 'R$ 0,00';
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const OpenSessionModal: React.FC<OpenSessionModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [initialValue, setInitialValue] = useState<number | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleValueChange = (values: NumberFormatValues) => {
        setInitialValue(values.floatValue); // Pega o valor numérico
    };

    const handleOpenSession = async () => {
        if (initialValue === undefined || initialValue < 0) {
            setError("Por favor, informe um valor inicial válido (mínimo R$ 0,00).");
            return;
        }
        setIsLoading(true); setError(null);
        try {
            console.log(`[OpenSessionModal] Tentando abrir com valor: ${initialValue}`);
            await sessionService.openSession(initialValue);
            console.log("[OpenSessionModal] Caixa aberto!");
            onSuccess(); onClose(); setInitialValue(undefined);
        } catch (err: any) { console.error("[OpenSessionModal] Erro:", err); setError(err.message || "Falha."); }
        finally { setIsLoading(false); }
    };

    // Hook para resetar o valor quando o modal for fechado externamente
    // Este hook PRECISA do useEffect importado
    useEffect(() => {
        console.log("[OpenSessionModal] useEffect rodando, isOpen:", isOpen); // Log de depuração
        if (!isOpen) {
            console.log("[OpenSessionModal] Resetando estado local pois isOpen é false.");
            setInitialValue(undefined);
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]); // Executa quando isOpen muda

    if (!isOpen) { return null; }

    // Estilização do Modal (usando Tailwind como exemplo)
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
             {/* ... (Resto do JSX do modal como na versão anterior) ... */}
             <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 scale-100"> <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">Abrir Caixa</h2> {error && (<div role="alert" className="mb-4 text-center text-red-700 bg-red-100 border border-red-300 p-3 rounded-md text-sm"><p><b>Erro:</b> {error}</p></div>)} <div className="mb-5"><label htmlFor="initial-value" className="block text-sm font-medium text-gray-700 mb-1">Valor Inicial (Troco) *</label><NumericFormat id="initial-value" value={initialValue === undefined ? '' : initialValue} onValueChange={handleValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg text-center focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" autoFocus disabled={isLoading} /><p className='text-xs text-gray-500 mt-1 text-center'>Informe o valor disponível para troco.</p></div><div className="flex justify-between items-center gap-4 mt-6"><button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">Cancelar</button><button type="button" onClick={handleOpenSession} disabled={isLoading || initialValue === undefined || initialValue < 0} className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${isLoading || initialValue === undefined || initialValue < 0 ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}>{isLoading ? 'Abrindo...' : 'Abrir Caixa'}</button></div></div>
        </div>
    );
};

export default OpenSessionModal;