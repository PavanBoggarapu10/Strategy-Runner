import React from 'react';
import { BacktestResult } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Award,
  Shield,
  Activity,
  Zap,
  Clock,
  DollarSign,
  AlertTriangle,
  Calendar,
  Star,
  BookmarkCheck,
} from 'lucide-react';

interface MetricsOverviewProps {
  result: BacktestResult;
  onOpenSaveFavorite?: () => void;
  onOpenFavoritesManager?: () => void;
  isFavorited?: boolean;
  favoritesCount?: number;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  result,
  onOpenSaveFavorite,
  onOpenFavoritesManager,
  isFavorited = false,
  favoritesCount = 0,
}) => {
  const isProfitable = result.netProfit >= 0;
  const isOutperforming = result.alphaPercent >= 0;

  return (
    <div className="space-y-3">
      {/* Range, Market & Favorites Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900/70 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          {result.periodLabel && (
            <>
              <span>Backtest Range: <strong className="text-white font-semibold">{result.periodLabel}</strong></span>
              <span className="text-slate-600">•</span>
            </>
          )}
          <span>Total Bars: <strong className="text-slate-200 font-semibold">{result.equityCurve.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Market: <span className="text-amber-400 font-semibold">{result.symbol}/{result.pair} ({result.timeframe})</span></span>
        </div>

        {/* Favorite Quick Action Trigger */}
        <div className="flex items-center gap-2">
          {onOpenSaveFavorite && (
            <button
              id="btn-favorite-results-setup"
              type="button"
              onClick={onOpenSaveFavorite}
              className={`px-3 py-1 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                isFavorited
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : isProfitable
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Save this entire strategy setup, capital, leverage, stop loss, take profit, and fees to your favorites"
            >
              <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-400 text-amber-400' : isProfitable ? 'fill-slate-950 text-slate-950' : 'text-amber-400'}`} />
              <span>{isFavorited ? 'Favorited Setup' : 'Save to Favorites'}</span>
            </button>
          )}

          {onOpenFavoritesManager && favoritesCount > 0 && (
            <button
              id="btn-view-favorites-from-metrics"
              type="button"
              onClick={onOpenFavoritesManager}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-sans font-medium flex items-center gap-1 transition-colors"
              title="Open your library of favorite strategies"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Favorites ({favoritesCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Hero Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Net Profit */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Profit</span>
            {isProfitable ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="mt-2">
            <div className={`text-xl font-mono font-bold tracking-tight ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable ? '+' : ''}${result.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-mono font-medium text-slate-400 mt-0.5">
              {isProfitable ? '+' : ''}{result.netProfitPercent.toFixed(2)}% ROI
            </div>
          </div>
        </div>

        {/* 2. Win Rate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Win Rate</span>
            <Award className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold tracking-tight text-white">
              {result.winRate.toFixed(1)}%
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              <span className="text-emerald-400 font-semibold">{result.winningTrades}W</span>
              {' '}-{' '}
              <span className="text-rose-400 font-semibold">{result.losingTrades}L</span>
              {' '}({result.totalTrades} total)
            </div>
          </div>
        </div>

        {/* 3. Profit Factor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Profit Factor</span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className={`text-xl font-mono font-bold tracking-tight ${result.profitFactor >= 1.5 ? 'text-emerald-400' : result.profitFactor >= 1 ? 'text-slate-100' : 'text-rose-400'}`}>
              {result.profitFactor > 50 ? '> 50.0' : result.profitFactor.toFixed(2)}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              Gross: ${result.grossProfit.toFixed(0)} / ${result.grossLoss.toFixed(0)}
            </div>
          </div>
        </div>

        {/* 4. Max Drawdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Max Drawdown</span>
            <Shield className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold tracking-tight text-amber-400">
              -{result.maxDrawdownPercent.toFixed(2)}%
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              -${result.maxDrawdownAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 5. Alpha vs Buy & Hold */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Strategy Alpha</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className={`text-xl font-mono font-bold tracking-tight ${isOutperforming ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isOutperforming ? '+' : ''}{result.alphaPercent.toFixed(2)}%
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              B&H: {result.buyAndHoldReturnPercent >= 0 ? '+' : ''}{result.buyAndHoldReturnPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 6. Sharpe & Risk */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Sharpe Ratio</span>
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className={`text-xl font-mono font-bold tracking-tight ${result.sharpeRatio >= 1.5 ? 'text-emerald-400' : result.sharpeRatio >= 0.8 ? 'text-cyan-300' : 'text-slate-300'}`}>
              {result.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              Sortino: {result.sortinoRatio.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Detailed Ratios Bar */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Risk/Reward Realized:</span>
          <span className="text-emerald-400 font-bold">{result.riskRewardRatio.toFixed(2)}:1</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Avg Win:</span>
          <span className="text-emerald-400 font-semibold">+{result.avgWinPnlPercent.toFixed(2)}%</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Avg Loss:</span>
          <span className="text-rose-400 font-semibold">-{result.avgLossPnlPercent.toFixed(2)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Avg Duration:</span>
          <span className="text-slate-200 font-semibold">{result.avgTradeDurationCandles} bars</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Trading Fees:</span>
          <span className="text-amber-400 font-semibold">${result.totalFeesPaid.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Calmar Ratio:</span>
          <span className="text-purple-300 font-semibold">{result.calmarRatio.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
          <span className="text-slate-400">Efficiency:</span>
          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
            {result.efficiencyScore}/100 (Grade {result.efficiencyGrade})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Exposure:</span>
          <span className="text-cyan-300 font-semibold">{result.marketExposurePercent}%</span>
        </div>
      </div>
    </div>
  );
};
