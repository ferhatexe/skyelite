import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthState } from '../types';

interface AuthContextType {
  state: AuthState;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('token'),
    admin: null,
    isAuthenticated: false,
    loading: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setState({
          token: null,
          admin: null,
          isAuthenticated: false,
          loading: false,
        });
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setState({
            token,
            admin: response.data.admin,
            isAuthenticated: true,
            loading: false,
          });
        } else {
          localStorage.removeItem('token');
          setState({
            token: null,
            admin: null,
            isAuthenticated: false,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('token');
        setState({
          token: null,
          admin: null,
          isAuthenticated: false,
          loading: false,
        });
      }
    };

    checkAuth();
  }, []);

  const login = async (pin: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await api.post('/auth/login', { pin });
      if (response.data.success) {
        const { token, admin } = response.data;
        localStorage.setItem('token', token);
        setState({
          token,
          admin,
          isAuthenticated: true,
          loading: false,
        });
      }
    } catch (error: any) {
      localStorage.removeItem('token');
      setState({
        token: null,
        admin: null,
        isAuthenticated: false,
        loading: false,
      });
      throw new Error(error.response?.data?.message || 'Giriş yapılamadı.');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({
      token: null,
      admin: null,
      isAuthenticated: false,
      loading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
