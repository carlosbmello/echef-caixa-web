import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { comandaServiceCaixa, ComandaFechadaResumo, ConsultaDetalheResponse } from '../services/comandaService';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/formatters';
import { FiPrinter } from 'react-icons/fi';
import { printService } from '../services/printService';
import { toast } from 'react-toastify';

interface ConsultaComandaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ConsultaComandaModal: React.FC<ConsultaComandaModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'data' | 'numero'>('data');
    
    const [startDate, setStartDate] = useState<Date | null>(new Date());
    const [endDate, setEndDate] = useState<Date | null>(new Date());
    const [listaComandas, setListaComandas] = useState<ComandaFechadaResumo[]>([]);

    const [numeroBusca, setNumeroBusca] = useState('');
    const [detalheConsulta, setDetalheConsulta] = useState<ConsultaDetalheResponse | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearchByDate = async () => {
    setIsLoading(true);
    setError(null);
    setListaComandas([]);
    setDetalheConsulta(null);

    // [CORREÇÃO] Adiciona uma verificação para garantir que as datas não são nulas
    if (!startDate || !endDate) {
        setError("Por favor, selecione as datas de início e fim.");
        setIsLoading(false);
        return;
    }

    try {
        const di = format(startDate, 'yyyy-MM-dd');
        const df = format(endDate, 'yyyy-MM-dd');
        const result = await comandaServiceCaixa.consultarListaFechadas(di, df);
        if (!result || result.length === 0) {
            setError("Nenhuma comanda fechada encontrada para este período.");
        } else {
            setListaComandas(result);
        }
    } catch (err: any) {
        setError(err.message || "Erro ao buscar comandas.");
    } finally {
        setIsLoading(false);
    }
};


    const handleSearchByNumber = async (num: string) => {
        if (!num.trim()) return;
        setIsLoading(true); setError(null); setListaComandas([]); setDetalheConsulta(null);
        try {
            const result = await comandaServiceCaixa.consultarDetalheFechada(num.trim());
            if (!result) {
                setError(`Nenhuma comanda fechada com o número ${num.trim()} foi encontrada.`);
            }
            setDetalheConsulta(result);
        } catch (err: any) { setError(err.message || "Erro ao buscar detalhes."); }
        finally { setIsLoading(false); }
    };

    const handleViewDetails = (numero: string) => {
        setActiveTab('numero');
        setNumeroBusca(numero);
        handleSearchByNumber(numero);
    };

    const handleCloseAndReset = () => {
        setListaComandas([]);
        setDetalheConsulta(null);
        setError(null);
        setNumeroBusca('');
        setStartDate(new Date());
        setEndDate(new Date());
        setActiveTab('data');
        onClose();
    };


    // Adicione esta nova função dentro do componente
