import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaServiceCaixa as comandaService, Comanda } from '../services/comandaService';
import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import { transacaoService, FinalizarTransacaoPayload } from '../services/transacaoService';
import { printService } from '../services/printService';
import type { ItemPedido } from '../services/itemPedidoService';
import MovementFormModal from '../components/MovementFormModal';
import OpenSessionModal from '../components/OpenSessionModal';
import CloseSessionModal from '../components/CloseSessionModal';
import ConsultaComandaModal from '../components/ConsultaComandaModal';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { toast } from 'react-toastify';
import axios from 'axios';
import { FiArrowLeft, FiRefreshCw, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/formatters';

// --- INTERFACES ---
interface ComandaComItens extends Comanda {
    itens?: ItemPedido[];
}

interface UIPayment {
  id: number;
  valor: string;
  data_hora: string;
  nome_forma_pagamento: string;
  detalhes: string | null;
}

interface PrintError {
    id: number;
    jobType: string;
    mensagem_erro: string;
    updated_at: string;
}

// --- SUB-COMPONENTE: CABEÇALHO ---
const CashierHeader: React.FC<{ 
    user: any; 
    onLogout: () => void; 
    onToggleDark: () => void; 
    isDark: boolean;
    errorCount: number;
    onOpenErrors: () => void;
}> = ({ user, onLogout, onToggleDark, isDark, errorCount, onOpenErrors }) => (
    <header className="bg-gray-800 dark:bg-gray-900 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0">
        <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1>
        <div className="flex items-center gap-4">
            {errorCount > 0 && (
                <button 
                    onClick={onOpenErrors}
                    className="flex items-center gap-2 bg-red-600 animate-pulse px-3 py-1 rounded-full text-xs font-bold hover:bg-red-700 transition-colors shadow-lg"
                    title="Existem erros de impressão pendentes"
                >
                    <FiPrinter /> {errorCount} ERRO{errorCount > 1 ? 'S' : ''}
                </button>
            )}
            <button onClick={onToggleDark} className="p-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 text-xl">
                {isDark ? '☀️' : '🌙'}
            </button>
            <span className="text-xs sm:text-sm">Usuário: {user?.nome || 'N/A'}</span>
            <button onClick={onLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Logout</button>
        </div>
    </header>
);

// --- SUB-COMPONENTE: MODAL DE ERROS DE IMPRESSÃO ---
const PrintErrorsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    errors: PrintError[]; 
    onRetry: (id: number) => void;
}> = ({ isOpen, onClose, errors, onRetry }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-red-200 dark:border-red-900/30">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/10">
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <FiPrinter /> Falhas de Impressão na Cozinha/Bar
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 font-bold text-xl">✕</button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-950">
                    {errors.length === 0 ? (
                        <p className="text-center text-gray-500 py-10 italic">Nenhum erro pendente no momento.</p>
                    ) : (
                        <div className="space-y-3">
                            {errors.map((error) => (
                                <div key={error.id} className="p-4 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 flex justify-between items-center gap-4 shadow-sm border-l-4 border-l-red-500">
                                    <div className="flex-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-800 dark:text-gray-100 uppercase text-xs">Tipo: {error.jobType}</span>
                                            <span className="text-[10px] text-gray-400">{formatDateTime(error.updated_at)}</span>
                                        </div>
                                        <p className="text-red-600 dark:text-red-400 font-medium mt-1 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                            {error.mensagem_erro}
                                        </p>
                                    </div>
                                    <button onClick={() => onRetry(error.id)} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-2 flex-shrink-0 shadow transition-transform active:scale-95">
                                        <FiRefreshCw size={14} /> Reimprimir
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t dark:border-gray-700 text-right bg-white dark:bg-gray-900">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-sm font-bold hover:bg-gray-300 transition-colors">Fechar</button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTE: STATUS DA SESSÃO ---
const SessionStatus: React.FC<{ 
    openSession: Session | null | undefined; 
    isLoading: boolean; 
    error: string | null; 
    onOpen: () => void; 
    onClose: () => void; 
    onMove: () => void; 
    onConsult: () => void;
    isAllowed: boolean 
}> = ({ openSession, isLoading, error, onOpen, onClose, onMove, onConsult, isAllowed }) => (
    <div className={`px-4 py-2 bg-white dark:bg-gray-900 rounded-lg shadow border-l-4 ${openSession ? 'border-green-500' : 'border-red-500'} mb-4 transition-all`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className='flex-grow text-sm text-gray-700 dark:text-gray-200 flex flex-wrap items-center gap-x-4'>
                {isLoading && openSession === undefined ? (
                    <span className='italic text-gray-500'>Verificando status...</span>
                ) : error && !openSession ? (
                    <span className="text-red-600 font-bold">{error}</span>
                ) : openSession ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="font-bold text-green-700 dark:text-green-400 uppercase">Aberto</span>
                            <span className="text-xs text-gray-400">#{openSession.id}</span>
                        </div>
                        <span className="hidden sm:inline text-gray-300">|</span>
                        <span>Op: <strong>{openSession.nome_usuario_abertura}</strong></span>
                        <span className="hidden sm:inline text-gray-300">|</span>
                        <span>{formatDateTime(openSession.data_abertura)}</span>
                        <span className="hidden sm:inline text-gray-300">|</span>
                        <span>Ini: <strong>{formatCurrency(Number(openSession.valor_abertura))}</strong></span>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span className="font-bold text-gray-500 uppercase">Caixa Fechado</span>
                    </div>
                )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
                {!isLoading && isAllowed && (
                    <>
                        {openSession ? (
                            <>
                                <button onClick={onConsult} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300">Consultar</button>
                                <button onClick={onMove} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-semibold hover:bg-yellow-600">Movimentação</button>
                                <button onClick={onClose} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700">Fechar Caixa</button>
                            </>
                        ) : (
                            !error && <button onClick={onOpen} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm font-bold shadow hover:bg-green-700">Abrir Caixa</button>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
);

const MonitorView: React.FC<{ comandasList: Comanda[]; isLoading: boolean; error: string | null; onFetch: () => void; onComandaClick: (comanda: Comanda) => void }> = ({ comandasList, isLoading, error, onFetch, onComandaClick }) => (
    <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow h-full">
        <div className='flex justify-between items-center mb-4 gap-4'>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Monitor de Comandas Abertas</h2>
            <button onClick={onFetch} disabled={isLoading} className='px-4 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-blue-100 dark:bg-gray-700 hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1'>
                {isLoading ? '...' : <><FiRefreshCw size={12}/> Atualizar</>}
            </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {isLoading ? ( <p className='text-center italic text-gray-500 py-4'>Carregando...</p> ) : (
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
    const [printErrors, setPrintErrors] = useState<PrintError[]>([]);
    const [showPrintErrorsModal, setShowPrintErrorsModal] = useState(false);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [showConsultaModal, setShowConsultaModal] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [isLoadingComanda, setIsLoadingComanda] = useState<boolean>(false);
    const [comandaError, setComandaError] = useState<string | null>(null);
    const [groupTotalConsumo, setGroupTotalConsumo] = useState<number>(0);
    const [groupTotalPago, setGroupTotalPago] = useState<number>(0);
    const [groupTotalAPagar, setGroupTotalAPagar] = useState<number>(0);
    const [groupSaldoDevedor, setGroupSaldoDevedor] = useState<number>(0);
    const [comandaItems, setComandaItems] = useState<ItemPedido[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
    const [groupPaymentsList, setGroupPaymentsList] = useState<UIPayment[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoadingPayMethods, setIsLoadingPayMethods] = useState(true);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
    const [paymentDetails, setPaymentDetails] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [incluirTaxa, setIncluirTaxa] = useState<boolean>(true);
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0);
    const [numeroPessoas, setNumeroPessoas] = useState<number>(1);
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    const [paymentValueCents, setPaymentValueCents] = useState<number | null>(null);
    const [groupAcrescimosCents, setGroupAcrescimosCents] = useState(0);
    const [groupDescontosCents, setGroupDescontosCents] = useState(0);
    const [paymentInputKey, setPaymentInputKey] = useState(Date.now());
    const initialFetchDoneRef = useRef(false);
    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';
    const addComandaInputRef = useRef<HTMLInputElement>(null);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
    const handleVoltarParaMonitor = useCallback(() => { setViewMode('monitor'); }, []);
    
    const fetchOpenComandas = useCallback(async () => { 
        setIsLoadingMonitor(true); setMonitorError(null); 
        try { 
            const cs = await comandaService.getAllComandas({ status: 'aberta' }); 
            cs.sort((a, b) => (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true })); 
            setOpenComandasList(cs); 
        } catch (err: any) { setMonitorError(err.message); setOpenComandasList([]); } finally { setIsLoadingMonitor(false); } 
    }, []);

    const fetchInitialData = useCallback(async () => { 
        setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null); 
        try { 
            const [s, m] = await Promise.all([sessionService.getLastOpenSession(), paymentMethodService.getAllPaymentMethods({ ativo: true })]); 
            setOpenSession(s); setPaymentMethods(m || []); 
        } catch (err: any) { 
            if (axios.isAxiosError(err) && err.response?.status === 404) { setOpenSession(null); } else { setError("Erro."); setOpenSession(null); }
        } finally { setIsLoadingSession(false); setIsLoadingPayMethods(false); } 
    }, []);

    const fetchPrintErrors = useCallback(async () => {
        try { const response = await api.get('/impressao-fila/erros'); setPrintErrors(response.data); } catch (err) { console.error(err); }
    }, []);

    const handleRetryPrint = async (id: number) => {
        try { await api.post(`/impressao-fila/retry/${id}`); toast.success("Enviado!"); fetchPrintErrors(); } catch (err) { toast.error("Erro."); }
    };

    const fetchComandaDetails = useCallback(async (comandas: Comanda[]) => { 
        if (comandas.length === 0) { setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0); return; } 
        setIsLoadingItems(true); 
        try { 
            const detailedComandasPromises = comandas.map(c => comandaService.getComandaByNumero(c.numero || '')); 
            const detailedComandas: ComandaComItens[] = await Promise.all(detailedComandasPromises); 
            const allItems = detailedComandas.flatMap(c => (c.itens || []).map(item => ({...item, numero_comanda: c.numero, cliente_nome_comanda: c.cliente_nome}))); 
            setComandaItems(allItems); 
            setGroupTotalConsumo(detailedComandas.reduce((sum, c) => sum + Number(c.total_atual_calculado || 0), 0)); 
        } catch (err: any) { setComandaError("Erro ao carregar."); } finally { setIsLoadingItems(false); } 
    }, []);

    const handleRegisterPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedComandas.length || !openSession || !paymentValueCents) return;
        const fId = parseInt(selectedPaymentMethodId);
        if (isNaN(fId) || paymentValueCents > groupSaldoDevedor + 0.01) { toast.error("Verifique os dados."); return; }
        setIsProcessingPayment(true);
        try {
            const newPayment: UIPayment = { id: Date.now(), valor: paymentValueCents.toString(), data_hora: new Date().toISOString(), nome_forma_pagamento: paymentMethods.find(m => m.id === fId)?.nome || 'N/A', detalhes: paymentDetails.trim() || null };
            const listaAtualizada = [...groupPaymentsList, newPayment];
            setGroupPaymentsList(listaAtualizada);
            if ((groupTotalAPagar - listaAtualizada.reduce((s, p) => s + Number(p.valor || 0), 0)) <= 0.01) {
                toast.info("Fechando conta..."); setTimeout(() => handleFinalizarTransacao(true, listaAtualizada), 1500);
            } else {
                setSelectedPaymentMethodId(''); setPaymentValueCents(null); setPaymentDetails(''); setPaymentInputKey(Date.now());
            }
        } catch (err: any) { toast.error("Erro."); } finally { setIsProcessingPayment(false); }
    };

    const handleFinalizarTransacao = async (skipConfirmation = false, pagamentosParaFinalizar?: UIPayment[]) => {
        if (!selectedComandas.length || !openSession) return;
        if (groupSaldoDevedor > 0.01 && !skipConfirmation) { toast.error("Ainda há saldo."); return; }
        if (!skipConfirmation && !window.confirm(`Finalizar ${selectedComandas.length} comanda(s)?`)) return;
        setIsProcessingPayment(true);
        try {
            const listaDePagamentos = pagamentosParaFinalizar || groupPaymentsList;
            const payload: FinalizarTransacaoPayload = { comandaIds: selectedComandas.map(c => c.id), taxa_servico: groupTaxaServico, acrescimos: groupAcrescimosCents / 100, descontos: groupDescontosCents / 100, pagamentos: listaDePagamentos.map(p => { const methodId = paymentMethods.find(pm => pm.nome === p.nome_forma_pagamento)?.id; return { forma_pagamento_id: methodId || 0, valor: Number(p.valor), nome_forma_pagamento: p.nome_forma_pagamento }; }) };
            await transacaoService.finalizar(payload);
            toast.success("Sucesso!"); setSelectedComandas([]); handleVoltarParaMonitor();
        } catch (err: any) { toast.error("Erro ao finalizar."); } finally { setIsProcessingPayment(false); }
    };

   const handleAddComanda = async (e?: React.FormEvent) => { 
        if (e) e.preventDefault(); 
        const num = searchInputValue.trim(); 
        if (!num) return; 
        
        setIsLoadingComanda(true); 
        try { 
            const com = await comandaService.getComandaByNumero(num); 
            if (['fechada','paga','cancelada'].includes(com.status||'')) throw new Error("Comanda fechada."); 
            
            setSelectedComandas(prev => [...prev, com]); 
            setSearchInputValue(''); 
            
        } catch(err: any){ 
            toast.error(err.message);
        } finally { 
            setIsLoadingComanda(false); 
            // O segredo está aqui: o setTimeout garante que o input já foi 
            // re-habilitado pelo React antes de tentarmos dar o foco.
            setTimeout(() => {
                addComandaInputRef.current?.focus();
            }, 50);
        } 
    };
    const handleRemoveComanda = (comandaId: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== comandaId)); };
    const handleAddComandaPorClique = (comanda: Comanda) => { if (selectedComandas.some(c => c.id === comanda.id)) return; setSelectedComandas(prev => [...prev, comanda]); };
    const handleTaxaChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ setIncluirTaxa(e.target.checked); };
    const handleAcrescimosValueChange = (v: NumberFormatValues) => { setGroupAcrescimosCents(v.floatValue ? Math.round(v.floatValue * 100) : 0); };
    const handleDescontosValueChange = (v: NumberFormatValues) => { setGroupDescontosCents(v.floatValue ? Math.round(v.floatValue * 100) : 0); };
    const handleShowOpenModal=()=>{setShowOpenModal(true);}; const handleShowCloseModal=()=>{setShowCloseModal(true);}; const handleShowMovementModal=()=>{setShowMovementModal(true);}; const handleOpenSuccess=()=>{setShowOpenModal(false);fetchInitialData();fetchOpenComandas();}; const handleCloseSuccess=()=>{setShowCloseModal(false);fetchInitialData();fetchOpenComandas();}; const handleMovementSuccess = () => { setShowMovementModal(false); fetchInitialData(); }; const handleLogout=()=>{logout();}; 
    const handleIniciarFechamento = () => { setNumeroPessoas(1); setSelectedPaymentMethodId(''); setPaymentValueCents(null); setPaymentDetails(''); setGroupAcrescimosCents(0); setGroupDescontosCents(0); setGroupPaymentsList([]); setViewMode('fechamento'); };

    const handlePrintConferencia = async () => {
        if (!selectedComandas.length || isPrinting) return;
        setIsPrinting(true);
        try {
            const jobData = { cabecalho: { linha1: "NEVERLAND BAR", linha2: "Sua casa de espetaculos" }, comandas: selectedComandas.map(comanda => ({ numero: comanda.numero, clienteNome: comanda.cliente_nome, itens: comandaItems.filter(item => item.numero_comanda === comanda.numero).map(item => ({ quantidade: `${formatQuantity(Number(item.quantidade || 0))}x`, nome: item.produto_nome, valor: (Number(item.quantidade || 0) * Number(item.preco_unitario_momento || 0)) })) })), resumoTransacao: { totalConsumo: { descricao: "Total Consumo", valor: groupTotalConsumo }, taxaServico: { descricao: "(+) Taxa de Serviço (10%)", valor: groupTaxaServico }, acrescimos: { descricao: "(+) Acréscimos", valor: groupAcrescimosCents / 100 }, descontos: { descricao: "(-) Descontos", valor: groupDescontosCents / 100 }, totalConta: { descricao: "Total da Conta", valor: groupTotalAPagar } } };
            await printService.imprimirPorPonto(3, jobData, 'clienteConta'); toast.success("Impresso!");
        } catch (err: any) { toast.error("Erro."); } finally { setIsPrinting(false); }
    };
    
    const handleCancelarItem = async (itemId: number) => {
        if (!window.confirm("Cancelar?")) return;
        const motivo = prompt("Motivo:"); if (!motivo) return;
        try { await api.post(`/pedidos/item/${itemId}/cancelar`, { motivo }); toast.success("OK"); if (selectedComandas.length > 0) fetchComandaDetails(selectedComandas); } catch (err: any) { toast.error("Erro."); }
    };

    const handleValorClick = (valor: number) => { if (valor > 0) { setPaymentValueCents(valor); setPaymentInputKey(Date.now()); } };
    const handlePaymentValueChange = (v: NumberFormatValues) => { setPaymentValueCents(v.floatValue || null); };

    useEffect(() => { if (!initialFetchDoneRef.current) { fetchInitialData(); fetchOpenComandas(); fetchPrintErrors(); initialFetchDoneRef.current = true; } }, [fetchInitialData, fetchOpenComandas, fetchPrintErrors]);
    useEffect(() => { const interval = setInterval(fetchPrintErrors, 15000); return () => clearInterval(interval); }, [fetchPrintErrors]);
    useEffect(() => { if (viewMode === 'monitor') fetchOpenComandas(); else if (viewMode === 'fechamento' && selectedComandas.length > 0) fetchComandaDetails(selectedComandas); }, [viewMode, selectedComandas, fetchComandaDetails, fetchOpenComandas]);
    useEffect(() => {
        const totalPago = groupPaymentsList.reduce((s, p) => s + Number(p.valor || 0), 0);
        setGroupTotalPago(totalPago);
        const taxa = incluirTaxa ? groupTotalConsumo * 0.10 : 0;
        const total = groupTotalConsumo + taxa + (groupAcrescimosCents / 100) - (groupDescontosCents / 100);
        setGroupTaxaServico(taxa); setGroupTotalAPagar(total); setGroupSaldoDevedor(Math.max(0, total - totalPago));
    }, [groupTotalConsumo, groupPaymentsList, incluirTaxa, groupAcrescimosCents, groupDescontosCents]);

    useEffect(() => { if (addComandaInputRef.current) setTimeout(() => addComandaInputRef.current?.focus(), 100); }, [viewMode]);
    useEffect(() => { const root = window.document.documentElement; root.classList.remove(isDarkMode ? 'light' : 'dark'); root.classList.add(isDarkMode ? 'dark' : 'light'); localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);
    useEffect(() => {
    if (viewMode === 'monitor') {
        // Aguarda um milissegundo para garantir que o elemento apareceu na tela
        setTimeout(() => addComandaInputRef.current?.focus(), 100);
    }
}, [viewMode]);
    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-sans">
            <CashierHeader user={user} onLogout={handleLogout} onToggleDark={toggleDarkMode} isDark={isDarkMode} errorCount={printErrors.length} onOpenErrors={() => setShowPrintErrorsModal(true)} />
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                <SessionStatus openSession={openSession} isLoading={isLoadingSession} error={error} onOpen={handleShowOpenModal} onClose={handleShowCloseModal} onMove={handleShowMovementModal} onConsult={() => setShowConsultaModal(true)} isAllowed={isCashierAllowed} />
                {openSession && viewMode === 'monitor' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <MonitorView comandasList={openComandasList} isLoading={isLoadingMonitor} error={monitorError} onFetch={fetchOpenComandas} onComandaClick={handleAddComandaPorClique} />
                        <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow">
                            <h2 className="text-xl font-bold mb-4">Comandas para Fechamento</h2>
                            <form onSubmit={handleAddComanda} className="flex items-center gap-2 mb-4">
                                <input type="text" ref={addComandaInputRef} value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Número" className="w-full border rounded px-2 py-1.5 bg-gray-50 dark:bg-gray-800" />
                                <button type="submit" disabled={isLoadingComanda} className="px-4 py-1.5 border rounded bg-blue-600 text-white">Add</button>
                            </form>
                            <div className="mt-4 min-h-[200px]">
                                {selectedComandas.length === 0 ? <p className="text-center italic pt-10">Vazio.</p> : (
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                                        {selectedComandas.map(com => (
                                            <div key={com.id} className="grid grid-cols-12 gap-2 p-2 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
                                                <div className="col-span-2 font-bold">{com.numero}</div>
                                                <div className="col-span-6 truncate">{com.cliente_nome || '-'}</div>
                                                <div className="col-span-3 text-right font-semibold">{formatCurrency(com.total_atual_calculado)}</div>
                                                <div className="col-span-1 text-right"><button onClick={() => handleRemoveComanda(com.id)} className="text-red-500 font-bold">×</button></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedComandas.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="text-right font-bold text-xl mb-6">Total: {formatCurrency(selectedComandas.reduce((acc, com) => acc + Number(com.total_atual_calculado || 0), 0))}</div>
                                    <button onClick={handleIniciarFechamento} className="w-full px-4 py-3 text-lg font-bold rounded bg-green-600 text-white">Ir para Fechamento &rarr;</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {viewMode === 'fechamento' && openSession && (
                    <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow">
                        <button onClick={handleVoltarParaMonitor} className="text-sm text-blue-600 mb-4 flex items-center gap-1"><FiArrowLeft /> Voltar para Seleção</button>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-3 space-y-4">
                                <div className='p-3 border dark:border-gray-700 rounded bg-white dark:bg-gray-900'>
                                    <h4 className="text-base font-semibold mb-2 border-b pb-2">Itens Consumidos</h4>
                                    {isLoadingItems ? <p className="text-center py-4 italic">Buscando...</p> : (
                                        <ul className='text-xs space-y-1.5 max-h-[65vh] overflow-y-auto pr-2'>
                                            {comandaItems.filter(i => i.status_item !== 'cancelado').map((item) => (
                                                <li key={item.id} className='flex justify-between py-2 border-b'>
                                                    <div className="flex-1"><span className="font-bold text-sm block">{item.produto_nome}</span>{item.observacao_item && <span className="block text-gray-500 italic">{item.observacao_item}</span>}</div>
                                                    <div className="text-right"><span className="block text-xs">{formatQuantity(item.quantidade)} x {formatCurrency(item.preco_unitario_momento)}</span><span className="block font-bold text-sm">
    {formatCurrency(Number(item.quantidade) * Number(item.preco_unitario_momento))}
</span></div>
                                                    <button onClick={() => handleCancelarItem(item.id)} className="ml-2 text-red-500"><FiTrash2 size={16} /></button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="lg:col-span-2 space-y-4">
                                <div className='text-sm border dark:border-gray-700 p-3 rounded bg-gray-50 dark:bg-gray-800 space-y-2'>
                                    <p className='flex justify-between'><span>Consumo:</span><span>{formatCurrency(groupTotalConsumo)}</span></p>
                                    <div className='flex justify-between items-center'><div className='flex items-center gap-1.5'><input type="checkbox" checked={incluirTaxa} onChange={handleTaxaChange} className="h-4 w-4"/> <label>Taxa 10%:</label></div><span>{formatCurrency(groupTaxaServico)}</span></div>
                                    <div className='flex justify-between items-center'><label>Acréscimos:</label><NumericFormat value={groupAcrescimosCents / 100} onValueChange={handleAcrescimosValueChange} className="w-24 text-right border rounded dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale /></div>
                                    <div className='flex justify-between items-center'><label>Descontos:</label><NumericFormat value={groupDescontosCents / 100} onValueChange={handleDescontosValueChange} className="w-24 text-right border rounded dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale /></div>
                                    <hr className='my-2' />
                                    <p className='flex justify-between items-center text-base font-bold'><span>Total:</span><span onClick={() => handleValorClick(groupTotalAPagar)} className="cursor-pointer text-blue-600">{formatCurrency(groupTotalAPagar)}</span></p>
                                    {groupSaldoDevedor > 0 && (
                                        <div className="flex justify-between items-center text-red-600 font-black text-lg mt-1 pt-1 border-t border-red-200 dark:border-red-900/50">
                                            <span>FALTA PAGAR:</span>
                                            <span 
                                                onClick={() => handleValorClick(Number(groupSaldoDevedor.toFixed(2)))} 
                                                className="cursor-pointer hover:underline animate-pulse"
                                                title="Clique para cobrar o saldo restante"
                                            >
                                                {formatCurrency(groupSaldoDevedor)}
                                            </span>
                                        </div>
                                    )}
                                    {/* EXIBIÇÃO DO VALOR DIVIDIDO COM CORREÇÃO DE TIPOS */}
                                   {groupTotalAPagar > 0 && numeroPessoas > 1 && (
                                       <div className='mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 rounded flex justify-between items-center shadow-inner'>
                                            <span className="text-blue-800 dark:text-blue-300 font-bold text-xs uppercase italic">Dividido por pessoa:</span>
                                            <button 
                                                type="button"
                                                onClick={() => handleValorClick(Number((Number(groupTotalAPagar) / Number(numeroPessoas)).toFixed(2)))} 
                                                className="font-black text-blue-700 dark:text-blue-200 text-base"
                                            >
                                                {formatCurrency(Number(groupTotalAPagar) / Number(numeroPessoas))}
                                            </button>
                                        </div>
                                    )}

                                    <div className='mt-2 pt-2 border-t flex justify-end items-center gap-2 text-sm'>
                                        <label>Dividir por:</label>
                                        <input type="number" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 border rounded text-center dark:bg-gray-700"/>
                                    </div>
                                </div>
                                <div className='border dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 overflow-hidden shadow-sm'>
                                    <h4 className="text-sm font-medium p-2 border-b bg-gray-100 dark:bg-gray-700">Pagamentos</h4>
                                    <div className='p-2'>
                                        {groupPaymentsList.length === 0 ? <p className='text-center italic py-2'>Vazio.</p> : (
                                            <ul className='text-xs space-y-1 max-h-28 overflow-y-auto'>{groupPaymentsList.map(p => (<li key={p.id} className='flex justify-between border-b pb-1'><div><span>{p.nome_forma_pagamento}</span></div><span className="font-semibold">{formatCurrency(Number(p.valor))}</span></li>))}</ul>
                                        )}
                                    </div>
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 border-t text-right text-sm font-bold">Total Pago: {formatCurrency(groupTotalPago)}</div>
                                </div>
                                {groupSaldoDevedor > 0.001 && (
                                    <div className='mt-3 p-3 border dark:border-gray-700 rounded bg-blue-50 dark:bg-blue-900/20'>
                                        {comandaError && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>}
                                        <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end">
                                            <div className="col-span-6 sm:col-span-3"><label className="text-xs">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isLoadingPayMethods} className="w-full text-sm border rounded p-1.5 dark:bg-gray-700"><option value="">Selecione</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                            <div className="col-span-3 sm:col-span-3"><label className="text-xs">Valor*</label><NumericFormat key={paymentInputKey} value={paymentValueCents === null ? '' : paymentValueCents} onValueChange={handlePaymentValueChange} className="w-full text-sm border rounded p-1.5 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                            <div className="col-span-6"><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} placeholder="Detalhes" className="w-full text-sm border rounded p-1.5 dark:bg-gray-800"/></div>
                                            <div className="col-span-6"><button type="submit" disabled={isProcessingPayment || !paymentValueCents} className="w-full text-sm font-bold p-2 border rounded text-white bg-blue-600">Adicionar {formatCurrency(paymentValueCents || 0)}</button></div>
                                        </form>
                                    </div>
                                )}
                                <div className='flex gap-4 mt-6'>
                                    <button onClick={handlePrintConferencia} disabled={isPrinting} className="flex-1 px-4 py-3 bg-gray-500 text-white rounded"><FiPrinter className="inline mr-2"/>Conferência</button>
                                    <button 
    onClick={() => handleFinalizarTransacao()} 
    className={`flex-1 px-4 py-3 text-white rounded font-bold transition-all ${ groupSaldoDevedor > 0.01 ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-700 shadow-md' }`} 
    disabled={groupSaldoDevedor > 0.01}
>
    {groupSaldoDevedor > 0.01 ? `FALTA ${formatCurrency(groupSaldoDevedor)}` : 'FINALIZAR CONTA'}
</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <ConsultaComandaModal isOpen={showConsultaModal} onClose={() => setShowConsultaModal(false)} />
            <OpenSessionModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} onSuccess={handleOpenSuccess} />
            {openSession && <CloseSessionModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} onSuccess={handleCloseSuccess} sessionToClose={openSession} />}
            {openSession && <MovementFormModal isOpen={showMovementModal} onClose={() => setShowMovementModal(false)} onSuccess={handleMovementSuccess} sessionId={openSession.id} />}
            <PrintErrorsModal isOpen={showPrintErrorsModal} onClose={() => setShowPrintErrorsModal(false)} errors={printErrors} onRetry={handleRetryPrint} />
        </div>
    );
};

export default CashierMainPage;