import { FileText } from 'lucide-react';
import CategoryPage from './CategoryPage';

export default function TaxPage() {
  return <CategoryPage category="tax" label="Tax" description="Tax obligations, filings and compliance records"
    icon={FileText} color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-900/20" withUser userFilter="shareholder" />;
}
