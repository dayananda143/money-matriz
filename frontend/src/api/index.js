const BASE = '/api';

async function request(method, path, data) {
  const token = localStorage.getItem('mm-token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  };
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401) {
    localStorage.removeItem('mm-token');
    window.location.href = '/login';
    return;
  }
  const json = await res.json();
  if (!res.ok) throw { status: res.status, message: json.error || 'Request failed', data: json };
  return { data: json, status: res.status };
}

const api = {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  delete: (path) => request('DELETE', path),
};

export default api;
