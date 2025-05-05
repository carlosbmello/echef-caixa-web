// src/pages/CashierMainPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaService, Comanda } from '../services/comandaService';
import { paymentService, Payment, CreatePaymentPayload } from '../services/paymentService';
import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import { itemPedidoService, ItemPedido } from '../services/itemPedidoService'; // Usando MOCK por enquanto
import MovementFormModal from '../components/MovementFormModal';
// Modal components need to be created
// import OpenSessionModal from '../components/OpenSessionModal';
// import CloseSessionModal from '../components/CloseSessionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios'; // Import axios for error checking

// --- Funções Auxiliares de Formatação ---
const formatCurrency = (value: string | number | null | undefined): string => {
    const number = Number(String(value).replace(',', '.'));
    if (value === null || value === undefined || isNaN(number)) return 'R$ 0,00';
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
    const decimals = String(number).includes('.') ? 3 : 0;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: 3 });
};
// --- Fim Funções Auxiliares ---

const CashierMainPage: React.FC = () => {
    // --- Estados ---
    const { user, logout } = useAuth();
    const [openSession, setOpenSession] = useState<Session | null | undefined>(undefined);
    const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [searchInputValue, setSearchInputValue] = useState('');
    const [selectedComandas, setSelectedComandas] = useState<Comanda[]>([]);
    const [isLoadingComanda, setIsLoadingComanda] = useState<boolean>(false);
    const [comandaError, setComandaError] = useState<string | null>(null);
    // Estados de grupo
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
    // Estados form pagamento
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
    const [paymentValue, setPaymentValue] = useState('');
    const [paymentDetails, setPaymentDetails] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    // *** NOVOS ESTADOS para Taxa/Ajustes ***
    const [incluirTaxa, setIncluirTaxa] = useState<boolean>(true); // Taxa 10% padrão
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0); // Valor calculado da taxa
    const [groupAcrescimos, setGroupAcrescimos] = useState<number>(0); // Valor numérico
    const [groupDescontos, setGroupDescontos] = useState<number>(0); // Valor numérico
    const [valorAcrescimosInput, setValorAcrescimosInput] = useState<string>(''); // Input string
    const [valorDescontosInput, setValorDescontosInput] = useState<string>(''); // Input string
    // --- Fim Novos Estados ---
    const initialFetchRef = useRef(false);
    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';

    // --- Função para buscar Status do Caixa e Formas de Pagamento ---
    const fetchInitialData = useCallback(async () => {
        // ... (como antes) ...
        setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null);
        console.log("CashierMainPage: Buscando dados iniciais...");
        try {
            const [sessionData, methodsData] = await Promise.all([
                sessionService.getLastOpenSession(),
                paymentMethodService.getAllPaymentMethods({ ativo: true })
            ]);
            setOpenSession(sessionData);
            setPaymentMethods(methodsData || []);
            console.log("CashierMainPage: Dados iniciais recebidos.", { sessionData, methodsData });
        } catch (err: any) {
             console.error("CashierMainPage: Erro busca inicial:", err);
             if (axios.isAxiosError(err) && err.response?.status === 404) {
                 setOpenSession(null); console.log("Nenhuma sessão aberta (404).");
                 try { const m = await paymentMethodService.getAllPaymentMethods({ ativo: true }); setPaymentMethods(m || []); }
                 catch (mErr: any) { setError("Erro formas pgto."); setPaymentMethods([]); }
             } else { setError(err.message || "Erro."); setOpenSession(null); setPaymentMethods([]); }
        } finally { setIsLoadingSession(false); setIsLoadingPayMethods(false); }
    }, []);

    // --- Efeito para buscar dados iniciais ao montar ---
    useEffect(() => {
        if (!initialFetchRef.current) { fetchInitialData(); initialFetchRef.current = true; }
    }, [fetchInitialData]);

    // --- Função para buscar detalhes (itens e pagamentos) ---
    const fetchComandaDetails = useCallback(async (comandaIds: number[]) => {
        if (comandaIds.length === 0) {
            // Resetar TUDO ao limpar seleção
            setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0);
            setGroupTotalPago(0); setComandaError(null); setGroupTaxaServico(0);
            setGroupAcrescimos(0); setGroupDescontos(0); setGroupTotalAPagar(0);
            setGroupSaldoDevedor(0); setValorAcrescimosInput(''); setValorDescontosInput('');
            setIncluirTaxa(true); // Volta ao padrão
            return;
        }
        setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null);
        console.log(`[fetchComandaDetails] Buscando detalhes para comanda(s) IDs: ${comandaIds.join(', ')}`);
        try {
            const itemPromises = comandaIds.map(id => itemPedidoService.getItemsByComandaId(id)); // MOCK
            const paymentPromises = comandaIds.map(id => paymentService.getPaymentsByComandaId(id)); // REAL
            const [itemResultsArray, paymentResultsArray] = await Promise.all([ Promise.all(itemPromises), Promise.all(paymentPromises) ]);
            // Processa Itens
            const allItems = itemResultsArray.flat(); setComandaItems(allItems);
            const totalConsumo = allItems.reduce((s, i) => s + (Number(i.quantidade || 0) * Number(i.preco_unitario_momento || 0)), 0);
            setGroupTotalConsumo(totalConsumo);
            // Processa Pagamentos
            const allPayments = paymentResultsArray.flat(); setGroupPaymentsList(allPayments);
            const totalPago = allPayments.reduce((s, p) => s + Number(p.valor || 0), 0);
            setGroupTotalPago(totalPago);
            console.log('[fetchComandaDetails] Detalhes:', { allItems, allPayments, totalConsumo, totalPago });
        } catch (err: any) { console.error("[fetchComandaDetails] Erro:", err); setComandaError(err.message); /* Reset states */ }
        finally { setIsLoadingItems(false); setIsLoadingPayments(false); }
    }, []);

    // --- useEffect para BUSCAR DETALHES quando selectedComandas mudar ---
    useEffect(() => {
        const comandaIds = selectedComandas.map(c => c.id);
        console.log(`[useEffect selectedComandas] Mudança. IDs: ${comandaIds.join(', ')}`);
        fetchComandaDetails(comandaIds);
    }, [selectedComandas, fetchComandaDetails]);

    // --- useEffect para Recalcular Totais Gerais (INCLUINDO TAXA/AJUSTES) ---
    useEffect(() => {
        // Calcula a taxa SE incluída
        const taxaCalculada = incluirTaxa ? (groupTotalConsumo * 0.10) : 0;
        setGroupTaxaServico(taxaCalculada); // Atualiza estado da taxa para exibição

        // Calcula o total a pagar usando os estados numéricos
        const totalAPagar = groupTotalConsumo + taxaCalculada + groupAcrescimos - groupDescontos;
        setGroupTotalAPagar(totalAPagar);

        console.log(`[useEffect Totais] Recalculado. Consumo: ${groupTotalConsumo}, Taxa: ${taxaCalculada}, Acresc: ${groupAcrescimos}, Desc: ${groupDescontos}, TotalAPagar: ${totalAPagar}`);
    // Depende dos valores que afetam o cálculo final
    }, [groupTotalConsumo, incluirTaxa, groupAcrescimos, groupDescontos]);

    // --- useEffect para Recalcular Saldo Devedor ---
    useEffect(() => {
        const saldo = groupTotalAPagar - groupTotalPago;
        const saldoFinal = saldo < 0.001 ? 0 : saldo; // Evita negativo pequeno por arredondamento
        setGroupSaldoDevedor(saldoFinal);
        console.log(`[useEffect Saldo] Recalculado Saldo Devedor: ${saldoFinal}`);
    }, [groupTotalAPagar, groupTotalPago]);

    // --- Handlers ---
    const handleAddComanda = async (e?: React.FormEvent) => {
        // ... (como na versão anterior, já estava correto) ...
        if (e) e.preventDefault();
        const identifier = searchInputValue.trim(); if (!identifier) return;
        setIsLoadingComanda(true); setComandaError(null);
        try {
             if (selectedComandas.some(c => c.numero === identifier || String(c.id) === identifier)) throw new Error(`Comanda ${identifier} já adicionada.`);
             console.log(`Buscando comanda com identifier: ${identifier}`);
             const comanda = await comandaService.getComandaByIdentifier(identifier);
             if (!comanda) throw new Error(`Comanda ${identifier} não encontrada.`);
             if (['fechada', 'paga'].includes(comanda.status || '')) throw new Error(`Comanda ${comanda.numero || identifier} já está ${comanda.status}.`);
             if (selectedComandas.some(c => c.id === comanda.id)) throw new Error(`Comanda ID ${comanda.id} já está na lista.`);
             setSelectedComandas(prev => [...prev, comanda]);
             setSearchInputValue('');
        } catch (err: any) { console.error("Erro add comanda:", err); setComandaError(err.message); }
        finally { setIsLoadingComanda(false); }
    };
    const handleRemoveComanda = (comandaIdToRemove: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== comandaIdToRemove)); };
    const handleShowOpenModal = () => { setError(null); setShowOpenModal(true); };
    const handleShowCloseModal = () => { setError(null); setShowCloseModal(true); };
    const handleShowMovementModal = () => { setError(null); setShowMovementModal(true); };
    const handleOpenSuccess = () => { setShowOpenModal(false); fetchInitialData(); };
    const handleCloseSuccess = () => { setShowCloseModal(false); fetchInitialData(); };
    const handleMovementSuccess = () => { setShowMovementModal(false); /* fetchInitialData(); */ };
    const handleLogout = () => { logout(); };

    // *** NOVOS HANDLERS para Taxa/Ajustes ***
    const handleTaxaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIncluirTaxa(event.target.checked);
    };
    const handleAcrescimosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = event.target.value;
        setValorAcrescimosInput(inputValue);
        const numero = parseFloat(inputValue.replace(',', '.')) || 0;
        setGroupAcrescimos(numero >= 0 ? numero : 0); // Garante não negativo
    };
    const handleDescontosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = event.target.value;
        setValorDescontosInput(inputValue);
        const numero = parseFloat(inputValue.replace(',', '.')) || 0;
        setGroupDescontos(numero >= 0 ? numero : 0); // Garante não negativo
    };
    // *** FIM NOVOS HANDLERS ***

    // Handler para Registrar Pagamento (COM VALIDAÇÃO DE SALDO)
    const handleRegisterPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedComandas.length === 0 || !openSession) { setComandaError("Adicione comandas e abra o caixa."); return; }
        const formaId = parseInt(selectedPaymentMethodId);
        const valorNum = parseFloat(paymentValue.replace(',', '.'));
        if (isNaN(formaId) || formaId <= 0 || isNaN(valorNum) || valorNum <= 0) { setComandaError("Verifique forma e valor."); return; }

        // *** VALIDAÇÃO DE OVERPAYMENT ***
        if (valorNum > groupSaldoDevedor + 0.01) { // Adiciona tolerância
            setComandaError(`Valor ${formatCurrency(valorNum)} excede o saldo devedor de ${formatCurrency(groupSaldoDevedor)}.`);
            return; // Impede o registro
        }
        // *** FIM VALIDAÇÃO ***

        setIsProcessingPayment(true); setComandaError(null);
        try {
            const targetId = selectedComandas[0].id; // Simplificado
            const payload: CreatePaymentPayload = { comandaIdentifier: targetId, forma_pagamento_id: formaId, valor: valorNum, detalhes: paymentDetails.trim() || null };
            const response = await paymentService.registerPayment(payload);
            alert(response.message || "OK!");
            setSelectedPaymentMethodId(''); setPaymentValue(''); setPaymentDetails('');
            fetchComandaDetails(selectedComandas.map(c => c.id)); // Recarrega TUDO
        } catch (err: any) { console.error("Erro pagto:", err); setComandaError(err.message); }
        finally { setIsProcessingPayment(false); }
    };

    // Handler para Fechar Comandas
    const handleCloseGroupComandas = async () => {
        // ... (lógica como antes, ainda simplificada) ...
        if (selectedComandas.length === 0 || !openSession || groupSaldoDevedor > 0.01) { /* ... erro ... */ return; }
        if (!window.confirm(`Fechar ${selectedComandas.length} comanda(s)?`)) return;
        setError(null); setComandaError(null); /* TODO: Loading */
        try {
             console.warn("Fechando individualmente.");
             const promises = selectedComandas.map(c => comandaService.updateComandaStatus(c.id, { status: 'paga' }));
             await Promise.all(promises);
             alert("Fechada(s)!");
             setSelectedComandas([]);
        } catch (err: any) { console.error("Erro fechar:", err); setError(err.message); }
        finally { /* TODO: Loading */ }
    };

    // --- Renderização ---
    if (openSession === undefined && isLoadingSession) { return <div className="p-6 text-center italic">Carregando...</div>; }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gray-800 text-white p-3 sm:p-4 flex justify-between items-center shadow-md flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-semibold">eChef Caixa</h1>
                <div className='text-xs sm:text-sm flex items-center'><span>Usuário: {user?.nome || 'N/A'}</span><button onClick={handleLogout} className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">Logout</button></div>
            </header>

            {/* Conteúdo Principal */}
            <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">

                {/* Card Status Caixa */}
                 <div className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
                    {/* ... (JSX do Status Caixa como antes - OK) ... */}
                     <div className="flex flex-wrap items-center justify-between gap-4"> <div className='flex-grow'> <h2 className="text-lg font-semibold mb-1 text-gray-700">Status do Caixa</h2> {isLoadingSession ? (<p>...</p>) : error && !openSession ? (<p className="text-red-600">{error}</p>) : openSession ? ( <div className="text-sm space-y-1"><p><span>Status:</span> <span className="text-green-700">Aberto</span></p><p><span>Operador:</span> {openSession.nome_usuario_abertura || `ID ${openSession.usuario_abertura_id}`}</p><p><span>Abertura:</span> {formatDateTime(openSession.data_abertura)}</p><p><span>Valor Inicial:</span> {formatCurrency(openSession.valor_abertura)}</p></div> ) : ( <p>Caixa Fechado</p> )} </div> <div className="flex gap-3 flex-shrink-0">{!isLoadingSession && isCashierAllowed && ( <> {openSession ? (<> <button onClick={handleShowMovementModal} className="..." disabled={!openSession}>Mov.</button> <button onClick={handleShowCloseModal} className="..." disabled={!openSession}>Fechar</button> </>) : ( !error && <button onClick={handleShowOpenModal} className="...">Abrir</button>)} </>)} {isLoadingSession && <div className="animate-spin ..."></div>}</div> </div> {error && !isLoadingSession && <p className="mt-2 text-xs text-red-600">Erro: {error}</p>}
                </div>

                {/* Card Operação de Caixa */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4">Operação de Caixa</h2>
                    {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 p-3 rounded-md">{comandaError}</p>}
                    {/* Form Add Comanda */}
                    <form onSubmit={handleAddComanda} className="flex items-center gap-3 mb-4 pb-4 border-b">
                        <label htmlFor="comanda-search">Comanda:</label>
                        <input type="text" id="comanda-search" value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Número ou ID" className="flex-grow border rounded px-2 py-1"/>
                        <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-4 py-1 border rounded bg-blue-600 text-white disabled:opacity-50"> {isLoadingComanda ? '...' : '+ Add'} </button>
                    </form>
                    {/* Lista Comandas Selecionadas */}
                    {selectedComandas.length > 0 && (<div className="mb-6 border rounded p-3 bg-gray-50"> <h3 className="text-sm font-semibold mb-1">Comandas:</h3> <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">{selectedComandas.map(c => (<li key={c.id} className="flex justify-between items-center border-b py-0.5"><span>{c.numero||c.id} ({c.status})</span><button onClick={()=>handleRemoveComanda(c.id)} className="px-1 text-red-500">X</button></li>))}</ul> </div>)}

                    {/* Área de Detalhes (só se tiver comanda) */}
                    {selectedComandas.length > 0 && (<div className="mt-6 pt-6 border-t space-y-5">

                        {/* **** TOTAIS ATUALIZADOS COM TAXA/AJUSTES **** */}
                        <div className='text-right space-y-1 text-sm mb-4 border p-3 rounded bg-gray-50'>
                            <p className='flex justify-between items-center'>
                                <span>Consumo Total:</span>
                                <span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span>
                            </p>
                            <div className='flex justify-between items-center'>
                                <div className='flex items-center'>
                                    <input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="mr-1.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                                    <label htmlFor="incluir-taxa" className="text-gray-700">Taxa Serviço (10%):</label>
                                </div>
                                <span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span>
                            </div>
                            <div className='flex justify-between items-center'>
                                <label htmlFor="acrescimos" className="text-gray-700">Acréscimos:</label>
                                <div className="relative rounded-md shadow-sm w-24">
                                    <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-500 text-xs">R$</span>
                                    <input type="text" inputMode='decimal' id="acrescimos" value={valorAcrescimosInput} onChange={handleAcrescimosChange} placeholder="0,00" className="block w-full pl-6 pr-1 py-1 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                                </div>
                            </div>
                            <div className='flex justify-between items-center'>
                                <label htmlFor="descontos" className="text-gray-700">Descontos (-):</label>
                                <div className="relative rounded-md shadow-sm w-24">
                                    <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-500 text-xs">R$</span>
                                    <input type="text" inputMode='decimal' id="descontos" value={valorDescontosInput} onChange={handleDescontosChange} placeholder="0,00" className="block w-full pl-6 pr-1 py-1 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
                                </div>
                            </div>
                            <hr className='my-2' />
                            <p className='flex justify-between items-center text-base font-bold'>
                                <span>Total a Pagar:</span>
                                <span>{formatCurrency(groupTotalAPagar)}</span>
                            </p>
                        </div>
                        {/* **** FIM TOTAIS ATUALIZADOS **** */}

                        {/* Itens */}
                         <div className='p-2 border rounded bg-gray-50'><h4 className="text-sm font-medium mb-1">Itens</h4> {isLoadingItems?(<p>...</p>):comandaItems.length===0?(<p>Nenhum.</p>):(<ul className='text-[11px] space-y-0.5 max-h-40 overflow-y-auto'>{comandaItems.map(i=>{const q=Number(i.quantidade),p=Number(i.preco_unitario_momento);return(<li key={i.id} className='flex justify-between border-b pb-0.5'><div className='mr-1'><span>{i.nome_produto}</span>{i.observacao_item&&<span className='block italic text-gray-600'>Obs:{i.observacao_item}</span>}</div><div className='text-right shrink-0'><span>{formatQuantity(q)}x{formatCurrency(p)}</span><span className='block font-semibold'>{formatCurrency(q*p)}</span></div></li>)})}</ul>)}</div>
                        {/* Pagamentos */}
                         <div className='border rounded bg-gray-50 overflow-hidden'><h4 className="text-sm font-medium p-1.5 border-b bg-gray-100">Pagamentos</h4><div className='p-2'>{isLoadingPayments?(<p>...</p>):groupPaymentsList.length===0?(<p>Nenhum.</p>):(<ul className='text-[11px] space-y-0.5 max-h-24 overflow-y-auto'>{groupPaymentsList.map(p=>{const v=Number(p.valor);return(<li key={p.id} className='flex justify-between border-b pb-0.5'><div><span>{p.nome_forma_pagamento||`ID ${p.forma_pagamento_id}`}</span><span className='block text-gray-600'>{formatDateTime(p.data_hora)}</span>{p.detalhes&&<span className='block italic text-gray-600'>D:{p.detalhes}</span>}</div><span className='font-semibold ml-1'>{formatCurrency(v)}</span></li>)})}</ul>)}</div><div className="p-1.5 bg-gray-100 border-t text-right text-sm font-semibold">Pago: {formatCurrency(groupTotalPago)}</div></div>
                        {/* Registrar Pagamento Form */}
                        {openSession && (<div className='mt-4 p-3 border rounded bg-blue-50'>
                            <h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4>
                            {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>}
                            <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end">
                                <div className="col-span-6 sm:col-span-2"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border rounded p-1"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'X':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                <div className="col-span-3 sm:col-span-2"><label className="block text-xs mb-0.5">Valor*</label><div className="relative"><span className="absolute left-1.5 top-1.5 text-xs text-gray-500">R$</span><input type="text" inputMode='decimal' required value={paymentValue} onChange={(e)=>setPaymentValue(e.target.value)} disabled={isProcessingPayment} placeholder="0,00" className="w-full text-sm border rounded pl-6 p-1"/></div></div>
                                <div className="col-span-3 sm:col-span-1"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU" className="w-full text-sm border rounded p-1"/></div>
                                <div className="col-span-6 sm:col-span-1"><button type="submit" disabled={isProcessingPayment||!openSession} className="w-full text-sm p-1 border rounded text-white bg-green-600 disabled:opacity-50">{isProcessingPayment?'...':'Pagar'}</button></div>
                            </form>
                            <p className={`text-center font-bold mt-3 ${groupSaldoDevedor > 0.001 ? 'text-red-600' : 'text-green-600'}`}>Saldo: {formatCurrency(groupSaldoDevedor)}</p>
                        </div>)}
                        {/* Botão Fechar Grupo */}
                        <div className='text-center mt-4'><button onClick={handleCloseGroupComandas} className={`px-5 py-2 text-white rounded shadow ${groupSaldoDevedor > 0.01 || !openSession ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`} disabled={groupSaldoDevedor > 0.01 || !openSession || selectedComandas.length === 0}>{groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar'}</button></div>
                    </div>)}
                    {/* Mensagem Nenhuma Comanda */}
                    {selectedComandas.length === 0 && !isLoadingComanda && !comandaError && (<p className="text-center text-gray-500 italic mt-6">Adicione comandas.</p>)}
                </div>
            </main>

            {/* --- Modais --- */}
             {showOpenModal && <div className='fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50'><div className='bg-white p-6 rounded shadow-lg'>TODO: OpenSessionModal <button onClick={() => setShowOpenModal(false)}>X</button> <button onClick={handleOpenSuccess}>OK</button></div></div>}
             {showCloseModal && openSession && <div className='fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50'><div className='bg-white p-6 rounded shadow-lg'>TODO: CloseSessionModal <button onClick={() => setShowCloseModal(false)}>X</button> <button onClick={handleCloseSuccess}>OK</button></div></div>}
             <MovementFormModal isOpen={showMovementModal} onClose={() => { setShowMovementModal(false); setError(null); }} onSuccess={handleMovementSuccess} />
        </div>
    );
};

export default CashierMainPage;