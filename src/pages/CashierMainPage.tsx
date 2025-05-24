// src/pages/CashierMainPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaServiceCaixa as comandaService, Comanda } from '../services/comandaService'; 
import { paymentService, Payment, CreateGroupPaymentPayload } from '../services/paymentService';
import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import { itemPedidoService, ItemPedido } from '../services/itemPedidoService'; 
import { printService } from '../services/printService';
import MovementFormModal from '../components/MovementFormModal';
import OpenSessionModal from '../components/OpenSessionModal';
import CloseSessionModal from '../components/CloseSessionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { toast } from 'react-toastify';
import axios from 'axios'; // Mantido para o type guard isAxiosError

const formatCurrency = (value: string | number | null | undefined): string => { const n=Number(String(value).replace(',','.')); return isNaN(n) ? 'R$ 0,00' : n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); };
const formatDateTime = (dateString: string | null | undefined): string => { if (!dateString) return '-'; try { return format(new Date(dateString), "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return '?'; } };
const formatQuantity = (value: string | number | null | undefined): string => { const n=Number(value); if (isNaN(n)) return '-'; const d=String(n).includes('.')?3:0; return n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:3}); };

const CashierMainPage: React.FC = () => {
    console.log('>>> [0] CashierMainPage: Início da definição do componente');
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
    const [paymentValueNum, setPaymentValueNum] = useState<number | undefined>(0); 
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

    const fetchInitialData = useCallback(async () => { 
        setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null); 
        console.log(">>> [1] fetchInitialData: Iniciando..."); 
        try { 
            const [s, m] = await Promise.all([ 
                sessionService.getLastOpenSession(), 
                paymentMethodService.getAllPaymentMethods({ ativo: true }) 
            ]); 
            console.log(">>> [1] fetchInitialData: Dados recebidos", { s, m }); 
            setOpenSession(s); 
            setPaymentMethods(m || []); 
        } catch (err: any) { 
            console.error(">>> [1] fetchInitialData: Erro", err); 
            if (axios.isAxiosError(err) && err.response?.status === 404) { 
                setOpenSession(null); 
                try { 
                    const m = await paymentMethodService.getAllPaymentMethods({ ativo: true }); 
                    setPaymentMethods(m || []); 
                } catch (mErr: any) { setError("Erro ao carregar formas de pagamento."); setPaymentMethods([]); } 
            } else { setError(err.message || "Erro ao carregar dados iniciais."); setOpenSession(null); setPaymentMethods([]); } 
        } finally { 
            console.log(">>> [1] fetchInitialData: Finalizado. Setando isLoadingSession e isLoadingPayMethods para FALSE."); 
            setIsLoadingSession(false); 
            setIsLoadingPayMethods(false); 
        } 
    }, []);
    
    const fetchComandaDetails = useCallback(async (comandaIds: number[]) => {
        console.log(`>>> [2] fetchComandaDetails: Chamado para IDs: [${comandaIds.join(',') || 'NENHUM'}]`);
        if (comandaIds.length === 0) {
            console.log(">>> [2] fetchComandaDetails: Sem IDs, limpando detalhes.");
            setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0);
            setComandaError(null); setGroupTaxaServico(0); setGroupAcrescimos(0); setGroupDescontos(0);
            setGroupTotalAPagar(0); setGroupSaldoDevedor(0); setIncluirTaxa(true); setNumeroPessoas(1);
            return;
        }

        setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null);
        let allItemsFromSelected: ItemPedido[] = [];
        let currentTotalConsumo = 0;

        selectedComandas.forEach(comanda => {
            const comandaDetalhada = comanda as Comanda & { itens?: ItemPedido[], total_atual_calculado?: number | null };
            if (comandaDetalhada.itens && Array.isArray(comandaDetalhada.itens)) {
                allItemsFromSelected = allItemsFromSelected.concat(comandaDetalhada.itens);
            }
            currentTotalConsumo += Number(comandaDetalhada.total_atual_calculado) || 0;
        });
        console.log('>>> [2] fetchComandaDetails: Itens agregados de selectedComandas:', allItemsFromSelected.length, JSON.stringify(allItemsFromSelected.map(it => ({id: it.id, nome: it.nome_produto}))));
        setComandaItems(allItemsFromSelected);
        setIsLoadingItems(false);
        setGroupTotalConsumo(currentTotalConsumo);

        try {
            const paymentPromises = comandaIds.map(id => paymentService.getPaymentsByComandaId(id).catch(err => { console.error(`>>> [2] ERRO PAGAMENTOS ID ${id}:`, err); return []; }));
            const paymentResults = await Promise.all(paymentPromises);
            let allRawPayments: Payment[] = paymentResults.flat();
            setGroupPaymentsList(allRawPayments);
            const uniqueP = new Map<string, Payment>();
            allRawPayments.forEach(p=>{if(p.grupo_uuid){if(!uniqueP.has(p.grupo_uuid))uniqueP.set(p.grupo_uuid,p);}else{uniqueP.set(`individual-${p.id}`,p);}});
            const totalPagoCalc = Array.from(uniqueP.values()).reduce((s,p)=>s+Number(p.valor||0),0);
            setGroupTotalPago(totalPagoCalc);
        } catch (err: any) {
            console.error(">>> [2] fetchComandaDetails: ERRO GERAL (pagamentos):", err);
            setComandaError(err.message||"Falha detalhes de pagamento.");
            setGroupPaymentsList([]); setGroupTotalPago(0);
        } finally {
            setIsLoadingPayments(false);
        }
    }, [selectedComandas]);

    const fetchOpenComandas = useCallback(async () => { 
        setIsLoadingMonitor(true); setMonitorError(null); 
        console.log(">>> [3] fetchOpenComandas: Iniciando..."); 
        try { 
            const cs = await comandaService.getAllComandas({ status: 'aberta' }); 
            console.log(">>> [3] fetchOpenComandas: Dados recebidos", cs.length); 
            setOpenComandasList(cs); 
        } catch (err: any) { 
            console.error(">>> [3] fetchOpenComandas: Erro:", err); 
            setMonitorError(err.message); setOpenComandasList([]); 
        } finally { 
            console.log(">>> [3] fetchOpenComandas: Finalizado. Setando isLoadingMonitor para FALSE."); 
            setIsLoadingMonitor(false); 
        } 
    }, []);

    useEffect(() => { 
        console.log(">>> [A] Effect Inicial: Verificando ref. Current:", initialFetchDoneRef.current);
        if (!initialFetchDoneRef.current) { 
            console.log(">>> [A] Effect Inicial: Disparando fetches pela primeira vez.");
            fetchInitialData(); 
            fetchOpenComandas(); 
            initialFetchDoneRef.current = true; 
            console.log(">>> [A] Effect Inicial: initialFetchDoneRef.current AGORA É TRUE");
        } else { 
            console.log(">>> [A] Effect Inicial: Já executado anteriormente.");
        }
    }, [fetchInitialData, fetchOpenComandas]);

    useEffect(() => { 
        const ids = selectedComandas.map(c => c.id); 
        console.log(`>>> [B] Effect selectedComandas: Disparado. IDs: [${ids.join(',')}], length: ${selectedComandas.length}`); 
        fetchComandaDetails(ids); 
        if (comandaError && selectedComandas.length > 0) setComandaError(null); 
    }, [selectedComandas, fetchComandaDetails, comandaError]);

    useEffect(() => { 
        const t = incluirTaxa ? (groupTotalConsumo * 0.1) : 0; 
        setGroupTaxaServico(t); 
        const total = groupTotalConsumo + t + groupAcrescimos - groupDescontos; 
        setGroupTotalAPagar(total); 
        console.log(`>>> [C] Effect Totais: TotalAPagar: ${total.toFixed(2)}`); 
    }, [groupTotalConsumo, incluirTaxa, groupAcrescimos, groupDescontos]);

    useEffect(() => { 
        const s = groupTotalAPagar - groupTotalPago; 
        const f = s < 0.001 && s > -0.001 ? 0 : s; 
        setGroupSaldoDevedor(f); 
        console.log(`>>> [D] Effect Saldo: SaldoDevedor: ${f.toFixed(2)}`); 
    }, [groupTotalAPagar, groupTotalPago]);

    const handleCloseGroupComandas = useCallback(async (automatico = false) => { 
        console.log(`>>> [H] handleCloseGroupComandas: Iniciando (Automático: ${automatico})`); 
        if(!selectedComandas.length||!openSession||isPrinting) { console.log(">>> [H] CloseGroup: Condições não atendidas."); return; } 
        if(groupSaldoDevedor > 0.01 && !automatico) { setComandaError(`Saldo: ${formatCurrency(groupSaldoDevedor)}`); return; } 
        if(!automatico && !window.confirm(`Fechar ${selectedComandas.length} comanda(s)?`)) { return; } 
        setError(null);setComandaError(null); 
        try { 
            const payload={comandaIds:selectedComandas.map(c=>c.id)}; 
            const r=await comandaService.closeComandaGroup(payload); 
            toast.success(r.message||`${r.affectedRows} fechada(s)!`); 
            setSelectedComandas([]);
            fetchOpenComandas();
        } catch(err:any){ setComandaError(err.message||"Erro fechar."); toast.error(err.message || "Erro ao fechar comandas.") }
    }, [selectedComandas, openSession, isPrinting, groupSaldoDevedor, user, fetchOpenComandas]); 
    
    useEffect(() => { 
        console.log( `>>> [E] Effect Saldo Zero Check: Saldo: ${groupSaldoDevedor.toFixed(2)}, TotalAPagar: ${groupTotalAPagar.toFixed(2)}, Sel#: ${selectedComandas.length}, View: ${viewMode}, ProcPay: ${isProcessingPayment}, Printing: ${isPrinting}` ); 
        if ( viewMode === 'fechamento' && selectedComandas.length > 0 && groupTotalAPagar > 0.01 && groupSaldoDevedor >= -0.01 && groupSaldoDevedor <= 0.01 && !isProcessingPayment && !isPrinting ) { 
            const algumaAberta = selectedComandas.some(c => c.status === 'aberta'); 
            if (algumaAberta) { 
                console.log(">>> [E] Saldo zerado. CHAMANDO handleCloseGroupComandas AUTOMATICAMENTE."); 
                const timerId = setTimeout(() => { handleCloseGroupComandas(true); }, 100); 
                return () => clearTimeout(timerId); 
            } 
        } 
    }, [groupSaldoDevedor, groupTotalAPagar, selectedComandas, viewMode, isProcessingPayment, isPrinting, handleCloseGroupComandas]);
    
    useEffect(() => {
        if (viewMode === 'fechamento' && addComandaInputRef.current) {
            console.log(">>> [F] Effect viewMode: Modo Fechamento, focando input 'Add Comanda'.");
            setTimeout(() => { addComandaInputRef.current?.focus(); }, 0);
        }
    }, [viewMode]);

    const handleAddComanda = async (e?: React.FormEvent) => {
        console.log(">>> [H1] handleAddComanda: Input:", searchInputValue);
        if (e) e.preventDefault();
        const numeroComandaParaBuscar = searchInputValue.trim();
        if (!numeroComandaParaBuscar) return;
        setIsLoadingComanda(true); setComandaError(null);
        try {
            if (selectedComandas.some(c => c.numero === numeroComandaParaBuscar)) throw new Error(`Comanda ${numeroComandaParaBuscar} já na lista.`);
            const comandaEncontrada = await comandaService.getComandaByNumero(numeroComandaParaBuscar);
            console.log(">>> [H1] Comanda recebida pela API:",comandaEncontrada);
            if (['fechada','paga','cancelada'].includes(comandaEncontrada.status||'')) throw new Error(`Comanda ${comandaEncontrada.numero} ${comandaEncontrada.status}.`);
            if (selectedComandas.some(c=>c.id===comandaEncontrada.id)) throw new Error(`ID ${comandaEncontrada.id} já na lista.`);
            setSelectedComandas(prev=>{const nS=[...prev,comandaEncontrada]; return nS;});
            setSearchInputValue(''); addComandaInputRef.current?.focus();
        } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao adicionar comanda."); }
        finally{ setIsLoadingComanda(false); console.log(">>> [H1] Finalizado");}
    };
    
    const handleRemoveComanda = (id: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== id)); };
    const handleTaxaChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ setIncluirTaxa(e.target.checked); }; 
    const handleAcrescimosValueChange=(v:NumberFormatValues)=>{ setGroupAcrescimos(v.floatValue>=0?(v.floatValue||0):0); }; 
    const handleDescontosValueChange=(v:NumberFormatValues)=>{ setGroupDescontos(v.floatValue>=0?(v.floatValue||0):0); }; 
    const handlePaymentValueChange=(v:NumberFormatValues)=>{ setPaymentValueNum(v.floatValue); };
    
    const handleRegisterPayment = async (e:React.FormEvent) => { 
        console.log(">>> [H] RegisterPayment"); e.preventDefault(); 
        if(!selectedComandas.length||!openSession)return; 
        const fId=parseInt(selectedPaymentMethodId);const val=paymentValueNum; 
        if(isNaN(fId)||fId<=0||val===undefined||val<=0){setComandaError("Verifique forma/valor.");return;} 
        if(val>groupSaldoDevedor+0.01){setComandaError(`Valor ${formatCurrency(val)} > Saldo ${formatCurrency(groupSaldoDevedor)}.`);return;} 
        setIsProcessingPayment(true);setComandaError(null); 
        try { 
            const payload:CreateGroupPaymentPayload={comandaIds:selectedComandas.map(c=>c.id),forma_pagamento_id:fId,valor:val,detalhes:paymentDetails.trim()||null}; 
            const r=await paymentService.registerGroupPayment(payload); 
            toast.success(r.message||"Pagamento registrado!"); 
            setSelectedPaymentMethodId('');setPaymentValueNum(0);setPaymentDetails(''); 
            await fetchComandaDetails(selectedComandas.map(c=>c.id));
        } catch(err:any){ setComandaError(err.message); toast.error(err.message || "Erro ao registrar pagamento.");}
        finally{setIsProcessingPayment(false);}
    };
    
    const handlePrintConferencia = async (valorIncluirTaxa: boolean) => { 
        if(!selectedComandas.length || isPrinting) return; setIsPrinting(true); setComandaError(null); 
        const payload = { comandaIds: selectedComandas.map(c => c.id), items: comandaItems, totalConsumo: groupTotalConsumo, taxaServico: groupTaxaServico, incluiuTaxa: valorIncluirTaxa, acrescimos: groupAcrescimos, descontos: groupDescontos, totalAPagar: groupTotalAPagar, totalPago: groupTotalPago, saldoDevedor: groupSaldoDevedor, numeroPessoas: numeroPessoas > 1 ? numeroPessoas : undefined, nomeOperadorCaixa: user?.nome || 'N/D' }; 
        try { await printService.printConferencia(payload); toast.success("Impressão de conferência enviada!"); } 
        catch(err: any) { setComandaError(err.message || "Erro ao tentar imprimir conferência."); toast.error(err.message || "Erro ao imprimir."); } 
        finally { setIsPrinting(false); } 
    };

    const handleShowOpenModal=()=>{setError(null);setShowOpenModal(true);}; 
    const handleShowCloseModal=()=>{setError(null);setShowCloseModal(true);}; 
    const handleShowMovementModal=()=>{setError(null);setShowMovementModal(true);}; 
    const handleOpenSuccess=()=>{setShowOpenModal(false);fetchInitialData();fetchOpenComandas();}; 
    const handleCloseSuccess=()=>{setShowCloseModal(false);fetchInitialData();fetchOpenComandas();}; 
    const handleMovementSuccess=()=>{setShowMovementModal(false); /* fetchOpenComandas(); Pode não ser necessário aqui */}; 
    const handleLogout=()=>{logout();};
    const handleIniciarFechamento=()=>{setComandaError(null);setSelectedComandas([]);setViewMode('fechamento');};
    const handleVoltarParaMonitor=()=>{setViewMode('monitor');setSelectedComandas([]);fetchOpenComandas();};

    console.log(`>>> [R] RENDER --- Mode: ${viewMode}, Sess: ${openSession?.id}, LoadSess: ${isLoadingSession}, LoadMon: ${isLoadingMonitor}, Selected#: ${selectedComandas.length}, Itens#: ${comandaItems.length}, Consumo: ${groupTotalConsumo.toFixed(2)}, LoadItems: ${isLoadingItems}, LoadPays: ${isLoadingPayments}`);
    if (openSession === undefined && isLoadingSession && isLoadingMonitor) { return <div className="p-6 text-center italic">Carregando Caixa...</div>; }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-gray-800 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0"> <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1> <div className='text-xs sm:text-sm flex items-center'><span>Usuário: {user?.nome || 'N/A'}</span><button onClick={handleLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Logout</button></div> </header>
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                 <div className={`p-2 bg-white rounded-lg shadow border-l-4 border-blue-500 ${viewMode === 'fechamento' ? 'mb-2' : ''}`}> <div className="flex flex-wrap items-center justify-between gap-2"><div className='flex-grow'>{viewMode === 'fechamento' && openSession ? (<p className='text-xs text-gray-600'>Cx Aberto: <span className='font-medium'>{openSession.nome_usuario_abertura||'??'}</span> | Inicial: <span className='font-medium'>{formatCurrency(openSession.valor_abertura)}</span></p>) : viewMode === 'monitor' ? (<> <h2 className="text-lg font-semibold mb-1 text-gray-700">Status do Caixa</h2> {isLoadingSession?(<p>...</p>):error&&!openSession?(<p className="text-red-600">{error}</p>):openSession?( <div className="text-sm space-y-1"><p><span>Status:</span> <span className="text-green-700">Aberto</span></p><p><span>Operador:</span> {openSession.nome_usuario_abertura||'?'}</p><p><span>Abertura:</span> {formatDateTime(openSession.data_abertura)}</p><p><span>Valor:</span> {formatCurrency(openSession.valor_abertura)}</p></div> ):( <p>Caixa Fechado</p> )} </>) : null}</div><div className="flex gap-2 flex-shrink-0">{!isLoadingSession && isCashierAllowed && ( <> {openSession ? (<> <button onClick={handleShowMovementModal} className="px-2 py-1 bg-yellow-500 text-white rounded text-[11px] shadow disabled:opacity-50" disabled={!openSession}>Mov.</button> <button onClick={handleShowCloseModal} className="px-2 py-1 bg-red-600 text-white rounded text-[11px] shadow disabled:opacity-50" disabled={!openSession}>Fechar Cx</button> </>) : ( !error && <button onClick={handleShowOpenModal} className="px-2 py-1 bg-green-600 text-white rounded text-xs shadow">Abrir Cx</button>)} </>)} {isLoadingSession && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>}</div></div>{error && !isLoadingSession && <p className="mt-1 text-xs text-red-600">Erro: {error}</p>} </div>
                {viewMode === 'monitor' && ( <div className="bg-white p-6 rounded-lg shadow"> <div className='flex justify-between items-center mb-4 gap-4'><h2 className="text-xl font-bold text-gray-800">Monitor</h2><div className='flex gap-2'><button onClick={handleIniciarFechamento} disabled={isLoadingMonitor || !openSession} className='px-3 py-1 text-sm border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'>Iniciar Fechamento</button><button onClick={fetchOpenComandas} disabled={isLoadingMonitor} className='px-3 py-1 text-xs border rounded bg-blue-100 hover:bg-blue-200 disabled:opacity-50'>{isLoadingMonitor ? '...' : 'Atualizar'}</button></div></div> {monitorError && <p className="text-red-500">{monitorError}</p>} {isLoadingMonitor?(<p className='text-center italic'>Carregando...</p>):openComandasList.length===0?(<p className='text-center italic'>Nenhuma comanda aberta.</p>):(<div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600"><thead><tr className="text-xs text-gray-700 uppercase bg-gray-50"><th>Comanda</th><th>Cliente/Local</th><th className="text-right">Total</th></tr></thead><tbody>{openComandasList.map((com) => (<tr key={com.id} className="bg-white border-b hover:bg-gray-50"><td>{com.numero||com.id}</td><td>{com.cliente_nome||com.local_atual||'-'}</td><td className="text-right">{formatCurrency(com.total_atual_calculado)}</td></tr>))}</tbody></table></div>)} </div> )}
                {viewMode === 'fechamento' && ( <div className="bg-white p-4 rounded-lg shadow"> <button onClick={handleVoltarParaMonitor} className="text-xs text-blue-600 hover:underline mb-3 inline-block">← Voltar</button><h2 className="text-lg font-semibold mb-3 text-gray-700">Fechamento</h2>{comandaError && <p className="mb-3 text-center text-red-600 bg-red-100 p-2 rounded-md text-sm">{comandaError}</p>}
                    <form onSubmit={handleAddComanda} className="flex items-center gap-2 mb-4 pb-3 border-b"><label htmlFor="comanda-search-fechamento" className='text-sm'>Add Comanda:</label><input type="text" id="comanda-search-fechamento" ref={addComandaInputRef} value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Num/ID" className="flex-grow border rounded px-2 py-1 text-sm"/><button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-3 py-1 border rounded bg-blue-600 text-white text-sm disabled:opacity-50"> {isLoadingComanda ? '...' : '+'} </button></form>
                    {selectedComandas.length === 0 ? (<p className='text-center italic text-gray-500 my-6'>Adicione comandas para fechar.</p>) : (<div className="mt-4 space-y-4"> <div className='text-right space-y-1 text-sm border p-3 rounded bg-gray-50'><p className='flex justify-between'><span>Consumo:</span><span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span></p><div className='flex justify-between items-center'><div className='flex items-center'><input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="mr-1.5 h-4 w-4"/> <label htmlFor="incluir-taxa">Taxa(10%):</label></div><span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span></div><div className='flex justify-between items-center'><label htmlFor="acrescimos">Acréscimos:</label><NumericFormat id="acrescimos" value={groupAcrescimos} onValueChange={handleAcrescimosValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm"/></div><div className='flex justify-between items-center'><label htmlFor="descontos">Descontos(-):</label><NumericFormat id="descontos" value={groupDescontos} onValueChange={handleDescontosValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm"/></div><hr className='my-2' /><p className='flex justify-between items-center text-base font-bold'><span>Total:</span><span>{formatCurrency(groupTotalAPagar)}</span></p>{groupTotalAPagar > 0 && (<div className='mt-2 pt-2 border-t flex justify-end items-center gap-2 text-sm'><label htmlFor="numero-pessoas">Dividir por:</label><input type="number" id="numero-pessoas" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1 border rounded text-center"/>{numeroPessoas > 1 && ( <span className="font-semibold text-blue-600"> = {formatCurrency(groupTotalAPagar / numeroPessoas)} / pessoa </span> )}</div>)}</div>
                                <div className='p-2 border rounded bg-gray-50'><h4 className="text-sm font-medium mb-1">Itens</h4> {isLoadingItems?(<p className='italic text-xs text-center'>Buscando itens...</p>):comandaItems.length===0?(<p className='italic text-xs text-center'>Nenhum item.</p>):(<ul className='text-[11px] space-y-1.5 max-h-[350px] overflow-y-auto pr-2'>{comandaItems.sort((a: ItemPedido, b: ItemPedido)=>(a.numero_comanda||'').localeCompare(b.numero_comanda||'')||(a.data_hora_pedido||'').localeCompare(b.data_hora_pedido||'')||a.id - b.id).map((item, index, arr) => {
                                    console.log("Renderizando item na lista:", item); // LOG DE DEPURAÇÃO
                                    const q=Number(item.quantidade||0),p=Number(item.preco_unitario_momento||0),subtotal=q*p;
                                    const showComandaHeader=selectedComandas.length > 1 && (index === 0 || item.numero_comanda !== arr[index-1].numero_comanda);
                                    return (<React.Fragment key={`item-${item.id}`}>{showComandaHeader && (<li className="pt-2 mt-2 border-t border-dashed border-gray-300"><p className="text-xs font-semibold text-blue-700 mb-0.5">Comanda: {item.numero_comanda || 'N/D'}</p></li>)}<li className='flex justify-between items-start py-1 border-b border-gray-200 hover:bg-gray-50'><div className="flex-1 mr-2"><span className="font-medium text-gray-800 leading-tight">{item.produto_nome || '?'}</span>{item.observacao_item && <span className="block italic text-gray-500 leading-tight">Obs: {item.observacao_item}</span>}<div className="text-[10px] text-gray-500 mt-0.5 leading-none">{item.data_hora_pedido?formatDateTime(item.data_hora_pedido):''}{item.nome_garcom?` - ${item.nome_garcom}`:''}</div></div><div className="text-right flex-shrink-0"><span className="block text-gray-700 leading-tight">{formatQuantity(q)} x {formatCurrency(p)}</span><span className="block font-semibold text-gray-800 leading-tight">{formatCurrency(subtotal)}</span></div></li></React.Fragment>);
                                })}</ul>)}{selectedComandas.length > 1 && !isLoadingItems && comandaItems.length > 0 && (<p className='text-xs italic mt-2 text-gray-500 text-center'>Itens de {selectedComandas.length} comandas.</p>)}</div>
                                <div className='border rounded bg-gray-50 overflow-hidden'><h4 className="text-sm font-medium p-1.5 border-b bg-gray-100">Pagamentos</h4><div className='p-2'>{isLoadingPayments?(<p className='italic text-xs text-center'>Buscando pagamentos...</p>):groupPaymentsList.length===0?(<p className='italic text-xs text-center'>Nenhum.</p>):(<ul className='text-[11px] space-y-0.5 max-h-24 overflow-y-auto'>{groupPaymentsList.map(p=>{const v=Number(p.valor||0);return(<li key={p.id} className='flex justify-between border-b pb-0.5'><div><span>{p.nome_forma_pagamento||`ID ${p.forma_pagamento_id}`}</span><span className="block text-gray-600">{formatDateTime(p.data_hora)}</span>{p.detalhes&&<span className="block italic text-gray-600">D:{p.detalhes}</span>}</div><span className="font-semibold ml-1">{formatCurrency(v)}</span></li>)})}</ul>)}</div><div className="p-1.5 bg-gray-100 border-t text-right text-sm font-semibold">Pago: {formatCurrency(groupTotalPago)}</div></div> {openSession && (<div className='mt-3 p-3 border rounded bg-blue-50'><h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4> {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>} <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end"> <div className="col-span-6 sm:col-span-2"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border rounded p-1"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'X':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div> <div className="col-span-3 sm:col-span-2"><label className="block text-xs mb-0.5">Valor*</label><NumericFormat id="payment-value" value={paymentValueNum} onValueChange={handlePaymentValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" disabled={isProcessingPayment} required className="w-full text-sm border rounded pl-6 p-1"/></div> <div className="col-span-3 sm:col-span-1"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU" className="w-full text-sm border rounded p-1"/></div> <div className="col-span-6 sm:col-span-1"><button type="submit" disabled={isProcessingPayment||!openSession} className="w-full text-sm p-1 border rounded text-white bg-green-600 disabled:opacity-50">{isProcessingPayment?'...':'Pagar'}</button></div> </form> <p className={`text-center font-bold mt-3 ${groupSaldoDevedor > 0.001 ? 'text-red-600' : 'text-green-600'}`}>Saldo: {formatCurrency(groupSaldoDevedor)}</p> </div>)}
                                <div className='flex justify-center items-center gap-4 mt-3'>
                                    <button type="button" onClick={() => handlePrintConferencia(incluirTaxa)} disabled={selectedComandas.length === 0 || isPrinting || isLoadingItems || isLoadingPayments} className={`px-4 py-2 text-sm rounded shadow ${(selectedComandas.length === 0 || isPrinting || isLoadingItems || isLoadingPayments) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600 text-white'}`} > {isPrinting ? 'Imprimindo...' : 'Impr. Conf.'} </button>
                                    <button onClick={() => handleCloseGroupComandas()} className={`px-5 py-2 text-white rounded shadow ${ groupSaldoDevedor > 0.01 || !openSession || selectedComandas.length === 0 || isPrinting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700' }`} disabled={groupSaldoDevedor > 0.01 || !openSession || selectedComandas.length === 0 || isPrinting} > {groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar'} </button>
                                </div>
                            </div>)}
                    </div>
                )}
            </main>
            <OpenSessionModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} onSuccess={handleOpenSuccess} />
            <CloseSessionModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} onSuccess={handleCloseSuccess} openSessionData={openSession} />
            <MovementFormModal isOpen={showMovementModal} onClose={() => { setShowMovementModal(false); setError(null); }} onSuccess={handleMovementSuccess} />
        </div>
    );
};

export default CashierMainPage;