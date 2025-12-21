import { FraudMetrics } from '../types';

// Future Backend API Contracts:
// GET /api/v1/dashboard/metrics

export const dashboardService = {
  getFraudMetrics: async (): Promise<FraudMetrics> => {
    const token = localStorage.getItem('anomalyse_token');
    const resp = await fetch('http://localhost:8000/dashboard/metrics', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('anomalyse_token');
        localStorage.removeItem('anomalyse_user');
        window.location.href = '#/login';
      }
      throw new Error(`Failed to fetch metrics: ${resp.status} ${resp.statusText}`);
    }
    return await resp.json();
  }
};
