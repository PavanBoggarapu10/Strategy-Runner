import React, { useState } from 'react';
import {
  Sliders,
  TrendingUp,
  Settings,
  DollarSign,
  ShieldAlert,
  Play,
  Layers,
  Clock,
  Calendar,
  Coins,
  ChevronDown,
  Info,
  Sparkles,
  ArrowRight,
  Maximize2,
  Cpu,
  Code2,
  Copy,
  Plus,
  Trash2,
  Edit3,
  Check,
  Bookmark,
  FileCode,
  FolderHeart,
  Zap,
  Star,
} from 'lucide-react';
import {
  BacktestSettings,
  QuotePair,
  StrategyConfig,
  Timeframe,
  BacktestTimePeriod,
  TimePeriodPreset,
  DEFAULT_TIME_PERIOD,
  formatTimeframeDisplay,
} from '../types/trading';
import {
  SUPPORTED_COINS,
  SUPPORTED_PAIRS,
  TIMEFRAMES,
} from '../utils/dataService';
import {
  TIME_PERIOD_OPTIONS,
  getDefaultCustomDates,
  resolvePeriodToRange,
  formatPeriodDate,
} from '../utils/periodUtils';
import { STRATEGY_PRESETS } from '../utils/strategyEngine';
import { CreateStrategyModal } from './CreateStrategyModal';
import { SaveAsStrategyModal } from './SaveAsStrategyModal';
import { INITIAL_CUSTOM_STRATEGIES } from '../utils/customStrategyStorage';

interface StrategyControlsProps {
  mode?: 'ALL' | 'MARKET_ONLY' | 'STRATEGY_ONLY';
  coin: string;
  onCoinChange: (coin: string) => void;
  pair: QuotePair;
  onPairChange: (pair: QuotePair) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  candleLimit: number;
  onCandleLimitChange: (limit: number) => void;
  
  timePeriod?: BacktestTimePeriod;
  onTimePeriodChange?: (period: BacktestTimePeriod) => void;

  strategy: StrategyConfig;
  onStrategyChange: (strategy: StrategyConfig) => void;
  
  settings: BacktestSettings;
  onSettingsChange: (settings: BacktestSettings) => void;
  
  onRunTest: () => void;
  isLoading: boolean;
  onOpenCustomBuilder?: () => void;
  onOpenPineModal?: () => void;

  customStrategies?: StrategyConfig[];
  onCreateCustomStrategy?: (newStrat: StrategyConfig) => void;
  onSaveAsCustomStrategy?: (newStrat: StrategyConfig) => void;
  onUpdateCustomStrategy?: (updated: StrategyConfig) => void;
  onDeleteCustomStrategy?: (id: string) => void;
  onRenameCustomStrategy?: (id: string, newLabel: string, newDescription?: string) => void;

  onOpenSaveFavorite?: () => void;
  onOpenFavoritesManager?: () => void;
  favoritesCount?: number;
  isCurrentSetupFavorited?: boolean;
}

