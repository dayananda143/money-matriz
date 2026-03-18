import { Link } from 'react-router-dom';
import { Landmark, Receipt, TrendingUp, FileText, BarChart2, CreditCard, PieChart } from 'lucide-react';

const tiles = [
  {
    to: '/company/debt',
    icon: Landmark,
    label: 'Debt',
    description: 'Track company loans, liabilities and repayment schedules',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
  },
  {
    to: '/company/operating-expense',
    icon: Receipt,
    label: 'Operating Expense',
    description: 'Monitor day-to-day operational costs and expenditures',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
  },
  {
    to: '/company/stock-strategy',
    icon: TrendingUp,
    label: 'Stock Strategy Investment',
    description: 'Manage long-term stock strategy and investment allocations',
    color: 'text-brand-600 dark:text-brand-400',
    bg: 'bg-brand-50 dark:bg-brand-900/20',
  },
  {
    to: '/company/tax',
    icon: FileText,
    label: 'Tax',
    description: 'Track tax obligations, filings and compliance records',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    to: '/company/trading-investment',
    icon: BarChart2,
    label: 'Trading Investment',
    description: 'Short-term trading positions and active investment tracking',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    to: '/company/clients-payment',
    icon: CreditCard,
    label: 'Clients Payment',
    description: 'Track payments received from or made to clients',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    to: '/company/shares',
    icon: PieChart,
    label: 'Shares',
    description: 'Track shareholder equity, share allocations and ownership stakes in the company',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
  },
];

export default function CompanyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company</h1>
        <p className="text-gray-500 text-sm mt-1">Manage company finances, expenses and investment strategies</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tiles.map(({ to, icon: Icon, label, description, color, bg }) => (
          <Link
            key={to}
            to={to}
            className="card p-6 flex gap-4 items-start hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={24} className={color} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {label}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
