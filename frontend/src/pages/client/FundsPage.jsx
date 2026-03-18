import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';

export default function FundsPage() {
  const [movements, setMovements] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/me/funds'),
      api.get('/portfolio/me/summary')
    ]).then(([f, s]) => {
      setMovements(f.data);
      setBalance(s.data.cash_balance);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} cols="grid-cols-1 sm:grid-cols-3" />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );

  const totalDeposited = movements.filter(m => m.type === 'deposit').reduce((s, m) => s + parseFloat(m.amount), 0);
  const totalWithdrawn = movements.filter(m => m.type === 'withdrawal').reduce((s, m) => s + parseFloat(m.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fund Movements</h1>
        <p className="text-gray-500 text-sm mt-1">Deposits and withdrawals history</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Available Balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(balance)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Deposited</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt.currency(totalDeposited)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Withdrawn</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{fmt.currency(totalWithdrawn)}</p>
        </div>
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Processed By</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {!movements.length && <EmptyRow cols={5} message="No fund movements yet" />}
            {movements.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>{fmt.datetime(m.executed_at)}</Td>
                <Td>
                  <span className={m.type === 'deposit' ? 'badge-green' : 'badge-red'}>
                    {m.type.toUpperCase()}
                  </span>
                </Td>
                <Td className="font-medium">{fmt.currency(m.amount)}</Td>
                <Td className="text-gray-500">{m.executed_by_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{m.notes || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
