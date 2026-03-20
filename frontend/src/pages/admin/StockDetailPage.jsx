import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { HoldersModal } from './StocksPage';

export default function StockDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);

  useEffect(() => {
    api.get(`/stocks/${id}`)
      .then(r => setStock(r.data))
      .catch(() => navigate('/admin/stocks', { replace: true }));
  }, [id]);

  const handleEdit = (s) => {
    // Navigate back to stocks page with edit intent
    navigate('/admin/stocks');
  };

  return (
    <div className="space-y-6">
      <HoldersModal
        stock={stock}
        open={true}
        onClose={() => navigate(-1)}
        onEdit={handleEdit}
        onReload={() => api.get(`/stocks/${id}`).then(r => setStock(r.data))}
        showToast={() => {}}
        fullPage={true}
      />
    </div>
  );
}
