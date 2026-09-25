import React, { useState, useEffect } from 'react';
import {
  Star,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Layers,
  ArrowRight,
  Sliders,
  Sparkles,
  Award,
  Clock,
} from 'lucide-react';
import {
  QuotePair,
  Timeframe,
  StrategyConfig,
  BacktestSettings,
  BacktestTimePeriod,
  BacktestResult,
  FavoriteStrategySetup,
  formatTimeframeDisplay,
} from '../types/trading';

interface SaveFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  coin: string;
  pair: QuotePair;
  timeframe: Timeframe;
  timePeriod: BacktestTimePeriod;
  strategy: StrategyConfig;
  settings: BacktestSettings;
  result: BacktestResult | null;
  onSaveFavorite: (favorite: Omit<FavoriteStrategySetup, 'id' | 'createdAt'>) => void;
}

export const SaveFavoriteModal: React.FC<SaveFavoriteModalProps> = ({
  isOpen,
  onClose,
  coin,
  pair,
  timeframe,
  timePeriod,
  strategy,
  settings,
  result,
  onSaveFavorite,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(timeframe);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Auto-generate a high-clarity title based on results when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedTimeframe(timeframe);
      setIsSavedNotice(false);
      const profitStr = result
        ? ` (${result.netProfit >= 0 ? '+' : ''}${result.netProfitPercent.toFixed(1)}% ROI)`
        : '';
      setTitle(`${coin}/${pair} ${formatTimeframeDisplay(timeframe)} • ${strategy.name}${profitStr}`);
      setNotes('');
    }
  }, [isOpen, coin, pair, timeframe, strategy.name, result]);

  if (!isOpen) return null;

  const isProfitable = result ? result.netProfit >= 0 : true;

  const handleSelectTimeframe = (newTf: string, label: string) => {
    setSelectedTimeframe(newTf as Timeframe);
    const profitStr = result
      ? ` (${result.netProfit >= 0 ? '+' : ''}${result.netProfitPercent.toFixed(1)}% ROI)`
      : '';
    setTitle(`${coin}/${pair} ${label} • ${strategy.name}${profitStr}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const favoriteData: Omit<FavoriteStrategySetup, 'id' | 'createdAt'> = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      coin,
      pair,
      timeframe: selectedTimeframe,
      timePeriod,
      strategy,
      settings: { ...settings },
      metricsSnapshot: result
        ? {
            netProfit: result.netProfit,
            netProfitPercent: result.netProfitPercent,
            winRate: result.winRate,
            profitFactor: result.profitFactor,
            totalTrades: result.totalTrades,
            maxDrawdownPercent: result.maxDrawdownPercent,
            alphaPercent: result.alphaPercent,
            sharpeRatio: result.sharpeRatio,
            efficiencyScore: result.efficiencyScore,
            efficiencyGrade: result.efficiencyGrade,
          }
        : undefined,
    };

    onSaveFavorite(favoriteData);
    setIsSavedNotice(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-favorite-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h2 id="save-favorite-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Save Setup to Favorites</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Ready to Reload
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Bookmarks this strategy with all execution settings, capital, and risk parameters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Performance Snapshot Banner (if results available) */}
          {result && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isProfitable
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {isProfitable ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-300">Current Backtest Results</div>
                  <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                    <span className={`font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfitable ? '+' : ''}${result.netProfit.toFixed(2)} ({isProfitable ? '+' : ''}
                      {result.netProfitPercent.toFixed(2)}%)
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-white font-medium">{result.winRate.toFixed(1)}% Win</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-purple-300">PF {result.profitFactor.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  {result.totalTrades} Trades
                </span>
              </div>
            </div>
          )}

          {/* Title Field */}
          <div>
            <label htmlFor="favorite-title-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Favorite Setup Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="favorite-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BTC 4h Golden Alpha High-Yield"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Captured Fields Breakdown Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Captured Parameters & Settings to Reload:
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                Timeframe: <strong className="text-amber-300">{formatTimeframeDisplay(selectedTimeframe)}</strong>
              </span>
            </div>

            {/* Quick Time Frame Selector: 1hr, 4hr, 1D etc. */}
            <div className="flex items-center gap-1.5 flex-wrap bg-slate-950/80 p-2 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Time Frame:</span>
              </span>
              {[
                { val: '1h', label: '1hr' },
                { val: '4h', label: '4hr' },
                { val: '1d', label: '1D' },
                { val: '15m', label: '15m' },
                { val: '1w', label: '1W' },
                { val: '1M', label: '1M' },
              ].map((tfOpt) => {
                const isSelected = formatTimeframeDisplay(selectedTimeframe) === tfOpt.label;
                return (
                  <button
                    key={tfOpt.val}
                    type="button"
                    onClick={() => handleSelectTimeframe(tfOpt.val, tfOpt.label)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:text-white'
                    }`}
                  >
                    {tfOpt.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs font-mono">
              {/* 1. Time Frame */}
              <div className="p-2 rounded bg-slate-900 border border-amber-500/40">
                <span className="text-[10px] text-amber-400 font-semibold block flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Time Frame
                </span>
                <span className="text-amber-300 font-bold text-xs">
                  {formatTimeframeDisplay(selectedTimeframe)}
                </span>
              </div>

              {/* 2. Capital Amount */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Capital Amount</span>
                <span className="text-emerald-400 font-bold text-xs">${settings.initialCapital.toLocaleString()}</span>
              </div>

              {/* 3. Direction */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Direction</span>
                <span className="text-cyan-300 font-bold text-xs">
                  {settings.tradeDirection === 'BOTH'
                    ? 'Long & Short'
                    : settings.tradeDirection === 'LONG_ONLY'
                    ? 'Long Only'
                    : 'Short Only'}
                </span>
              </div>

              {/* 4. Leverage */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Leverage</span>
                <span className="text-purple-300 font-bold text-xs">{settings.leverage}x</span>
              </div>

              {/* 5. Stop Loss */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Stop Loss</span>
                <span className="text-rose-400 font-bold text-xs">{settings.stopLossPercent}%</span>
              </div>

              {/* 6. Take Profit */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Take Profit</span>
                <span className="text-emerald-400 font-bold text-xs">{settings.takeProfitPercent}%</span>
              </div>

              {/* 7. Trailing Stop Loss */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Trailing Stop Loss</span>
                <span className="text-amber-300 font-bold text-xs">
                  {settings.trailingStopPercent > 0 ? `${settings.trailingStopPercent}%` : 'Disabled'}
                </span>
              </div>

              {/* 8. Fee % (Taker) */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Fee % (Taker)</span>
                <span className="text-slate-200 font-bold text-xs">{settings.takerFeePercent}%</span>
              </div>

              {/* 9. Slippage % */}
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Slippage %</span>
                <span className="text-slate-200 font-bold text-xs">{settings.slippagePercent}%</span>
              </div>
            </div>

            {/* Strategy & Market Context */}
            <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Strategy:</span>
                <span className="text-white font-semibold">{strategy.name}</span>
                {strategy.isCustom && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    Custom
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                <span>Market:</span>
                <span className="text-amber-400 font-bold">{coin}/{pair}</span>
                <span>•</span>
                <span className="text-amber-300 font-bold">{formatTimeframeDisplay(selectedTimeframe)}</span>
                <span>•</span>
                <span>Period: {timePeriod.preset}</span>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label htmlFor="favorite-notes-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Strategy Notes & Performance Context (Optional)
            </label>
            <textarea
              id="favorite-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Excellent win-rate during high volatility; best on 4h candle closes."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavedNotice}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                isSavedNotice
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25 active:scale-95'
              }`}
            >
              {isSavedNotice ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved to Favorites!</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 fill-slate-950" />
                  <span>Save Setup to Favorites</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
