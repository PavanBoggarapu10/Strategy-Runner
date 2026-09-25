import React, { useState } from 'react';
import { Trade } from '../types/trading';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface TradeHistoryTableProps {
  trades: Trade[];
  coin: string;
  pair: string;
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ trades, coin, pair }) => {
  const [filter, setFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredTrades = trades.filter((t) => {
    if (filter === 'WIN' && t.pnl <= 0) return false;
    if (filter === 'LOSS' && t.pnl >= 0) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.type.toLowerCase().includes(q) ||
        t.exitReason.toLowerCase().includes(q) ||
        t.id.toString().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = filteredTrades.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const headers = [
      'Trade ID',
      'Side',
      'Entry Time',
      'Entry Price',
      'Exit Time',
      'Exit Price',
      'Size USD',
      'Net PnL USD',
      'PnL Percent',
      'Exit Reason',
      'Duration Bars',
      'Max Runup %',
      'Max Drawdown %',
    ];

    const rows = trades.map((t) => [
      t.id,
      t.type,
      new Date(t.entryTime).toISOString(),
      t.entryPrice,
      new Date(t.exitTime).toISOString(),
      t.exitPrice,
      t.size,
      t.pnl,
      t.pnlPercent,
      t.exitReason,
      t.durationCandles,
      t.maxRunup,
      t.maxDrawdown,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${coin}_${pair}_backtest_trades.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExitBadge = (reason: Trade['exitReason']) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold">Take Profit</span>;
      case 'STOP_LOSS':
        return <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[10px] font-semibold">Stop Loss</span>;
      case 'TRAILING_STOP':
        return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-semibold">Trailing Stop</span>;
      case 'LIQUIDATION':
        return <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/40 text-[10px] font-bold">Liquidation</span>;
      case 'SIGNAL':
        return <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-[10px] font-semibold">Signal Flip</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">End of Period</span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Header with Filters and Export */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-200">Trade Execution Ledger</h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {trades.length} Trades Recorded
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              id="input-search-trades"
              type="text"
              placeholder="Search trades..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-36 sm:w-44"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              id="btn-filter-all"
              onClick={() => { setFilter('ALL'); setPage(1); }}
              className={`px-2.5 py-1 rounded transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
            >
              All ({trades.length})
            </button>
            <button
              id="btn-filter-wins"
              onClick={() => { setFilter('WIN'); setPage(1); }}
              className={`px-2.5 py-1 rounded transition-colors ${filter === 'WIN' ? 'bg-emerald-950/60 text-emerald-400 font-medium' : 'text-slate-400'}`}
            >
              Wins ({trades.filter(t => t.pnl > 0).length})
            </button>
            <button
              id="btn-filter-losses"
              onClick={() => { setFilter('LOSS'); setPage(1); }}
              className={`px-2.5 py-1 rounded transition-colors ${filter === 'LOSS' ? 'bg-rose-950/60 text-rose-400 font-medium' : 'text-slate-400'}`}
            >
              Losses ({trades.filter(t => t.pnl < 0).length})
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            id="btn-export-csv"
            onClick={exportCSV}
            disabled={trades.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px]">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Side</th>
              <th className="py-2.5 px-3">Entry Time / Price</th>
              <th className="py-2.5 px-3">Exit Time / Price</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Size ($)</th>
              <th className="py-2.5 px-3">Net PnL</th>
              <th className="py-2.5 px-3">ROI %</th>
              <th className="py-2.5 px-3">Exit Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedTrades.length > 0 ? (
              paginatedTrades.map((trade) => {
                const isWin = trade.pnl > 0;
                const isLong = trade.type === 'LONG';

                return (
                  <tr
                    key={trade.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-slate-500 font-bold">{trade.id}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                        }`}
                      >
                        {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200 font-semibold">${trade.entryPrice.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">{new Date(trade.entryTime).toLocaleDateString()} {new Date(trade.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200 font-semibold">${trade.exitPrice.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">{new Date(trade.exitTime).toLocaleDateString()} {new Date(trade.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {trade.durationCandles} bars
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      ${trade.size.toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isWin ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3">
                      {getExitBadge(trade.exitReason)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No trades matched current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
