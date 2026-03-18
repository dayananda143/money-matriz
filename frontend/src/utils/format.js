export const fmt = {
  currency: (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0),
  number: (n, d = 2) => parseFloat(n ?? 0).toFixed(d),
  percent: (n) => `${parseFloat(n ?? 0).toFixed(2)}%`,
  date: (d) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  datetime: (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
};

export const pnlColor = (n) => parseFloat(n) >= 0 ? 'positive' : 'negative';
export const pnlSign = (n) => parseFloat(n) >= 0 ? '+' : '';
