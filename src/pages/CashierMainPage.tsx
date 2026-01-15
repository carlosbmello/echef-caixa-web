import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { FiArrowLeft, FiRefreshCw, FiPrinter } from 'react-icons/fi';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/formatters';

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

// Componente de Status Compacto (Uma única linha)
const SessionStatus: React.FC<{ 
    openSession: Session | null | undefined; 
    isLoading: boolean; 
    error: string | null; 
    onOpen: () => void; 
    onClose: () => void; 
    onMove: () => void; 
    onConsult: () => void; // [NOVO] Recebe a função de consultar
    isAllowed: boolean 
}> = ({ openSession, isLoading, error, onOpen, onClose, onMove, onConsult, isAllowed }) => (
    <div className={`px-4 py-2 bg-white dark:bg-gray-900 rounded-lg shadow border-l-4 ${openSession ? 'border-green-500' : 'border-red-500'} mb-4 transition-all`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* LADO ESQUERDO: Informações em linha */}
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

            {/* LADO DIREITO: Botões de Ação na mesma linha */}
            <div className="flex gap-2 flex-shrink-0">
                {!isLoading && isAllowed && (
                    <>
                        {openSession ? (
                            <>
                                {/* Botão Consultar trazido para cá */}
                                <button onClick={onConsult} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600">
                                    Consultar
                                </button>
                                
                                <button onClick={onMove} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-semibold shadow-sm hover:bg-yellow-600 transition-colors">
                                    Movimentação
                                </button>
                                
                                <button onClick={onClose} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold shadow-sm hover:bg-red-700 transition-colors">
                                    Fechar Caixa
                                </button>
                            </>
                        ) : (
                            !error && (
                                <button onClick={onOpen} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm font-bold shadow hover:bg-green-700 transition-colors">
                                    Abrir Caixa
                                </button>
                            )
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
            <button onClick={onFetch} disabled={isLoading} className='px-4 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-blue-100 dark:bg-gray-700 dark:text-gray-200 hover:bg-blue-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1'>
                {isLoading ? '...' : <><FiRefreshCw size={12}/> Atualizar</>}
            </button>
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
    const fetchOpenComandas = useCallback(async () => { setIsLoadingMonitor(true); setMonitorError(null); try { const cs = await comandaService.getAllComandas({ status: 'aberta' }); cs.sort((a, b) => (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true })); setOpenComandasList(cs); } catch (err: any) { setMonitorError(err.message); setOpenComandasList([]); } finally { setIsLoadingMonitor(false); } }, []);
    const fetchInitialData = useCallback(async () => { setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null); try { const [s, m] = await Promise.all([sessionService.getLastOpenSession(), paymentMethodService.getAllPaymentMethods({ ativo: true })]); setOpenSession(s); setPaymentMethods(m || []); } catch (err: any) { if (axios.isAxiosError(err) && err.response?.status === 404) { setOpenSession(null); try { const m = await paymentMethodService.getAllPaymentMethods({ ativo: true }); setPaymentMethods(m || []); } catch (mErr: any) { setError("Erro ao carregar formas de pagamento."); setPaymentMethods([]); } } else { setError(err.message || "Erro ao carregar dados iniciais."); setOpenSession(null); setPaymentMethods([]); } } finally { setIsLoadingSession(false); setIsLoadingPayMethods(false); } }, []);
    const fetchComandaDetails = useCallback(async (comandas: Comanda[]) => { const comandaIds = comandas.map(c => c.id); if (comandaIds.length === 0) { setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0); setComandaError(null); return; } setIsLoadingItems(true); setComandaError(null); try { const detailedComandasPromises = comandas.map(c => comandaService.getComandaByNumero(c.numero || '')); const detailedComandas: ComandaComItens[] = await Promise.all(detailedComandasPromises); const allItems = detailedComandas.flatMap(c => (c.itens || []).map(item => ({...item, numero_comanda: c.numero, cliente_nome_comanda: c.cliente_nome}))); setComandaItems(allItems); const totalConsumo = detailedComandas.reduce((sum, c) => sum + Number(c.total_atual_calculado || 0), 0); setGroupTotalConsumo(totalConsumo); } catch (err: any) { setComandaError(err.message || "Falha ao carregar detalhes."); setComandaItems([]); setGroupTotalConsumo(0); } finally { setIsLoadingItems(false); } }, []);
    const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComandas.length || !openSession || !paymentValueCents) return;

    const fId = parseInt(selectedPaymentMethodId);
    const valInReais = paymentValueCents;

    if (isNaN(fId) || fId <= 0 || valInReais <= 0) {
        setComandaError("Verifique a forma de pagamento e o valor.");
        return;
    }
    if (valInReais > groupSaldoDevedor + 0.01) {
        setComandaError(`Valor do pagamento ${formatCurrency(valInReais)} é maior que o saldo devedor ${formatCurrency(groupSaldoDevedor)}.`);
        return;
    }
    
    setIsProcessingPayment(true);
    setComandaError(null);
    
    try {
        const newPayment: UIPayment = {
            id: Date.now(),
            valor: valInReais.toString(),
            data_hora: new Date().toISOString(),
            nome_forma_pagamento: paymentMethods.find(m => m.id === fId)?.nome || 'N/A',
            detalhes: paymentDetails.trim() || null
        };

        // Cria a lista de pagamentos atualizada ANTES de qualquer outra coisa.
        const listaAtualizada = [...groupPaymentsList, newPayment];

        // Recalcula o saldo com base nesta nova lista garantida.
        const novoTotalPago = listaAtualizada.reduce((s, p) => s + Number(p.valor || 0), 0);
        const novoSaldoDevedor = groupTotalAPagar - novoTotalPago;
        
        // Agora, atualiza o estado para que a interface reflita o novo pagamento.
        setGroupPaymentsList(listaAtualizada);
        toast.success(`Pagamento de ${formatCurrency(valInReais)} adicionado à lista.`);
        
        // Verifica se a conta foi zerada.
        if (novoSaldoDevedor <= 0.01) {
            toast.info("Conta totalmente paga. Finalizando automaticamente...");
            
            // Atraso para o usuário ler a notificação
            setTimeout(() => {
                // Chama a finalização passando a lista atualizada para garantir que o último pagamento seja incluído.
                handleFinalizarTransacao(true, listaAtualizada);
            }, 1500);
        
        } else {
            // Se ainda há saldo, limpa os campos para o próximo pagamento.
            setSelectedPaymentMethodId('');
            setPaymentValueCents(null);
            setPaymentDetails('');
            setPaymentInputKey(Date.now());
        }

    } catch (err: any) {
        setComandaError(err.message);
        toast.error(err.message || "Erro ao adicionar pagamento.");
    } finally {
        setIsProcessingPayment(false);
    }
};
    const handleFinalizarTransacao = async (skipConfirmation = false, pagamentosParaFinalizar?: UIPayment[]) => {
    if (!selectedComandas.length || !openSession) {
        toast.warn("Nenhuma comanda selecionada para finalizar.");
        return;
    }
    // A checagem de saldo pendente não se aplica à finalização automática, que já sabe que o saldo é zero.
    if (groupSaldoDevedor > 0.01 && !skipConfirmation) {
        toast.error(`Ainda há um saldo pendente de ${formatCurrency(groupSaldoDevedor)}.`);
        return;
    }
    
    // A confirmação só aparece se for um clique manual (skipConfirmation = false).
    if (!skipConfirmation && !window.confirm(`Tem certeza que deseja finalizar e fechar ${selectedComandas.length} comanda(s)?`)) {
        return;
    }

    setIsProcessingPayment(true);
    setError(null);
    setComandaError(null);

    try {
        // Se a função recebeu uma lista de pagamentos, ela a usa.
        // Senão, ela usa a lista do estado (para o clique manual no botão).
        const listaDePagamentos = pagamentosParaFinalizar || groupPaymentsList;

        const payload: FinalizarTransacaoPayload = {
            comandaIds: selectedComandas.map(c => c.id),
            taxa_servico: groupTaxaServico,
            acrescimos: groupAcrescimosCents / 100,
            descontos: groupDescontosCents / 100,
            pagamentos: listaDePagamentos.map(p => {
                const methodId = paymentMethods.find(pm => pm.nome === p.nome_forma_pagamento)?.id;
                return { forma_pagamento_id: methodId || 0, valor: Number(p.valor), nome_forma_pagamento: p.nome_forma_pagamento };
            })
        };

        if (payload.pagamentos.some(p => p.forma_pagamento_id === 0)) {
            throw new Error("Não foi possível identificar a forma de pagamento de um dos lançamentos.");
        }

        const response = await transacaoService.finalizar(payload);
        toast.success(response.message || "Comanda(s) finalizada(s) com sucesso!");
        
        // Limpa a seleção e volta para a tela do monitor
        setSelectedComandas([]);
        handleVoltarParaMonitor();

    } catch (err: any) {
        toast.error(err.message || "Erro ao finalizar a transação.");
    } finally {
        setIsProcessingPayment(false);
    }
};
    const handleAddComanda = async (e?: React.FormEvent) => { if (e) e.preventDefault(); const numeroComandaParaBuscar = searchInputValue.trim(); if (!numeroComandaParaBuscar) return; setIsLoadingComanda(true); setComandaError(null); try { if (selectedComandas.some(c => c.numero === numeroComandaParaBuscar)) throw new Error(`Comanda ${numeroComandaParaBuscar} já está na lista.`); const comandaEncontrada = await comandaService.getComandaByNumero(numeroComandaParaBuscar); if (['fechada','paga','cancelada'].includes(comandaEncontrada.status||'')) throw new Error(`Comanda ${comandaEncontrada.numero} está ${comandaEncontrada.status}.`); if (selectedComandas.some(c=>c.id===comandaEncontrada.id)) throw new Error(`Comanda ID ${comandaEncontrada.id} já está na lista.`); setSelectedComandas(prev=>[...prev,comandaEncontrada]); setSearchInputValue(''); addComandaInputRef.current?.focus(); } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao adicionar comanda."); } finally{ setIsLoadingComanda(false); } };
    const handleRemoveComanda = (comandaId: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== comandaId)); if (comandaError) setComandaError(null); };
    const handleAddComandaPorClique = (comanda: Comanda) => { if (comandaError) setComandaError(null); if (selectedComandas.some(c => c.id === comanda.id)) { toast.info(`Comanda ${comanda.numero || comanda.id} já está na lista de fechamento.`); return; } setSelectedComandas(prev => [...prev, comanda]); };
    const handleTaxaChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ setIncluirTaxa(e.target.checked); };
    const handleAcrescimosValueChange = (v: NumberFormatValues) => { setGroupAcrescimosCents(v.floatValue ? Math.round(v.floatValue * 100) : 0); };
    const handleDescontosValueChange = (v: NumberFormatValues) => { setGroupDescontosCents(v.floatValue ? Math.round(v.floatValue * 100) : 0); };
    const handleShowOpenModal=()=>{setError(null);setShowOpenModal(true);}; const handleShowCloseModal=()=>{setError(null);setShowCloseModal(true);}; const handleShowMovementModal=()=>{setError(null);setShowMovementModal(true);}; const handleOpenSuccess=()=>{setShowOpenModal(false);fetchInitialData();fetchOpenComandas();}; const handleCloseSuccess=()=>{setShowCloseModal(false);fetchInitialData();fetchOpenComandas();}; const handleMovementSuccess=()=>{}; const handleLogout=()=>{logout();}; 
    const handleIniciarFechamento = () => {
    // 1. Reseta todos os estados do formulário para seus valores iniciais
    setComandaError(null);
    setNumeroPessoas(1); // Volta a divisão para 1 pessoa
    setSelectedPaymentMethodId(''); // Limpa a forma de pagamento selecionada
    setPaymentValueCents(null); // Limpa o valor do pagamento
    setPaymentDetails(''); // Limpa os detalhes
    setGroupAcrescimosCents(0); // Zera acréscimos
    setGroupDescontosCents(0); // Zera descontos
    setGroupPaymentsList([]); // Limpa a lista de pagamentos já feitos

    // 2. Muda para a tela de fechamento
    setViewMode('fechamento');
};
    const handlePrintConferencia = async () => {
    if (!selectedComandas.length || isPrinting) return;
    setIsPrinting(true);
    setComandaError(null);
    const PONTO_ID_CAIXA = 3;

    try {
        // --- LÓGICA DE CÁLCULO FINAL E SEGURA ---
        // Garante que todos os valores estejam na unidade correta (Reais) antes de montar o payload.
        
        const consumoFinal = groupTotalConsumo;          // Ex: 283
        const acrescimosFinal = groupAcrescimosCents / 100; // Ex: 0
        const descontosFinal = groupDescontosCents / 100;   // Ex: 0
        
        // Garante que a taxa seja calculada sobre o valor em Reais
        const taxaFinal = incluirTaxa ? consumoFinal * 0.10 : 0; // Ex: 283 * 0.10 = 28.3
        
        const totalFinal = consumoFinal + taxaFinal + acrescimosFinal - descontosFinal; // Ex: 283 + 28.3 = 311.3

        const jobData = {
            cabecalho: {
                linha1: "NEVERLAND BAR",
                linha2: "Sua casa de espetaculos"
            },
            comandas: selectedComandas.map(comanda => ({
                numero: comanda.numero,
                clienteNome: comanda.cliente_nome,
                itens: comandaItems
                    .filter(item => item.numero_comanda === comanda.numero)
                    .map(item => ({
                        quantidade: `${formatQuantity(Number(item.quantidade || 0))}x`,
                        nome: item.produto_nome,
                        // Passa o valor NUMÉRICO do subtotal
                        valor: (Number(item.quantidade || 0) * Number(item.preco_unitario_momento || 0))
                    }))
            })),
            resumoTransacao: {
                // Todos os valores são passados como NÚMEROS PUROS
                totalConsumo: { descricao: "Total Consumo", valor: consumoFinal },
                taxaServico: { descricao: "(+) Taxa de Serviço (10%)", valor: taxaFinal },
                acrescimos: { descricao: "(+) Acréscimos", valor: acrescimosFinal },
                descontos: { descricao: "(-) Descontos", valor: descontosFinal },
                totalConta: { descricao: "Total da Conta", valor: totalFinal }
            }
        };

        // Envia o jobData com números puros para a API
        await printService.imprimirPorPonto(PONTO_ID_CAIXA, jobData, 'clienteConta');
        toast.success("Impressão de conferência enviada!");

    } catch (err: any) {
        setComandaError(err.message);
        toast.error(err.message);
    } finally {
        setIsPrinting(false);
    }
};
    
    // [NOVA FUNÇÃO ADICIONADA]
    const handleValorClick = (valorEmReais: number) => {
        if (valorEmReais > 0) {
            setPaymentValueCents(valorEmReais);
            if (comandaError) setComandaError(null);
        }
    };
    
    // [FUNÇÃO CORRIGIDA]
    const handlePaymentValueChange = (v: NumberFormatValues) => {
        setPaymentValueCents(v.floatValue || null);
        if(comandaError) setComandaError(null);
    };

    useEffect(() => { if (!initialFetchDoneRef.current) { fetchInitialData(); fetchOpenComandas(); initialFetchDoneRef.current = true; } }, [fetchInitialData, fetchOpenComandas]);
    useEffect(() => { if (viewMode === 'monitor') { fetchOpenComandas(); } else if (viewMode === 'fechamento' && selectedComandas.length > 0) { setGroupAcrescimosCents(0); setGroupDescontosCents(0); setGroupPaymentsList([]); fetchComandaDetails(selectedComandas); } else if (viewMode === 'fechamento' && selectedComandas.length === 0) { fetchComandaDetails([]); } }, [viewMode, selectedComandas, fetchComandaDetails, fetchOpenComandas]);
    useEffect(() => {
    if (viewMode === 'fechamento') {
        const totalPagoCalculado = groupPaymentsList.reduce((s, p) => s + Number(p.valor || 0), 0);
        setGroupTotalPago(totalPagoCalculado);

        const acrescimos = groupAcrescimosCents / 100;
        const descontos = groupDescontosCents / 100;
        
        // --- CÁLCULO CORRIGIDO DA TAXA ---
        // Agora, garantimos que o cálculo seja feito sobre o valor em Reais.
        const taxa = incluirTaxa ? groupTotalConsumo * 0.10 : 0; 
        
        const totalAPagar = groupTotalConsumo + taxa + acrescimos - descontos;
        const saldoDevedor = totalAPagar - totalPagoCalculado;

        setGroupTaxaServico(taxa); // Armazena a taxa em Reais (ex: 28.3)
        setGroupTotalAPagar(totalAPagar);
        setGroupSaldoDevedor(Math.abs(saldoDevedor) < 0.001 ? 0 : saldoDevedor);
    }
}, [viewMode, groupTotalConsumo, groupPaymentsList, incluirTaxa, groupAcrescimosCents, groupDescontosCents]);
    useEffect(() => { if (addComandaInputRef.current) { setTimeout(() => { addComandaInputRef.current?.focus(); }, 100); } }, [viewMode]);
    useEffect(() => { const root = window.document.documentElement; const oldTheme = isDarkMode ? 'light' : 'dark'; root.classList.remove(oldTheme); root.classList.add(isDarkMode ? 'dark' : 'light'); localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);
    useEffect(() => { document.title = 'Gerenciar Caixa - eChef Admin'; return () => { document.title = 'eChef Admin'; }; }, []);
    
    if (openSession === undefined && isLoadingSession) { return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-800"><div className="text-lg text-gray-500 dark:text-gray-400 italic">Carregando Caixa...</div></div>; }
    
    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
            <CashierHeader user={user} onLogout={handleLogout} onToggleDark={toggleDarkMode} isDark={isDarkMode} />
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                <SessionStatus openSession={openSession} isLoading={isLoadingSession} error={error} onOpen={handleShowOpenModal} onClose={handleShowCloseModal} onMove={handleShowMovementModal} onConsult={() => setShowConsultaModal(true)} isAllowed={isCashierAllowed} />
                {!openSession && !isLoadingSession && ( <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-lg shadow mt-6"><h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Caixa Fechado</h2><p className="text-gray-500 dark:text-gray-400 mt-2">Abra o caixa para iniciar as operações.</p></div> )}
                {openSession && viewMode === 'monitor' && ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> <MonitorView comandasList={openComandasList} isLoading={isLoadingMonitor} error={monitorError} onFetch={fetchOpenComandas} onComandaClick={handleAddComandaPorClique} /> <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow"> <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Comandas para Fechamento</h2> <form onSubmit={handleAddComanda} className="flex items-center gap-2 mb-4"> <input type="text" ref={addComandaInputRef} value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Adicionar por Número" className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500" /> <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-4 py-1.5 border rounded bg-blue-600 text-white text-sm disabled:opacity-50">{isLoadingComanda ? '...' : 'Add'}</button> </form> {comandaError && <p className="mb-2 text-sm text-center text-red-500 bg-red-100 dark:bg-red-900/20 p-2 rounded">{comandaError}</p>} <div className="mt-4 min-h-[200px]"> {selectedComandas.length === 0 ? ( <p className='text-center italic text-gray-500 dark:text-gray-400 pt-10'>Selecione comandas na lista à esquerda ou adicione por número.</p> ) : ( <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2"> {selectedComandas.map(com => ( <div key={com.id} className="grid grid-cols-12 gap-2 items-center p-2 border dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-sm"> <div className="col-span-2 font-bold text-gray-800 dark:text-gray-100">{com.numero}</div> <div className="col-span-6 text-gray-600 dark:text-gray-300 truncate">{com.cliente_nome || '-'}</div> <div className="col-span-3 text-right font-semibold">{formatCurrency(com.total_atual_calculado)}</div> <div className="col-span-1 text-right"><button onClick={() => handleRemoveComanda(com.id)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button></div> </div> ))} </div> )} </div> {selectedComandas.length > 0 && ( <div className="mt-4 pt-4 border-t dark:border-gray-700"> <div className="text-right font-bold text-xl mb-6"><span>Total: </span><span>{formatCurrency(selectedComandas.reduce((acc, com) => acc + Number(com.total_atual_calculado || 0), 0))}</span></div> <button onClick={handleIniciarFechamento} className="w-full px-4 py-3 text-lg font-bold border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all duration-300">Ir para Fechamento &rarr;</button> </div> )} </div> </div> )}
                {viewMode === 'fechamento' && openSession && ( <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow"> <button onClick={() => { handleVoltarParaMonitor(); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-flex items-center gap-1"><FiArrowLeft size={14} /> Voltar para Seleção</button> <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Fechamento de Comandas</h2> {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 dark:bg-red-900/20 p-2 rounded-md text-sm">{comandaError}</p>} <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4"> <div className="lg:col-span-3 space-y-4"> <div className='p-3 border dark:border-gray-700 rounded bg-white dark:bg-gray-900'> <h4 className="text-base font-semibold mb-2 p-2 border-b dark:border-gray-700">Itens Consumidos</h4> {isLoadingItems ? (<p className='italic text-xs text-center py-4'>Buscando itens...</p>) : comandaItems.length === 0 ? (<p className='italic text-xs text-center py-4'>Nenhum item encontrado.</p>) : ( <ul className='text-xs space-y-1.5 max-h-[65vh] overflow-y-auto pr-2'>{comandaItems.sort((a,b) => (a.numero_comanda||'').localeCompare(b.numero_comanda||'') || (a.data_hora_pedido||'').localeCompare(b.data_hora_pedido||'') || a.id - b.id).map((item, index, arr) => { const q = Number(item.quantidade||0), p = Number(item.preco_unitario_momento||0), subtotal=q*p; const showComandaHeader = selectedComandas.length > 1 && (index === 0 || item.numero_comanda !== arr[index-1].numero_comanda); 
                    return (
    <React.Fragment key={`item-${item.id}`}>
        {showComandaHeader && (
            <li className="pt-2 mt-2 border-t border-dashed border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Comanda: {item.numero_comanda || 'N/D'}</p>
                {item.cliente_nome_comanda && (<p className="text-xs text-gray-600 dark:text-gray-400">Cliente: {item.cliente_nome_comanda}</p>)}
            </li>
        )}
        
        <li className='flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-800'>
            <div className="flex-1 mr-2">
                {/* Nome do Produto */}
                <span className="font-bold text-gray-800 dark:text-gray-100 text-sm block leading-tight">
                    {item.produto_nome || '?'}
                </span>
                
                {/* [AJUSTE] Descrição dos Opcionais / Observação */}
                {item.observacao_item && (
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug">
                        {item.observacao_item}
                    </span>
                )}

                {/* Data e Garçom (metadados bem pequenos) */}
                <div className="text-[10px] text-gray-400 mt-1 leading-none">
                    {item.data_hora_pedido ? formatDateTime(item.data_hora_pedido) : ''}
                    {item.nome_garcom ? ` - ${item.nome_garcom}` : ''}
                </div>
            </div>

            {/* Valores */}
            <div className="text-right flex-shrink-0">
                <span className="block text-xs text-gray-500 dark:text-gray-400 leading-tight">
                    {formatQuantity(q)} x {formatCurrency(p)}
                </span>
                <span className="block font-bold text-gray-800 dark:text-gray-200 leading-tight text-sm">
                    {formatCurrency(subtotal)}
                </span>
            </div>
        </li>
    </React.Fragment>
);
})}</ul>)} </div> </div> <div className="lg:col-span-2 space-y-4"> <div className='text-sm border dark:border-gray-700 p-3 rounded bg-gray-50 dark:bg-gray-800 space-y-2'> <p className='flex justify-between'><span>Consumo:</span><span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span></p> <div className='flex justify-between items-center'><div className='flex items-center gap-1.5'><input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500"/> <label htmlFor="incluir-taxa">Taxa Serviço (10%):</label></div><span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span></div> <div className='flex justify-between items-center'><label htmlFor="acrescimos">Acréscimos:</label><NumericFormat id="acrescimos" value={groupAcrescimosCents === 0 ? '' : groupAcrescimosCents / 100} onValueChange={handleAcrescimosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border dark:border-gray-600 rounded sm:text-sm bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div> <div className='flex justify-between items-center'><label htmlFor="descontos">Descontos (-):</label><NumericFormat id="descontos" value={groupDescontosCents === 0 ? '' : groupDescontosCents / 100} onValueChange={handleDescontosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border dark:border-gray-600 rounded sm:text-sm bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div> <hr className='my-2 dark:border-gray-700' /> <p className='flex justify-between items-center text-base font-bold'><span>Total a Pagar:</span><span onClick={() => handleValorClick(groupTotalAPagar)} className="cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Clique para usar este valor no pagamento">{formatCurrency(groupTotalAPagar)}</span></p> {groupTotalAPagar > 0 && numeroPessoas > 1 && (<div className='mt-2 pt-2 border-t dark:border-gray-700 flex justify-end items-center gap-2 text-sm'><span onClick={() => handleValorClick(groupTotalAPagar / numeroPessoas)} className="font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" title="Clique para usar este valor no pagamento"> = {formatCurrency(groupTotalAPagar / numeroPessoas)} / pessoa </span></div>)} <div className='mt-2 pt-2 border-t dark:border-gray-700 flex justify-end items-center gap-2 text-sm'><label htmlFor="numero-pessoas">Dividir por:</label><input type="number" id="numero-pessoas" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1 border dark:border-gray-600 rounded text-center bg-gray-50 dark:bg-gray-700"/></div> </div> <div className='border dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 overflow-hidden'> <h4 className="text-sm font-medium p-2 border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-700">Pagamentos Realizados</h4> <div className='p-2'> {groupPaymentsList.length === 0 ? (<p className='italic text-xs text-center py-2'>Nenhum pagamento registrado.</p>) : (<ul className='text-xs space-y-1 max-h-28 overflow-y-auto'>{groupPaymentsList.map(p => (<li key={p.id} className='flex justify-between border-b dark:border-gray-700 pb-1'><div><span className='font-medium'>{p.nome_forma_pagamento}</span><span className="block text-gray-600 dark:text-gray-400">{formatDateTime(p.data_hora)}</span>{p.detalhes && <span className="block italic text-gray-600 dark:text-gray-400">D: {p.detalhes}</span>}</div><span className="font-semibold ml-2">{formatCurrency(Number(p.valor))}</span></li>))}</ul>)} </div> <div className="p-2 bg-gray-100 dark:bg-gray-700 border-t dark:border-gray-600 text-right text-sm font-semibold">Total Pago: {formatCurrency(groupTotalPago)}</div> </div> {openSession && groupSaldoDevedor > 0.001 && ( <div className='mt-3 p-3 border dark:border-gray-700 rounded bg-blue-50 dark:bg-blue-900/20'> <h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4> {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>} <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end"> <div className="col-span-6 sm:col-span-3"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'Cadastre':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div> <div className="col-span-3 sm:col-span-3"><label className="block text-xs mb-0.5">Valor*</label><NumericFormat key={paymentInputKey} value={paymentValueCents === null ? '' : paymentValueCents} onValueChange={handlePaymentValueChange} placeholder="R$ 0,00" disabled={isProcessingPayment} required className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div> <div className="col-span-6"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU, nome no PIX, etc." className="w-full text-sm border dark:border-gray-600 rounded p-1.5 bg-gray-50 dark:bg-gray-700"/></div> <div className="col-span-6"><button type="submit" disabled={isProcessingPayment || !openSession || !paymentValueCents || paymentValueCents <= 0} className="w-full text-sm p-2 border rounded text-white bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">{isProcessingPayment ? 'Processando...' : `Adicionar ${formatCurrency((paymentValueCents || 0))}`}</button></div> </form> </div> )} <div className='flex justify-around items-center gap-4 mt-4'> <button type="button" onClick={handlePrintConferencia} disabled={isPrinting} className="px-4 py-2 text-sm rounded shadow flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"> <FiPrinter size={16}/> {isPrinting ? 'Imprimindo...' : 'Conferência'} </button> <button onClick={() => handleFinalizarTransacao()} className={`px-5 py-2 text-white rounded shadow font-bold ${ groupSaldoDevedor > 0.01 || !openSession ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700' }`} disabled={groupSaldoDevedor > 0.01 || !openSession}> {groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar Comanda(s)'} </button> </div> </div> </div> </div> )}
            </main>
            
            <ConsultaComandaModal 
                isOpen={showConsultaModal} 
                onClose={() => setShowConsultaModal(false)} 
            />
            <OpenSessionModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} onSuccess={handleOpenSuccess} />
            {openSession && <CloseSessionModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} onSuccess={handleCloseSuccess} sessionToClose={openSession} />}
            {openSession && <MovementFormModal isOpen={showMovementModal} onClose={() => {setShowMovementModal(false)}} onSuccess={handleMovementSuccess} sessionId={openSession.id} />}
        </div>
    );
};

export default CashierMainPage;