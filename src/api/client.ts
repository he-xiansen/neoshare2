import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // 可以选择重定向到登录页，或者由 AuthStore 处理
      // window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);
