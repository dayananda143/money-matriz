import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonFilterPills, SkeletonTable } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const url = isAdmin
      ? '/portfolio/all/transactions?limit=500'
      : '/portfolio/me/transactions?limit=100';
    api.get(url)
      .then(r => setTxs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonFilterPills count={3} />
      <SkeletonTable rows={8} cols={8} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin ? `All platform transactions — ${filtered.length} records` : 'All buy / sell activity'}
        </p>
      </div>

      <div className="flex gap-2">
        {['all', 'buy', 'sell'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Stock</Th>
              {isAdmin && <Th>Investor</Th>}
              <Th>Qty</Th>
              <Th>Price</Th>
              <Th>Total</Th>
              <Th>Executed By</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={isAdmin ? 9 : 8} message="No transactions found" />}
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>{fmt.datetime(t.executed_at)}</Td>
                <Td>
                  <span className={t.type === 'buy' ? 'badge-green' : 'badge-red'}>
                    {t.type.toUpperCase()}
                  </span>
                </Td>
                <Td>
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-gray-400 text-xs ml-1">{t.stock_name}</span>
                </Td>
                {isAdmin && (
                  <Td>
                    <p className="font-medium text-gray-900 dark:text-white">{t.user_name}</p>
                    <p className="text-xs text-gray-400">{t.user_type}</p>
                  </Td>
                )}
                <Td>{fmt.number(t.quantity, 2)}</Td>
                <Td>{fmt.currency(t.price)}</Td>
                <Td className="font-medium">{fmt.currency(t.total)}</Td>
                <Td className="text-gray-500">{t.executed_by_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{t.notes || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
