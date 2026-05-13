import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, Sun, Moon, Eye, EyeOff } from 'lucide-react';

function FaceIdIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 3H5a2 2 0 0 0-2 2v4" /><path d="M15 3h4a2 2 0 0 1 2 2v4" />
      <path d="M9 21H5a2 2 0 0 1-2-2v-4" /><path d="M15 21h4a2 2 0 0 0 2-2v-4" />
      <path d="M9 9v1" /><path d="M15 9v1" /><path d="M9 15a3 3 0 0 0 6 0" />
    </svg>
  );
}

function isWebAuthnAvailable() {
  return !!(window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function');
}

function PasskeySetupBanner({ onSetup, onDismiss }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handleSetup() {
    setLoading(true); setError('');
    try { await onSetup(); onDismiss(); }
    catch (e) { setError(e?.message ?? 'Setup failed. Make sure Face ID / Touch ID is enabled.'); setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <FaceIdIcon className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Enable Face ID / Touch ID</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in instantly next time — no password needed.</p>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 w-full">{error}</p>}
          <button onClick={handleSetup} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
            <FaceIdIcon />{loading ? 'Setting up…' : 'Set Up Face ID / Touch ID'}
          </button>
          <button onClick={onDismiss} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Not now</button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, registerPasskey, loginWithPasskey } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);

  const passkeyRegistered = localStorage.getItem('mm-passkey-registered') === 'true';

  useEffect(() => {
    if (!isWebAuthnAvailable()) return;
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(ok => setPlatformAvailable(ok))
      .catch(() => {});
  }, []);

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError('');
    try {
      await loginWithPasskey();
      navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Face ID / Touch ID sign-in failed. Try your password.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      if (platformAvailable && !passkeyRegistered) {
        setShowSetupBanner(true);
        setLoading(false);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      {showSetupBanner && (
        <PasskeySetupBanner
          onSetup={registerPasskey}
          onDismiss={() => { setShowSetupBanner(false); navigate('/dashboard'); }}
        />
      )}

      <button
        onClick={toggle}
        className="fixed top-4 right-4 p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4 shadow-lg">
            <TrendingUp size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Money Matriz</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Investment Portfolio Platform</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {platformAvailable && passkeyRegistered && (
            <div className="mb-5">
              <button
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <FaceIdIcon className="w-5 h-5" />
                {passkeyLoading ? 'Authenticating…' : 'Sign in with Face ID / Touch ID'}
              </button>
              <div className="flex items-center gap-3 mt-5 mb-1">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">or use password</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">© 2024 Money Matriz. All rights reserved.</p>
      </div>
    </div>
  );
}
