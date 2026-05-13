import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  PieChart, TrendingUp, ArrowLeftRight, Wallet, LayoutDashboard,
  Users, Activity, MoreHorizontal, Newspaper,
} from 'lucide-react';

const itemsByType = {
  client: [
    { to: '/dashboard',     icon: PieChart,          label: 'Home' },
    { to: '/portfolio',     icon: TrendingUp,         label: 'Portfolio' },
    { to: '/transactions',  icon: ArrowLeftRight,     label: 'History' },
    { to: '/funds',         icon: Wallet,             label: 'Funds' },
  ],
  shareholder: [
    { to: '/dashboard',     icon: LayoutDashboard,    label: 'Home' },
    { to: '/portfolio',     icon: TrendingUp,         label: 'Portfolio' },
    { to: '/clients',       icon: Users,              label: 'Clients' },
    { to: '/movers',        icon: Activity,           label: 'Movers' },
  ],
  admin: [
    { to: '/dashboard',     icon: LayoutDashboard,    label: 'Home' },
    { to: '/portfolio',     icon: TrendingUp,         label: 'Portfolio' },
    { to: '/admin/clients', icon: Users,              label: 'Clients' },
    { to: '/movers',        icon: Activity,           label: 'Movers' },
  ],
};

export default function BottomNav({ onMoreClick }) {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role === 'admin' || user.role === 'super_admin' ? 'admin' : user.user_type;
  const items = itemsByType[role] || itemsByType.client;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-400 dark:text-gray-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      {/* More — opens full sidebar */}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-400 dark:text-gray-500 transition-colors"
      >
        <MoreHorizontal size={22} strokeWidth={1.8} />
        <span>More</span>
      </button>
    </nav>
  );
}
