// src/pages/CashierMainPage.tsx
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

// --- Componentes de Renderização Auxiliares (com JSX real) ---
const CashierHeader: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => (
    <header className="bg-gray-800 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0">
        <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1>
        <div className='text-xs sm:text-sm flex items-center'>
            <span>Usuário: {user?.nome || 'N/A'}</span>
            <button onClick={onLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Logout</button>
        </div>
    </header>
);

const SessionStatus: React.FC<{ openSession: Session | null | undefined; isLoading: boolean; error: string | null; onOpen: () => void; onClose: () => void; onMove: () => void; isAllowed: boolean }> = ({ openSession, isLoading, error, onOpen, onClose, onMove, isAllowed }) => (
    <div className={`p-4 bg-white rounded-lg shadow border-l-4 ${openSession ? 'border-green-500' : 'border-red-500'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className='flex-grow'>
                <h2 className="text-lg font-semibold mb-1 text-gray-700">Status do Caixa</h2>
                {isLoading && openSession === undefined ? (
                    <p className='italic text-gray-500'>Verificando...</p>
                ) : error && !openSession ? (
                    <p className="text-red-600">{error}</p>
                ) : openSession ? (
                    <div className="text-sm space-y-1">
                        <p><span>Status:</span> <span className="text-green-700 font-medium">Aberto</span> (ID: {openSession.id})</p>
                        <p><span>Operador:</span> {openSession.nome_usuario_abertura || '?'}</p>
                        <p><span>Abertura:</span> {formatDateTime(openSession.data_abertura)}</p>
                        <p><span>Valor Inicial:</span> <span className="font-semibold">{formatCurrency(openSession.valor_abertura)}</span></p>
                    </div>
                ) : (
                    <p className="text-gray-600">Caixa Fechado</p>
                )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
                {!isLoading && isAllowed && (
                    <>
                        {openSession ? (
                            <>
                                <button onClick={onMove} className="px-3 py-1.5 bg-yellow-500 text-white rounded text-xs shadow hover:bg-yellow-600">Movimentação</button>
                                <button onClick={onClose} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs shadow hover:bg-red-700">Fechar Caixa</button>
                            </>
                        ) : (
                            !error && <button onClick={onOpen} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs shadow hover:bg-green-700">Abrir Caixa</button>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
);

const MonitorView: React.FC<{ comandasList: Comanda[]; isLoading: boolean; error: string | null; onFetch: () => void; onStartCheckout: () => void }> = ({ comandasList, isLoading, error, onFetch, onStartCheckout }) => (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className='flex justify-between items-center mb-4 gap-4'>
            <h2 className="text-xl font-bold text-gray-800">Monitor de Comandas Abertas</h2>
            <div className='flex gap-2'>
                <button onClick={onStartCheckout} disabled={isLoading || comandasList.length === 0} className='px-4 py-2 text-sm border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'>Iniciar Fechamento</button>
                <button onClick={onFetch} disabled={isLoading} className='px-4 py-2 text-xs border rounded bg-blue-100 hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1'>{isLoading ? '...' : <><FiRefreshCw size={12}/> Atualizar</>}</button>
            </div>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {isLoading ? (
            <p className='text-center italic text-gray-500 py-4'>Carregando comandas...</p>
        ) : comandasList.length === 0 ? (
            <p className='text-center italic text-gray-500 py-4'>Nenhuma comanda aberta no momento.</p>
        ) : (
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Comanda</th>
                            <th className="px-4 py-2">Cliente/Local</th>
                            <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comandasList.map((com) => (
                            <tr key={com.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium">{com.numero || com.id}</td>
                                <td className="px-4 py-2">{com.cliente_nome || com.local_atual || '-'}</td>
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
    // ... (toda a sua lógica de hooks (useState, useEffect, etc.) permanece a mesma) ...
    const { user, logout } = useAuth();
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
    
    // --- LÓGICA DE FUNÇÕES (useCallback, useEffects, etc.) ---
    const fetchInitialData = useCallback(async () => { setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null); try { const [s, m] = await Promise.all([sessionService.getLastOpenSession(), paymentMethodService.getAllPaymentMethods({ ativo: true })]); setOpenSession(s); setPaymentMethods(m || []); } catch (err: any) { if (axios.isAxiosError(err) && err.response?.status === 404) { setOpenSession(null); try { const m = await paymentMethodService.getAllPaymentMethods({ ativo: true }); setPaymentMethods(m || []); } catch (mErr: any) { setError("Erro ao carregar formas de pagamento."); setPaymentMethods([]); } } else { setError(err.message || "Erro ao carregar dados iniciais."); setOpenSession(null); setPaymentMethods([]); } } finally { setIsLoadingSession(false); setIsLoadingPayMethods(false); } }, []);
    const fetchComandaDetails = useCallback(async (comandaIds: number[]) => { if (comandaIds.length === 0) { setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0); setComandaError(null); setGroupTaxaServico(0); setGroupAcrescimos(0); setGroupDescontos(0); setGroupTotalAPagar(0); setGroupSaldoDevedor(0); setIncluirTaxa(true); setNumeroPessoas(1); return; } setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null); let allItemsFromSelected: ItemPedido[] = []; let currentTotalConsumo = 0; selectedComandas.forEach(comanda => { const comandaDetalhada = comanda as Comanda & { itens?: ItemPedido[], total_atual_calculado?: number | null }; if (comandaDetalhada.itens && Array.isArray(comandaDetalhada.itens)) { const itemsEnriquecidos = comandaDetalhada.itens.map(item => ({...item, numero_comanda: comandaDetalhada.numero, cliente_nome_comanda: comandaDetalhada.cliente_nome})); allItemsFromSelected = allItemsFromSelected.concat(itemsEnriquecidos); } currentTotalConsumo += Number(comandaDetalhada.total_atual_calculado) || 0; }); setComandaItems(allItemsFromSelected); setIsLoadingItems(false); setGroupTotalConsumo(currentTotalConsumo); try { const paymentPromises = comandaIds.map(id => paymentService.getPaymentsByComandaId(id).catch(err => { console.error(`Erro ao buscar pagamentos para comanda ${id}:`, err); return []; })); const paymentResults = await Promise.all(paymentPromises); let allRawPayments: Payment[] = paymentResults.flat(); setGroupPaymentsList(allRawPayments); const uniqueP = new Map<string, Payment>(); allRawPayments.forEach(p=>{if(p.grupo_uuid){if(!uniqueP.has(p.grupo_uuid))uniqueP.set(p.grupo_uuid,p);}else{uniqueP.set(`individual-${p.id}`,p);}}); const totalPagoCalc = Array.from(uniqueP.values()).reduce((s,p)=>s+Number(p.valor||0),0); setGroupTotalPago(totalPagoCalc); } catch (err: any) { setComandaError(err.message||"Falha detalhes de pagamento."); setGroupPaymentsList([]); setGroupTotalPago(0); } finally { setIsLoadingPayments(false); } }, [selectedComandas]);
    const fetchOpenComandas = useCallback(async () => { setIsLoadingMonitor(true); setMonitorError(null); try { const cs = await comandaService.getAllComandas({ status: 'aberta' }); setOpenComandasList(cs); } catch (err: any) { setMonitorError(err.message); setOpenComandasList([]); } finally { setIsLoadingMonitor(false); } }, []);
    useEffect(() => { if (!initialFetchDoneRef.current) { fetchInitialData(); fetchOpenComandas(); initialFetchDoneRef.current = true; } }, [fetchInitialData, fetchOpenComandas]);
    useEffect(() => { const ids = selectedComandas.map(c => c.id); fetchComandaDetails(ids); if (comandaError && selectedComandas.length > 0) setComandaError(null); }, [selectedComandas, fetchComandaDetails, comandaError]);
    useEffect(() => { const t = incluirTaxa ? (groupTotalConsumo * 0.1) : 0; setGroupTaxaServico(t); const total = groupTotalConsumo + t + groupAcrescimos - groupDescontos; setGroupTotalAPagar(total); }, [groupTotalConsumo, incluirTaxa, groupAcrescimos, groupDescontos]);
    useEffect(() => { const s = groupTotalAPagar - groupTotalPago; const f = s < 0.001 && s > -0.001 ? 0 : s; setGroupSaldoDevedor(f); }, [groupTotalAPagar, groupTotalPago]);
    const handleCloseGroupComandas = useCallback(async (automatico = false) => { if(!selectedComandas.length||!openSession||isPrinting) return; if(groupSaldoDevedor > 0.01 && !automatico) { setComandaError(`Saldo pendente: ${formatCurrency(groupSaldoDevedor)}`); toast.warn(`Saldo pendente: ${formatCurrency(groupSaldoDevedor)}`); return; } if(!automatico && !window.confirm(`Tem certeza que deseja finalizar e fechar ${selectedComandas.length} comanda(s)?`)) return; setError(null);setComandaError(null); try { const payload={comandaIds:selectedComandas.map(c=>c.id)}; const r=await comandaService.closeComandaGroup(payload); toast.success(r.message||`${r.affectedRows} comanda(s) fechada(s)!`); setSelectedComandas([]); fetchOpenComandas(); } catch(err:any){ setComandaError(err.message||"Erro ao fechar."); toast.error(err.message || "Erro ao fechar comandas.") } }, [selectedComandas, openSession, isPrinting, groupSaldoDevedor, user, fetchOpenComandas]);
    useEffect(() => { if ( viewMode === 'fechamento' && selectedComandas.length > 0 && groupTotalAPagar > 0.01 && groupSaldoDevedor >= -0.01 && groupSaldoDevedor <= 0.01 && !isProcessingPayment && !isPrinting ) { const algumaAberta = selectedComandas.some(c => c.status === 'aberta'); if (algumaAberta) { const timerId = setTimeout(() => { handleCloseGroupComandas(true); }, 200); return () => clearTimeout(timerId); } } }, [groupSaldoDevedor, groupTotalAPagar, selectedComandas, viewMode, isProcessingPayment, isPrinting, handleCloseGroupComandas]);
    useEffect(() => { if (viewMode === 'fechamento' && addComandaInputRef.current) { setTimeout(() => { addComandaInputRef.current?.focus(); }, 0); } }, [viewMode]);
    const handleAddComanda = async (e?: React.FormEvent) => { if (e) e.preventDefault(); const numeroComandaParaBuscar = searchInputValue.trim(); if (!numeroComandaParaBuscar) return; setIsLoadingComanda(true); setComandaError(null); try { if (selectedComandas.some(c => c.numero === numeroComandaParaBuscar)) throw new Error(`Comanda ${numeroComandaParaBuscar} já está na lista.`); const comandaEncontrada = await comandaService.getComandaByNumero(numeroComandaParaBuscar); if (['fechada','paga','cancelada'].includes(comandaEncontrada.status||'')) throw new Error(`Comanda ${comandaEncontrada.numero} está ${comandaEncontrada.status}.`); if (selectedComandas.some(c=>c.id===comandaEncontrada.id)) throw new Error(`Comanda ID ${comandaEncontrada.id} já está na lista.`); setSelectedComandas(prev=>[...prev,comandaEncontrada]); setSearchInputValue(''); addComandaInputRef.current?.focus(); } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao adicionar comanda."); } finally{ setIsLoadingComanda(false); } };
    const handleTaxaChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ setIncluirTaxa(e.target.checked); };
    const handleAcrescimosValueChange=(v:NumberFormatValues)=>{ const value = v.floatValue ?? 0; setGroupAcrescimos(value >= 0 ? value : 0); };
    const handleDescontosValueChange=(v:NumberFormatValues)=>{ const value = v.floatValue ?? 0; setGroupDescontos(value >= 0 ? value : 0); };
    const handlePaymentValueChange=(v:NumberFormatValues)=>{ setPaymentValueNum(v.floatValue); };
    const handleRegisterPayment = async (e:React.FormEvent) => { e.preventDefault(); if(!selectedComandas.length||!openSession)return; const fId=parseInt(selectedPaymentMethodId);const val=paymentValueNum; if(isNaN(fId)||fId<=0||val===undefined||val<=0){setComandaError("Verifique a forma de pagamento e o valor.");return;} if(val>groupSaldoDevedor+0.01){setComandaError(`Valor do pagamento ${formatCurrency(val)} é maior que o saldo devedor ${formatCurrency(groupSaldoDevedor)}.`);return;} setIsProcessingPayment(true);setComandaError(null); try { const payload:CreateGroupPaymentPayload={comandaIds:selectedComandas.map(c=>c.id),forma_pagamento_id:fId,valor:val,detalhes:paymentDetails.trim()||null}; const r=await paymentService.registerGroupPayment(payload); toast.success(r.message||"Pagamento registrado!"); setSelectedPaymentMethodId('');setPaymentValueNum(undefined);setPaymentDetails(''); await fetchComandaDetails(selectedComandas.map(c=>c.id)); } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao registrar pagamento.");} finally{setIsProcessingPayment(false);} };
    const handlePrintConferencia = async (valorIncluirTaxa: boolean) => { if(!selectedComandas.length || isPrinting) return; setIsPrinting(true); setComandaError(null); const payload = { comandaIds: selectedComandas.map(c => c.id), items: comandaItems, totalConsumo: groupTotalConsumo, taxaServico: groupTaxaServico, incluiuTaxa: valorIncluirTaxa, acrescimos: groupAcrescimos, descontos: groupDescontos, totalAPagar: groupTotalAPagar, totalPago: groupTotalPago, saldoDevedor: groupSaldoDevedor, numeroPessoas: numeroPessoas > 1 ? numeroPessoas : undefined, nomeOperadorCaixa: user?.nome || 'N/D' }; try { await printService.printConferencia(payload); toast.success("Impressão de conferência enviada!"); } catch(err: any) { setComandaError(err.message || "Erro ao tentar imprimir conferência."); toast.error(err.message || "Erro ao imprimir."); } finally { setIsPrinting(false); } };
    const handleShowOpenModal=()=>{setError(null);setShowOpenModal(true);};
    const handleShowCloseModal=()=>{setError(null);setShowCloseModal(true);};
    const handleShowMovementModal=()=>{setError(null);setShowMovementModal(true);};
    const handleOpenSuccess=()=>{setShowOpenModal(false);fetchInitialData();fetchOpenComandas();};
    const handleCloseSuccess=()=>{setShowCloseModal(false);fetchInitialData();fetchOpenComandas();};
    const handleMovementSuccess=()=>{setShowMovementModal(false); fetchComandaDetails(selectedComandas.map(c => c.id));};
    const handleLogout=()=>{logout();};
    const handleIniciarFechamento=()=>{setComandaError(null);setSelectedComandas([]);setViewMode('fechamento');};
    const handleVoltarParaMonitor=()=>{setViewMode('monitor');setSelectedComandas([]);fetchOpenComandas();};

    if (openSession === undefined && isLoadingSession) {
        return <div className="flex items-center justify-center h-screen"><div className="text-lg text-gray-500 italic">Carregando Caixa...</div></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <CashierHeader user={user} onLogout={handleLogout} />

            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                <SessionStatus
                    openSession={openSession} isLoading={isLoadingSession} error={error}
                    onOpen={handleShowOpenModal} onClose={handleShowCloseModal}
                    onMove={handleShowMovementModal} isAllowed={isCashierAllowed}
                />
                
                {viewMode === 'monitor' && openSession && (
                    <MonitorView
                        comandasList={openComandasList} isLoading={isLoadingMonitor} error={monitorError}
                        onFetch={fetchOpenComandas} onStartCheckout={handleIniciarFechamento}
                    />
                )}
                
                {viewMode === 'fechamento' && openSession && (
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                        <button onClick={handleVoltarParaMonitor} className="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1"><FiArrowLeft size={14} /> Voltar para o Monitor</button>
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Fechamento de Comandas</h2>
                        
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                            <label htmlFor="comanda-search-fechamento" className='text-sm font-medium'>Adicionar Comanda:</label>
                            <form onSubmit={handleAddComanda} className="flex-grow flex items-center gap-2">
                                <input
                                    type="text" id="comanda-search-fechamento" ref={addComandaInputRef}
                                    value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)}
                                    disabled={isLoadingComanda} placeholder="Número ou ID"
                                    className="w-full border rounded px-2 py-1.5 text-sm"
                                />
                                <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-4 py-1.5 border rounded bg-blue-600 text-white text-sm disabled:opacity-50">
                                    {isLoadingComanda ? '...' : '+ Add'}
                                </button>
                            </form>
                        </div>
                        
                        {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 p-2 rounded-md text-sm">{comandaError}</p>}

                        {selectedComandas.length === 0 ? (
                            <p className='text-center italic text-gray-500 my-8'>Adicione uma ou mais comandas para iniciar o fechamento.</p>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
                                
                                <div className="lg:col-span-3 space-y-4">
                                    <div className='p-3 border rounded bg-white'>
                                        <h4 className="text-base font-semibold mb-2 p-2 border-b">Itens Consumidos</h4>
                                        {isLoadingItems ? (
                                            <p className='italic text-xs text-center py-4'>Buscando itens...</p>
                                        ) : comandaItems.length === 0 ? (
                                            <p className='italic text-xs text-center py-4'>Nenhum item encontrado.</p>
                                        ) : (
                                            <ul className='text-xs space-y-1.5 max-h-[65vh] overflow-y-auto pr-2'>
                                                {comandaItems.sort((a,b) => (a.numero_comanda||'').localeCompare(b.numero_comanda||'') || (a.data_hora_pedido||'').localeCompare(b.data_hora_pedido||'') || a.id - b.id)
                                                    .map((item, index, arr) => {
                                                        const q = Number(item.quantidade||0), p = Number(item.preco_unitario_momento||0), subtotal=q*p;
                                                        const showComandaHeader = selectedComandas.length > 0 && (index === 0 || item.numero_comanda !== arr[index-1].numero_comanda);
                                                        return (
                                                            <React.Fragment key={`item-${item.id}`}>
                                                                {showComandaHeader && (
                                                                    <li className="pt-2 mt-2 border-t border-dashed border-gray-300 bg-blue-50 p-2 rounded">
                                                                        <p className="text-sm font-bold text-blue-700">Comanda: {item.numero_comanda || 'N/D'}</p>
                                                                        {item.cliente_nome_comanda && (<p className="text-xs text-gray-600">Cliente: {item.cliente_nome_comanda}</p>)}
                                                                    </li>
                                                                )}
                                                                <li className='flex justify-between items-start py-1.5 border-b border-gray-100'>
                                                                    <div className="flex-1 mr-2"><span className="font-medium text-gray-800 leading-tight">{item.produto_nome || '?'}</span>{item.observacao_item && <span className="block italic text-gray-500 leading-tight">Obs: {item.observacao_item}</span>}<div className="text-[10px] text-gray-500 mt-0.5 leading-none">{item.data_hora_pedido?formatDateTime(item.data_hora_pedido):''}{item.nome_garcom?` - ${item.nome_garcom}`:''}</div></div>
                                                                    <div className="text-right flex-shrink-0"><span className="block text-gray-700 leading-tight">{formatQuantity(q)} x {formatCurrency(p)}</span><span className="block font-semibold text-gray-800 leading-tight">{formatCurrency(subtotal)}</span></div>
                                                                </li>
                                                            </React.Fragment>
                                                        );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    <div className='text-sm border p-3 rounded bg-gray-50 space-y-2'>
                                        <p className='flex justify-between'><span>Consumo:</span><span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span></p>
                                        <div className='flex justify-between items-center'><div className='flex items-center gap-1.5'><input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="h-4 w-4"/> <label htmlFor="incluir-taxa">Taxa Serviço (10%):</label></div><span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span></div>
                                        <div className='flex justify-between items-center'><label htmlFor="acrescimos">Acréscimos:</label><NumericFormat id="acrescimos" value={groupAcrescimos} onValueChange={handleAcrescimosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                        <div className='flex justify-between items-center'><label htmlFor="descontos">Descontos (-):</label><NumericFormat id="descontos" value={groupDescontos} onValueChange={handleDescontosValueChange} className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                        <hr className='my-2' />
                                        <p className='flex justify-between items-center text-base font-bold'><span>Total a Pagar:</span><span>{formatCurrency(groupTotalAPagar)}</span></p>
                                        {groupTotalAPagar > 0 && numeroPessoas > 1 && (<div className='mt-2 pt-2 border-t flex justify-end items-center gap-2 text-sm'><span className="font-semibold text-blue-600"> = {formatCurrency(groupTotalAPagar / numeroPessoas)} / pessoa </span></div>)}
                                        <div className='mt-2 pt-2 border-t flex justify-end items-center gap-2 text-sm'><label htmlFor="numero-pessoas">Dividir por:</label><input type="number" id="numero-pessoas" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1 border rounded text-center"/></div>
                                    </div>
                                    <div className='border rounded bg-gray-50 overflow-hidden'>
                                        <h4 className="text-sm font-medium p-2 border-b bg-gray-100">Pagamentos Realizados</h4>
                                        <div className='p-2'>
                                            {isLoadingPayments ? (<p className='italic text-xs text-center py-2'>Buscando...</p>) : groupPaymentsList.length === 0 ? (<p className='italic text-xs text-center py-2'>Nenhum pagamento registrado.</p>) : (<ul className='text-xs space-y-1 max-h-28 overflow-y-auto'>{groupPaymentsList.map(p => (<li key={p.id} className='flex justify-between border-b pb-1'><div><span className='font-medium'>{p.nome_forma_pagamento}</span><span className="block text-gray-600">{formatDateTime(p.data_hora)}</span>{p.detalhes && <span className="block italic text-gray-600">D: {p.detalhes}</span>}</div><span className="font-semibold ml-2">{formatCurrency(p.valor)}</span></li>))}</ul>)}
                                        </div>
                                        <div className="p-2 bg-gray-100 border-t text-right text-sm font-semibold">Total Pago: {formatCurrency(groupTotalPago)}</div>
                                    </div>
                                    {openSession && groupSaldoDevedor > 0.001 && (
                                        <div className='mt-3 p-3 border rounded bg-blue-50'>
                                            <h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4>
                                            {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>}
                                            <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end">
                                                <div className="col-span-6 sm:col-span-3"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border rounded p-1.5"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'Cadastre':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                                <div className="col-span-3 sm:col-span-3"><label className="block text-xs mb-0.5">Valor*</label><NumericFormat value={paymentValueNum} onValueChange={handlePaymentValueChange} placeholder="R$ 0,00" disabled={isProcessingPayment} required className="w-full text-sm border rounded p-1.5" thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} /></div>
                                                <div className="col-span-6"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU, nome no PIX, etc." className="w-full text-sm border rounded p-1.5"/></div>
                                                <div className="col-span-6"><button type="submit" disabled={isProcessingPayment||!openSession||groupSaldoDevedor <= 0.001} className="w-full text-sm p-2 border rounded text-white bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">{isProcessingPayment ? 'Processando...' : `Pagar Saldo (${formatCurrency(groupSaldoDevedor)})`}</button></div>
                                            </form>
                                        </div>
                                    )}
                                    <div className='flex justify-around items-center gap-4 mt-4'>
                                        <button type="button" onClick={() => handlePrintConferencia(incluirTaxa)} disabled={isPrinting} className="px-4 py-2 text-sm rounded shadow flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"> <FiPrinter size={16}/> Conferência </button>
                                        <button onClick={() => handleCloseGroupComandas()} className={`px-5 py-2 text-white rounded shadow font-bold ${ groupSaldoDevedor > 0.01 || !openSession ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700' }`} disabled={groupSaldoDevedor > 0.01 || !openSession}> {groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar Comanda(s)'} </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modais */}
            <OpenSessionModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} onSuccess={handleOpenSuccess} />
            {openSession && <CloseSessionModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} onSuccess={handleCloseSuccess} sessionToClose={openSession} />}
            {openSession && <MovementFormModal isOpen={showMovementModal} onClose={handleMovementSuccess} onSuccess={handleMovementSuccess} sessionId={openSession.id} />}
        </div>
    );
};

export default CashierMainPage;