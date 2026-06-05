import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    const token = localStorage.getItem('mm-token');
    const socket = io('', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(c => c + 1);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user, loadNotifications]);

  const markRead = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  }, []);

  const acknowledge = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/acknowledge`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_acknowledged: true, is_read: true } : n));
      setUnreadCount(c => {
        const notif = notifications.find(n => n.id === id);
        return notif && !notif.is_read ? Math.max(0, c - 1) : c;
      });
    } catch {}
  }, [notifications]);

  const acknowledgeAll = useCallback(async () => {
    try {
      await api.put('/notifications/acknowledge-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_acknowledged: true, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  // Stock alert notifications that haven't been acknowledged yet — these persist in sidebar
  const pendingAlerts = notifications.filter(
    n => !n.is_acknowledged && (n.type === 'stop_loss' || n.type === 'target')
  );

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      pendingAlerts,
      markRead,
      markAllRead,
      clearAll,
      acknowledge,
      acknowledgeAll,
      reload: loadNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
