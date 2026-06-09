import axios from 'axios';
import { getToken, clearAuthSession } from '@/lib/auth/authStore.js';

const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to every request if available
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear session on 401
axiosInstance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuthSession();
    }
    return Promise.reject(err);
  },
);

export const api = {
  getAction: async (url, config) => {
    const response = await axiosInstance.get(url, config);
    return response.data;
  },

  postAction: async (url, data, config) => {
    const response = await axiosInstance.post(url, data, config);
    return response.data;
  },

  patchAction: async (url, data, config) => {
    const response = await axiosInstance.patch(url, data, config);
    return response.data;
  },

  deleteAction: async (url, config) => {
    const response = await axiosInstance.delete(url, config);
    return response.data;
  },
};
