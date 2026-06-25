export const formatMoney = (value?: number | string | null, currency = '₪') => {
  if (value == null || value === '') return '-';

  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? `${currency}${amount.toFixed(2)}` : '-';
};
export const formatDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : '-';
export const compactStatus = (s?: string) => s ? s.replaceAll('_', ' ').toLowerCase() : '';
