import { create } from 'zustand';
import { client } from '../api/client';

interface User {
  id: number;
  username: string;
  role: string;
  nickname?: string;
  avatar_url?: string;
  signature?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
          const res = await client.get('/auth/me');
          set({ user: res.data, isAuthenticated: true });
          localStorage.setItem('user', JSON.stringify(res.data));
      } catch (e) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          set({ token: null, user: null, isAuthenticated: false });
      }
  }
}));
