import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Client pages
import ClientDashboard from './pages/client/DashboardPage';
import PortfolioPage from './pages/client/PortfolioPage';
import TransactionsPage from './pages/client/TransactionsPage';
import FundsPage from './pages/client/FundsPage';

// Shareholder pages
import ShareholderDashboard from './pages/shareholder/DashboardPage';
import ClientsPage from './pages/shareholder/ClientsPage';
import ClientDetailPage from './pages/shareholder/ClientDetailPage';

// Company pages
import CompanyPage from './pages/company/CompanyPage';
import DebtPage from './pages/company/DebtPage';
import OperatingExpensePage from './pages/company/OperatingExpensePage';
import StockStrategyPage from './pages/company/StockStrategyPage';
import TaxPage from './pages/company/TaxPage';
import TradingInvestmentPage from './pages/company/TradingInvestmentPage';
import ClientsPaymentPage from './pages/company/ClientsPaymentPage';
import SharesPage from './pages/company/SharesPage';
import DepositsPage from './pages/company/DepositsPage';
import CompanyDashboardPage from './pages/company/CompanyDashboardPage';

// Shared pages
import IdeasPage from './pages/shared/IdeasPage';

// Admin pages
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import StocksPage from './pages/admin/StocksPage';
import StockDetailPage from './pages/admin/StockDetailPage';
import RelationshipsPage from './pages/admin/RelationshipsPage';
import SettingsPage from './pages/admin/SettingsPage';
import BrokerageAccountsPage from './pages/admin/BrokerageAccountsPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;

  const isShareholder = user.user_type === 'shareholder';
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <Layout>
      <Routes>
        {/* Dashboard — role-based */}
        <Route path="/dashboard" element={isAdmin ? <OverviewPage /> : isShareholder ? <ShareholderDashboard /> : <ClientDashboard />} />

        {/* Portfolio & Transactions (both types) */}
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/funds" element={<FundsPage />} />

        {/* Ideas — shareholders + admins */}
        {(isShareholder || isAdmin) && <Route path="/ideas" element={<IdeasPage />} />}

        {/* Shareholder + Admin: client management */}
        {(isShareholder || isAdmin) && <Route path="/clients" element={<ClientsPage />} />}
        {(isShareholder || isAdmin) && <Route path="/clients/:id" element={<ClientDetailPage />} />}

        {/* Company dashboard — shareholders + admins */}
        {(isAdmin || isShareholder) && <Route path="/company/dashboard" element={<CompanyDashboardPage />} />}

        {/* Company routes (admin only) */}
        {isAdmin && <Route path="/company" element={<CompanyPage />} />}
        {isAdmin && <Route path="/company/debt" element={<DebtPage />} />}
        {isAdmin && <Route path="/company/operating-expense" element={<OperatingExpensePage />} />}
        {isAdmin && <Route path="/company/stock-strategy" element={<StockStrategyPage />} />}
        {isAdmin && <Route path="/company/tax" element={<TaxPage />} />}
        {isAdmin && <Route path="/company/trading-investment" element={<TradingInvestmentPage />} />}
        {isAdmin && <Route path="/company/clients-payment" element={<ClientsPaymentPage />} />}
        {isAdmin && <Route path="/company/shares" element={<SharesPage />} />}
        {isAdmin && <Route path="/company/deposits" element={<DepositsPage />} />}

        {/* Admin routes */}
        {isAdmin && <Route path="/admin/users" element={<UsersPage />} />}
        {isAdmin && <Route path="/admin/stocks" element={<StocksPage />} />}
        {isAdmin && <Route path="/admin/stocks/:id" element={<StockDetailPage />} />}
        {isAdmin && <Route path="/admin/brokerage-accounts" element={<BrokerageAccountsPage />} />}
        {isAdmin && <Route path="/admin/relationships" element={<RelationshipsPage />} />}
        {isAdmin && <Route path="/admin/overview" element={<OverviewPage />} />}
        {user.role === 'super_admin' && <Route path="/admin/settings" element={<SettingsPage />} />}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPageWrapper />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function LoginPageWrapper() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}
