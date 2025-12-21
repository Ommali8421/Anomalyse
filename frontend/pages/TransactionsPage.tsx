import React, { useEffect, useState, useMemo } from 'react';
import { transactionService } from '../services/transactionService';
import { Transaction } from '../types';
import { sortTransactions } from '../utils/sorting';
import { AlertCircle, CheckCircle, Search, Trash2, Filter, Flag, ArrowUpDown, Zap, DollarSign, AlertTriangle, Activity, Tag, Cpu } from 'lucide-react';

const getFlagIcon = (type: string, isCritical: boolean) => {
  if (!type) return null;
  const className = `w-4 h-4 ${isCritical ? 'text-red-600' : 'text-indigo-600'}`;
  const lower = type.toLowerCase();
  
  if (lower.includes('velocity')) return <Zap className={className} />;
  if (lower.includes('value') || lower.includes('amount')) return <DollarSign className={className} />;
  if (lower.includes('frequency')) return <Activity className={className} />;
  if (lower.includes('category')) return <Tag className={className} />;
  if (lower.includes('model') || lower.includes('anomaly')) return <Cpu className={className} />;
  
  return <AlertTriangle className={className} />;
};

const getFlagSeverity = (type: string): 'critical' | 'normal' => {
  const lower = type.toLowerCase();
  if (lower.includes('fraud') || lower.includes('suspicious') || lower.includes('high risk') || lower.includes('velocity') || lower.includes('device')) {
    return 'critical';
  }
  return 'normal';
};

