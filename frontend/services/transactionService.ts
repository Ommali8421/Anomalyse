import { Transaction } from '../types';
import { authService } from './authService';
import { API_CONFIG } from './config';

// Future Backend API Contracts:
// GET /api/v1/transactions



export const transactionService = {
  getTransactions: async (): Promise<Transaction[]> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch(`${API_CONFIG.BASE_URL}/transactions`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        authService.logout();
      }
      throw new Error('Failed to fetch transactions');
    }
    return await resp.json();
  },
  notifyTransaction: async (id: string): Promise<{ success: boolean }> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch(`${API_CONFIG.BASE_URL}/transactions/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ id })
    });
    if (!resp.ok) throw new Error('Failed to trigger notification');
    return await resp.json();
  },
  clearTransactions: async (): Promise<{ success: boolean; deleted: number }> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch(`${API_CONFIG.BASE_URL}/transactions/clear`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        authService.logout();
      }
      throw new Error('Failed to clear transactions');
    }
    return await resp.json();
  }
};
