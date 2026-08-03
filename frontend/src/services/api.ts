import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/tickets-api/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('mrti-auth-expired'));
    }
    if (error.response?.status === 403 && error.response?.data?.error?.code === 'MODULE_FORBIDDEN') {
      window.location.replace('/?accessDenied=tickets');
    }
    return Promise.reject(error);
  }
);

export default api;