const handleReimprimirRecibo = async () => {
        if (!detalheConsulta || isPrinting) return;
        setIsPrinting(true);
        setError(null);

        const PONTO_ID_CAIXA = 3; 

        try {
            // Cálculo do total da conta para enviar limpo
            const totalContaCalculado = detalheConsulta.lancamentos?.reduce((total, l) => {
                if (l.tipo_lancamento === 'desconto') return total - Number(l.valor);
                if (l.tipo_lancamento !== 'pagamento') return total + Number(l.valor);
                return total;
            }, 0) || 0;

            const totalPagoCalculado = detalheConsulta.pagamentos?.reduce((sum: number, p: any) => sum + Number(p.valor), 0) || 0;

            // 1. Montar o jobData enviando NÚMEROS (Raw Numbers)
            // O print-bridge se encarrega de colocar o "R$" e a vírgula.
            const jobData = {
                cabecalho: {
                    linha1: "NEVERLAND BAR",
                    linha2: "Sua casa de espetaculos"
                },
                comandas: detalheConsulta.comandas.map((comanda: any) => ({
                    numero: comanda.numero,
                    clienteNome: comanda.cliente_nome,
                    itens: comanda.itens?.map((item: any) => ({
                        quantidade: `${formatQuantity(Number(item.quantidade || 0))}x`,
                        nome: item.produto_nome,
                        // [CORREÇÃO] Envia número, não string formatada
                        valor: Number(item.quantidade || 0) * Number(item.preco_unitario_momento || 0)
                    })) || []
                })),
                resumoTransacao: {
                    consumo: detalheConsulta.lancamentos
                        .filter(l => l.tipo_lancamento === 'consumo')
                        .map(l => ({ 
                            descricao: l.descricao, 
                            valor: Number(l.valor) // [CORREÇÃO] Número puro
                        })),
                    taxaServico: {
                        descricao: "(+) Taxa de Serviço (10%)",
                        valor: Number(detalheConsulta.lancamentos.find(l => l.tipo_lancamento === 'taxa_servico')?.valor || 0)
                    },
                    acrescimos: {
                        descricao: "(+) Acréscimos",
                        valor: Number(detalheConsulta.lancamentos.find(l => l.tipo_lancamento === 'acrescimo')?.valor || 0)
                    },
                    descontos: {
                        descricao: "(-) Descontos",
                        valor: Number(detalheConsulta.lancamentos.find(l => l.tipo_lancamento === 'desconto')?.valor || 0)
                    },
                    totalConta: {
                        descricao: "Total da Conta",
                        valor: Number(totalContaCalculado)
                    }
                },
                pagamentos: detalheConsulta.pagamentos.map((p: any) => ({
                    metodo: p.nome_forma_pagamento,
                    data: formatDateTime(p.data_hora),
                    valor: Number(p.valor) // [CORREÇÃO] Número puro
                })),
                totalPago: Number(totalPagoCalculado)
            };

            await printService.imprimirPorPonto(PONTO_ID_CAIXA, jobData, 'clientePagtos');

            toast.success("Recibo enviado para a fila de impressão!");

        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsPrinting(false);
        }
    };
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl text-gray-800 dark:text-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Consultar Comanda</h2>
                        <div className="flex border-b dark:border-gray-600">
                            <button 
                                onClick={() => { setActiveTab('data'); setDetalheConsulta(null); setError(null); }}  className={`px-4 py-2 text-sm ${activeTab === 'data' ? 'border-b-2 border-blue-500 font-semibold text-blue-500' : 'text-gray-500'}`}>Por Data</button>
                            <button onClick={() => { setActiveTab('numero'); setListaComandas([]); setError(null); }} className={`px-4 py-2 text-sm ${activeTab === 'numero' ? 'border-b-2 border-blue-500 font-semibold text-blue-500' : 'text-gray-500'}`}>Por Número</button>
                        </div>
                    </div>
                    <button onClick={handleCloseAndReset} className="text-2xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">&times;</button>
                </div>

                <div className="mt-4 min-h-[400px]">
                    {isLoading && <p className="text-center italic mt-10">Buscando...</p>}
                    {error && !isLoading && <p className="text-red-500 text-center mt-10">{error}</p>}
                    
                    {activeTab === 'data' && !isLoading && !error && (
                        <div>
                            <div className="flex items-center gap-4 mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date)} className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-800" dateFormat="dd/MM/yyyy" />
                                <DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date)} className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-800" dateFormat="dd/MM/yyyy" />
                                <button onClick={handleSearchByDate} disabled={isLoading} className="px-4 py-1.5 border rounded bg-blue-600 text-white text-sm disabled:opacity-50">Buscar</button>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-gray-500">
                                        <tr><th className="p-2">Nº Comanda</th><th className="p-2">Cliente</th><th className="p-2">Valor Pago</th><th className="p-2">Data/Hora Fechamento</th><th className="p-2">Ações</th></tr>
                                    </thead>
                                    <tbody>
                                        {listaComandas.map(c => (
                                            <tr key={c.id} className="border-t dark:border-gray-700">
                                                <td className="p-2 font-bold">{c.numero}</td>
                                                <td className="p-2">{c.cliente_nome || '-'}</td>
                                                <td className="p-2">{formatCurrency(c.valor_total_pago)}</td>
                                                <td className="p-2">{formatDateTime(c.data_fechamento)}</td>
                                                <td className="p-2"><button onClick={() => handleViewDetails(c.numero)} className="text-blue-500 hover:underline">Ver</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'numero' && !isLoading && !error && (
                        <div>
                             <div className="flex items-center gap-2 mb-4">
                                <input type="text" value={numeroBusca} onChange={e => setNumeroBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchByNumber(numeroBusca)} placeholder='Digite o número da comanda' className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700" />
                                <button onClick={() => handleSearchByNumber(numeroBusca)} disabled={isLoading} className="px-4 py-1.5 border rounded bg-blue-600 text-white text-sm disabled:opacity-50">Buscar</button>
                            </div>
                            {detalheConsulta && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto p-1">
                                    
                                    {/* Coluna de Consumo */}
                                    <div>
                                        <h3 className='font-bold mb-2 text-base'>Comandas Envolvidas (Consumo)</h3>
                                        {detalheConsulta?.comandas?.map((comanda: any) => (
                                            <div key={comanda.id} className="p-3 border dark:border-gray-700 rounded-md mb-2 bg-gray-50 dark:bg-gray-700/50">
                                                <p className="font-semibold border-b dark:border-gray-600 pb-1 mb-2 text-lg">
                                                    Nº: {comanda.numero} <span className="font-normal text-sm text-gray-500">| Cliente: {comanda.cliente_nome || 'N/A'}</span>
                                                </p>
                                                <h4 className="text-sm mt-1 font-semibold mb-1">Itens Consumidos:</h4>
                                                <ul className='text-sm space-y-1'>
                                                    {comanda.itens?.length > 0 ? comanda.itens.map((item: any) => (
                                                        <li key={item.id} className="flex justify-between border-b dark:border-gray-600/50 pb-1">
                                                            <span>{item.quantidade}x {item.produto_nome}</span>
                                                            <span>{formatCurrency(Number(item.quantidade) * Number(item.preco_unitario_momento))}</span>
                                                        </li>
                                                    )) : <li className="italic text-xs">Nenhum item consumido nesta comanda.</li>}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Coluna Financeira */}
                                    <div className="space-y-4">
                                        {/* [MOVIDO] Resumo Financeiro da Transação */}
                                        <div className="p-3 border dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                            <h3 className='font-bold text-base mb-2'>Resumo da Transação</h3>
                                            <div className='text-sm space-y-1'>
                                                {detalheConsulta.lancamentos?.map(l => {
                                                    if (l.tipo_lancamento === 'pagamento') return null;
                                                    const eCredito = ['consumo', 'taxa_servico', 'acrescimo'].includes(l.tipo_lancamento);
                                                    const prefixo = eCredito ? '(+)' : '(-)';
                                                    const cor = eCredito ? 'text-gray-800 dark:text-gray-200' : 'text-green-600 dark:text-green-400';
                                                    return (
                                                        <p key={l.id} className="flex justify-between">
                                                            <span>{prefixo} {l.descricao}</span>
                                                            <span className={cor}>{formatCurrency(Number(l.valor))}</span>
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                            <p className="flex justify-between font-bold mt-2 pt-2 border-t dark:border-gray-500 text-base">
                                                <span>Total da Conta:</span> 
                                                <span>
                                                    {formatCurrency(
                                                        detalheConsulta.lancamentos?.reduce((total, l) => {
                                                            if (l.tipo_lancamento === 'desconto') return total - Number(l.valor);
                                                            if (l.tipo_lancamento !== 'pagamento') return total + Number(l.valor);
                                                            return total;
                                                        }, 0) || 0
                                                    )}
                                                </span>
                                            </p>
                                        </div>
                                        
                                        {/* Pagamentos Realizados */}
                                        <div className="p-3 border dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                            <h3 className='font-bold mb-2 text-base'>Pagamentos Realizados</h3>
                                            {detalheConsulta.pagamentos?.length > 0 ? detalheConsulta.pagamentos.map((p: any) => (
                                                <div key={p.id} className="flex justify-between p-2 border-b dark:border-gray-600 last:border-b-0">
                                                    <div>
                                                        <span className="font-semibold">{p.nome_forma_pagamento}</span>
                                                        <span className="block text-xs text-gray-500">{formatDateTime(p.data_hora)}</span>
                                                    </div>
                                                    <span className="font-semibold text-lg">{formatCurrency(Number(p.valor))}</span>
                                                </div>
                                            )) : <p className="text-sm italic p-2">Nenhum pagamento encontrado.</p>}
                                            <div className="flex justify-between font-bold border-t dark:border-gray-600 mt-1 pt-2 text-base">
                                                <span>Total Pago:</span>
                                                <span>{formatCurrency(detalheConsulta.pagamentos?.reduce((sum: number, p: any) => sum + Number(p.valor), 0) || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-end mt-2">
    <button
        onClick={handleReimprimirRecibo}
        disabled={isPrinting}
        className="px-4 py-2 bg-gray-500 text-white rounded text-sm flex items-center gap-2 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait"
    >
        <FiPrinter /> {isPrinting ? 'Imprimindo...' : 'Reimprimir Recibo'}
    </button>
</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConsultaComandaModal;