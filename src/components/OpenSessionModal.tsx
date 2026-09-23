import React, { useState } from 'react';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { sessionService, CreateSessionPayload } from '../services/sessionService';
import { toast } from 'react-toastify';

interface OpenSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EVENTOS_DISPONIVEIS = [
    "KARAOKÊ",
    "FLASHBACK",
    "STANDUP COMEDY",
    "MPB",
    "BATALHA DE BANDAS",
    "EVENTO FECHADO",
    "FUNCIONAMENTO NORMAL"
];

const OpenSessionModal: React.FC<OpenSessionModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [openingValue, setOpeningValue] = useState<number | undefined>(undefined);
    const [eventoNome, setEventoNome] = useState<string>(EVENTOS_DISPONIVEIS[0]);
    const [menuDigitalAtivo, setMenuDigitalAtivo] = useState<boolean>(true);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleValueChange = (values: NumberFormatValues) => {
        setOpeningValue(values.floatValue);
    };

    const handleCloseAndReset = () => {
        setOpeningValue(undefined);
        setEventoNome(EVENTOS_DISPONIVEIS[0]);
        setMenuDigitalAtivo(true);
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
            const payload: CreateSessionPayload = {
                valor_abertura: openingValue,
                evento_nome: eventoNome,
                menu_digital_ativo: menuDigitalAtivo
            };

            await sessionService.openSession(payload);
            toast.success('Caixa aberto com sucesso!');
            handleCloseAndReset();
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Erro ao abrir o caixa.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 bg-gray-800">
                    <h3 className="text-lg font-bold text-white">Abertura de Caixa</h3>
                </div>
                <div className="p-6 space-y-5">
                    {error && <div className="p-3 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm">{error}</div>}
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Valor Inicial (Troco) *</label>
                        <NumericFormat 
                            value={openingValue} 
                            onValueChange={handleValueChange} 
                            thousandSeparator="." 
                            decimalSeparator="," 
                            prefix="R$ " 
                            decimalScale={2} 
                            fixedDecimalScale 
                            allowNegative={false} 
                            className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white text-lg font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all" 
                            placeholder="R$ 0,00" 
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Evento de Hoje</label>
                        <select 
                            value={eventoNome} 
                            onChange={(e) => setEventoNome(e.target.value)}
                            className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            {EVENTOS_DISPONIVEIS.map(ev => (
                                <option key={ev} value={ev}>{ev}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-600 rounded">
                        <div>
                            <p className="text-sm font-bold text-white">Autoatendimento (Mesa)</p>
                            <p className="text-xs text-gray-400">Permite clientes pedirem pelo celular.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={menuDigitalAtivo} onChange={(e) => setMenuDigitalAtivo(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>

                </div>
                <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
                    <button onClick={handleCloseAndReset} disabled={isProcessing} className="px-4 py-2 text-gray-300 hover:text-white font-medium">Cancelar</button>
                    <button onClick={handleOpenSession} disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-50">
                        {isProcessing ? 'Abrindo...' : 'Abrir Caixa'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OpenSessionModal;