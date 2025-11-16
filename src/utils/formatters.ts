// src/utils/formatters.ts
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatCurrency = (value: string | number | null | undefined): string => {
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