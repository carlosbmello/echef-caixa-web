// src/pages/CashierMainPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Adicionado useRef
import { Link } from 'react-router-dom'; // Para uso futuro
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaService, Comanda } from '../services/comandaService';
import { paymentService, Payment } from '../services/paymentService';
import { itemPedidoService, ItemPedido } from '../services/itemPedidoService';
import MovementFormModal from '../components/MovementFormModal';
// Importar os componentes de modal de sessão quando criados
// import OpenSessionModal from '../components/OpenSessionModal';
// import CloseSessionModal from '../components/CloseSessionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Funções Auxiliares de Formatação ---
const formatCurrency = (value: string | number | null | undefined): string => {
    const number = Number(String(value).replace(',','.'));
    if (value === null || value === undefined || isNaN(number)) return 'R$ -';
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR }); }
    catch { return 'Data inválida'; }
};
const formatQuantity = (value: string | number | null | undefined): string => {
    const number = Number(value);
    if (value === null || value === undefined || isNaN(number)) return '-';
    const decimals = number % 1 !== 0 ? 3 : 0;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: 3 });
};
// Interface Mock para ItemPedido (REMOVER QUANDO TIVER O SERVIÇO REAL)
interface ItemPedido { id: number; pedido_id: number; nome_produto: string; quantidade: string | number; preco_unitario_momento: string; observacao_item?: string | null; }
// --- Fim Funções Auxiliares ---

