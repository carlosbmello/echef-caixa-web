// src/utils/formatters.ts
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return 'R$ -';
    
    // Converte para número garantindo que seja um float (decimal)
    // Se for string "37.00", parseFloat transforma em 37.00
    const numberValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numberValue)) return 'R$ -';
    
    // O toLocaleString formata corretamente 37.00 para R$ 37,00
    return numberValue.toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
    });
};

export const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), "dd/MM/yy HH:mm", { locale: ptBR }); }
    catch { return '?'; }
};

export const formatQuantity = (value: string | number | null | undefined): string => {
    const n = Number(value);
    if (isNaN(n)) return '-';
    const d = String(n).includes('.') ? 3 : 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: 3 });
};