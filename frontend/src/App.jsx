import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

import UnifiedDashboard from './pages/UnifiedDashboard';

// Client pages
import PortfolioPage from './pages/client/PortfolioPage';
import TransactionsPage from './pages/client/TransactionsPage';
import FundsPage from './pages/client/FundsPage';

// Shareholder pages
import ClientsPage from './pages/shareholder/ClientsPage';
import ClientDetailPage from './pages/shareholder/ClientDetailPage';
import DematAccountPage from './pages/shareholder/DematAccountPage';

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
import MoversPage from './pages/shared/MoversPage';
import TradeRequestsPage from './pages/shared/TradeRequestsPage';
import TodaysDataPage from './pages/shared/TodaysDataPage';
import NewsPage from './pages/shared/NewsPage';

// Admin pages
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import StocksPage from './pages/admin/StocksPage';
import StockDetailPage from './pages/admin/StockDetailPage';
import StockAnalysisPage from './pages/admin/StockAnalysisPage';
import RelationshipsPage from './pages/admin/RelationshipsPage';
import ClientDashboardPage from './pages/admin/ClientDashboardPage';
import SettingsPage from './pages/admin/SettingsPage';
import BrokerageAccountsPage from './pages/admin/BrokerageAccountsPage';
import SIPPage, { SIPTilesPage } from './pages/admin/SIPPage';
import AllClientsPage from './pages/admin/AllClientsPage';
import AlertsPage from './pages/AlertsPage';
import StockAlertsPage from './pages/StockAlertsPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;

  const isShareholder = user.user_type === 'shareholder';
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <Layout>
      <Routes>
        {/* Dashboard — unified */}
        <Route path="/dashboard" element={<UnifiedDashboard />} />

        {/* Portfolio & Transactions (both types) */}
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/funds" element={<FundsPage />} />

        {/* Ideas — shareholders + admins */}
        {(isShareholder || isAdmin) && <Route path="/ideas" element={<IdeasPage />} />}

        {/* Movers — all users */}
        <Route path="/movers" element={<MoversPage />} />

        {/* Today's Data — all users */}
        <Route path="/todays-data" element={<TodaysDataPage />} />
        {isAdmin && <Route path="/news" element={<NewsPage />} />}

        {/* Trade Requests — shareholders and admins only */}
        {(isShareholder || isAdmin) && <Route path="/trade-requests" element={<TradeRequestsPage />} />}

        {/* Demat account — any user with personal holdings */}
        <Route path="/demat" element={<DematAccountPage />} />

        {/* Shareholder: my clients */}
        {(isShareholder || isAdmin) && <Route path="/clients/dashboard" element={<ClientDashboardPage />} />}
        {(isShareholder || isAdmin) && <Route path="/clients" element={<ClientsPage />} />}
        {(isShareholder || isAdmin) && <Route path="/clients/:id" element={<ClientDetailPage />} />}

        {/* Admin: all clients */}
        {isAdmin && <Route path="/admin/clients" element={<AllClientsPage />} />}
        {isAdmin && <Route path="/admin/clients/:scheme" element={<AllClientsPage />} />}

        {/* Company dashboard — shareholders + admins */}
        {(isAdmin || isShareholder) && <Route path="/company/dashboard" element={<CompanyDashboardPage />} />}

        {/* Company routes (admin only) */}
        {isAdmin && <Route path="/company" element={<CompanyPage />} />}
        {isAdmin && <Route path="/company/deposits" element={<DepositsPage />} />}
        {/* Company detail routes — admin full access, shareholder read-only */}
        {(isAdmin || isShareholder) && <Route path="/company/debt" element={<DebtPage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/operating-expense" element={<OperatingExpensePage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/stock-strategy" element={<StockStrategyPage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/tax" element={<TaxPage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/trading-investment" element={<TradingInvestmentPage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/clients-payment" element={<ClientsPaymentPage />} />}
        {(isAdmin || isShareholder) && <Route path="/company/shares" element={<SharesPage />} />}

        {/* Admin routes */}
        {isAdmin && <Route path="/admin/users" element={<UsersPage />} />}
        {isAdmin && <Route path="/admin/stocks" element={<StocksPage />} />}
        {isAdmin && <Route path="/admin/stocks/:id" element={<StockDetailPage />} />}
        {isAdmin && <Route path="/admin/stock-analysis" element={<StockAnalysisPage />} />}
        {isAdmin && <Route path="/admin/brokerage-accounts" element={<BrokerageAccountsPage />} />}
        {isAdmin && <Route path="/sip" element={<SIPTilesPage />} />}
        {(isAdmin || isShareholder) && <Route path="/sip/:shareholderId" element={<SIPPage />} />}
        {isShareholder && !isAdmin && <Route path="/sip" element={<SIPPage />} />}
        {(isAdmin || isShareholder) && <Route path="/alerts" element={<AlertsPage />} />}
        {(isAdmin || isShareholder) && <Route path="/stock-alerts" element={<StockAlertsPage />} />}
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
        <NotificationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPageWrapper />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </NotificationProvider>
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
