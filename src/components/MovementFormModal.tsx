// src/components/MovementFormModal.tsx
import React, { useState } from 'react';
import { movementService } from '../services/movementService'; // Importa o serviço

// Tipos permitidos para movimentação
type MovementType = 'entrada' | 'saida' | 'despesa';

// Props que o modal receberá
interface MovementFormModalProps {
  isOpen: boolean; // Controla se o modal está visível
  onClose: () => void; // Função para fechar o modal
  onSuccess: () => void; // Função a ser chamada após sucesso (ex: para recarregar dados)
  sessionId: number | null;
}

const MovementFormModal: React.FC<MovementFormModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Estados internos do formulário
  const [tipo, setTipo] = useState<MovementType>('saida'); // Padrão 'saida' (mais comum?)
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(''); // Input como string
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Tipos para o select
  const movementTypes: { value: MovementType; label: string }[] = [
    { value: 'saida', label: 'Saída (Pagamento/Sangria)' },
    { value: 'despesa', label: 'Despesa (Compra)' },
    { value: 'entrada', label: 'Entrada (Reforço/Outro)' },
  ];

  // Handler de submissão
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const valorNum = parseFloat(valor.replace(',', '.'));

    // Validações
    if (!tipo) { setError("Tipo é obrigatório."); setIsLoading(false); return; }
    if (!descricao.trim()) { setError("Descrição é obrigatória."); setIsLoading(false); return; }
    if (isNaN(valorNum) || valorNum <= 0) { setError("Valor inválido. Deve ser um número positivo."); setIsLoading(false); return; }

    try {
      const payload = {
        tipo,
        descricao: descricao.trim(),
        valor: valorNum,
      };
      console.log("MovementFormModal: Enviando payload:", payload);
      const result = await movementService.createMovement(payload);
      console.log("MovementFormModal: Resposta:", result);
      alert(result.message); // Feedback simples
      onSuccess(); // Chama a função de sucesso (ex: recarregar dados da página pai)
      handleClose(); // Fecha o modal
    } catch (err: any) {
      console.error("MovementFormModal: Erro ao registrar:", err);
      setError(err.message || "Erro ao registrar movimentação.");
    } finally {
      setIsLoading(false);
    }
  };

  // Função para fechar e resetar o modal
  const handleClose = () => {
    setTipo('saida');
    setDescricao('');
    setValor('');
    setError(null);
    setIsLoading(false);
    onClose(); // Chama a função passada por props para fechar
  };

  // Não renderiza nada se não estiver aberto
  if (!isOpen) {
    return null;
  }

  // Renderização do Modal
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-50 px-4">
      {/* Conteúdo do Modal */}
      <div className="relative mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
        {/* Botão de Fechar (X) */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          aria-label="Fechar modal"
          disabled={isLoading}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <h3 className="text-xl font-semibold leading-6 text-gray-900 mb-4">Registrar Movimentação de Caixa</h3>

        {/* Mensagem de Erro */}
        {error && <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded">{error}</div>}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <label htmlFor="mov-tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              id="mov-tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as MovementType)}
              required
              disabled={isLoading}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            >
              {movementTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="mov-descricao" className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input
              type="text"
              id="mov-descricao"
              name="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Ex: Pagamento Fornecedor X, Sangria, Reforço"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>

          {/* Valor */}
          <div>
            <label htmlFor="mov-valor" className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">R$</span></div>
              <input
                  type="text"
                  inputMode='decimal'
                  name="valor"
                  id="mov-valor"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  disabled={isLoading}
                  placeholder="0,00"
                  className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Botões de Ação do Modal */}
          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose} // Chama handleClose para resetar e fechar
              disabled={isLoading}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
            >
              {isLoading ? 'Registrando...' : 'Registrar Movimentação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MovementFormModal;