const CashierMainPage: React.FC = () => {
    // --- Estados ---
    const { user, logout } = useAuth();
    const [openSession, setOpenSession] = useState<Session | null | undefined>(undefined); // undefined = não verificado; null = fechado; Session = aberto
    const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
    const initialFetchRef = useRef(false); 
    const [error, setError] = useState<string | null>(null); // Erro geral/sessão/ação
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [selectedComandas, setSelectedComandas] = useState<Comanda[]>([]);
    const [isLoadingComanda, setIsLoadingComanda] = useState<boolean>(false); // Loading busca/add comanda
    const [comandaError, setComandaError] = useState<string | null>(null); // Erro busca/add comanda
    const [groupTotalCalculado, setGroupTotalCalculado] = useState<number>(0);
    const [groupTotalPago, setGroupTotalPago] = useState<number>(0); // << TODO: Buscar e atualizar
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0); // << TODO: Calcular
    const [groupAcrescimos, setGroupAcrescimos] = useState<number>(0);   // << TODO: Input
    const [groupDescontos, setGroupDescontos] = useState<number>(0);    // << TODO: Input
    const [groupTotalAPagar, setGroupTotalAPagar] = useState<number>(0);
    const [groupSaldoDevedor, setGroupSaldoDevedor] = useState<number>(0);
    const [comandaItems, setComandaItems] = useState<ItemPedido[]>([]); // Estado para itens
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false); // Loading itens
    const [groupPaymentsList, setGroupPaymentsList] = useState<Payment[]>([]); // Estado para pagamentos
    const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false); // Loading pagamentos

    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';

    // Ref para controlar busca inicial
    const initialFetchDone = useRef(false);

    // --- Função para buscar Status do Caixa (sem useCallback) ---
    const fetchOpenSessionData = async () => {
        // A verificação de isLoading é feita antes de chamar esta função pelo useEffect inicial
        setIsLoadingSession(true); setError(null);
        console.log("CashierMainPage: Iniciando busca de sessão aberta...");
        try {
            const data = await sessionService.getLastOpenSession();
            setOpenSession(data); // Define null se fechado, ou a sessão se aberta
            console.log("CashierMainPage: Sessão aberta recebida:", data);
        } catch (err: any) {
            console.error("CashierMainPage: Erro ao buscar sessão aberta:", err);
            setError(err.message || "Falha ao verificar status do caixa.");
            setOpenSession(null); // Garante null em caso de erro
        } finally {
            setIsLoadingSession(false); // Desativa loading da busca
            console.log("CashierMainPage: Busca de sessão finalizada.");
        }
    };

    // --- Efeito para buscar status ao montar (COM useRef) ---
    useEffect(() => {
        // Roda SOMENTE SE a busca inicial ainda não foi feita
        if (!initialFetchRef.current) {
            console.log("CashierMainPage: useEffect [] - Busca inicial disparada.");
            fetchOpenSessionData(); // Chama a busca
            initialFetchRef.current = true; // Marca que a busca foi feita
        } else {
            console.log("CashierMainPage: useEffect [] - Busca inicial já feita, pulando.");
        }
    // Array vazio garante que o EFEITO roda só uma vez, o ref controla a BUSCA
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // --- Função para buscar detalhes (itens E pagamentos) de UMA comanda ---
    const fetchSingleComandaDetails = async (comandaId: number) => {
        if (!comandaId) return;
        setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null);
        console.log(`Buscando detalhes (itens/pagamentos) para comanda ID: ${comandaId}`);
        try {
            const [itemsData, paymentsData] = await Promise.all([
                 itemPedidoService.getItemsByComandaId(comandaId).catch(err => { console.error("Erro itens:", err.message); setError(prev => prev ? `${prev}\nFalha itens.` : 'Falha itens.'); return []; }),
                 paymentService.getPaymentsByComandaId(comandaId).catch(err => { console.error("Erro pagamentos:", err.message); setError(prev => prev ? `${prev}\nFalha pagamentos.` : 'Falha pagamentos.'); return []; })
             ]);
            setComandaItems(itemsData || []);
            setGroupPaymentsList(paymentsData || []);
            const totalPagoCalc = (paymentsData || []).reduce((sum, p) => sum + parseFloat(p.valor || '0'), 0);
            setGroupTotalPago(totalPagoCalc);
        } catch (err: any) { console.error("Erro detalhes:", err); setComandaError(err.message); setComandaItems([]); setGroupPaymentsList([]); setGroupTotalPago(0); }
        finally { setIsLoadingItems(false); setIsLoadingPayments(false); }
    };

    // --- Função para buscar pagamentos de MÚLTIPLAS comandas ---
    const fetchAllGroupPayments = async (comandaIds: number[]) => {
         setIsLoadingPayments(true); setComandaError(null);
         console.log("Buscando pagamentos para comandas:", comandaIds);
         try {
            const paymentPromises = comandaIds.map(id => paymentService.getPaymentsByComandaId(id).catch(err => { console.error(`Erro pagtos comanda ${id}:`, err); return []; }));
            const results = await Promise.all(paymentPromises);
            const allPayments = results.flat();
            setGroupPaymentsList(allPayments);
            const totalPagoCalc = allPayments.reduce((sum, p) => sum + parseFloat(p.valor || '0'), 0);
            setGroupTotalPago(totalPagoCalc);
         } catch (err: any) { console.error("Erro pagtos grupo:", err); setComandaError(err.message); setGroupPaymentsList([]); setGroupTotalPago(0); }
         finally { setIsLoadingPayments(false); }
     };

    // --- useEffect para Recalcular Totais e Buscar Detalhes ---
    useEffect(() => {
        console.log("Effect: selectedComandas mudou:", selectedComandas.map(c => c.id));
        const totalConsumo = selectedComandas.reduce((sum, c) => sum + (Number(c.total_atual_calculado) || 0), 0);
        const taxa = totalConsumo * 0.10; // TODO: Opcional
        const acrescimos = groupAcrescimos; const descontos = groupDescontos;
        const totalAPagar = totalConsumo + taxa + acrescimos - descontos;
        setGroupTotalCalculado(totalConsumo); setGroupTaxaServico(taxa); setGroupTotalAPagar(totalAPagar);
        setComandaItems([]); setGroupPaymentsList([]); setGroupTotalPago(0); // Limpa detalhes

        const comandaIds = selectedComandas.map(c => c.id);
        if (comandaIds.length === 1) { fetchSingleComandaDetails(comandaIds[0]); }
        else if (comandaIds.length > 1) { fetchAllGroupPayments(comandaIds); setIsLoadingItems(false); }
        else { setIsLoadingItems(false); setIsLoadingPayments(false); setGroupSaldoDevedor(0); }
    }, [selectedComandas, groupAcrescimos, groupDescontos]); // Dependências corretas

    // --- useEffect que recalcula Saldo Devedor ---
    useEffect(() => {
        const saldo = groupTotalAPagar - groupTotalPago;
        setGroupSaldoDevedor(saldo);
        console.log("Saldo Devedor recalculado:", saldo);
    }, [groupTotalAPagar, groupTotalPago]);


    // --- Handlers ---
    const handleAddComanda = async (e?: React.FormEvent) => {
         if (e) e.preventDefault(); const identifier = searchInputValue.trim(); if (!identifier) return;
         if (selectedComandas.some(c => String(c.id) === identifier || c.numero === identifier)) { setComandaError(`Comanda '${identifier}' já está no grupo.`); return; }
         setIsLoadingComanda(true); setComandaError(null);
         try {
             const comandaData = await comandaService.getComandaByIdentifier(identifier);
              if (selectedComandas.some(c => c.id === comandaData.id)) { throw new Error(`Comanda já adicionada.`); }
              const comandaWithType = { ...comandaData, total_atual_calculado: Number(comandaData.total_atual_calculado) || 0 };
             setSelectedComandas(prev => [...prev, comandaWithType]); setSearchInputValue('');
         } catch (err: any) { setComandaError(err.message); } finally { setIsLoadingComanda(false); }
     };
    const handleRemoveComanda = (comandaIdToRemove: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== comandaIdToRemove)); };
    const handleShowOpenModal = () => { setError(null); setShowOpenModal(true); };
    const handleShowCloseModal = () => { setError(null); setShowCloseModal(true); };
    const handleShowMovementModal = () => { setError(null); setShowMovementModal(true); };
    // Handlers de Sucesso dos Modais (chamam fetchOpenSessionData)
    const handleOpenSuccess = () => { setShowOpenModal(false); fetchOpenSessionData(); };
    const handleCloseSuccess = () => { setShowCloseModal(false); fetchOpenSessionData(); };
    const handleMovementSuccess = () => { setShowMovementModal(false); fetchOpenSessionData();}; // Atualiza status/histórico
    const handleLogout = () => { logout(); };


    // --- Renderização ---
    console.log("CashierMainPage: Renderizando...", { isLoadingSession, error, hasOpenSession: openSession !== undefined && openSession !== null });

    // Mostra loading inicial apenas se openSession ainda for undefined
    if (openSession === undefined) {
        return <div className="p-6 text-center italic text-gray-500">Carregando aplicação do caixa...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gray-800 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1>
                <div className='text-xs sm:text-sm flex items-center'>
                    <span>Usuário: {user?.nome || 'N/A'}</span>
                    <button onClick={handleLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"> Logout </button>
                </div>
            </header>

            {/* Conteúdo Principal */}
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                {/* Card Status Caixa */}
                 <div className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
                     <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className='flex-grow'>
                            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">Status do Caixa</h2>
                             {isLoadingSession ? (<p className='italic text-gray-500 text-sm'>Verificando...</p>)
                             : error ? (<p className="text-red-600 text-sm">{error}</p>)
                             : openSession ? ( <p className="text-green-700 text-sm"> Caixa Aberto (ID: {openSession.id}) por <span className='font-medium'>{openSession.nome_usuario_abertura || '?'}</span> <span className='text-xs'>({formatDateTime(openSession.data_abertura)})</span> - Vlr. Inicial: <span className='font-medium'>{formatCurrency(openSession.valor_abertura)}</span> </p> )
                             : ( <p className="text-gray-600 text-sm">Caixa Fechado</p> )}
                         </div>
                         <div className="flex gap-3 flex-shrink-0">
                            {/* Botões só aparecem se não estiver carregando status E tiver permissão */}
                             {!isLoadingSession && isCashierAllowed && ( <>
                                {!openSession && ( <button onClick={handleShowOpenModal} className="px-4 py-2 text-sm bg-blue-600 text-white rounded shadow hover:bg-blue-700">Abrir Caixa</button> )}
                                {openSession && ( <button onClick={handleShowMovementModal} className="px-4 py-2 text-sm bg-yellow-500 text-white rounded shadow hover:bg-yellow-600">Movimentação</button> )}
                                {openSession && ( <button onClick={handleShowCloseModal} className="px-4 py-2 text-sm bg-orange-600 text-white rounded shadow hover:bg-orange-700">Fechar Caixa (ID: {openSession.id})</button> )}
                            </>)}
                         </div>
                    </div>
                    {/* Mostra erro geral/sessão se houver */}
                    {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                </div>

                {/* Card Operação de Caixa */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Operação de Caixa</h2>
                     {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 p-3 rounded-md">{comandaError}</p>}
                    {/* Formulário de Busca/Adição */}
                    <form onSubmit={handleAddComanda} className="flex items-center gap-3 mb-4 pb-4 border-b">
                         <label htmlFor="comanda-search" className="text-sm font-medium text-gray-700 whitespace-nowrap">Comanda:</label>
                         <input type="text" id="comanda-search" value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Número da Comanda" className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"/>
                         <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className={`px-5 py-2 text-sm text-white rounded-md shadow transition duration-150 ${isLoadingComanda || !searchInputValue.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}> {isLoadingComanda ? '+' : '+ Adicionar'} </button>
                    </form>

                    {/* Lista de Comandas Selecionadas */}
                    {selectedComandas.length > 0 && ( <div className="mb-6 border rounded-lg p-3 bg-gray-50"> <h3 className="text-base font-semibold mb-2 text-gray-600">Comandas no Fechamento:</h3> <ul className="space-y-1 max-h-32 overflow-y-auto">{selectedComandas.map(c => ( <li key={c.id} className="flex justify-between items-center text-sm border-b pb-1 last:border-b-0"> <span>C:{c.numero} (ID:{c.id}) - {formatCurrency(c.total_atual_calculado)}</span> <button onClick={() => handleRemoveComanda(c.id)} className="text-red-500 hover:text-red-700 text-xs ml-2" title="Remover">X</button> </li> ))}</ul> </div> )}

                    {/* --- Área de Totais e Detalhes --- */}
                    {selectedComandas.length > 0 && (
                         <div className="mt-6 pt-6 border-t space-y-4">
                             {/* Totais Calculados */}
                              <div className='text-right space-y-1 text-sm mb-4'> <p>Total Consumo: <span className='font-medium'>{formatCurrency(groupTotalCalculado)}</span></p> <p>Taxa Serviço (10%): <span className='font-medium'>{formatCurrency(groupTaxaServico)}</span></p> <p>Acréscimos: <span className='font-medium text-blue-600'>{formatCurrency(groupAcrescimos)}</span></p> <p>Descontos: <span className='font-medium text-red-600'>{formatCurrency(groupDescontos)}</span></p> <p className='text-lg font-bold border-t pt-1 mt-1'>Total a Pagar: {formatCurrency(groupTotalAPagar)}</p> </div>
                            {/* Lista de Itens (Só se 1 comanda) */}
                             {selectedComandas.length === 1 && ( <div className='mt-4 p-3 border rounded bg-gray-50'> <h4 className="text-md font-semibold mb-2 text-gray-700">Itens da Comanda {selectedComandas[0].numero}</h4> {isLoadingItems ? <p className='italic text-sm text-center'>Buscando...</p> : comandaItems.length === 0 ? <p className='italic text-sm text-center'>Nenhum item.</p> : <ul className='text-xs space-y-1'>{comandaItems.map(item => ( <li key={item.id} className='border-b last:border-b-0 pb-1'><span>{formatQuantity(item.quantidade)} {item.nome_produto} ({formatCurrency(item.preco_unitario_momento)} un.)</span>{item.observacao_item && <p className='text-gray-500 text-xs ml-2 mt-0.5'>Obs: {item.observacao_item}</p>}</li> ))}</ul> } </div> )}
                             {selectedComandas.length > 1 && ( <div className='mt-4 p-3 border rounded bg-yellow-100'><p className="text-center text-yellow-700 text-sm italic">Detalhes de itens não disponíveis para múltiplas comandas.</p></div> )}
                            {/* Lista de Pagamentos */}
                             <div className='mt-4 border rounded bg-gray-50 overflow-hidden'> <h4 className="text-md font-semibold p-3 bg-gray-100 border-b text-gray-700">Pagamentos Efetuados</h4> <div className='p-3'>{isLoadingPayments ? <p className='italic text-sm text-center'>Buscando...</p> : groupPaymentsList.length === 0 ? <p className='italic text-sm text-center'>Nenhum pagamento.</p> : <ul className='text-xs space-y-1'>{groupPaymentsList.map(p => ( <li key={p.id} className='flex justify-between border-b last:border-b-0 py-1'><span> {formatDateTime(p.data_hora)} - {p.nome_forma_pagamento} {selectedComandas.length > 1 && `(C:${p.numero_comanda})`} {p.detalhes && <span className='text-gray-500 text-xs block ml-2'> {p.detalhes}</span>} </span><span className='font-medium'>{formatCurrency(p.valor)}</span></li> ))}</ul>}</div> <div className="p-2 bg-gray-100 border-t text-right font-semibold text-sm"> Total Pago: {formatCurrency(groupTotalPago)} </div> </div>
                             {/* Área Registrar Pagamento */}
                              <div className='mt-4 p-4 border rounded bg-blue-50'> <h4 className="text-md font-semibold mb-3 text-center">Registrar Pagamento</h4> <p className="text-center text-gray-700 italic text-sm">Área de Registro (Implementar)...</p> <p className='text-center text-lg font-bold mt-2'>Saldo Devedor: {formatCurrency(groupSaldoDevedor)}</p> </div>
                              {/* Botão Fechar Comandas */}
                              <div className='text-center mt-6'> <button className={`px-6 py-3 text-white rounded-lg shadow transition-colors duration-150 ${groupSaldoDevedor > 0.001 ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`} disabled={groupSaldoDevedor > 0.001}> {groupSaldoDevedor > 0.001 ? `Falta Pagar ${formatCurrency(groupSaldoDevedor)}` : 'Fechar Comandas'} </button> </div>
                         </div>
                    )}
                    {/* Mensagem se nenhuma comanda */}
                     {selectedComandas.length === 0 && !isLoadingComanda && !comandaError && ( <p className="text-center text-gray-500 italic mt-6">Adicione uma ou mais comandas para iniciar o fechamento.</p> )}
                 </div>
            </main>

            {/* --- Modais --- */}
            {/* TODO: Substituir placeholders por componentes reais OpenSessionModal e CloseSessionModal */}
            {showOpenModal && <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"><div className="bg-white p-6 rounded shadow-lg">Placeholder Modal Abrir Caixa<button onClick={() => setShowOpenModal(false)} className="ml-4 bg-red-500 text-white p-1">X</button></div></div>}
            {showCloseModal && openSession && <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"><div className="bg-white p-6 rounded shadow-lg">Placeholder Modal Fechar Caixa (ID: {openSession.id})<button onClick={() => setShowCloseModal(false)} className="ml-4 bg-red-500 text-white p-1">X</button></div></div>}
            <MovementFormModal isOpen={showMovementModal} onClose={() => { setShowMovementModal(false); setError(null); }} onSuccess={handleMovementSuccess} />

        </div>
    );
};

export default CashierMainPage;

// --- Funções de formatação ---
// const formatCurrency = ...
// const formatDateTime = ...
// const formatQuantity = ...