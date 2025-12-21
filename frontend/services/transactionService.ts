import { Transaction } from '../types';
import { authService } from './authService';

// Future Backend API Contracts:
// GET /api/v1/transactions



export const transactionService = {
  getTransactions: async (): Promise<Transaction[]> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch('http://localhost:8000/transactions', {
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
  clearTransactions: async (): Promise<{ success: boolean; deleted: number }> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch('http://localhost:8000/transactions/clear', {
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
