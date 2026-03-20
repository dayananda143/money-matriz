export const fmt = {
  currency: (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0),
  number: (n, d = 2) => parseFloat(n ?? 0).toFixed(d),
  percent: (n) => `${parseFloat(n ?? 0).toFixed(2)}%`,
  date: (d) => {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    return `${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}-${y}`;
  },
  datetime: (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
  },
};

export const pnlColor = (n) => parseFloat(n) >= 0 ? 'positive' : 'negative';
export const pnlSign = (n) => parseFloat(n) >= 0 ? '+' : '';
