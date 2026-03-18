import { useState, useRef, useEffect } from 'react';
import { Menu, Sun, Moon, LogOut, KeyRound, ChevronDown, UserCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import Modal from '../ui/Modal';

export default function Header({ onMenuClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const openChangePassword = () => { setDropdownOpen(false); setForm({ current_password: '', new_password: '', confirm_password: '' }); setError(''); setSuccess(''); setModal(true); };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) { setError('New passwords do not match'); return; }
    if (form.new_password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setSaving(true);
    try {
      await api.put('/users/me/change-password', { current_password: form.current_password, new_password: form.new_password });
      setSuccess('Password changed successfully');
      setTimeout(() => setModal(false), 1500);
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <button onClick={onMenuClick} className="lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <Menu size={22} />
        </button>
        <div className="hidden lg:flex items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Welcome back, <span className="font-medium text-gray-900 dark:text-white">{user?.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <UserCircle size={20} />
              <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1">
                <button
                  onClick={openChangePassword}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <KeyRound size={15} /> Change Password
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal open={modal} onClose={() => setModal(false)} title="Change Password">
        <form onSubmit={submitChangePassword} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">{success}</div>}
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} required minLength={6} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={form.confirm_password} onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} required minLength={6} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
