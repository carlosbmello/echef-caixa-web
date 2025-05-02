// src/pages/CashierMainPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // <-- Adicionado useRef
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaService, Comanda } from '../services/comandaService';
import { paymentService, Payment } from '../services/paymentService';
import MovementFormModal from '../components/MovementFormModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Funções Auxiliares (como antes)
const formatCurrency = (value) => { /* ... */ };
const formatDateTime = (dateString) => { /* ... */ };
const formatQuantity = (value) => { /* ... */ };
interface ItemPedido { /* ... */ } // Mock

const CashierMainPage: React.FC = () => {
    // --- Estados (como antes) ---
    const { user, logout } = useAuth();
    const [openSession, setOpenSession] = useState<Session | null | undefined>(undefined);
    const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true); // Inicia true
    const [error, setError] = useState<string | null>(null);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [selectedComandas, setSelectedComandas] = useState<Comanda[]>([]);
    const [isLoadingComanda, setIsLoadingComanda] = useState<boolean>(false);
    const [comandaError, setComandaError] = useState<string | null>(null);
    const [groupTotalCalculado, setGroupTotalCalculado] = useState<number>(0);
    const [groupTotalPago, setGroupTotalPago] = useState<number>(0);
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0);
    const [groupAcrescimos, setGroupAcrescimos] = useState<number>(0);
    const [groupDescontos, setGroupDescontos] = useState<number>(0);
    const [groupTotalAPagar, setGroupTotalAPagar] = useState<number>(0);
    const [groupSaldoDevedor, setGroupSaldoDevedor] = useState<number>(0);
    const [comandaItems, setComandaItems] = useState<ItemPedido[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
    const [groupPaymentsList, setGroupPaymentsList] = useState<Payment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);

    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';

    // --- Ref para controlar busca inicial ---
    const initialFetchDone = useRef(false); // Começa como false

    // --- Função para buscar Status do Caixa (sem useCallback) ---
    const fetchOpenSessionData = async () => {
        // Não precisa mais do if(isLoading) aqui
        setIsLoadingSession(true); setError(null);
        console.log("CashierMainPage: Iniciando busca de sessão aberta...");
        try {
            const data = await sessionService.getLastOpenSession();
            setOpenSession(data);
        } catch (err: any) { setError(err.message); setOpenSession(null); }
        finally { setIsLoadingSession(false); console.log("CashierMainPage: Busca de sessão finalizada.");}
    };

    // --- Efeito para buscar dados ao montar (COM useRef) ---
    useEffect(() => {
        // Roda SOMENTE SE a busca inicial ainda não foi feita
        if (!initialFetchDone.current) {
            console.log("CashierMainPage: useEffect [] - Busca inicial disparada.");
            fetchOpenSessionData(); // Chama a busca
            initialFetchDone.current = true; // Marca que a busca inicial foi feita
        } else {
            console.log("CashierMainPage: useEffect [] - Busca inicial já feita, pulando.");
        }
    // Array vazio para rodar teoricamente só uma vez, mas o ref controla a execução da busca
    }, []);


    // --- Funções de busca de detalhes (como antes) ---
    const fetchSingleComandaDetails = async (comandaId: number) => { /* ... */ };
    const fetchAllGroupPayments = async (comandaIds: number[]) => { /* ... */ };

    // --- useEffect para Recalcular Totais (como antes) ---
    useEffect(() => { /* ... */ }, [selectedComandas, groupAcrescimos, groupDescontos]);

    // --- useEffect que recalcula Saldo Devedor (como antes) ---
    useEffect(() => { /* ... */ }, [groupTotalAPagar, groupTotalPago]);

    // --- Handlers (como antes, MAS chamam fetchOpenSessionData DIRETO) ---
    const handleAddComanda = async (e?: React.FormEvent) => { /* ... */ };
    const handleRemoveComanda = (comandaIdToRemove: number) => { /* ... */ };
    const handleShowOpenModal = () => { /* ... */ };
    const handleShowCloseModal = () => { /* ... */ };
    const handleShowMovementModal = () => { /* ... */ };
    // Modificar handlers de sucesso para chamar fetchOpenSessionData diretamente
    const handleOpenSuccess = () => { setShowOpenModal(false); fetchOpenSessionData(); };
    const handleCloseSuccess = () => { setShowCloseModal(false); fetchOpenSessionData(); };
    const handleMovementSuccess = () => { setShowMovementModal(false); fetchOpenSessionData(); }; // Recarrega após movimento
    const handleLogout = () => { logout(); };


    // --- Renderização ---
    console.log("CashierMainPage: Renderizando...", { isLoadingSession, error, hasOpenSession: openSession !== undefined && openSession !== null });

    // Usa openSession === undefined para o estado inicial de carregamento da aplicação
    if (openSession === undefined) {
        return <div className="p-6 text-center italic">Carregando aplicação do caixa...</div>;
    }

    // Renderiza o restante da página normalmente, usando openSession (que agora é null ou objeto Session)
    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gray-800 ..."> {/* ... */} </header>

            {/* Conteúdo Principal */}
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                {/* Card Status Caixa */}
                 <div className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
                     <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className='flex-grow'>
                            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">Status do Caixa</h2>
                            {/* Mostra erro se falhou na busca inicial */}
                            {error && <p className="text-red-600 text-sm">{error}</p>}
                            {/* Mostra status baseado em openSession (null ou objeto) */}
                            {!error && openSession ? ( <p className="text-green-700 text-sm"> Caixa Aberto (ID: {openSession.id}) por <span className='font-medium'>{openSession.nome_usuario_abertura || '?'}</span> <span className='text-xs'>({formatDateTime(openSession.data_abertura)})</span> - Vlr. Inicial: <span className='font-medium'>{formatCurrency(openSession.valor_abertura)}</span> </p>)
                            : !error && (<p className="text-gray-600 text-sm">Caixa Fechado</p>)}
                        </div>
                         <div className="flex gap-3 flex-shrink-0">
                            {/* Botões baseados em openSession e permissão */}
                             {!error && isCashierAllowed && ( <>
                                {!openSession && ( <button onClick={handleShowOpenModal} className="...">Abrir Caixa</button> )}
                                {openSession && ( <button onClick={handleShowMovementModal} className="...">Movimentação</button> )}
                                {openSession && ( <button onClick={handleShowCloseModal} className="...">Fechar Caixa (ID: {openSession.id})</button> )}
                            </>)}
                         </div>
                    </div>
                </div>

                 {/* Card Operação de Caixa */}
                <div className="bg-white p-6 rounded-lg shadow">
                    {/* ... Formulário Busca/Add Comanda ... */}
                    {/* ... Lista Comandas Selecionadas ... */}
                    {/* ... Área Totais e Detalhes ... */}
                </div>

            </main>

            {/* --- Modais --- */}
             {/* ... */}
        </div>
    );
};

export default CashierMainPage;
// Funções de formatação
// const formatCurrency = ...
// const formatDateTime = ...
// const formatQuantity = ...