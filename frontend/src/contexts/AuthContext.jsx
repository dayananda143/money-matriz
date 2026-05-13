import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import api from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mm-token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('mm-token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('mm-token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('mm-token');
    setUser(null);
  };

  const registerPasskey = useCallback(async () => {
    const res = await api.post('/auth/webauthn/register-options', {});
    const response = await startRegistration(res.data);
    const verify = await api.post('/auth/webauthn/register-verify', response);
    if (verify.data.verified) {
      localStorage.setItem('mm-passkey-registered', 'true');
    }
    return verify.data;
  }, []);

  const loginWithPasskey = useCallback(async () => {
    const res = await api.post('/auth/webauthn/login-options', {});
    const response = await startAuthentication(res.data);
    const verify = await api.post('/auth/webauthn/login-verify', response);
    localStorage.setItem('mm-token', verify.data.token);
    setUser(verify.data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerPasskey, loginWithPasskey }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
