import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaServiceCaixa as comandaService, Comanda } from '../services/comandaService';
import { paymentService, Payment, CreateGroupPaymentPayload } from '../services/paymentService';
import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import type { ItemPedido } from '../services/itemPedidoService';
import { printService } from '../services/printService';
import MovementFormModal from '../components/MovementFormModal';
import OpenSessionModal from '../components/OpenSessionModal';
import CloseSessionModal from '../components/CloseSessionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { toast } from 'react-toastify';
import axios from 'axios';
import { FiArrowLeft, FiRefreshCw, FiPrinter } from 'react-icons/fi';

// --- Funções Auxiliares de Formatação ---
const formatCurrency = (value: string | number | null | undefined): string => {
    let numberValue: number;
    if (value === null || value === undefined) return 'R$ -';
    if (typeof value === 'string') {
        const cleanedValue = value.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');
        numberValue = parseFloat(cleanedValue);
    } else {
        numberValue = value;
    }
    if (isNaN(numberValue)) return 'R$ -';
    return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), "dd/MM/yy HH:mm", { locale: ptBR }); }
    catch { return '?'; }
};

const formatQuantity = (value: string | number | null | undefined): string => {
    const n = Number(value);
    if (isNaN(n)) return '-';
    const d = String(n).includes('.') ? 3 : 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: 3 });
};

// [NOVA PARTE] Adicionada esta interface para resolver o erro de build.
// Ela estende a Comanda original e GARANTE que a propriedade 'itens' existe.
interface ComandaComItens extends Comanda {
    itens?: ItemPedido[];
}

