import React from 'react';
import { Activity, ArrowUpRight, BarChart2, Cpu, RefreshCw, Zap, LogOut, ShieldCheck, User, Star } from 'lucide-react';
import { QuotePair, Timeframe, formatTimeframeDisplay } from '../types/trading';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  coin: string;
  pair: QuotePair;
  timeframe: Timeframe;
  strategyName: string;
  dataSource: 'live' | 'synthetic';
  lastPrice: number;
  priceChange24h: number;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenFavorites?: () => void;
  favoritesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  coin,
  pair,
  timeframe,
  strategyName,
  dataSource,
  lastPrice,
  priceChange24h,
  onRefresh,
  isLoading,
  onOpenFavorites,
  favoritesCount = 0,
}) => {
  const { user, logout } = useAuth();
  const isPositive = priceChange24h >= 0;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Active Pair */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <BarChart2 className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  Crypto Strategy Tester
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold">
                  v2.4 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Institutional-grade algorithmic backtesting & quantitative analytics
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Active Ticker Pill */}
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs">
            <span className="font-bold text-slate-100 flex items-center gap-1">
              <span className="text-emerald-400">{coin}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{pair}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 font-medium">
              {formatTimeframeDisplay(timeframe)}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-200 font-semibold">
              ${lastPrice < 1 ? lastPrice.toFixed(6) : lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`flex items-center text-[11px] font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right: Data Feed Badge & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border bg-slate-950/60 border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dataSource === 'live' ? 'bg-emerald-400' : 'bg-cyan-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${dataSource === 'live' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
            </span>
            <span className="text-slate-400 text-[11px]">Feed:</span>
            <span className={`font-semibold text-[11px] ${dataSource === 'live' ? 'text-emerald-400' : 'text-cyan-300'}`}>
              {dataSource === 'live' ? 'Binance Live' : 'Precision Sim'}
            </span>
          </div>

          <button
            id="btn-refresh-data"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
            title="Reload latest market data & re-run backtest"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>

          {/* Favorites Library Button */}
          {onOpenFavorites && (
            <button
              id="btn-header-open-favorites"
              type="button"
              onClick={onOpenFavorites}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Open Favorite Strategies Library"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Favorites</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                {favoritesCount}
              </span>
            </button>
          )}

          {/* User Authentication & Sign Out */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-purple-500/30 rounded-lg px-2.5 py-1">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-5 h-5 rounded-full ring-1 ring-purple-400/50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[10px] font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <div className="text-[11px] font-semibold text-slate-200 leading-tight flex items-center gap-1">
                    <span>{user.name}</span>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-[9px] font-mono text-purple-300/80 leading-tight">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                id="btn-auth-logout"
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="Sign out of private terminal"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
