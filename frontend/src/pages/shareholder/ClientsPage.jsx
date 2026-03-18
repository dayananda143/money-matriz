import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonSearchBar, SkeletonTable } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const url = isAdmin ? '/relationships/all-clients' : '/relationships/shareholder/me';
    api.get(url)
      .then(r => setClients(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonSearchBar />
      <SkeletonTable rows={8} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAdmin ? 'All Clients' : 'My Clients'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isAdmin ? `${clients.length} total clients on the platform` : `${clients.length} clients assigned to you`}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              {isAdmin && <Th>Manager</Th>}
              <Th>Cash Balance</Th>
              <Th>Portfolio Value</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={isAdmin ? 8 : 7} message="No clients found" />}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>
                  <Link to={`/clients/${c.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                    {c.name}
                  </Link>
                </Td>
                <Td className="text-gray-500">{c.email}</Td>
                {isAdmin && <Td className="text-gray-500 text-xs">{c.shareholder_name || '—'}</Td>}
                <Td>{fmt.currency(c.cash_balance)}</Td>
                <Td>{fmt.currency(c.portfolio_value)}</Td>
                <Td className="font-medium">{fmt.currency(parseFloat(c.cash_balance) + parseFloat(c.portfolio_value))}</Td>
                <Td><span className={c.is_active ? 'badge-green' : 'badge-red'}>{c.is_active ? 'Active' : 'Inactive'}</span></Td>
                <Td className="text-gray-500 text-xs">{fmt.date(c.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
