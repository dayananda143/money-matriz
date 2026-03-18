import { CreditCard } from 'lucide-react';
import CategoryPage from './CategoryPage';

export default function ClientsPaymentPage() {
  return (
    <CategoryPage
      category="clients_payment"
      label="Clients Payment"
      description="Track payments received from or made to clients"
      icon={CreditCard}
      color="text-emerald-600 dark:text-emerald-400"
      bg="bg-emerald-50 dark:bg-emerald-900/20"
      withUser
      userFilter="client"
      withScheme
    />
  );
}
