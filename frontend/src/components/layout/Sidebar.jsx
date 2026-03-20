import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, TrendingUp, ArrowLeftRight, Users, BarChart2,
  Settings, Link2, X, Wallet, UserCircle, SlidersHorizontal, Building2, PieChart, Lightbulb, Briefcase
} from 'lucide-react';

const navConfig = {
  client: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/portfolio', icon: TrendingUp, label: 'Portfolio' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
    { to: '/funds', icon: Wallet, label: 'Fund Movements' },
  ],
  shareholder: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/portfolio', icon: TrendingUp, label: 'My Portfolio' },
    { to: '/transactions', icon: ArrowLeftRight, label: 'My Transactions' },
    { to: '/clients', icon: Users, label: 'My Clients' },
    { to: '/company/dashboard', icon: PieChart, label: 'Company Dashboard' },
    { to: '/ideas', icon: Lightbulb, label: 'Ideas' },
  ],
  admin_extra: [
    { to: '/clients', icon: Users, label: 'All Clients' },
    { to: '/company', icon: Building2, label: 'Company' },
    { to: '/admin/users', icon: UserCircle, label: 'Users' },
    { to: '/admin/stocks', icon: BarChart2, label: 'Stocks' },
    { to: '/admin/relationships', icon: Link2, label: 'Relationships' },
    { to: '/admin/brokerage-accounts', icon: Briefcase, label: 'Brokerage Accounts' },
  ],
  super_admin_extra: [
    { to: '/admin/overview', icon: Settings, label: 'Overview' },
    { to: '/admin/settings', icon: SlidersHorizontal, label: 'Platform Settings' },
  ]
};

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isSuperAdmin = user.role === 'super_admin';
  const isShareholder = user.user_type === 'shareholder';
  const base = (navConfig[user.user_type] || []).filter(i => !(isSuperAdmin && i.to === '/clients') && i.to !== '/ideas');
  const adminItems = isAdmin ? navConfig.admin_extra : [];
  const superItems = user.role === 'super_admin' ? navConfig.super_admin_extra : [];
  const ideasItem = (isAdmin || isShareholder) ? [{ to: '/ideas', icon: Lightbulb, label: 'Ideas' }] : [];
  const seen = new Set();
  const allItems = [...base, ...adminItems, ...superItems].filter(i => {
    if (seen.has(i.to)) return false;
    seen.add(i.to);
    return true;
  });

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">Money Matriz</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {base.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Main</p>
              {base.map(item => <NavItem key={item.to} {...item} onClick={onClose} />)}
            </>
          )}
          {adminItems.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Management</p>
              {adminItems.map(item => <NavItem key={item.to} {...item} onClick={onClose} />)}
            </>
          )}
          {superItems.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">System</p>
              {superItems.map(item => <NavItem key={item.to} {...item} onClick={onClose} />)}
            </>
          )}
          {ideasItem.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Community</p>
              {ideasItem.map(item => <NavItem key={item.to} {...item} onClick={onClose} />)}
            </>
          )}
        </nav>

        {/* User info */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.user_type} · {user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
