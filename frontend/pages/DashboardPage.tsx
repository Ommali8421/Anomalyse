import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { dashboardService } from '../services/dashboardService';
import { FraudMetrics } from '../types';

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<FraudMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await dashboardService.getFraudMetrics();
        setMetrics(data);
        setLastUpdated(new Date().toLocaleString());
      } catch (error) {
        console.error("Failed to load dashboard metrics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const COLORS = ['#10b981', '#ef4444']; // Green for Safe, Red for Fraud

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Fraud Overview</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-slate-500">Real-time analysis of transaction streams</p>
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
            onClick={async () => {
              setLoading(true);
              try {
                const data = await dashboardService.getFraudMetrics();
                setMetrics(data);
                setLastUpdated(new Date().toLocaleString());
              } finally {
                setLoading(false);
              }
            }}
            title="Refresh metrics"
          >
            Refresh
          </button>
          {lastUpdated && (
            <span className="text-xs text-slate-400">Last updated: {lastUpdated}</span>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalTransactions.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Suspicious Activity</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{metrics.flaggedTransactions}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Fraud Risk Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.overallRiskScore}%</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Fraud Trend Analysis</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.fraudTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="fraudCount" name="Suspicious" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="safeCount" name="Genuine" stroke="#cbd5e1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Risk Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics.riskDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Volume Comparison (Genuine vs Fake)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.fraudTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend />
                <Bar dataKey="safeCount" name="Genuine Transactions" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fraudCount" name="Fake Transactions" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
