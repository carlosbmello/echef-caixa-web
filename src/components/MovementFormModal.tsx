import React, { useState, useEffect } from 'react';
import { movementService } from '../services/movementService';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { toast } from 'react-toastify';

type MovementType = 'entrada' | 'saida' | 'despesa';

interface MovementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionId: number | null; // Embora não usado na submissão, pode ser útil para validação
}

const MovementFormModal: React.FC<MovementFormModalProps> = ({ isOpen, onClose, onSuccess, sessionId }) => {
  const [tipo, setTipo] = useState<MovementType>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const movementTypes: { value: MovementType; label: string }[] = [
    { value: 'saida', label: 'Saída (Pagamento/Sangria)' },
    { value: 'despesa', label: 'Despesa (Compra)' },
    { value: 'entrada', label: 'Entrada (Reforço/Outro)' },
  ];

  const handleValueChange = (values: NumberFormatValues) => {
    setValor(values.floatValue);
  };

  const handleClose = () => {
    setTipo('saida');
    setDescricao('');
    setValor(undefined);
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!sessionId) { setError("ID da sessão não encontrado."); setIsLoading(false); return; }
    if (!tipo) { setError("Tipo é obrigatório."); setIsLoading(false); return; }
    if (!descricao.trim()) { setError("Descrição é obrigatória."); setIsLoading(false); return; }
    if (valor === undefined || valor <= 0) { setError("Valor inválido. Deve ser um número positivo."); setIsLoading(false); return; }

    try {
      // O backend de movimentação espera o valor em CENTAVOS
      const payload = {
        tipo,
        descricao: descricao.trim(),
        valor: valor, 
      };

      const result = await movementService.createMovement(payload);
      toast.success(result.message || "Movimentação registrada com sucesso!");
      onSuccess();
      handleClose();

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Erro ao registrar movimentação.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(!isOpen) {
        handleClose();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="relative mx-auto p-6 border dark:border-gray-600 w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
        <button onClick={handleClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-300" aria-label="Fechar modal" disabled={isLoading}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <h3 className="text-xl font-semibold leading-6 mb-4">Registrar Movimentação de Caixa</h3>

        {error && <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/20 border border-red-300 dark:border-red-500/50 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="mov-tipo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
            <select id="mov-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as MovementType)} required disabled={isLoading} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800">
              {movementTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mov-descricao" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
            <input type="text" id="mov-descricao" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} required disabled={isLoading} placeholder="Ex: Pagamento Fornecedor X, Sangria..." className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
          </div>
          <div>
            <label htmlFor="mov-valor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor *</label>
             <NumericFormat
                id="mov-valor"
                value={valor === undefined ? '' : valor}
                onValueChange={handleValueChange}
                thousandSeparator="." decimalSeparator="," prefix="R$ "
                decimalScale={2} fixedDecimalScale allowNegative={false}
                placeholder="R$ 0,00"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800"
                disabled={isLoading}
                required
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={handleClose} disabled={isLoading} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}>
              {isLoading ? 'Registrando...' : 'Registrar Movimentação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MovementFormModal;