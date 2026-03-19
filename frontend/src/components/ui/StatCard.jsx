import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, sub, trend, icon: Icon, color = 'brand' }) {
  const iconColors = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  };
  const valueColors = {
    brand: 'text-brand-600 dark:text-brand-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    teal: 'text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${valueColors[color] ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${parseFloat(trend) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {parseFloat(trend) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{parseFloat(trend) >= 0 ? '+' : ''}{parseFloat(trend).toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