// --- Componentes de Renderização Auxiliares (com JSX real) ---
const CashierHeader: React.FC<{ user: any; onLogout: () => void; onToggleDark: () => void; isDark: boolean }> = ({ user, onLogout, onToggleDark, isDark }) => (
    <header className="bg-gray-800 dark:bg-gray-900 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0">
        <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1>
        <div className='text-xs sm:text-sm flex items-center gap-4'>
            <button onClick={onToggleDark} className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 text-xl">
                {isDark ? '☀️' : '🌙'}
            </button>
            <span>Usuário: {user?.nome || 'N/A'}</span>
            <button onClick={onLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Logout</button>
        </div>
    </header>
);

const SessionStatus: React.FC<{ openSession: Session | null | undefined; isLoading: boolean; error: string | null; onOpen: () => void; onClose: () => void; onMove: () => void; isAllowed: boolean }> = ({ openSession, isLoading, error, onOpen, onClose, onMove, isAllowed }) => (
    <div className={`p-4 bg-white dark:bg-gray-900 rounded-lg shadow border-l-4 ${openSession ? 'border-green-500 dark:border-green-400' : 'border-red-500 dark:border-red-400'}`}>
        <div className="flex flex-wrap items-center justify-between gap-y-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 w-full">Status do Caixa</h2>
            <div className='flex-grow text-sm text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-x-4 gap-y-1'>
                {isLoading && openSession === undefined ? ( <p className='italic text-gray-500 dark:text-gray-400'>Verificando...</p> ) : error && !openSession ? ( <p className="text-red-600">{error}</p> ) : openSession ? (
                    <>
                        <p><strong>Status:</strong> <span className="text-green-700 dark:text-green-400 font-medium">Aberto</span> (ID: {openSession.id})</p>
                        <p><strong>Operador:</strong> {openSession.nome_usuario_abertura || '?'}</p>
                        <p><strong>Abertura:</strong> {formatDateTime(openSession.data_abertura)}</p>
                        <p><strong>Valor Inicial:</strong> {formatCurrency(Number(openSession.valor_abertura))}</p>
                    </>
                ) : ( <p className="text-gray-600 dark:text-gray-400">Caixa Fechado</p> )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
                {!isLoading && isAllowed && ( <> {openSession ? ( <> <button onClick={onMove} className="px-3 py-1.5 bg-yellow-500 text-white rounded text-xs shadow hover:bg-yellow-600">Movimentação</button> <button onClick={onClose} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs shadow hover:bg-red-700">Fechar Caixa</button> </> ) : ( !error && <button onClick={onOpen} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs shadow hover:bg-green-700">Abrir Caixa</button> )} </> )}
            </div>
        </div>
    </div>
);

const MonitorView: React.FC<{ comandasList: Comanda[]; isLoading: boolean; error: string | null; onFetch: () => void; onComandaClick: (comanda: Comanda) => void }> = ({ comandasList, isLoading, error, onFetch, onComandaClick }) => (
    <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow h-full">
        <div className='flex justify-between items-center mb-4 gap-4'>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Monitor de Comandas Abertas</h2>
            <button onClick={onFetch} disabled={isLoading} className='px-4 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-blue-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-blue-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1'>{isLoading ? '...' : <><FiRefreshCw size={12}/> Atualizar</>}</button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {isLoading ? ( <p className='text-center italic text-gray-500 dark:text-gray-400 py-4'>Carregando comandas...</p> ) : comandasList.length === 0 ? ( <p className='text-center italic text-gray-500 dark:text-gray-400 py-4'>Nenhuma comanda aberta no momento.</p> ) : (
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr><th className="px-4 py-2">Comanda</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Total</th></tr>
                    </thead>
                    <tbody>
                        {comandasList.map((com) => (
                            <tr key={com.id} onClick={() => onComandaClick(com)} className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-150">
                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{com.numero || com.id}</td>
                                <td className="px-4 py-2">{com.cliente_nome || '-'}</td>
                                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(com.total_atual_calculado)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// --- COMPONENTE PRINCIPAL ---
const CashierMainPage: React.FC = () => {
    // 1. Declaração de estados (useState)
    const { user, logout } = useAuth();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const [viewMode, setViewMode] = useState<'monitor' | 'fechamento'>('monitor');
    const [openComandasList, setOpenComandasList] = useState<Comanda[]>([]);
    const [isLoadingMonitor, setIsLoadingMonitor] = useState<boolean>(true);
    const [monitorError, setMonitorError] = useState<string | null>(null);
    const [selectedComandas, setSelectedComandas] = useState<Comanda[]>([]);
    const [openSession, setOpenSession] = useState<Session | null | undefined>(undefined);
    const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [isLoadingComanda, setIsLoadingComanda] = useState<boolean>(false);
    const [comandaError, setComandaError] = useState<string | null>(null);
    const [groupTotalConsumo, setGroupTotalConsumo] = useState<number>(0);
    const [groupTotalPago, setGroupTotalPago] = useState<number>(0);
    const [groupTotalAPagar, setGroupTotalAPagar] = useState<number>(0);
    const [groupSaldoDevedor, setGroupSaldoDevedor] = useState<number>(0);
    const [comandaItems, setComandaItems] = useState<ItemPedido[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
    const [groupPaymentsList, setGroupPaymentsList] = useState<Payment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoadingPayMethods, setIsLoadingPayMethods] = useState(true);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
    const [paymentValueNum, setPaymentValueNum] = useState<number | undefined>(undefined);
    const [paymentDetails, setPaymentDetails] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [incluirTaxa, setIncluirTaxa] = useState<boolean>(true);
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0);
    const [groupAcrescimos, setGroupAcrescimos] = useState<number>(0);
    const [groupDescontos, setGroupDescontos] = useState<number>(0);
    const [numeroPessoas, setNumeroPessoas] = useState<number>(1);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const initialFetchDoneRef = useRef(false);
    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';
    const addComandaInputRef = useRef<HTMLInputElement>(null);

    // 2. Declaração de Funções (useCallback)
    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    const fetchInitialData = useCallback(async () => {
        setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null);
        try {
            const [s, m] = await Promise.all([sessionService.getLastOpenSession(), paymentMethodService.getAllPaymentMethods({ ativo: true })]);
            setOpenSession(s);
            setPaymentMethods(m || []);
        } catch (err: any) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                setOpenSession(null);
                try {
                    const m = await paymentMethodService.getAllPaymentMethods({ ativo: true });
                    setPaymentMethods(m || []);
                } catch (mErr: any) {
                    setError("Erro ao carregar formas de pagamento.");
                    setPaymentMethods([]);
                }
            } else {
                setError(err.message || "Erro ao carregar dados iniciais.");
                setOpenSession(null);
                setPaymentMethods([]);
            }
        } finally {
            setIsLoadingSession(false);
            setIsLoadingPayMethods(false);
        }
    }, []);

    const fetchOpenComandas = useCallback(async () => {
        setIsLoadingMonitor(true); setMonitorError(null);
        try {
            const cs = await comandaService.getAllComandas({ status: 'aberta' });
            cs.sort((a, b) => (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true }));
            setOpenComandasList(cs);
        } catch (err: any) {
            setMonitorError(err.message);
            setOpenComandasList([]);
        } finally {
            setIsLoadingMonitor(false);
        }
    }, []);

    const fetchComandaDetails = useCallback(async (comandas: Comanda[]) => {
        const comandaIds = comandas.map(c => c.id);
        if (comandaIds.length === 0) {
             setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0); setComandaError(null); setGroupTaxaServico(0); setGroupAcrescimos(0); setGroupDescontos(0); setGroupTotalAPagar(0); setGroupSaldoDevedor(0); setIncluirTaxa(true); setNumeroPessoas(1);
            return;
        }
        setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null);
        try {
            const detailedComandasPromises = comandas.map(comanda => comandaService.getComandaByNumero(comanda.numero || comanda.id.toString()));
            
            // A CORREÇÃO ESTÁ AQUI: Nós aplicamos nosso tipo local `ComandaComItens`
            const detailedComandas: ComandaComItens[] = await Promise.all(detailedComandasPromises);
            
            // Agora o restante do código funciona sem erros
            const allItems = detailedComandas.flatMap(comanda =>
                (comanda.itens || []).map(item => ({
                    ...item,
                    numero_comanda: comanda.numero,
                    cliente_nome_comanda: comanda.cliente_nome
                }))
            );
            
            setComandaItems(allItems);
            const totalConsumo = detailedComandas.reduce((sum, comanda) => sum + Number(comanda.total_atual_calculado || 0), 0);
            setGroupTotalConsumo(totalConsumo);
            
            const paymentPromises = comandaIds.map(id => paymentService.getPaymentsByComandaId(id).catch(() => []));
            const paymentResults = await Promise.all(paymentPromises);
            const allRawPayments: Payment[] = paymentResults.flat();
            setGroupPaymentsList(allRawPayments);
            
            const totalPagoCalc = allRawPayments.reduce((s, p) => s + Number(p.valor || 0), 0);
            setGroupTotalPago(totalPagoCalc);
        } catch (err: any) {
            setComandaError(err.message || "Falha ao carregar detalhes da comanda.");
            setComandaItems([]);
        } finally {
            setIsLoadingItems(false);
            setIsLoadingPayments(false);
        }
    }, []);
    
    const handleRegisterPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedComandas.length || !openSession) return;
        const fId = parseInt(selectedPaymentMethodId);
        const val = paymentValueNum;
        if (isNaN(fId) || fId <= 0 || val === undefined || val <= 0) {
            setComandaError("Verifique a forma de pagamento e o valor.");
            return;
        }
        if (val > groupSaldoDevedor + 0.01) {
            setComandaError(`Valor do pagamento ${formatCurrency(val)} é maior que o saldo devedor ${formatCurrency(groupSaldoDevedor)}.`);
            return;
        }
        setIsProcessingPayment(true);
        setComandaError(null);
        try {
            const payload: CreateGroupPaymentPayload = {
                comandaIds: selectedComandas.map(c => c.id),
                forma_pagamento_id: fId,
                valor: val, // Envia o valor decimal diretamente
                detalhes: paymentDetails.trim() || null
            };
            await paymentService.registerGroupPayment(payload);
            toast.success(`Pagamento de ${formatCurrency(val)} registrado!`);
            setSelectedPaymentMethodId('');
            setPaymentValueNum(undefined);
            setPaymentDetails('');
            await fetchComandaDetails(selectedComandas); // Rebusca os dados para atualizar a tela
        } catch (err: any) {
            setComandaError(err.message);
            toast.error(err.message || "Erro ao registrar pagamento.");
        } finally {
            setIsProcessingPayment(false);
        }
    };
    
    const handleCloseGroupComandas = useCallback(async (automatico = false) => { if(!selectedComandas.length||!openSession||isPrinting) return; if(groupSaldoDevedor > 0.01 && !automatico) { setComandaError(`Saldo pendente: ${formatCurrency(groupSaldoDevedor)}`); toast.warn(`Saldo pendente: ${formatCurrency(groupSaldoDevedor)}`); return; } if(!automatico && !window.confirm(`Tem certeza que deseja finalizar e fechar ${selectedComandas.length} comanda(s)?`)) return; setError(null);setComandaError(null); try { const payload={comandaIds:selectedComandas.map(c=>c.id)}; const r=await comandaService.closeComandaGroup(payload); toast.success(r.message||`${r.affectedRows} comanda(s) fechada(s)!`); setSelectedComandas([]); handleVoltarParaMonitor(); } catch(err:any){ setComandaError(err.message||"Erro ao fechar."); toast.error(err.message || "Erro ao fechar comandas.") } }, [selectedComandas, openSession, isPrinting, groupSaldoDevedor, fetchOpenComandas]);
    const handleAddComanda = async (e?: React.FormEvent) => { if (e) e.preventDefault(); const numeroComandaParaBuscar = searchInputValue.trim(); if (!numeroComandaParaBuscar) return; setIsLoadingComanda(true); setComandaError(null); try { if (selectedComandas.some(c => c.numero === numeroComandaParaBuscar)) throw new Error(`Comanda ${numeroComandaParaBuscar} já está na lista.`); const comandaEncontrada = await comandaService.getComandaByNumero(numeroComandaParaBuscar); if (['fechada','paga','cancelada'].includes(comandaEncontrada.status||'')) throw new Error(`Comanda ${comandaEncontrada.numero} está ${comandaEncontrada.status}.`); if (selectedComandas.some(c=>c.id===comandaEncontrada.id)) throw new Error(`Comanda ID ${comandaEncontrada.id} já está na lista.`); setSelectedComandas(prev=>[...prev,comandaEncontrada]); setSearchInputValue(''); addComandaInputRef.current?.focus(); } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao adicionar comanda."); } finally{ setIsLoadingComanda(false); } };
    const handleRemoveComanda = (comandaId: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== comandaId)); if (comandaError) setComandaError(null); };
    const handleAddComandaPorClique = (comanda: Comanda) => { if (comandaError) setComandaError(null); if (selectedComandas.some(c => c.id === comanda.id)) { toast.info(`Comanda ${comanda.numero || comanda.id} já está na lista de fechamento.`); return; } setSelectedComandas(prev => [...prev, comanda]); };
    const handleTaxaChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ setIncluirTaxa(e.target.checked); };
    const handleAcrescimosValueChange=(v:NumberFormatValues)=>{ setGroupAcrescimos(v.floatValue ?? 0); };
    const handleDescontosValueChange=(v:NumberFormatValues)=>{ setGroupDescontos(v.floatValue ?? 0); };
    const handlePaymentValueChange=(v:NumberFormatValues)=>{ setPaymentValueNum(v.floatValue); };
    const handlePrintConferencia = async (valorIncluirTaxa: boolean) => { if(!selectedComandas.length || isPrinting) return; setIsPrinting(true); setComandaError(null); const payload = { comandaIds: selectedComandas.map(c => c.id), items: comandaItems, totalConsumo: groupTotalConsumo, taxaServico: groupTaxaServico, incluiuTaxa: valorIncluirTaxa, acrescimos: groupAcrescimos, descontos: groupDescontos, totalAPagar: groupTotalAPagar, totalPago: groupTotalPago, saldoDevedor: groupSaldoDevedor, numeroPessoas: numeroPessoas > 1 ? numeroPessoas : undefined, nomeOperadorCaixa: user?.nome || 'N/D' }; try { await printService.printConferencia(payload); toast.success("Impressão de conferência enviada!"); } catch(err: any) { setComandaError(err.message || "Erro ao tentar imprimir conferência."); toast.error(err.message || "Erro ao imprimir."); } finally { setIsPrinting(false); } };
    const handleShowOpenModal=()=>{setError(null);setShowOpenModal(true);};
    const handleShowCloseModal=()=>{setError(null);setShowCloseModal(true);};
    const handleShowMovementModal=()=>{setError(null);setShowMovementModal(true);};
    const handleOpenSuccess=()=>{setShowOpenModal(false);fetchInitialData();fetchOpenComandas();};
    const handleCloseSuccess=()=>{setShowCloseModal(false);fetchInitialData();fetchOpenComandas();};
    const handleMovementSuccess=()=>{setShowMovementModal(false); fetchComandaDetails(selectedComandas);};
    const handleLogout=()=>{logout();};
    const handleIniciarFechamento=()=>{setComandaError(null);setViewMode('fechamento');};
    const handleVoltarParaMonitor=()=>{setViewMode('monitor');fetchOpenComandas();};

    // 3. Hooks de Efeito (useEffect)
    useEffect(() => {
        if (!initialFetchDoneRef.current) {
            fetchInitialData();
            fetchOpenComandas();
            initialFetchDoneRef.current = true;
        }
    }, [fetchInitialData, fetchOpenComandas]);

    useEffect(() => { if (viewMode === 'fechamento' && selectedComandas.length > 0) { fetchComandaDetails(selectedComandas); } if (comandaError && selectedComandas.length > 0) setComandaError(null); }, [viewMode, selectedComandas, fetchComandaDetails, comandaError]);
    useEffect(() => { const t = incluirTaxa ? (groupTotalConsumo * 0.1) : 0; setGroupTaxaServico(t); const total = groupTotalConsumo + t + groupAcrescimos - groupDescontos; setGroupTotalAPagar(total); }, [groupTotalConsumo, incluirTaxa, groupAcrescimos, groupDescontos]);
    useEffect(() => { const s = groupTotalAPagar - groupTotalPago; const f = s < 0.001 && s > -0.001 ? 0 : s; setGroupSaldoDevedor(f); }, [groupTotalAPagar, groupTotalPago]);
    useEffect(() => { if ( viewMode === 'fechamento' && selectedComandas.length > 0 && groupTotalAPagar > 0.01 && groupSaldoDevedor >= -0.01 && groupSaldoDevedor <= 0.01 && !isProcessingPayment && !isPrinting ) { const algumaAberta = selectedComandas.some(c => c.status === 'aberta'); if (algumaAberta) { const timerId = setTimeout(() => { handleCloseGroupComandas(true); }, 200); return () => clearTimeout(timerId); } } }, [groupSaldoDevedor, groupTotalAPagar, selectedComandas, viewMode, isProcessingPayment, isPrinting, handleCloseGroupComandas]);
    useEffect(() => { if (addComandaInputRef.current) { setTimeout(() => { addComandaInputRef.current?.focus(); }, 100); } }, [viewMode]);
    useEffect(() => { const root = window.document.documentElement; const oldTheme = isDarkMode ? 'light' : 'dark'; root.classList.remove(oldTheme); root.classList.add(isDarkMode ? 'dark' : 'light'); localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);
    useEffect(() => { document.title = 'Gerenciar Caixa - eChef Admin'; return () => { document.title = 'eChef Admin'; }; }, []);

    if (openSession === undefined && isLoadingSession) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-800"><div className="text-lg text-gray-500 dark:text-gray-400 italic">Carregando Caixa...</div></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
            <CashierHeader user={user} onLogout={handleLogout} onToggleDark={toggleDarkMode} isDark={isDarkMode} />
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                <SessionStatus openSession={openSession} isLoading={isLoadingSession} error={error} onOpen={handleShowOpenModal} onClose={handleShowCloseModal} onMove={handleShowMovementModal} isAllowed={isCashierAllowed} />
                {!openSession && !isLoadingSession && ( <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-lg shadow mt-6"><h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Caixa Fechado</h2><p className="text-gray-500 dark:text-gray-400 mt-2">Abra o caixa para iniciar as operações.</p></div> )}
                {openSession && viewMode === 'monitor' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <MonitorView comandasList={openComandasList} isLoading={isLoadingMonitor} error={monitorError} onFetch={fetchOpenComandas} onComandaClick={handleAddComandaPorClique} />
                        <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Comandas para Fechamento</h2>
                            <form onSubmit={handleAddComanda} className="flex items-center gap-2 mb-4">
                                <input type="text" ref={addComandaInputRef} value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Adicionar por Número" className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500" />
                                <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-4 py-1.5 border rounded bg-blue-600 text-white text-sm disabled:opacity-50">{isLoadingComanda ? '...' : 'Add'}</button>
                            </form>
                            {comandaError && <p className="mb-2 text-sm text-center text-red-500 bg-red-100 dark:bg-red-900/20 p-2 rounded">{comandaError}</p>}
                            <div className="mt-4 min-h-[200px]">
                                {selectedComandas.length === 0 ? ( <p className='text-center italic text-gray-500 dark:text-gray-400 pt-10'>Selecione comandas na lista à esquerda ou adicione por número.</p> ) : (
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                                        {selectedComandas.map(com => (
                                            <div key={com.id} className="grid grid-cols-12 gap-2 items-center p-2 border dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-sm">
                                                <div className="col-span-2 font-bold text-gray-800 dark:text-gray-100">{com.numero}</div>
                                                <div className="col-span-6 text-gray-600 dark:text-gray-300 truncate">{com.cliente_nome || '-'}</div>
                                                <div className="col-span-3 text-right font-semibold">{formatCurrency(com.total_atual_calculado)}</div>
                                                <div className="col-span-1 text-right"><button onClick={() => handleRemoveComanda(com.id)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedComandas.length > 0 && (
                                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                    <div className="text-right font-bold text-xl mb-6"><span>Total: </span><span>{formatCurrency(selectedComandas.reduce((acc, com) => acc + Number(com.total_atual_calculado || 0), 0))}</span></div>
                                    <button onClick={handleIniciarFechamento} className="w-full px-4 py-3 text-lg font-bold border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all duration-300">Ir para Fechamento &rarr;</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {viewMode === 'fechamento' && openSession && (
                    <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow">
                        <button onClick={handleVoltarParaMonitor} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center gap-1"><FiArrowLeft size={14} /> Voltar para Seleção</button>
                        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Fechamento de Comandas</h2>
                        {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 dark:bg-red-900/20 p-2 rounded-md text-sm">{comandaError}</p>}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
                            <div className="lg:col-span-3 space-y-4">
                                <div className='p-3 border dark:border-gray-700 rounded bg-white dark:bg-gray-900'>
                                    <h4 className="text-base font-semibold mb-2 p-2 border-b dark:border-gray-700">Itens Consumidos</h4>
                                    {isLoadingItems ? (<p className='italic text-xs text-center py-4'>Buscando itens...</p>) : comandaItems.length === 0 ? (<p className='italic text-xs text-center py-4'>Nenhum item encontrado.</p>) : (
                                        <ul className='text-xs space-y-1.5 max-h-[65vh] overflow-y-auto pr-2'>{comandaItems.sort((a,b) => (a.numero_comanda||'').localeCompare(b.numero_comanda||'') || (a.data_hora_pedido||'').localeCompare(b.data_hora_pedido||'') || a.id - b.id).map((item, index, arr) => {
                                            const q = Number(item.quantidade||0), p = Number(item.preco_unitario_momento||0), subtotal=q*p;
                                            const showComandaHeader = selectedComandas.length > 1 && (index === 0 || item.numero_comanda !== arr[index-1].numero_comanda);
                                            return (<React.Fragment key={`item-${item.id}`}>{showComandaHeader && (<li className="pt-2 mt-2 border-t border-dashed border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-2 rounded"><p className="text-sm font-bold text-blue-700 dark:text-blue-400">Comanda: {item.numero_comanda || 'N/D'}</p>{item.cliente_nome_comanda && (<p className="text-xs text-gray-600 dark:text-gray-400">Cliente: {item.cliente_nome_comanda}</p>)}</li>)}<li className='flex justify-between items-start py-1.5 border-b border-gray-100 dark:border-gray-800'><div className="flex-1 mr-2"><span className="font-medium text-gray-800 dark:text-gray-200 leading-tight">{item.produto_nome || '?'}</span>{item.observacao_item && <span className="block italic text-gray-500 dark:text-gray-400 leading-tight">Obs: {item.observacao_item}</span>}<div className="text-[10px] text-gray-500 mt-0.5 leading-none">{item.data_hora_pedido?formatDateTime(item.data_hora_pedido):''}{item.nome_garcom?` - ${item.nome_garcom}`:''}</div></div><div className="text-right flex-shrink-0"><span className="block text-gray-700 dark:text-gray-300 leading-tight">{formatQuantity(q)} x {formatCurrency(p)}</span><span className="block font-semibold text-gray-800 dark:text-gray-200 leading-tight">{formatCurrency(subtotal)}</span></div></li></React.Fragment>);})}</ul>)}
                                </div>
                            </div>
                            <div className="lg:col-span-2 space-y-4">
                                <div className='text-sm border dark:border-gray-700 p-3 rounded bg-gray-50 dark:bg-gray-800 space-y-2'>
                                    <p className='flex justify-between'><span>Consumo:</span><span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span></p>
                                    <div className='flex justify-between items-center'><div className='flex items-center gap-1.5'><input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500"/> <label htmlFor="incluir-taxa">Taxa Serviço (10%):</label></div><span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span></div>
                                    <div className='flex justify-between items-center'><label htmlFor="acrescimos">Acréscimos:</label><NumericFormat id="acrescimos" value={groupAcrescimos} onValueChange={handleAcrescimosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border dark:border-gray-600 rounded sm:text-sm bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                    <div className='flex justify-between items-center'><label htmlFor="descontos">Descontos (-):</label><NumericFormat id="descontos" value={groupDescontos} onValueChange={handleDescontosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border dark:border-gray-600 rounded sm:text-sm bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                    <hr className='my-2 dark:border-gray-700' />
                                    <p className='flex justify-between items-center text-base font-bold'><span>Total a Pagar:</span><span>{formatCurrency(groupTotalAPagar)}</span></p>
                                    {groupTotalAPagar > 0 && numeroPessoas > 1 && (<div className='mt-2 pt-2 border-t dark:border-gray-700 flex justify-end items-center gap-2 text-sm'><span className="font-semibold text-blue-600 dark:text-blue-400"> = {formatCurrency(groupTotalAPagar / numeroPessoas)} / pessoa </span></div>)}
                                    <div className='mt-2 pt-2 border-t dark:border-gray-700 flex justify-end items-center gap-2 text-sm'><label htmlFor="numero-pessoas">Dividir por:</label><input type="number" id="numero-pessoas" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1 border dark:border-gray-600 rounded text-center bg-gray-50 dark:bg-gray-700"/></div>
                                </div>
                                <div className='border dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 overflow-hidden'>
                                    <h4 className="text-sm font-medium p-2 border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-700">Pagamentos Realizados</h4>
                                    <div className='p-2'>
                                        {isLoadingPayments ? (<p className='italic text-xs text-center py-2'>Buscando...</p>) : groupPaymentsList.length === 0 ? (<p className='italic text-xs text-center py-2'>Nenhum pagamento registrado.</p>) : (<ul className='text-xs space-y-1 max-h-28 overflow-y-auto'>{groupPaymentsList.map(p => (<li key={p.id} className='flex justify-between border-b dark:border-gray-700 pb-1'><div><span className='font-medium'>{p.nome_forma_pagamento}</span><span className="block text-gray-600 dark:text-gray-400">{formatDateTime(p.data_hora)}</span>{p.detalhes && <span className="block italic text-gray-600 dark:text-gray-400">D: {p.detalhes}</span>}</div><span className="font-semibold ml-2">{formatCurrency(Number(p.valor))}</span></li>))}</ul>)}
                                    </div>
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 border-t dark:border-gray-600 text-right text-sm font-semibold">Total Pago: {formatCurrency(groupTotalPago)}</div>
                                </div>
                                {openSession && groupSaldoDevedor > 0.01 && (
                                    <div className='mt-3 p-3 border dark:border-gray-700 rounded bg-blue-50 dark:bg-blue-900/20'>
                                        <h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4>
                                        {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>}
                                        <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end">
                                            <div className="col-span-6 sm:col-span-3"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'Cadastre':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                            <div className="col-span-3 sm:col-span-3"><label className="block text-xs mb-0.5">Valor*</label><NumericFormat value={paymentValueNum} onValueChange={handlePaymentValueChange} placeholder="R$ 0,00" disabled={isProcessingPayment} required className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                            <div className="col-span-6"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU, nome no PIX, etc." className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700"/></div>
                                            <div className="col-span-6"><button type="submit" disabled={isProcessingPayment||!openSession||(paymentValueNum ?? 0) <= 0} className="w-full text-sm p-2 border rounded text-white bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">{isProcessingPayment ? 'Processando...' : (paymentValueNum && paymentValueNum > 0) ? `Pagar ${formatCurrency(paymentValueNum)}` : 'Registrar Pagamento'}</button></div>
                                        </form>
                                    </div>
                                )}
                                <div className='flex justify-around items-center gap-4 mt-4'>
                                    <button type="button" onClick={() => handlePrintConferencia(incluirTaxa)} disabled={isPrinting} className="px-4 py-2 text-sm rounded shadow flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"> <FiPrinter size={16}/> Conferência </button>
                                    <button onClick={() => handleCloseGroupComandas()} className={`px-5 py-2 text-white rounded shadow font-bold ${ groupSaldoDevedor > 0.01 || !openSession ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700' }`} disabled={groupSaldoDevedor > 0.01 || !openSession}> {groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar Comanda(s)'} </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <OpenSessionModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} onSuccess={handleOpenSuccess} />
            {openSession && <CloseSessionModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} onSuccess={handleCloseSuccess} sessionToClose={openSession} />}
            {openSession && <MovementFormModal isOpen={showMovementModal} onClose={handleMovementSuccess} onSuccess={handleMovementSuccess} sessionId={openSession.id} />}
        </div>
    );
};

export default CashierMainPage;