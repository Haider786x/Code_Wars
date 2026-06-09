import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
