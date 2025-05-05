// src/pages/CashierMainPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sessionService, Session } from '../services/sessionService';
import { comandaService, Comanda } from '../services/comandaService';
import { paymentService, Payment, CreatePaymentPayload } from '../services/paymentService';
import { paymentMethodService, PaymentMethod } from '../services/paymentMethodService';
import { itemPedidoService, ItemPedido } from '../services/itemPedidoService'; // Usando MOCK
// *** Importar o novo serviço de impressão ***
import { printService } from '../services/printService';
import MovementFormModal from '../components/MovementFormModal';
// Modals need to be created
// import OpenSessionModal from '../components/OpenSessionModal';
// import CloseSessionModal from '../components/CloseSessionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import { NumericFormat, NumberFormatValues } from 'react-number-format';

// --- Funções Auxiliares de Formatação ---
const formatCurrency = (value: string | number | null | undefined): string => { /* ... (como antes) ... */
    const number = Number(String(value).replace(',', '.')); if (value === null || value === undefined || isNaN(number)) return 'R$ 0,00'; return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
const formatDateTime = (dateString: string | null | undefined): string => { /* ... (como antes) ... */
    if (!dateString) return '-'; try { return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return 'Data inválida'; } };
const formatQuantity = (value: string | number | null | undefined): string => { /* ... (como antes) ... */
    const number = Number(value); if (value === null || value === undefined || isNaN(number)) return '-'; const decimals = String(number).includes('.') ? 3 : 0; return number.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: 3 }); };
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
    const [paymentValueNum, setPaymentValueNum] = useState<number | undefined>(undefined);
    const [paymentDetails, setPaymentDetails] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    // Estados Taxa/Ajustes
    const [incluirTaxa, setIncluirTaxa] = useState<boolean>(true);
    const [groupTaxaServico, setGroupTaxaServico] = useState<number>(0);
    const [groupAcrescimos, setGroupAcrescimos] = useState<number>(0);
    const [groupDescontos, setGroupDescontos] = useState<number>(0);
    // Estado Divisão Conta
    const [numeroPessoas, setNumeroPessoas] = useState<number>(1);
    // *** NOVO ESTADO para loading da impressão ***
    const [isPrinting, setIsPrinting] = useState<boolean>(false);
    // --- Fim Estados ---
    const initialFetchRef = useRef(false);
    const isCashierAllowed = user?.role === 'caixa' || user?.role === 'admin';

    // --- Funções de Busca (fetchInitialData, fetchComandaDetails) ---
    const fetchInitialData = useCallback(async () => { /* ... (como antes) ... */
         setIsLoadingSession(true); setIsLoadingPayMethods(true); setError(null); console.log("Busca inicial..."); try { const [s, m] = await Promise.all([ sessionService.getLastOpenSession(), paymentMethodService.getAllPaymentMethods({ ativo: true }) ]); setOpenSession(s); setPaymentMethods(m || []); console.log("Dados iniciais OK.", { s, m }); } catch (err: any) { console.error("Erro busca inicial:", err); if (axios.isAxiosError(err) && err.response?.status === 404) { setOpenSession(null); try { const m = await paymentMethodService.getAllPaymentMethods({ ativo: true }); setPaymentMethods(m || []); } catch (mErr: any) { setError("Erro formas pgto."); setPaymentMethods([]); } } else { setError(err.message || "Erro."); setOpenSession(null); setPaymentMethods([]); } } finally { setIsLoadingSession(false); setIsLoadingPayMethods(false); } }, []);
    useEffect(() => { if (!initialFetchRef.current) { fetchInitialData(); initialFetchRef.current = true; } }, [fetchInitialData]);
    const fetchComandaDetails = useCallback(async (comandaIds: number[]) => { /* ... (como antes) ... */
         if (comandaIds.length === 0) { setComandaItems([]); setGroupPaymentsList([]); setGroupTotalConsumo(0); setGroupTotalPago(0); setComandaError(null); setGroupTaxaServico(0); setGroupAcrescimos(0); setGroupDescontos(0); setGroupTotalAPagar(0); setGroupSaldoDevedor(0); setIncluirTaxa(true); setNumeroPessoas(1); return; } setIsLoadingItems(true); setIsLoadingPayments(true); setComandaError(null); console.log(`Busca detalhes IDs: ${comandaIds.join(',')}`); try { const itemP = comandaIds.map(id => itemPedidoService.getItemsByComandaId(id)); const payP = comandaIds.map(id => paymentService.getPaymentsByComandaId(id)); const [itemR, payR] = await Promise.all([ Promise.all(itemP), Promise.all(payP) ]); const allI = itemR.flat(); setComandaItems(allI); const totalC = allI.reduce((s, i) => s + (Number(i.quantidade||0)*Number(i.preco_unitario_momento||0)), 0); setGroupTotalConsumo(totalC); const allP = payR.flat(); setGroupPaymentsList(allP); const totalP = allP.reduce((s, p) => s + Number(p.valor||0), 0); setGroupTotalPago(totalP); console.log('Detalhes OK:', {allI, allP, totalC, totalP}); } catch (err: any) { console.error("Erro detalhes:", err); setComandaError(err.message); /* Reset */ } finally { setIsLoadingItems(false); setIsLoadingPayments(false); } }, []);
    useEffect(() => { const ids = selectedComandas.map(c => c.id); console.log(`Effect comandas. IDs: ${ids.join(',')}`); fetchComandaDetails(ids); }, [selectedComandas, fetchComandaDetails]);

    // --- useEffects para Cálculos de Totais ---
    useEffect(() => { /* ... (como antes) ... */
         const taxa = incluirTaxa ? (groupTotalConsumo * 0.10) : 0; setGroupTaxaServico(taxa); const total = groupTotalConsumo + taxa + groupAcrescimos - groupDescontos; setGroupTotalAPagar(total); console.log(`Effect Totais. TotalAPagar: ${total}`); }, [groupTotalConsumo, incluirTaxa, groupAcrescimos, groupDescontos]);
    useEffect(() => { /* ... (como antes) ... */
         const saldo = groupTotalAPagar - groupTotalPago; const final = saldo < 0.001 ? 0 : saldo; setGroupSaldoDevedor(final); console.log(`Effect Saldo. Saldo: ${final}`); }, [groupTotalAPagar, groupTotalPago]);

    // --- Handlers ---
    const handleAddComanda = async (e?: React.FormEvent) => { /* ... (como antes) ... */
         if (e) e.preventDefault(); const idf = searchInputValue.trim(); if (!idf) return; setIsLoadingComanda(true); setComandaError(null); try { if (selectedComandas.some(c => c.numero === idf || String(c.id) === idf)) throw new Error(`Comanda ${idf} já add.`); console.log(`Buscando comanda: ${idf}`); const comanda = await comandaService.getComandaByIdentifier(idf); if (!comanda) throw new Error(`Comanda ${idf} não encontrada.`); if (['fechada', 'paga'].includes(comanda.status||'')) throw new Error(`Comanda ${comanda.numero||idf} ${comanda.status}.`); if (selectedComandas.some(c => c.id === comanda.id)) throw new Error(`Comanda ID ${comanda.id} já na lista.`); setSelectedComandas(prev => [...prev, comanda]); setSearchInputValue(''); } catch (err: any) { console.error("Erro add:", err); setComandaError(err.message); } finally { setIsLoadingComanda(false); } };
    const handleRemoveComanda = (id: number) => { setSelectedComandas(prev => prev.filter(c => c.id !== id)); };
    // Handlers Modais/Logout
    const handleShowOpenModal = () => { setError(null); setShowOpenModal(true); }; const handleShowCloseModal = () => { setError(null); setShowCloseModal(true); }; const handleShowMovementModal = () => { setError(null); setShowMovementModal(true); }; const handleOpenSuccess = () => { setShowOpenModal(false); fetchInitialData(); }; const handleCloseSuccess = () => { setShowCloseModal(false); fetchInitialData(); }; const handleMovementSuccess = () => { setShowMovementModal(false); }; const handleLogout = () => { logout(); };
    // Handlers Taxa/Ajustes/Valor Pagamento (onValueChange)
    const handleTaxaChange = (e: React.ChangeEvent<HTMLInputElement>) => { setIncluirTaxa(e.target.checked); };
    const handleAcrescimosValueChange = (v: NumberFormatValues) => { setGroupAcrescimos(v.floatValue >= 0 ? (v.floatValue || 0) : 0); };
    const handleDescontosValueChange = (v: NumberFormatValues) => { setGroupDescontos(v.floatValue >= 0 ? (v.floatValue || 0) : 0); };
    const handlePaymentValueChange = (v: NumberFormatValues) => { setPaymentValueNum(v.floatValue); };

    // Handler Registrar Pagamento
    const handleRegisterPayment = async (e: React.FormEvent) => { /* ... (como antes, com validação) ... */
         e.preventDefault(); if (!selectedComandas.length || !openSession) return; const fId = parseInt(selectedPaymentMethodId); const val = paymentValueNum; if (isNaN(fId) || fId <= 0 || val === undefined || val <= 0) { setComandaError("Verifique forma/valor."); return; } if (val > groupSaldoDevedor + 0.01) { setComandaError(`Valor ${formatCurrency(val)} > Saldo ${formatCurrency(groupSaldoDevedor)}.`); return; } setIsProcessingPayment(true); setComandaError(null); try { const tId = selectedComandas[0].id; const p: CreatePaymentPayload = { comandaIdentifier: tId, forma_pagamento_id: fId, valor: val, detalhes: paymentDetails.trim() || null }; const r = await paymentService.registerPayment(p); alert(r.message || "OK!"); setSelectedPaymentMethodId(''); setPaymentValueNum(undefined); setPaymentDetails(''); fetchComandaDetails(selectedComandas.map(c => c.id)); } catch (err: any) { console.error("Erro pagto:", err); setComandaError(err.message); } finally { setIsProcessingPayment(false); } };

    // *** NOVO HANDLER para Impressão ***
    const handlePrintConferencia = async () => {
        if (selectedComandas.length === 0 || isPrinting) return;
        setIsPrinting(true); setComandaError(null);
        const payload = {
            comandaIds: selectedComandas.map(c => c.id), items: comandaItems,
            totalConsumo: groupTotalConsumo, taxaServico: groupTaxaServico, incluiuTaxa: incluirTaxa,
            acrescimos: groupAcrescimos, descontos: groupDescontos, totalAPagar: groupTotalAPagar,
            totalPago: groupTotalPago, saldoDevedor: groupSaldoDevedor,
            numeroPessoas: numeroPessoas > 1 ? numeroPessoas : undefined,
            nomeOperadorCaixa: user?.nome || 'N/D',
        };
        try {
            await printService.printConferencia(payload);
            alert("Comando de impressão enviado!"); // Feedback simples por enquanto
        } catch (err: any) { console.error("Erro impressão:", err); setComandaError(err.message || "Erro ao imprimir."); }
        finally { setIsPrinting(false); }
    };
    // *** FIM NOVO HANDLER ***

    // Handler Fechar Comandas
    const handleCloseGroupComandas = async () => { /* ... (como antes) ... */
         if (!selectedComandas.length || !openSession || groupSaldoDevedor > 0.01) return; if (!window.confirm(`Fechar ${selectedComandas.length}?`)) return; setError(null); setComandaError(null); /* Load */ try { console.warn("Fechando individual."); const pr = selectedComandas.map(c => comandaService.updateComandaStatus(c.id, { status: 'paga' })); await Promise.all(pr); alert("Fechada(s)!"); setSelectedComandas([]); } catch (err: any) { console.error("Erro fechar:", err); setError(err.message); } finally { /* Load */ } };

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
                     <div className="flex flex-wrap items-center justify-between gap-4"> <div className='flex-grow'> <h2 className="text-lg font-semibold mb-1 text-gray-700">Status do Caixa</h2> {isLoadingSession ? (<p>...</p>) : error && !openSession ? (<p className="text-red-600">{error}</p>) : openSession ? ( <div className="text-sm space-y-1"><p><span>Status:</span> <span className="text-green-700">Aberto</span></p><p><span>Operador:</span> {openSession.nome_usuario_abertura || `ID ${openSession.usuario_abertura_id}`}</p><p><span>Abertura:</span> {formatDateTime(openSession.data_abertura)}</p><p><span>Valor Inicial:</span> {formatCurrency(openSession.valor_abertura)}</p></div> ) : ( <p>Caixa Fechado</p> )} </div> <div className="flex gap-3 flex-shrink-0">{!isLoadingSession && isCashierAllowed && ( <> {openSession ? (<> <button onClick={handleShowMovementModal} className="px-3 py-1.5 bg-yellow-500 text-white rounded text-xs shadow disabled:opacity-50" disabled={!openSession}>Mov.</button> <button onClick={handleShowCloseModal} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs shadow disabled:opacity-50" disabled={!openSession}>Fechar</button> </>) : ( !error && <button onClick={handleShowOpenModal} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs shadow">Abrir</button>)} </>)} {isLoadingSession && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>}</div> </div> {error && !isLoadingSession && <p className="mt-2 text-xs text-red-600">Erro: {error}</p>}
                </div>

                {/* Card Operação de Caixa */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4">Operação de Caixa</h2>
                    {comandaError && <p className="mb-4 text-center text-red-600 bg-red-100 p-3 rounded-md">{comandaError}</p>}
                    {/* Form Add Comanda */}
                    <form onSubmit={handleAddComanda} className="flex items-center gap-3 mb-4 pb-4 border-b"> <label htmlFor="comanda-search">Comanda:</label> <input type="text" id="comanda-search" value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)} disabled={isLoadingComanda} placeholder="Número ou ID" className="flex-grow border rounded px-2 py-1"/> <button type="submit" disabled={isLoadingComanda || !searchInputValue.trim()} className="px-4 py-1 border rounded bg-blue-600 text-white disabled:opacity-50"> {isLoadingComanda ? '...' : '+ Add'} </button> </form>
                    {/* Lista Comandas Selecionadas */}
                    {selectedComandas.length > 0 && (<div className="mb-6 border rounded p-3 bg-gray-50"> <h3 className="text-sm font-semibold mb-1">Comandas:</h3> <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">{selectedComandas.map(c => (<li key={c.id} className="flex justify-between items-center border-b py-0.5"><span>{c.numero||c.id} ({c.status})</span><button onClick={()=>handleRemoveComanda(c.id)} className="px-1 text-red-500">X</button></li>))}</ul> </div>)}

                    {/* Área de Detalhes */}
                    {selectedComandas.length > 0 && (<div className="mt-6 pt-6 border-t space-y-5">
                        {/* Totais com Taxa/Ajustes e Divisão */}
                        <div className='text-right space-y-1 text-sm mb-4 border p-3 rounded bg-gray-50'>
                            <p className='flex justify-between items-center'><span>Consumo Total:</span><span className='font-semibold'>{formatCurrency(groupTotalConsumo)}</span></p>
                             <div className='flex justify-between items-center'><div className='flex items-center'><input type="checkbox" id="incluir-taxa" checked={incluirTaxa} onChange={handleTaxaChange} className="mr-1.5 h-4 w-4"/> <label htmlFor="incluir-taxa">Taxa Serviço (10%):</label></div><span className='font-semibold'>{formatCurrency(groupTaxaServico)}</span></div>
                             <div className='flex justify-between items-center'><label htmlFor="acrescimos">Acréscimos:</label><NumericFormat id="acrescimos" value={groupAcrescimos} onValueChange={handleAcrescimosValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm"/></div>
                             <div className='flex justify-between items-center'><label htmlFor="descontos">Descontos (-):</label><NumericFormat id="descontos" value={groupDescontos} onValueChange={handleDescontosValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" className="w-24 pl-6 pr-1 py-0.5 text-right border rounded sm:text-sm"/></div>
                            <hr className='my-2' />
                            <p className='flex justify-between items-center text-base font-bold'><span>Total a Pagar:</span><span>{formatCurrency(groupTotalAPagar)}</span></p>
                            {groupTotalAPagar > 0 && (<div className='mt-2 pt-2 border-t flex justify-end items-center gap-2 text-sm'><label htmlFor="numero-pessoas" className="text-gray-600">Dividir por:</label><input type="number" id="numero-pessoas" min="1" value={numeroPessoas} onChange={(e) => setNumeroPessoas(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1 border rounded text-center"/>{numeroPessoas > 1 && ( <span className="font-semibold text-blue-600"> = {formatCurrency(groupTotalAPagar / numeroPessoas)} / pessoa </span> )}</div>)}
                        </div>
                        {/* Itens */}
                         <div className='p-2 border rounded bg-gray-50'><h4 className="text-sm font-medium mb-1">Itens</h4> {isLoadingItems?(<p>...</p>):comandaItems.length===0?(<p>Nenhum.</p>):(<ul className='text-[11px] space-y-0.5 max-h-40 overflow-y-auto'>{comandaItems.map(i=>{const q=Number(i.quantidade||0),p=Number(i.preco_unitario_momento||0);return(<li key={i.id} className='flex justify-between border-b pb-0.5'><div className='mr-1'><span>{i.nome_produto}</span>{i.observacao_item&&<span className='block italic text-gray-600'>Obs:{i.observacao_item}</span>}</div><div className='text-right shrink-0'><span>{formatQuantity(q)}x{formatCurrency(p)}</span><span className='block font-semibold'>{formatCurrency(q*p)}</span></div></li>)})}</ul>)}</div>
                        {/* Pagamentos */}
                         <div className='border rounded bg-gray-50 overflow-hidden'><h4 className="text-sm font-medium p-1.5 border-b bg-gray-100">Pagamentos</h4><div className='p-2'>{isLoadingPayments?(<p>...</p>):groupPaymentsList.length===0?(<p>Nenhum.</p>):(<ul className='text-[11px] space-y-0.5 max-h-24 overflow-y-auto'>{groupPaymentsList.map(p=>{const v=Number(p.valor||0);return(<li key={p.id} className='flex justify-between border-b pb-0.5'><div><span>{p.nome_forma_pagamento||`ID ${p.forma_pagamento_id}`}</span><span className='block text-gray-600'>{formatDateTime(p.data_hora)}</span>{p.detalhes&&<span className='block italic text-gray-600'>D:{p.detalhes}</span>}</div><span className='font-semibold ml-1'>{formatCurrency(v)}</span></li>)})}</ul>)}</div><div className="p-1.5 bg-gray-100 border-t text-right text-sm font-semibold">Pago: {formatCurrency(groupTotalPago)}</div></div>
                        {/* Registrar Pagamento Form */}
                        {openSession && (<div className='mt-4 p-3 border rounded bg-blue-50'>
                            <h4 className="text-base font-semibold mb-2 text-center">Registrar Pagamento</h4>
                            {comandaError && !isProcessingPayment && <p className="mb-2 text-xs text-center text-red-600">{comandaError}</p>}
                            <form onSubmit={handleRegisterPayment} className="grid grid-cols-6 gap-3 items-end">
                                <div className="col-span-6 sm:col-span-2"><label className="block text-xs mb-0.5">Forma*</label><select required value={selectedPaymentMethodId} onChange={(e)=>setSelectedPaymentMethodId(e.target.value)} disabled={isProcessingPayment||isLoadingPayMethods||!paymentMethods.length} className="w-full text-sm border rounded p-1"><option value="" disabled>{isLoadingPayMethods?'...':(!paymentMethods.length?'X':'Selecione')}</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
                                <div className="col-span-3 sm:col-span-2"><label className="block text-xs mb-0.5">Valor*</label><NumericFormat id="payment-value" value={paymentValueNum} onValueChange={handlePaymentValueChange} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale allowNegative={false} placeholder="R$ 0,00" disabled={isProcessingPayment} required className="w-full text-sm border rounded pl-6 p-1"/></div>
                                <div className="col-span-3 sm:col-span-1"><label className="block text-xs mb-0.5">Detalhes</label><input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} disabled={isProcessingPayment} placeholder="NSU" className="w-full text-sm border rounded p-1"/></div>
                                <div className="col-span-6 sm:col-span-1"><button type="submit" disabled={isProcessingPayment||!openSession} className="w-full text-sm p-1 border rounded text-white bg-green-600 disabled:opacity-50">{isProcessingPayment?'...':'Pagar'}</button></div>
                            </form>
                            <p className={`text-center font-bold mt-3 ${groupSaldoDevedor > 0.001 ? 'text-red-600' : 'text-green-600'}`}>Saldo: {formatCurrency(groupSaldoDevedor)}</p>
                        </div>)}
                        {/* Botões Finais (Impressão e Fechar) */}
                        <div className='flex justify-center items-center gap-4 mt-4'>
                             {/* **** BOTÃO DE IMPRESSÃO ADICIONADO **** */}
                             <button type="button" onClick={handlePrintConferencia} disabled={selectedComandas.length === 0 || isPrinting || isLoadingItems || isLoadingPayments} className={`px-4 py-2 text-sm rounded shadow transition-colors duration-150 ${ (selectedComandas.length === 0 || isPrinting) ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-gray-500 hover:bg-gray-600 text-white' }`}> {isPrinting ? '...' : 'Impr. Conf.'} </button>
                             {/* Botão Finalizar */}
                             <button onClick={handleCloseGroupComandas} className={`px-5 py-2 text-white rounded shadow transition-colors duration-150 ${ groupSaldoDevedor > 0.01 || !openSession || selectedComandas.length === 0 || isPrinting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`} disabled={groupSaldoDevedor > 0.01 || !openSession || selectedComandas.length === 0 || isPrinting}> {groupSaldoDevedor > 0.01 ? `Falta ${formatCurrency(groupSaldoDevedor)}` : 'Finalizar'} </button>
                         </div>
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