const FlagItem = ({ type, reason, timestamp }: { type: string; reason?: string; timestamp?: string }) => {
  if (!type) return <span className="text-slate-400 text-xs">-</span>;
  
  const severity = getFlagSeverity(type);
  const isCritical = severity === 'critical';
  
  return (
    <div 
      className="group relative flex items-center gap-2 h-6 cursor-help focus:outline-none" 
      aria-label={`Flag: ${type}, Severity: ${severity}. Press Enter or Hover for details.`}
      tabIndex={0}
      role="button"
    >
      {getFlagIcon(type, isCritical)}
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
        isCritical 
          ? 'bg-red-100 text-red-800 border-red-200' 
          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
      }`}>
        {type}
      </span>
      {reason && (
        <div className="absolute right-0 bottom-full mb-2 w-80 p-0 bg-white text-slate-800 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all duration-200 delay-150 z-50 pointer-events-none border border-slate-200 overflow-hidden whitespace-normal">
          <div className={`px-3 py-2 border-b font-semibold flex justify-between items-center ${
            isCritical ? 'bg-red-50 border-red-100 text-red-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'
          }`}>
            <span className="truncate mr-2">{type}</span>
            <span className={`uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
              isCritical ? 'bg-red-200/50' : 'bg-indigo-200/50'
            }`}>{severity}</span>
          </div>
          <div className="p-3 space-y-2">
            <div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide font-medium mb-0.5">Analysis</div>
              <div className="leading-relaxed text-slate-700 break-words whitespace-normal">
                {reason}
              </div>
            </div>
            {timestamp && (
              <div className="pt-2 border-t border-slate-100">
                 <div className="text-slate-500 text-[10px] uppercase tracking-wide font-medium mb-0.5">Raised At</div>
                 <div className="text-slate-600 font-mono text-[10px]">{new Date(timestamp).toLocaleString()}</div>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b border-slate-200"></div>
        </div>
      )}
    </div>
  );
};

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await transactionService.getTransactions();
        // Initial sort by default util
        const sortedData = sortTransactions(data);
        setTransactions(sortedData);
      } catch (error) {
        console.error("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const uniqueReasons = useMemo(() => {
    const reasons = new Set<string>();
    transactions.forEach(t => {
      if (t.flags && t.flags.length > 0) {
        t.flags.forEach(f => { if (f.reason) reasons.add(f.reason); });
      } else if (t.flag_reason) {
        reasons.add(t.flag_reason);
      }
    });
    return Array.from(reasons);
  }, [transactions]);

  const uniqueFlags = useMemo(() => {
    const flags = new Set<string>();
    transactions.forEach(t => {
      if (t.flags && t.flags.length > 0) {
        t.flags.forEach(f => { if (f.type) flags.add(f.type); });
      } else if (t.flag_type) {
        flags.add(t.flag_type);
      }
    });
    return Array.from(flags).sort();
  }, [transactions]);

  const filteredData = useMemo(() => {
    let data = transactions.filter(t => 
      (t.id.toLowerCase().includes(filter.toLowerCase()) || 
       t.user_id.toLowerCase().includes(filter.toLowerCase())) &&
      (reasonFilter ? (t.flags ? t.flags.some(f => f.reason === reasonFilter) : t.flag_reason === reasonFilter) : true) &&
      (flagFilter ? (t.flags ? t.flags.some(f => f.type === flagFilter) : t.flag_type === flagFilter) : true)
    );

    if (sortConfig) {
      data = [...data].sort((a, b) => {
        // @ts-ignore - dynamic access
        const valA = a[sortConfig.key];
        // @ts-ignore
        const valB = b[sortConfig.key];

        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [transactions, filter, reasonFilter, flagFilter, sortConfig]);

  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (score: number) => {
    if (score > 70) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
          <AlertCircle className="w-3 h-3" />
          Fake / Suspicious
        </span>
      );
    } else if (score > 40) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Review Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        <CheckCircle className="w-3 h-3" />
        Safe
      </span>
    );
  };

  const getActionGuidance = (txn: Transaction) => {
    if (txn.riskScore > 70) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100 w-fit">
            Immediate Review
          </span>
          <span className="text-[10px] text-slate-500">Check user history & device</span>
        </div>
      );
    }
    if (txn.riskScore > 40) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">
            Verify Details
          </span>
           <span className="text-[10px] text-slate-500">Confirm with customer</span>
        </div>
      );
    }
    return <span className="text-xs text-slate-400">Routine monitoring</span>;
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      setStatus({ type: null, message: '' });
      await transactionService.clearTransactions();
      setTransactions([]);
      setStatus({ type: 'success', message: 'All transactions cleared.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to clear transactions. Please log in again if your session expired.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction Monitor</h1>
          <p className="text-slate-500">Live feed of processed transactions with real-time risk analysis and actionable guidance.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                title="Filter by Reason"
              >
                <option value="">All Reasons</option>
                {uniqueReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
             <div className="relative">
              <Flag className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <select
                value={flagFilter}
                onChange={(e) => setFlagFilter(e.target.value)}
                className="pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                title="Filter by Flag"
              >
                <option value="">All Flags</option>
                {uniqueFlags.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search ID or Merchant..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
            />
          </div>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            disabled={loading}
            title="Clear all transactions"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading transaction feed...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => requestSort('id')}>
                    <div className="flex items-center gap-1">Transaction ID <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => requestSort('timestamp')}>
                     <div className="flex items-center gap-1">Date & Time <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Merchant / Location</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => requestSort('amount')}>
                     <div className="flex items-center justify-end gap-1">Amount <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => requestSort('riskScore')}>
                     <div className="flex items-center justify-center gap-1">Risk Score <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => requestSort('flag_type')}>
                    <div className="flex items-center gap-1">Flag Analysis <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Action / Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredData.map((txn) => (
                  <tr 
                    key={txn.id}
                    className={`transition-colors ${
                      txn.riskScore > 70 ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {txn.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{txn.timestamp}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      <div className="font-medium">{txn.user_id}</div>
                      <div className="text-xs text-slate-500">{txn.city} • {txn.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-slate-900">
                      ₹{txn.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-slate-200 rounded-full h-2 mr-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full ${txn.riskScore > 70 ? 'bg-red-600' : txn.riskScore > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${txn.riskScore}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-bold ${txn.riskScore > 70 ? 'text-red-700' : 'text-slate-600'}`}>
                          {txn.riskScore}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                       {getStatusBadge(txn.riskScore)}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <div className="flex flex-col gap-1">
                         {(txn.flags && txn.flags.length > 0) ? (
                             txn.flags.map((flag, idx) => (
                                 <FlagItem key={idx} type={flag.type} reason={flag.reason} timestamp={txn.timestamp} />
                             ))
                         ) : (
                             <FlagItem type={txn.flag_type || ''} reason={txn.flag_reason} timestamp={txn.timestamp} />
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       {getActionGuidance(txn)}
                     </td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {status.type === 'success' && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-sm text-green-700">{status.message}</p>
        </div>
      )}
      {status.type === 'error' && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm text-red-700">{status.message}</p>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
