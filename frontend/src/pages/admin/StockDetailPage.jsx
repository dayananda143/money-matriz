import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { HoldersModal, StockEditModal } from './StocksPage';

export default function StockDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const reload = () => api.get(`/stocks/${id}`).then(r => setStock(r.data));

  useEffect(() => {
    reload().catch(() => navigate('/admin/stocks', { replace: true }));
  }, [id]);

  return (
    <div className="space-y-6">
      <HoldersModal
        stock={stock}
        open={true}
        onClose={() => navigate(-1)}
        onEdit={() => setEditOpen(true)}
        onReload={reload}
        showToast={() => {}}
        fullPage={true}
      />

      <StockEditModal
        stock={stock}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onDone={reload}
      />
    </div>
  );
}
