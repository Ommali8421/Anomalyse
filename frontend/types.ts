// Shared Data Models

export interface User {
  id: string;
  username: string;
  role: 'analyst' | 'admin';
  token: string;
}

export interface Transaction {
  id: string;
  timestamp: string;
  amount: number;
  user_id: string;
  city: string;
  category: string;
  status: 'Safe' | 'Suspicious';
  riskScore?: number;
  flag_type?: string;
  flag_reason?: string;
  flags?: Array<{ type: string; reason: string }>;
  time_since_last_txn?: number;
  distance_km?: number;
}

export interface FraudMetrics {
  totalTransactions: number;
  flaggedTransactions: number;
  overallRiskScore: number;
  fraudTrend: Array<{ date: string; fraudCount: number; safeCount: number }>;
  riskDistribution: Array<{ name: string; value: number }>;
}
