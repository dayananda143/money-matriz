import { Receipt } from 'lucide-react';
import CategoryPage from './CategoryPage';

export default function OperatingExpensePage() {
  return <CategoryPage category="operating_expense" label="Operating Expense" description="Day-to-day operational costs and expenditures"
    icon={Receipt} color="text-orange-600 dark:text-orange-400" bg="bg-orange-50 dark:bg-orange-900/20" />;
}
