import { User } from '../types';

// Future Backend API Contracts:
// POST /api/auth/login


export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    // Hardcoded login for immediate deployment fix
    if (email === 'analyst@anomalyse.bank' && password === 'password123') {
      const user: User = {
        id: 'usr_001',
        username: email,
        role: 'analyst',
        token: 'hardcoded-dev-token-for-deployment',
      };
      localStorage.setItem('anomalyse_token', user.token);
      localStorage.setItem('anomalyse_user', JSON.stringify(user));
      return user;
    }

    // Fallback to real API if credentials don't match hardcoded ones
    try {
      const resp = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!resp.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await resp.json();
      const user: User = {
        id: 'usr_001',
        username: email,
        role: 'analyst',
        token: data.access_token,
      };

      localStorage.setItem('anomalyse_token', user.token);
      localStorage.setItem('anomalyse_user', JSON.stringify(user));
      return user;
    } catch (err) {
      throw new Error('Invalid credentials');
    }
  },

  logout: () => {
    localStorage.removeItem('anomalyse_token');
    localStorage.removeItem('anomalyse_user');
    window.location.href = '#/login';
  },

  getCurrentUser: (): User | null => {
    const userStr = localStorage.getItem('anomalyse_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('anomalyse_token');
  }
};
