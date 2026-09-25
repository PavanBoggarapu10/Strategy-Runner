import React, { useState, useMemo } from 'react';
import {
  Star,
  X,
  Play,
  Trash2,
  Edit3,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Layers,
  ArrowRight,
  Sliders,
  Download,
  Upload,
  Search,
  Filter,
  Sparkles,
  Calendar,
  AlertCircle,
  Copy,
  Clock,
} from 'lucide-react';
import {
  FavoriteStrategySetup,
  QuotePair,
  Timeframe,
  StrategyConfig,
  BacktestSettings,
  BacktestTimePeriod,
  BacktestResult,
  formatTimeframeDisplay,
} from '../types/trading';
import { exportFavoritesAsJson, importFavoritesFromJson } from '../utils/favoriteStrategyStorage';

interface FavoritesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: FavoriteStrategySetup[];
  onLoadFavorite: (favorite: FavoriteStrategySetup) => void;
  onDeleteFavorite: (id: string) => void;
  onUpdateFavorite: (id: string, newTitle: string, newNotes?: string) => void;
  onOpenSaveCurrentModal: () => void;
  onImportFavorites?: (imported: FavoriteStrategySetup[]) => void;
}

export const FavoritesManagerModal: React.FC<FavoritesManagerModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onLoadFavorite,
  onDeleteFavorite,
  onUpdateFavorite,
  onOpenSaveCurrentModal,
  onImportFavorites,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | '1HR' | '4HR' | '1D' | 'SPOT' | 'LEVERAGED' | 'HIGH_ROI'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [loadedNoticeId, setLoadedNoticeId] = useState<string | null>(null);
  const [importExportMsg, setImportExportMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const filteredFavorites = useMemo(() => {
    return favorites.filter((fav) => {
      const tfFormatted = formatTimeframeDisplay(fav.timeframe).toLowerCase();
      // Search term filter
      const matchesSearch =
        fav.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fav.coin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fav.strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tfFormatted.includes(searchTerm.toLowerCase()) ||
        fav.timeframe.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fav.notes && fav.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Category / Timeframe filter
      if (filterType === '1HR') {
        return tfFormatted === '1hr';
      }
      if (filterType === '4HR') {
        return tfFormatted === '4hr';
      }
      if (filterType === '1D') {
        return tfFormatted === '1d';
      }
      if (filterType === 'SPOT') {
        return fav.settings.leverage === 1;
      }
      if (filterType === 'LEVERAGED') {
        return fav.settings.leverage > 1;
      }
      if (filterType === 'HIGH_ROI') {
        return (fav.metricsSnapshot?.netProfitPercent || 0) >= 20;
      }

      return true;
    });
  }, [favorites, searchTerm, filterType]);

  if (!isOpen) return null;

  const handleStartEdit = (fav: FavoriteStrategySetup) => {
    setEditingId(fav.id);
    setEditTitle(fav.title);
    setEditNotes(fav.notes || '');
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      onUpdateFavorite(id, editTitle.trim(), editNotes.trim() || undefined);
    }
    setEditingId(null);
  };

  const handleLoadAndClose = (fav: FavoriteStrategySetup) => {
    setLoadedNoticeId(fav.id);
    onLoadFavorite(fav);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleExportJson = () => {
    try {
      const json = exportFavoritesAsJson(favorites);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorite-strategies-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportExportMsg({ text: 'Favorites exported successfully!' });
      setTimeout(() => setImportExportMsg(null), 3000);
    } catch (e: any) {
      setImportExportMsg({ text: 'Export failed: ' + e.message, error: true });
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importFavoritesFromJson(text);
        if (onImportFavorites) {
          onImportFavorites(imported);
        }
        setImportExportMsg({ text: `Imported ${imported.length} favorite strategies!` });
        setTimeout(() => setImportExportMsg(null), 3000);
      } catch (err: any) {
        setImportExportMsg({ text: `Import failed: ${err.message || 'Invalid format'}`, error: true });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorites-manager-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Star className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="favorites-manager-title" className="text-base sm:text-lg font-bold text-white">
                  Favorite Strategies Library
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {favorites.length} Saved
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Load high-performing strategies with exact capital, direction, leverage, stop loss, take profit, trailing stop, fees, and slippage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-add-current-fav-inside-modal"
              type="button"
              onClick={onOpenSaveCurrentModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-slate-950" />
              <span>+ Save Current Setup</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Import/Export */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, coin, or strategy..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'All Setups' },
                { id: '1HR', label: '1hr' },
                { id: '4HR', label: '4hr' },
                { id: '1D', label: '1D' },
                { id: 'SPOT', label: 'Spot (1x)' },
                { id: 'LEVERAGED', label: 'Leveraged' },
                { id: 'HIGH_ROI', label: 'High ROI (>20%)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  filterType === f.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Backup Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
              title="Export favorites as JSON file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export</span>
            </button>

            <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>

        {/* Notice alert */}
        {importExportMsg && (
          <div
            className={`px-6 py-2 text-xs flex items-center gap-2 ${
              importExportMsg.error ? 'bg-rose-950/60 text-rose-300 border-b border-rose-500/30' : 'bg-emerald-950/60 text-emerald-300 border-b border-emerald-500/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{importExportMsg.text}</span>
          </div>
        )}

        {/* Favorite Cards Grid / List */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-slate-950/20">
          {filteredFavorites.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                <Star className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No favorite strategies found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchTerm
                  ? 'No favorites match your search criteria. Try a different search term.'
                  : 'Run a backtest on any strategy, then click "Add to Favorite" or "+ Save Current Setup" to store it here with all its parameters and risk settings.'}
              </p>
              <button
                type="button"
                onClick={onOpenSaveCurrentModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Star className="w-4 h-4 fill-slate-950" />
                <span>Save Current Strategy Setup</span>
              </button>
            </div>
          ) : (
            filteredFavorites.map((fav) => {
              const isEditing = editingId === fav.id;
              const hasSnapshot = !!fav.metricsSnapshot;
              const snap = fav.metricsSnapshot;
              const isProfitable = snap ? snap.netProfit >= 0 : true;

              return (
                <div
                  key={fav.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all shadow-sm hover:shadow-md space-y-3.5 group"
                >
                  {/* Top Bar: Title, Date & Quick Load CTA */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-400 text-sm font-bold text-white"
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Add notes..."
                            className="w-full px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(fav.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                              <span>{fav.title}</span>
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{formatTimeframeDisplay(fav.timeframe)}</span>
                            </span>
                            <button
                              onClick={() => handleStartEdit(fav)}
                              className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Title & Notes"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {fav.notes && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">
                              "{fav.notes}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Load Primary Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadAndClose(fav)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                          loadedNoticeId === fav.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
                        }`}
                        title="Load this strategy and all its settings, then immediately run backtest"
                      >
                        {loadedNoticeId === fav.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Loaded!</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-slate-950" />
                            <span>Load & Run Setup</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete favorite setup "${fav.title}"?`)) {
                            onDeleteFavorite(fav.id);
                          }
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete favorite"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Results Snapshot (if recorded) */}
                  {snap && (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px]">Net Profit:</span>
                          <span className={`font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfitable ? '+' : ''}${snap.netProfit.toLocaleString()} ({isProfitable ? '+' : ''}
                            {snap.netProfitPercent.toFixed(1)}%)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px]">Win Rate:</span>
                          <span className="text-white font-bold">{snap.winRate.toFixed(1)}%</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px]">Profit Factor:</span>
                          <span className="text-purple-300 font-bold">{snap.profitFactor.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px]">Max DD:</span>
                          <span className="text-amber-400 font-bold">-{snap.maxDrawdownPercent.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {snap.efficiencyScore !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] border border-purple-500/30">
                            Score {snap.efficiencyScore}/100
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          {snap.totalTrades} Trades simulated
                        </span>
                      </div>
                    </div>
                  )}

                  {/* The Captured Parameters Grid: Time Frame, Capital, Direction, Leverage, SL, TP, Trailing SL, Fee%, Slippage */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Saved Parameters & Risk Settings:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 text-xs font-mono">
                      {/* 1. Time Frame */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-amber-500/40">
                        <span className="text-[10px] text-amber-400 font-semibold block flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Time Frame
                        </span>
                        <span className="text-amber-300 font-bold text-xs">
                          {formatTimeframeDisplay(fav.timeframe)}
                        </span>
                      </div>

                      {/* 2. Capital */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Capital</span>
                        <span className="text-emerald-400 font-bold">${fav.settings.initialCapital.toLocaleString()}</span>
                      </div>

                      {/* 3. Direction */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Direction</span>
                        <span className="text-cyan-300 font-bold">
                          {fav.settings.tradeDirection === 'BOTH'
                            ? 'Both'
                            : fav.settings.tradeDirection === 'LONG_ONLY'
                            ? 'Long Only'
                            : 'Short Only'}
                        </span>
                      </div>

                      {/* 4. Leverage */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Leverage</span>
                        <span className="text-purple-300 font-bold">{fav.settings.leverage}x</span>
                      </div>

                      {/* 5. Stop Loss */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Stop Loss</span>
                        <span className="text-rose-400 font-bold">{fav.settings.stopLossPercent}%</span>
                      </div>

                      {/* 6. Take Profit */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Take Profit</span>
                        <span className="text-emerald-400 font-bold">{fav.settings.takeProfitPercent}%</span>
                      </div>

                      {/* 7. Trailing SL */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Trailing SL</span>
                        <span className="text-amber-300 font-bold">
                          {fav.settings.trailingStopPercent > 0 ? `${fav.settings.trailingStopPercent}%` : 'Off'}
                        </span>
                      </div>

                      {/* 8. Fee % */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Fee %</span>
                        <span className="text-slate-300 font-bold">{fav.settings.takerFeePercent}%</span>
                      </div>

                      {/* 9. Slippage % */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Slippage %</span>
                        <span className="text-slate-300 font-bold">{fav.settings.slippagePercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Context: Strategy Name, Market & Key Parameters */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-cyan-400" />
                        <span>Strategy: {fav.strategy.name}</span>
                      </span>

                      {/* Display a few key parameters */}
                      {Object.entries(fav.strategy.params || {}).slice(0, 3).map(([key, val]) => (
                        <span key={key} className="text-[11px] font-mono text-slate-400">
                          {key}: <strong className="text-slate-200">{String(val)}</strong>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                      <span className="text-amber-400 font-bold">{fav.coin}/{fav.pair}</span>
                      <span>•</span>
                      <span className="text-amber-300 font-bold">{formatTimeframeDisplay(fav.timeframe)}</span>
                      <span>•</span>
                      <span>Range: {fav.timePeriod.preset}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Click <strong>"Load & Run Setup"</strong> to instantly configure all parameters and rerun the backtest.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
