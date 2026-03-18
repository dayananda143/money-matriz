import { TrendingUp } from 'lucide-react';
import CategoryPage from './CategoryPage';

export default function StockStrategyPage() {
  return <CategoryPage category="stock_strategy" label="Stock Strategy Investment" description="Long-term stock strategy and investment allocations"
    icon={TrendingUp} color="text-brand-600 dark:text-brand-400" bg="bg-brand-50 dark:bg-brand-900/20" withTransactionType />;
}