export const StrategyControls: React.FC<StrategyControlsProps> = ({
  mode = 'ALL',
  coin,
  onCoinChange,
  pair,
  onPairChange,
  timeframe,
  onTimeframeChange,
  candleLimit,
  onCandleLimitChange,
  timePeriod,
  onTimePeriodChange,
  strategy,
  onStrategyChange,
  settings,
  onSettingsChange,
  onRunTest,
  isLoading,
  onOpenCustomBuilder,
  onOpenPineModal,
  customStrategies = INITIAL_CUSTOM_STRATEGIES,
  onCreateCustomStrategy,
  onSaveAsCustomStrategy,
  onUpdateCustomStrategy,
  onDeleteCustomStrategy,
  onRenameCustomStrategy,
  onOpenSaveFavorite,
  onOpenFavoritesManager,
  favoritesCount = 0,
  isCurrentSetupFavorited = false,
}) => {
  const [localTimePeriod, setLocalTimePeriod] = useState<BacktestTimePeriod>(DEFAULT_TIME_PERIOD);
  const activeTimePeriod = timePeriod || localTimePeriod;
  const periodInfo = resolvePeriodToRange(activeTimePeriod, timeframe);

  const handlePeriodPresetChange = (preset: TimePeriodPreset) => {
    const defaults = getDefaultCustomDates();
    const updated: BacktestTimePeriod = {
      preset,
      startDate: activeTimePeriod.startDate || defaults.startDate,
      endDate: activeTimePeriod.endDate || defaults.endDate,
    };
    if (onTimePeriodChange) {
      onTimePeriodChange(updated);
    } else {
      setLocalTimePeriod(updated);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    const updated: BacktestTimePeriod = {
      preset: 'CUSTOM',
      startDate: start,
      endDate: end,
    };
    if (onTimePeriodChange) {
      onTimePeriodChange(updated);
    } else {
      setLocalTimePeriod(updated);
    }
  };

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Strategy Category tab: PRESETS vs CUSTOM
  const [strategyCategory, setStrategyCategory] = useState<'PRESETS' | 'CUSTOM'>(
    strategy.isCustom || strategy.id === 'CUSTOM_RULES' || strategy.id === 'CUSTOM_SCRIPT' || strategy.id === 'PINE_SCRIPT'
      ? 'CUSTOM'
      : 'PRESETS'
  );

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [saveAsSource, setSaveAsSource] = useState<StrategyConfig | null>(null);

  // Inline rename state
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Core built-in algorithmic presets (excluding generic placeholders)
  const BUILT_IN_PRESETS = STRATEGY_PRESETS.filter(
    (p) => !['CUSTOM_RULES', 'CUSTOM_SCRIPT', 'PINE_SCRIPT'].includes(p.id)
  );

  const handleSelectPresetStrategy = (presetId: string) => {
    const preset = STRATEGY_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onStrategyChange({ ...preset, params: { ...preset.params } });
    }
  };

  const handleSelectCustomStrategy = (customStrat: StrategyConfig) => {
    onStrategyChange({ ...customStrat, params: { ...customStrat.params } });
  };

  const handleStartRename = (strat: StrategyConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLabelId(strat.id);
    setEditingLabelText(strat.name);
  };

  const handleCommitRename = (id: string) => {
    if (editingLabelText.trim() && onRenameCustomStrategy) {
      onRenameCustomStrategy(id, editingLabelText.trim());
      setSaveNotice(`Renamed to "${editingLabelText.trim()}"`);
      setTimeout(() => setSaveNotice(null), 2500);
    }
    setEditingLabelId(null);
  };

  const handleCancelRename = () => {
    setEditingLabelId(null);
    setEditingLabelText('');
  };

  const handleOpenSaveAs = (stratToCopy: StrategyConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSaveAsSource(stratToCopy);
    setIsSaveAsModalOpen(true);
  };

  const handleSaveCurrentChanges = () => {
    if (onUpdateCustomStrategy) {
      onUpdateCustomStrategy({ ...strategy, updatedAt: Date.now() });
      setSaveNotice(`Saved changes to "${strategy.name}"`);
      setTimeout(() => setSaveNotice(null), 2500);
    }
  };

  const handleParamChange = (key: string, value: any) => {
    onStrategyChange({
      ...strategy,
      params: {
        ...strategy.params,
        [key]: value,
      },
    });
  };

  const engineType = strategy.baseType || (
    strategy.id === 'FAST_SCALPER' ? 'FAST_SCALPER' :
    strategy.id === 'LIQUIDITY_SWEEP' ? 'LIQUIDITY_SWEEP' :
    strategy.id === 'GOLDEN_ALPHA' ? 'GOLDEN_ALPHA' :
    strategy.id === 'SUPERTREND_EMA' ? 'SUPERTREND_EMA' :
    strategy.customPineScript ? 'PINE_SCRIPT' :
    strategy.customRules ? 'CUSTOM_RULES' :
    strategy.customScript ? 'CUSTOM_SCRIPT' :
    strategy.id
  );

  const renderStrategyControls = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Strategy Type Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Select Trading Strategy
            </label>
            <button
              id="btn-add-new-strategy-top"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1 shadow transition-all cursor-pointer"
              title="Create a brand new custom strategy with editable label"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Strategy</span>
            </button>
          </div>

          {/* Strategy Category Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold">
            <button
              id="tab-strat-category-presets"
              type="button"
              onClick={() => setStrategyCategory('PRESETS')}
              className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                strategyCategory === 'PRESETS'
                  ? 'bg-purple-600 text-white shadow shadow-purple-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Presets</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 font-mono">
                {BUILT_IN_PRESETS.length}
              </span>
            </button>
            <button
              id="tab-strat-category-custom"
              type="button"
              onClick={() => setStrategyCategory('CUSTOM')}
              className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                strategyCategory === 'CUSTOM'
                  ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-cyan-200" />
              <span>My Strategies</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 font-mono">
                {customStrategies.length}
              </span>
            </button>
          </div>

          {/* Strategy List: Presets */}
          {strategyCategory === 'PRESETS' && (
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {BUILT_IN_PRESETS.map((preset) => {
                const active = preset.id === strategy.id && !strategy.isCustom;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPresetStrategy(preset.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer group ${
                      active
                        ? 'bg-purple-950/40 border-purple-500/50 shadow-sm ring-1 ring-purple-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-800/50 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold truncate ${active ? 'text-purple-300 font-bold' : 'text-slate-200'}`}>
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {preset.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        id={`btn-save-as-preset-${preset.id}`}
                        type="button"
                        onClick={(e) => handleOpenSaveAs(preset, e)}
                        className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors opacity-80 group-hover:opacity-100"
                        title="Save As New Custom Strategy with Editable Label"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 mt-0.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fork prompt card */}
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-2 mt-2">
                <span className="text-[11px]">Want to clone or customize a preset?</span>
                <button
                  type="button"
                  onClick={() => handleOpenSaveAs(strategy)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Save as New</span>
                </button>
              </div>
            </div>
          )}

          {/* Strategy List: Custom Strategies */}
          {strategyCategory === 'CUSTOM' && (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {customStrategies.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    No custom strategies saved yet. Create your first one or fork any preset!
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Custom Strategy</span>
                  </button>
                </div>
              ) : (
                customStrategies.map((customStrat) => {
                  const active = customStrat.id === strategy.id;
                  const isEditing = editingLabelId === customStrat.id;
                  const stratEngine = customStrat.baseType || (
                    customStrat.customPineScript ? 'PINE_SCRIPT' :
                    customStrat.customRules ? 'CUSTOM_RULES' :
                    customStrat.customScript ? 'CUSTOM_SCRIPT' :
                    'Custom'
                  );

                  return (
                    <div
                      key={customStrat.id}
                      onClick={() => !isEditing && handleSelectCustomStrategy(customStrat)}
                      className={`w-full text-left p-3 rounded-xl border transition-all space-y-2 cursor-pointer group ${
                        active
                          ? 'bg-cyan-950/30 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/70 hover:bg-slate-800/60 border-slate-800/90 text-slate-300'
                      }`}
                    >
                      {/* Label line */}
                      <div className="flex items-center justify-between gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              id={`input-rename-${customStrat.id}`}
                              type="text"
                              autoFocus
                              value={editingLabelText}
                              onChange={(e) => setEditingLabelText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitRename(customStrat.id);
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-xs text-white font-bold outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleCommitRename(customStrat.id)}
                              className="p-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900"
                              title="Save label"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`text-xs font-bold truncate ${active ? 'text-cyan-300' : 'text-slate-100'}`}>
                              {customStrat.name}
                            </span>
                            <button
                              id={`btn-edit-label-${customStrat.id}`}
                              type="button"
                              onClick={(e) => handleStartRename(customStrat, e)}
                              className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                              title="Edit Strategy Label / Name"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Engine Badge */}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex-shrink-0 bg-slate-900 border border-slate-700 text-cyan-300">
                          {stratEngine === 'PINE_SCRIPT' ? 'Pine v5' : stratEngine === 'CUSTOM_RULES' ? 'Rules' : stratEngine === 'CUSTOM_SCRIPT' ? 'JS Code' : stratEngine}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {customStrat.description || 'Custom user algorithmic strategy'}
                      </p>

                      {/* Quick Actions Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                        <div className="flex items-center gap-1">
                          <button
                            id={`btn-copy-custom-${customStrat.id}`}
                            type="button"
                            onClick={(e) => handleOpenSaveAs(customStrat, e)}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                            title="Save as new copy with custom label"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Save As New</span>
                          </button>
                          {onOpenCustomBuilder && (
                            <button
                              id={`btn-open-studio-${customStrat.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCustomStrategy(customStrat);
                                onOpenCustomBuilder();
                              }}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                              title="Open in Strategy Studio"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Studio</span>
                            </button>
                          )}
                        </div>

                        {onDeleteCustomStrategy && customStrategies.length > 1 && (
                          <button
                            id={`btn-delete-custom-${customStrat.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete custom strategy "${customStrat.name}"?`)) {
                                onDeleteCustomStrategy(customStrat.id);
                              }
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete strategy"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add New Strategy Card Button */}
              <button
                id="btn-create-new-strat-card"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Custom Strategy</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Parameter Adjustments & Execution (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Parameters:
                </span>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  {strategy.name}
                  {strategy.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleStartRename(strategy)}
                      className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                      title="Edit Label / Name"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </span>
                {strategy.isCustom && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    Custom
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-mono">
                  {coin}/{pair}
                </span>
                <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  {timeframe}
                </span>
              </div>
            </div>

            {/* Strategy Execution Controls: Period Window & Range */}
            <div className="mb-3.5 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
              {/* Testing Period / Execution Range (1W, 1M, 2M, 3M, 6M, 1Year, Custom) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Execution Range:</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans hidden md:inline">
                    (1 Week to Months & Year)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Quick Preset Pills */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {[
                      { key: '1w' as TimePeriodPreset, label: '1W' },
                      { key: '1M' as TimePeriodPreset, label: '1M' },
                      { key: '2M' as TimePeriodPreset, label: '2M' },
                      { key: '3M' as TimePeriodPreset, label: '3M' },
                      { key: '6M' as TimePeriodPreset, label: '6M' },
                      { key: '1Year' as TimePeriodPreset, label: '1Year' },
                      { key: 'CUSTOM' as TimePeriodPreset, label: 'Custom' },
                    ].map((p) => {
                      const isActive =
                        activeTimePeriod.preset === p.key ||
                        (p.key === '1M' && (activeTimePeriod.preset as string) === '30d') ||
                        (p.key === '2M' && (activeTimePeriod.preset as string) === '60d') ||
                        (p.key === '3M' && (activeTimePeriod.preset as string) === '90d') ||
                        (p.key === '6M' && (activeTimePeriod.preset as string) === '6m') ||
                        (p.key === '1Year' && (activeTimePeriod.preset as string) === '1y');
                      return (
                        <button
                          key={p.key}
                          id={`btn-period-pill-${p.key}`}
                          type="button"
                          onClick={() => handlePeriodPresetChange(p.key)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title={`Test strategy over ${p.label}`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Period Dropdown */}
                  <select
                    id="select-strategy-analyzer-period"
                    value={activeTimePeriod.preset}
                    onChange={(e) => handlePeriodPresetChange(e.target.value as TimePeriodPreset)}
                    className="bg-slate-950 border border-slate-700 text-emerald-300 text-xs rounded-lg px-2.5 py-1 font-mono font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                    title="Select strategy backtesting time period"
                  >
                    <option value="1w" className="bg-slate-900 text-slate-200">1 Week (1W)</option>
                    <option value="1M" className="bg-slate-900 text-emerald-300 font-bold">1 Month (1M)</option>
                    <option value="2M" className="bg-slate-900 text-slate-200">2 Months (2M)</option>
                    <option value="3M" className="bg-slate-900 text-slate-200">3 Months (3M)</option>
                    <option value="6M" className="bg-slate-900 text-slate-200">6 Months (6M)</option>
                    <option value="1Year" className="bg-slate-900 text-slate-200">1 Year (1Year)</option>
                    <option value="CUSTOM" className="bg-slate-900 text-amber-300 font-semibold">Custom Date Range</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Date Range Panel (Expanded when Custom date range is selected) */}
            {activeTimePeriod.preset === 'CUSTOM' && (
              <div
                id="custom-date-range-panel"
                className="mb-3 p-3 rounded-xl bg-slate-950/90 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-xs font-semibold text-amber-300">Custom Testing Date Range</div>
                    <div className="text-[11px] text-slate-400">
                      Backtest strategy across historical market window
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] text-slate-400">From:</span>
                    <input
                      id="input-custom-start-date"
                      type="date"
                      value={activeTimePeriod.startDate || getDefaultCustomDates().startDate}
                      max={activeTimePeriod.endDate || getDefaultCustomDates().endDate}
                      onChange={(e) =>
                        handleCustomDateChange(
                          e.target.value,
                          activeTimePeriod.endDate || getDefaultCustomDates().endDate
                        )
                      }
                      className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer"
                    />
                  </div>

                  <span className="text-slate-500 font-bold">→</span>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] text-slate-400">To:</span>
                    <input
                      id="input-custom-end-date"
                      type="date"
                      value={activeTimePeriod.endDate || getDefaultCustomDates().endDate}
                      min={activeTimePeriod.startDate || getDefaultCustomDates().startDate}
                      max={getDefaultCustomDates().endDate}
                      onChange={(e) =>
                        handleCustomDateChange(
                          activeTimePeriod.startDate || getDefaultCustomDates().startDate,
                          e.target.value
                        )
                      }
                      className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Date presets shortcuts */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { label: '1W', days: 7, title: 'Past 1 Week' },
                      { label: '1M', days: 30, title: 'Past 1 Month' },
                      { label: '2M', days: 60, title: 'Past 2 Months' },
                      { label: '3M', days: 90, title: 'Past 3 Months' },
                      { label: '6M', days: 180, title: 'Past 6 Months' },
                      { label: '1Year', days: 365, title: 'Past 1 Year' },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => {
                          const end = new Date();
                          const start = new Date(end.getTime() - btn.days * 24 * 60 * 60 * 1000);
                          handleCustomDateChange(
                            start.toISOString().split('T')[0],
                            end.toISOString().split('T')[0]
                          );
                        }}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono transition-colors cursor-pointer"
                        title={btn.title}
                      >
                        {btn.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date(end.getFullYear(), 0, 1);
                        handleCustomDateChange(
                          start.toISOString().split('T')[0],
                          end.toISOString().split('T')[0]
                        );
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono transition-colors cursor-pointer"
                      title="Year to Date"
                    >
                      YTD
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {periodInfo.daysCount} days ({periodInfo.candleLimit} bars)
                  </div>
                </div>
              </div>
            )}

            {saveNotice && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{saveNotice}</span>
              </div>
            )}

            {/* Dynamic Parameter Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {engineType === 'FAST_SCALPER' && (
                <>
                  <div className="col-span-full bg-slate-900/90 border border-cyan-500/30 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold text-slate-200">Recommended Scalping Timeframes:</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['5m', '15m', '30m'] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => onTimeframeChange(tf)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
                            timeframe === tf
                              ? 'bg-cyan-500 text-slate-950 shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fast EMA */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Fast EMA (Micro-Trend)</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.fastEmaLen ?? 9} EMA</span>
                    </div>
                    <input
                      id="slider-scalp-fast-ema"
                      type="range"
                      min={3}
                      max={20}
                      value={Number(strategy.params.fastEmaLen ?? 9)}
                      onChange={(e) => handleParamChange('fastEmaLen', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Slow EMA */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Slow EMA (Pullback Zone)</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.slowEmaLen ?? 21} EMA</span>
                    </div>
                    <input
                      id="slider-scalp-slow-ema"
                      type="range"
                      min={10}
                      max={50}
                      value={Number(strategy.params.slowEmaLen ?? 21)}
                      onChange={(e) => handleParamChange('slowEmaLen', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* 50 EMA Macro Trend Filter */}
                  <div className="space-y-1 col-span-full">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">50 EMA Macro Filter (Only trade with trend)</span>
                      <span className="font-mono text-amber-300 font-semibold">
                        {strategy.params.useTrendFilter !== false ? `${strategy.params.trendEmaLen ?? 50} EMA Enabled` : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={strategy.params.useTrendFilter !== false}
                        onChange={(e) => handleParamChange('useTrendFilter', e.target.checked)}
                        className="rounded accent-amber-500 bg-slate-900 border-slate-700"
                      />
                      <input
                        id="slider-scalp-trend-ema"
                        type="range"
                        min={20}
                        max={100}
                        step={5}
                        disabled={strategy.params.useTrendFilter === false}
                        value={Number(strategy.params.trendEmaLen ?? 50)}
                        onChange={(e) => handleParamChange('trendEmaLen', Number(e.target.value))}
                        className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Quick Profit / Take Profit */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Quick Take Profit (Exit)</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {strategy.params.useAtrTargets !== false
                          ? `${Number(strategy.params.atrMultTP ?? 2.6).toFixed(1)}x ATR`
                          : `${Number(strategy.params.quickTpPct ?? 2.5).toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleParamChange('useAtrTargets', !(strategy.params.useAtrTargets !== false))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          strategy.params.useAtrTargets !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                        }`}
                        title="Toggle ATR dynamic targets vs fixed %"
                      >
                        {strategy.params.useAtrTargets !== false ? 'ATR' : 'PCT'}
                      </button>
                      <input
                        id="slider-scalp-tp"
                        type="range"
                        min={strategy.params.useAtrTargets !== false ? 1.0 : 0.8}
                        max={strategy.params.useAtrTargets !== false ? 5.0 : 6.0}
                        step={0.1}
                        value={Number(strategy.params.useAtrTargets !== false ? (strategy.params.atrMultTP ?? 2.6) : (strategy.params.quickTpPct ?? 2.5))}
                        onChange={(e) => handleParamChange(strategy.params.useAtrTargets !== false ? 'atrMultTP' : 'quickTpPct', Number(e.target.value))}
                        className="flex-1 accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Structural Stop Loss */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Structural Stop Loss</span>
                      <span className="font-mono text-rose-400 font-semibold">
                        {strategy.params.useAtrTargets !== false
                          ? `${Number(strategy.params.atrMultSL ?? 1.8).toFixed(1)}x ATR`
                          : `${Number(strategy.params.stopLossPct ?? 1.6).toFixed(1)}%`}
                      </span>
                    </div>
                    <input
                      id="slider-scalp-sl"
                      type="range"
                      min={strategy.params.useAtrTargets !== false ? 0.8 : 0.5}
                      max={strategy.params.useAtrTargets !== false ? 3.5 : 4.0}
                      step={0.1}
                      value={Number(strategy.params.useAtrTargets !== false ? (strategy.params.atrMultSL ?? 1.8) : (strategy.params.stopLossPct ?? 1.6))}
                      onChange={(e) => handleParamChange(strategy.params.useAtrTargets !== false ? 'atrMultSL' : 'stopLossPct', Number(e.target.value))}
                      className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Auto-Breakeven Stop */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Auto Breakeven Lock</span>
                      <span className="font-mono text-emerald-300 font-semibold">
                        {strategy.params.enableBreakeven !== false ? `@ ${strategy.params.breakevenAtPct ?? 60}% TP` : 'Off'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={strategy.params.enableBreakeven !== false}
                          onChange={(e) => handleParamChange('enableBreakeven', e.target.checked)}
                          className="rounded accent-emerald-500 bg-slate-900 border-slate-700"
                        />
                        <span className="text-[11px] text-slate-300">Lock breakeven (+fee buffer)</span>
                      </label>
                      {strategy.params.enableBreakeven !== false && (
                        <input
                          type="range"
                          min={45}
                          max={75}
                          step={5}
                          value={Number(strategy.params.breakevenAtPct ?? 60)}
                          onChange={(e) => handleParamChange('breakevenAtPct', Number(e.target.value))}
                          className="flex-1 accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                          title="Progress to TP before moving stop to breakeven"
                        />
                      )}
                    </div>
                  </div>

                  {/* Volume & Momentum Quality Filters */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Institutional Volume Filter</span>
                      <span className="font-mono text-cyan-300 font-semibold">
                        {strategy.params.useVolFilt !== false ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={strategy.params.useVolFilt !== false}
                        onChange={(e) => handleParamChange('useVolFilt', e.target.checked)}
                        className="rounded accent-cyan-500 bg-slate-900 border-slate-700"
                      />
                      <span className="text-[11px] text-slate-300">Require volume surge to reject choppy sideways traps</span>
                    </label>
                  </div>

                  {/* Quick Preset Tuners */}
                  <div className="col-span-full pt-1">
                    <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
                      <span className="font-semibold text-slate-300">High-Expectancy Timeframe Profiles:</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Positive ROI Optimized</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleParamChange('atrMultTP', 2.6);
                          handleParamChange('atrMultSL', 1.8);
                          handleParamChange('breakevenAtPct', 60);
                          handleParamChange('useVolFilt', true);
                          handleParamChange('enableQuickExit', false);
                          onTimeframeChange('5m');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-cyan-400 font-mono">5M Profile</div>
                        <div className="text-[10px] text-slate-400">2.6x TP / 1.8x SL</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleParamChange('atrMultTP', 3.0);
                          handleParamChange('atrMultSL', 1.8);
                          handleParamChange('breakevenAtPct', 65);
                          handleParamChange('useVolFilt', true);
                          handleParamChange('enableQuickExit', false);
                          onTimeframeChange('15m');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-emerald-400 font-mono flex items-center justify-between">
                          <span>15M Best</span>
                          <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded font-normal">Star</span>
                        </div>
                        <div className="text-[10px] text-slate-300">3.0x TP / 1.8x SL</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleParamChange('atrMultTP', 3.2);
                          handleParamChange('atrMultSL', 1.8);
                          handleParamChange('breakevenAtPct', 65);
                          handleParamChange('useVolFilt', true);
                          handleParamChange('enableQuickExit', false);
                          onTimeframeChange('30m');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-amber-400 font-mono">30M Profile</div>
                        <div className="text-[10px] text-slate-400">3.2x TP / 1.8x SL</div>
                      </button>
                    </div>
                  </div>

                  <div className="col-span-full pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-cyan-300 font-mono flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      TradingView v6 Pine Script Engine
                    </span>
                    {onOpenCustomBuilder && (
                      <button
                        type="button"
                        onClick={onOpenCustomBuilder}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Inspect Script</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {engineType === 'LIQUIDITY_SWEEP' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Pivot Length (L/R Bars)</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.pivotLen ?? 7} bars</span>
                    </div>
                    <input
                      id="slider-sweep-pivot"
                      type="range"
                      min={3}
                      max={20}
                      value={Number(strategy.params.pivotLen ?? 7)}
                      onChange={(e) => handleParamChange('pivotLen', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Risk : Reward (R:R)</span>
                      <span className="font-mono text-emerald-400 font-semibold">1 : {strategy.params.rrRatio ?? 1.5}</span>
                    </div>
                    <input
                      id="slider-sweep-rr"
                      type="range"
                      min={0.8}
                      max={4.0}
                      step={0.1}
                      value={Number(strategy.params.rrRatio ?? 1.5)}
                      onChange={(e) => handleParamChange('rrRatio', Number(e.target.value))}
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Stop Loss ATR Distance</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.slAtrMult ?? 1.2}x ATR</span>
                    </div>
                    <input
                      id="slider-sweep-sl-atr"
                      type="range"
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      value={Number(strategy.params.slAtrMult ?? 1.2)}
                      onChange={(e) => handleParamChange('slAtrMult', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Max Swing Age</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.maxAge ?? 150} candles</span>
                    </div>
                    <input
                      id="slider-sweep-age"
                      type="range"
                      min={30}
                      max={300}
                      step={10}
                      value={Number(strategy.params.maxAge ?? 150)}
                      onChange={(e) => handleParamChange('maxAge', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Volume Surge Filter</span>
                      <span className="font-mono text-cyan-300 font-semibold">
                        {strategy.params.useVolFilt ? `${strategy.params.volMult ?? 1.3}x SMA` : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(strategy.params.useVolFilt ?? true)}
                        onChange={(e) => handleParamChange('useVolFilt', e.target.checked)}
                        className="rounded accent-cyan-500 bg-slate-900 border-slate-700"
                      />
                      <input
                        id="slider-sweep-vol"
                        type="range"
                        min={1.0}
                        max={3.0}
                        step={0.1}
                        disabled={!strategy.params.useVolFilt}
                        value={Number(strategy.params.volMult ?? 1.3)}
                        onChange={(e) => handleParamChange('volMult', Number(e.target.value))}
                        className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Auto Breakeven Trailing</span>
                      <span className="font-mono text-emerald-300 font-semibold">
                        {strategy.params.useBreakeven ? `Trigger @ ${strategy.params.breakevenAtPct ?? 50}% TP` : 'Off'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(strategy.params.useBreakeven ?? true)}
                        onChange={(e) => handleParamChange('useBreakeven', e.target.checked)}
                        className="rounded accent-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <input
                        id="slider-sweep-be"
                        type="range"
                        min={25}
                        max={80}
                        step={5}
                        disabled={!strategy.params.useBreakeven}
                        value={Number(strategy.params.breakevenAtPct ?? 50)}
                        onChange={(e) => handleParamChange('breakevenAtPct', Number(e.target.value))}
                        className="flex-1 accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>
                </>
              )}

              {engineType === 'SUPERTREND_EMA' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Supertrend Factor</span>
                      <span className="font-mono text-cyan-400 font-semibold">{Number(strategy.params.factor ?? 1.8).toFixed(1)}x</span>
                    </div>
                    <input
                      id="slider-supertrend-factor"
                      type="range"
                      min={1.0}
                      max={4.5}
                      step={0.1}
                      value={Number(strategy.params.factor ?? 1.8)}
                      onChange={(e) => handleParamChange('factor', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Supertrend ATR Length</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.atrPeriod ?? 10}</span>
                    </div>
                    <input
                      id="slider-supertrend-atr-len"
                      type="range"
                      min={5}
                      max={40}
                      value={Number(strategy.params.atrPeriod ?? 10)}
                      onChange={(e) => handleParamChange('atrPeriod', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1 col-span-full">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">EMA Trend Filter Length</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.emaLen ?? 200}</span>
                    </div>
                    <input
                      id="slider-supertrend-ema-len"
                      type="range"
                      min={30}
                      max={300}
                      step={5}
                      value={Number(strategy.params.emaLen ?? 200)}
                      onChange={(e) => handleParamChange('emaLen', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1 col-span-full">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">ADX Momentum Filter</span>
                      <span className="font-mono text-emerald-300 font-semibold">
                        {strategy.params.enableADX ? `Threshold > ${strategy.params.adxThresh ?? 20}` : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(strategy.params.enableADX ?? false)}
                        onChange={(e) => handleParamChange('enableADX', e.target.checked)}
                        className="rounded accent-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <input
                        id="slider-supertrend-adx-thresh"
                        type="range"
                        min={10}
                        max={45}
                        step={1}
                        disabled={!strategy.params.enableADX}
                        value={Number(strategy.params.adxThresh ?? 20)}
                        onChange={(e) => handleParamChange('adxThresh', Number(e.target.value))}
                        className="flex-1 accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="col-span-full pt-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-cyan-300 font-mono">TradingView v6 Pine Script Engine</span>
                    {onOpenCustomBuilder && (
                      <button
                        type="button"
                        onClick={onOpenCustomBuilder}
                        className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Inspect Script</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {engineType === 'GOLDEN_ALPHA' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Fast EMA Period</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.fastPeriod ?? 9}</span>
                    </div>
                    <input
                      id="slider-golden-fast"
                      type="range"
                      min={3}
                      max={50}
                      value={Number(strategy.params.fastPeriod || 9)}
                      onChange={(e) => handleParamChange('fastPeriod', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Slow EMA Period</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.slowPeriod ?? 21}</span>
                    </div>
                    <input
                      id="slider-golden-slow"
                      type="range"
                      min={10}
                      max={100}
                      value={Number(strategy.params.slowPeriod || 21)}
                      onChange={(e) => handleParamChange('slowPeriod', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Macro Trend EMA Filter</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.macroTrendPeriod ?? 50}</span>
                    </div>
                    <input
                      id="slider-golden-macro"
                      type="range"
                      min={20}
                      max={200}
                      value={Number(strategy.params.macroTrendPeriod || 50)}
                      onChange={(e) => handleParamChange('macroTrendPeriod', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'EMA_CROSS' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Fast EMA Period</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.fastPeriod}</span>
                    </div>
                    <input
                      id="slider-fast-ema"
                      type="range"
                      min={3}
                      max={50}
                      value={Number(strategy.params.fastPeriod || 9)}
                      onChange={(e) => handleParamChange('fastPeriod', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Slow EMA Period</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.slowPeriod}</span>
                    </div>
                    <input
                      id="slider-slow-ema"
                      type="range"
                      min={10}
                      max={200}
                      value={Number(strategy.params.slowPeriod || 21)}
                      onChange={(e) => handleParamChange('slowPeriod', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'RSI_REVERSION' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">RSI Period</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.period}</span>
                    </div>
                    <input
                      id="slider-rsi-period"
                      type="range"
                      min={5}
                      max={30}
                      value={Number(strategy.params.period || 14)}
                      onChange={(e) => handleParamChange('period', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Oversold (Buy) / Overbought (Sell)</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {strategy.params.oversold} / {strategy.params.overbought}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="input-rsi-oversold"
                        type="number"
                        min={10}
                        max={45}
                        value={Number(strategy.params.oversold || 30)}
                        onChange={(e) => handleParamChange('oversold', Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                      <input
                        id="input-rsi-overbought"
                        type="number"
                        min={55}
                        max={90}
                        value={Number(strategy.params.overbought || 70)}
                        onChange={(e) => handleParamChange('overbought', Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>
                </>
              )}

              {engineType === 'MACD_MOMENTUM' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Fast / Slow Period</span>
                      <span className="font-mono text-cyan-400 font-semibold">
                        {strategy.params.fastPeriod} / {strategy.params.slowPeriod}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="input-macd-fast"
                        type="number"
                        min={5}
                        max={25}
                        value={Number(strategy.params.fastPeriod || 12)}
                        onChange={(e) => handleParamChange('fastPeriod', Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                      <input
                        id="input-macd-slow"
                        type="number"
                        min={20}
                        max={60}
                        value={Number(strategy.params.slowPeriod || 26)}
                        onChange={(e) => handleParamChange('slowPeriod', Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Signal Period</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.signalPeriod}</span>
                    </div>
                    <input
                      id="slider-macd-signal"
                      type="range"
                      min={4}
                      max={18}
                      value={Number(strategy.params.signalPeriod || 9)}
                      onChange={(e) => handleParamChange('signalPeriod', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'BOLLINGER_BREAKOUT' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Period (SMA)</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.period}</span>
                    </div>
                    <input
                      id="slider-bb-period"
                      type="range"
                      min={10}
                      max={50}
                      value={Number(strategy.params.period || 20)}
                      onChange={(e) => handleParamChange('period', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">StdDev Multiplier</span>
                      <span className="font-mono text-purple-400 font-semibold">{strategy.params.stdDev}x</span>
                    </div>
                    <input
                      id="slider-bb-stddev"
                      type="range"
                      min={1}
                      max={3.5}
                      step={0.1}
                      value={Number(strategy.params.stdDev || 2)}
                      onChange={(e) => handleParamChange('stdDev', Number(e.target.value))}
                      className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'SUPERTREND' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">ATR Period</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.period}</span>
                    </div>
                    <input
                      id="slider-supertrend-period"
                      type="range"
                      min={5}
                      max={30}
                      value={Number(strategy.params.period || 10)}
                      onChange={(e) => handleParamChange('period', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">ATR Multiplier</span>
                      <span className="font-mono text-emerald-400 font-semibold">{strategy.params.multiplier}x</span>
                    </div>
                    <input
                      id="slider-supertrend-mult"
                      type="range"
                      min={1}
                      max={5}
                      step={0.2}
                      value={Number(strategy.params.multiplier || 3)}
                      onChange={(e) => handleParamChange('multiplier', Number(e.target.value))}
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'GRID_TRADING' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Grid Sub-Levels</span>
                      <span className="font-mono text-cyan-400 font-semibold">{strategy.params.gridLevels}</span>
                    </div>
                    <input
                      id="slider-grid-levels"
                      type="range"
                      min={3}
                      max={12}
                      value={Number(strategy.params.gridLevels || 5)}
                      onChange={(e) => handleParamChange('gridLevels', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Channel Period</span>
                      <span className="font-mono text-amber-400 font-semibold">{strategy.params.channelPeriod}</span>
                    </div>
                    <input
                      id="slider-grid-channel"
                      type="range"
                      min={10}
                      max={50}
                      value={Number(strategy.params.channelPeriod || 20)}
                      onChange={(e) => handleParamChange('channelPeriod', Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'DCA_ACCUMULATION' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Interval (Candles)</span>
                      <span className="font-mono text-cyan-400 font-semibold">Every {strategy.params.intervalCandles} bars</span>
                    </div>
                    <input
                      id="slider-dca-interval"
                      type="range"
                      min={3}
                      max={30}
                      value={Number(strategy.params.intervalCandles || 10)}
                      onChange={(e) => handleParamChange('intervalCandles', Number(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Take Profit Target %</span>
                      <span className="font-mono text-emerald-400 font-semibold">+{strategy.params.takeProfit}%</span>
                    </div>
                    <input
                      id="slider-dca-tp"
                      type="range"
                      min={3}
                      max={25}
                      value={Number(strategy.params.takeProfit || 8)}
                      onChange={(e) => handleParamChange('takeProfit', Number(e.target.value))}
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </>
              )}

              {engineType === 'CUSTOM_RULES' && (
                <div className="col-span-full bg-purple-950/40 border border-purple-500/40 rounded-xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      Custom Condition Rules Active
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-900/50 text-purple-200 border border-purple-700/50">
                      {strategy.customRules?.buyRules.length || 0} Buy • {strategy.customRules?.sellRules.length || 0} Sell
                    </span>
                  </div>

                  {/* Active Condition Preview Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {strategy.customRules?.buyRules.map((r, i) => (
                      <span key={r.id || i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1">
                        <span className="font-bold text-emerald-400">BUY:</span> {r.left} {r.operator === 'GREATER_THAN' ? '>' : r.operator === 'LESS_THAN' ? '<' : r.operator === 'CROSS_ABOVE' ? '↗' : '↘'} {r.rightType === 'CONSTANT' ? r.rightConstant : r.rightIndicator}
                      </span>
                    ))}
                    {strategy.customRules?.sellRules.map((r, i) => (
                      <span key={r.id || i} className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-mono flex items-center gap-1">
                        <span className="font-bold text-rose-400">SELL:</span> {r.left} {r.operator === 'GREATER_THAN' ? '>' : r.operator === 'LESS_THAN' ? '<' : r.operator === 'CROSS_ABOVE' ? '↗' : '↘'} {r.rightType === 'CONSTANT' ? r.rightConstant : r.rightIndicator}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-300">
                    Define entry/exit Boolean criteria or evaluate strategy edge and drawdown risk. Click below to launch the editor studio.
                  </p>

                  {onOpenCustomBuilder && (
                    <button
                      id="btn-open-custom-builder-rules"
                      type="button"
                      onClick={onOpenCustomBuilder}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 active:scale-[0.99]"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Open Rule Builder & Gemini AI Analyst (Studio)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {engineType === 'CUSTOM_SCRIPT' && (
                <div className="col-span-full bg-purple-950/40 border border-purple-500/40 rounded-xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      Custom JavaScript Strategy Code Active
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                      Executable Sandbox
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Direct JavaScript sandbox running on candle intervals. Click below to edit execution code, inspect variables, and test quantitative efficiency.
                  </p>

                  {onOpenCustomBuilder && (
                    <button
                      id="btn-open-custom-builder-script"
                      type="button"
                      onClick={onOpenCustomBuilder}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 active:scale-[0.99]"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Open Code Sandbox & Gemini AI Analyst (Studio)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {engineType === 'PINE_SCRIPT' && (
                <div className="col-span-full bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-cyan-400" />
                      TradingView Pine Script (v5) Active
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                      Pine v5 Engine
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Executing Pine Script v5 logic transpiled into the multi-bar simulator with high accuracy.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {onOpenCustomBuilder && (
                      <button
                        id="btn-open-custom-builder-pine"
                        type="button"
                        onClick={onOpenCustomBuilder}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/30 active:scale-[0.99]"
                      >
                        <Code2 className="w-4 h-4 text-cyan-200" />
                        <span>Open Pine Script Studio & AI Optimizer</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onOpenPineModal && (
                      <button
                        id="btn-open-pine-modal-from-strat"
                        type="button"
                        onClick={onOpenPineModal}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <span>Export / Convert</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Strategy Action Bar: Save As New / Save Changes / Create New / Add to Favorite */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-save-as-new-strategy-param"
                  type="button"
                  onClick={() => handleOpenSaveAs(strategy)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow"
                  title="Save current parameters to a new strategy with editable label"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Save As New Strategy...</span>
                </button>

                {onOpenSaveFavorite && (
                  <button
                    id="btn-save-as-favorite-setup"
                    type="button"
                    onClick={onOpenSaveFavorite}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow ${
                      isCurrentSetupFavorited
                        ? 'bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-amber-500/20'
                    }`}
                    title="Save this entire strategy with capital, leverage, SL, TP, trailing stop, and fees to favorites"
                  >
                    <Star className={`w-3.5 h-3.5 ${isCurrentSetupFavorited ? 'fill-amber-400 text-amber-400' : 'fill-slate-950 text-slate-950'}`} />
                    <span>{isCurrentSetupFavorited ? 'Setup Favorited' : 'Save as Favorite Setup...'}</span>
                  </button>
                )}

                {onOpenFavoritesManager && favoritesCount > 0 && (
                  <button
                    id="btn-open-favorites-from-strat-controls"
                    type="button"
                    onClick={onOpenFavoritesManager}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="View and reload your favorite strategies"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Favorites ({favoritesCount})</span>
                  </button>
                )}

                {strategy.isCustom && (
                  <button
                    id="btn-save-changes-strategy-param"
                    type="button"
                    onClick={handleSaveCurrentChanges}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Save changes directly to this strategy in your library"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save Changes</span>
                  </button>
                )}
              </div>

              <button
                id="btn-create-new-strategy-param"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Strategy</span>
              </button>
            </div>

            {/* Advanced Capital & Risk Management Accordion */}
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <button
                id="btn-toggle-advanced-settings"
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between w-full"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Capital, Direction, & Risk Rules
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  {showAdvanced ? 'Collapse' : 'Expand'}
                </span>
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Capital ($)</label>
                    <input
                      id="input-initial-capital"
                      type="number"
                      step={500}
                      value={settings.initialCapital}
                      onChange={(e) => onSettingsChange({ ...settings, initialCapital: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Direction</label>
                    <select
                      id="select-trade-direction"
                      value={settings.tradeDirection}
                      onChange={(e) => onSettingsChange({ ...settings, tradeDirection: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-100"
                    >
                      <option value="BOTH">Long & Short</option>
                      <option value="LONG_ONLY">Long Only</option>
                      <option value="SHORT_ONLY">Short Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Leverage</label>
                    <select
                      id="select-leverage"
                      value={settings.leverage}
                      onChange={(e) => onSettingsChange({ ...settings, leverage: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-100"
                    >
                      <option value={1}>1x (Spot)</option>
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                      <option value={5}>5x</option>
                      <option value={10}>10x</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Stop Loss %</label>
                    <input
                      id="input-stop-loss"
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={settings.stopLossPercent}
                      onChange={(e) => onSettingsChange({ ...settings, stopLossPercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-rose-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Take Profit %</label>
                    <input
                      id="input-take-profit"
                      type="number"
                      step={0.5}
                      min={0}
                      max={100}
                      value={settings.takeProfitPercent}
                      onChange={(e) => onSettingsChange({ ...settings, takeProfitPercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Trailing Stop %</label>
                    <input
                      id="input-trailing-stop"
                      type="number"
                      step={0.5}
                      min={0}
                      max={30}
                      value={settings.trailingStopPercent}
                      onChange={(e) => onSettingsChange({ ...settings, trailingStopPercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Fee % (Taker)</label>
                    <input
                      id="input-fee-rate"
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      value={settings.takerFeePercent}
                      onChange={(e) => onSettingsChange({ ...settings, takerFeePercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Slippage %</label>
                    <input
                      id="input-slippage-rate"
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      value={settings.slippagePercent}
                      onChange={(e) => onSettingsChange({ ...settings, slippagePercent: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-300"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button: Execute Test */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                Period: <strong className="text-emerald-400 font-mono">{periodInfo.periodLabel}</strong> ({periodInfo.candleLimit} bars) • Slippage: {settings.slippagePercent}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenPineModal && (
                <button
                  id="btn-open-pine-modal"
                  type="button"
                  onClick={onOpenPineModal}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  title="View, export, or convert strategies into TradingView Pine Script v5"
                >
                  <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pine Script (v5)</span>
                </button>
              )}

              <button
                id="btn-run-strategy-test"
                type="button"
                onClick={onRunTest}
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isLoading ? 'Simulating Engine...' : 'Run Strategy Test'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  const renderModals = () => (
    <>
      {/* Modals for Create New and Save As */}
      {isCreateModalOpen && (
        <CreateStrategyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(newStrat) => {
            if (onCreateCustomStrategy) {
              onCreateCustomStrategy(newStrat);
            } else {
              onStrategyChange(newStrat);
            }
            setStrategyCategory('CUSTOM');
            setSaveNotice(`Created new strategy: "${newStrat.name}"`);
            setTimeout(() => setSaveNotice(null), 3000);
          }}
        />
      )}

      {isSaveAsModalOpen && (
        <SaveAsStrategyModal
          isOpen={isSaveAsModalOpen}
          onClose={() => {
            setIsSaveAsModalOpen(false);
            setSaveAsSource(null);
          }}
          sourceStrategy={saveAsSource || strategy}
          onSaveAs={(newLabel, newDesc) => {
            const source = saveAsSource || strategy;
            const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const cloned: StrategyConfig = {
              ...source,
              id: newId,
              baseType: source.baseType || (
                source.customPineScript ? 'PINE_SCRIPT' :
                source.customRules ? 'CUSTOM_RULES' :
                source.customScript ? 'CUSTOM_SCRIPT' :
                (source.id as any)
              ),
              name: newLabel,
              description: newDesc || `Cloned from ${source.name}`,
              isCustom: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              params: { ...source.params },
              customPineScript: source.customPineScript,
              customRules: source.customRules ? JSON.parse(JSON.stringify(source.customRules)) : undefined,
              customScript: source.customScript,
            };
            if (onSaveAsCustomStrategy) {
              onSaveAsCustomStrategy(cloned);
            } else {
              onStrategyChange(cloned);
            }
            setStrategyCategory('CUSTOM');
            setSaveNotice(`Saved as new strategy: "${newLabel}"`);
            setTimeout(() => setSaveNotice(null), 3000);
          }}
        />
      )}
    </>
  );

  if (mode === 'MARKET_ONLY') {
    return null;
  }

  return (
    <div id="strategy-controls-container" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-xl shadow-black/20 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Strategy Analyzer & Execution Engine</span>
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-semibold" title="Market instrument configured on chart">
              {coin}/{pair}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold" title="Active Timeframe">
              {formatTimeframeDisplay(timeframe)}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Configure algorithmic rules, adjust technical parameters, and backtest across custom timeframes & historical periods.
          </p>
        </div>

        <button
          id="btn-run-strategy-header"
          type="button"
          onClick={onRunTest}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/40 disabled:opacity-50 transition-all cursor-pointer self-start sm:self-auto"
          title="Execute strategy backtest on selected timeframe and period"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Computing Backtest...' : 'Run Strategy'}</span>
        </button>
      </div>

      {renderStrategyControls()}
      {renderModals()}
    </div>
  );
};
