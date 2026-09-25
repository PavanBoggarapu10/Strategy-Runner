import React, { useEffect, useState, useCallback } from 'react';
import {
  QuotePair,
  Timeframe,
  StrategyConfig,
  BacktestSettings,
  Candle,
  BacktestResult,
  BacktestTimePeriod,
  DEFAULT_TIME_PERIOD,
  FavoriteStrategySetup,
} from './types/trading';
import { fetchCryptoCandles, SUPPORTED_COINS } from './utils/dataService';
import { resolvePeriodToRange } from './utils/periodUtils';
import {
  DEFAULT_BACKTEST_SETTINGS,
  STRATEGY_PRESETS,
  runBacktest,
} from './utils/strategyEngine';
import {
  getSavedCustomStrategies,
  saveCustomStrategy,
  deleteCustomStrategy,
  renameCustomStrategy,
} from './utils/customStrategyStorage';
import {
  getFavoriteStrategies,
  saveFavoriteStrategy,
  deleteFavoriteStrategy,
  updateFavoriteStrategyDetails,
  isStrategySetupFavorited,
} from './utils/favoriteStrategyStorage';
import { Header } from './components/Header';
import { StrategyControls } from './components/StrategyControls';
import { CandlestickChart } from './components/CandlestickChart';
import { MetricsOverview } from './components/MetricsOverview';
import { EquityChart } from './components/EquityChart';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { ParameterOptimizer } from './components/ParameterOptimizer';
import { CustomStrategyBuilder } from './components/CustomStrategyBuilder';
import { PineScriptExportModal } from './components/PineScriptExportModal';
import { SaveFavoriteModal } from './components/SaveFavoriteModal';
import { FavoritesManagerModal } from './components/FavoritesManagerModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  BarChart3,
  LineChart,
  ListOrdered,
  SlidersHorizontal,
  TrendingUp,
  AlertCircle,
  Zap,
  Sparkles,
  ChevronRight,
  Cpu,
  Play,
  Check,
  LayoutDashboard,
  Star,
} from 'lucide-react';

function StrategyDashboard() {
  // Combination State
  const [coin, setCoin] = useState<string>('BTC');
  const [pair, setPair] = useState<QuotePair>('USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1w');
  const [candleLimit, setCandleLimit] = useState<number>(300);
  const [timePeriod, setTimePeriod] = useState<BacktestTimePeriod>(DEFAULT_TIME_PERIOD);

  // Strategy & Settings State
  const [strategy, setStrategy] = useState<StrategyConfig>(STRATEGY_PRESETS[0]);
  const [settings, setSettings] = useState<BacktestSettings>(DEFAULT_BACKTEST_SETTINGS);

  // Market & Engine State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'synthetic'>('live');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Custom Strategies State
  const [customStrategies, setCustomStrategies] = useState<StrategyConfig[]>(() => getSavedCustomStrategies());

  // CRUD Handlers for Custom Strategies
  const handleCreateCustomStrategy = useCallback((newStrat: StrategyConfig) => {
    const updated = saveCustomStrategy(newStrat);
    setCustomStrategies(updated);
    setStrategy(newStrat);
    if (candles.length >= 2) {
      try {
        const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
        setBacktestResult(res);
      } catch (e) {
        console.error(e);
      }
    }
  }, [candles, settings, coin, pair, timeframe]);

  const handleSaveAsCustomStrategy = useCallback((newStrat: StrategyConfig) => {
    const updated = saveCustomStrategy(newStrat);
    setCustomStrategies(updated);
    setStrategy(newStrat);
    if (candles.length >= 2) {
      try {
        const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
        setBacktestResult(res);
      } catch (e) {
        console.error(e);
      }
    }
  }, [candles, settings, coin, pair, timeframe]);

  const handleUpdateCustomStrategy = useCallback((updatedStrat: StrategyConfig) => {
    const updated = saveCustomStrategy(updatedStrat);
    setCustomStrategies(updated);
    if (strategy.id === updatedStrat.id) {
      setStrategy(updatedStrat);
      if (candles.length >= 2) {
        try {
          const res = runBacktest(candles, updatedStrat, settings, coin, pair, timeframe);
          setBacktestResult(res);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [candles, settings, coin, pair, timeframe, strategy.id]);

  const handleDeleteCustomStrategy = useCallback((id: string) => {
    const updated = deleteCustomStrategy(id);
    setCustomStrategies(updated);
    if (strategy.id === id) {
      const fallback = STRATEGY_PRESETS[0];
      setStrategy(fallback);
      if (candles.length >= 2) {
        try {
          const res = runBacktest(candles, fallback, settings, coin, pair, timeframe);
          setBacktestResult(res);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [candles, settings, coin, pair, timeframe, strategy.id]);

  const handleRenameCustomStrategy = useCallback((id: string, newLabel: string, newDescription?: string) => {
    const updated = renameCustomStrategy(id, newLabel, newDescription);
    setCustomStrategies(updated);
    if (strategy.id === id) {
      setStrategy(prev => ({ ...prev, name: newLabel, description: newDescription || prev.description }));
    }
  }, [strategy.id]);

  const handleStrategyChange = useCallback((newStrat: StrategyConfig) => {
    setStrategy(newStrat);
    if (candles.length >= 2) {
      try {
        const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
        setBacktestResult(res);
      } catch (err: any) {
        console.error('Failed to run backtest on strategy change:', err);
      }
    }
  }, [candles, settings, coin, pair, timeframe]);

  // Favorites State
  const [favorites, setFavorites] = useState<FavoriteStrategySetup[]>(() => getFavoriteStrategies());
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState<boolean>(false);
  const [isSaveFavoriteModalOpen, setIsSaveFavoriteModalOpen] = useState<boolean>(false);
  const [favoriteSuccessToast, setFavoriteSuccessToast] = useState<string | null>(null);

  // Check if current active combination is already favorited
  const isCurrentSetupFavorited = isStrategySetupFavorited(
    favorites,
    coin,
    pair,
    timeframe,
    strategy.id,
    settings
  );

  const handleSaveFavorite = useCallback((newFavData: Omit<FavoriteStrategySetup, 'id' | 'createdAt'>) => {
    const { favorites: updatedList, saved } = saveFavoriteStrategy(newFavData);
    setFavorites(updatedList);
    setFavoriteSuccessToast(`Saved "${saved.title}" to Favorites!`);
    setTimeout(() => {
      setFavoriteSuccessToast(null);
    }, 4000);
  }, []);

  const handleDeleteFavorite = useCallback((id: string) => {
    const updatedList = deleteFavoriteStrategy(id);
    setFavorites(updatedList);
  }, []);

  const handleUpdateFavorite = useCallback((id: string, newTitle: string, newNotes?: string) => {
    const updatedList = updateFavoriteStrategyDetails(id, newTitle, newNotes);
    setFavorites(updatedList);
  }, []);

  const handleImportFavorites = useCallback((imported: FavoriteStrategySetup[]) => {
    setFavorites(imported);
    setFavoriteSuccessToast(`Imported ${imported.length} favorite strategies into library!`);
    setTimeout(() => {
      setFavoriteSuccessToast(null);
    }, 4000);
  }, []);

  // Active View Tab and Dashboard Layout
  const [dashboardLayout, setDashboardLayout] = useState<'CHART_TOP' | 'STRATEGY_FIRST'>('CHART_TOP');
  const [activeTab, setActiveTab] = useState<'CHART' | 'EQUITY' | 'TRADES' | 'OPTIMIZER' | 'CUSTOM_STRATEGY'>('CHART');
  const [isCustomBuilderModalOpen, setIsCustomBuilderModalOpen] = useState<boolean>(false);
  const [isPineModalOpen, setIsPineModalOpen] = useState<boolean>(false);

  // Smooth opener for custom strategy builder
  const handleOpenCustomBuilder = useCallback(() => {
    setIsCustomBuilderModalOpen(true);
    setActiveTab('CUSTOM_STRATEGY');
    setTimeout(() => {
      const el = document.getElementById('tab-navigation-bar') || document.getElementById('custom-strategy-builder-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  // Load candles and execute backtest
  const loadAndTest = useCallback(async (
    targetCoin = coin,
    targetPair = pair,
    targetTf = timeframe,
    targetPeriod = timePeriod,
    targetStrategy = strategy,
    targetSettings = settings
  ) => {
    setIsLoading(true);
    setInfoNotice(null);

    const { startTimeMs, endTimeMs, candleLimit: computedLimit, periodLabel } = resolvePeriodToRange(
      targetPeriod,
      targetTf
    );
    setCandleLimit(computedLimit);

    try {
      const { candles: loadedCandles, source, errorMsg } = await fetchCryptoCandles(
        targetCoin,
        targetPair,
        targetTf,
        computedLimit,
        startTimeMs,
        endTimeMs
      );

      setCandles(loadedCandles);
      setDataSource(source);
      if (errorMsg) {
        setInfoNotice(errorMsg);
      }

      if (loadedCandles.length >= 2) {
        const result = runBacktest(
          loadedCandles,
          targetStrategy,
          targetSettings,
          targetCoin,
          targetPair,
          targetTf
        );
        result.periodLabel = periodLabel;
        setBacktestResult(result);
      }
    } catch (err: any) {
      console.error('Backtest error:', err);
      setInfoNotice(`Execution error: ${err.message || 'Failed to simulate strategy.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [coin, pair, timeframe, timePeriod, strategy, settings]);

  const handleTimePeriodChange = useCallback((newPeriod: BacktestTimePeriod) => {
    setTimePeriod(newPeriod);
    loadAndTest(coin, pair, timeframe, newPeriod, strategy, settings);
  }, [coin, pair, timeframe, strategy, settings, loadAndTest]);

  // Initial load
  useEffect(() => {
    loadAndTest();
  }, []);

  // Quick preset loader (e.g. BTC Trend Follower, ETH RSI Swing, SOL Volatility Rider)
  const applyQuickPreset = (presetCoin: string, presetPair: QuotePair, presetTf: Timeframe, stratId: string) => {
    setCoin(presetCoin);
    setPair(presetPair);
    setTimeframe(presetTf);

    const targetStrat = STRATEGY_PRESETS.find(s => s.id === stratId) || STRATEGY_PRESETS[0];
    setStrategy(targetStrat);

    loadAndTest(presetCoin, presetPair, presetTf, timePeriod, targetStrat, settings);
  };

  // Quick favorite loader: loads capital amount, direction, Leverage, Stop Loss, Take Profit, trailing stop loss, fee%, Slippage, and its strategy
  const handleLoadFavorite = useCallback((fav: FavoriteStrategySetup) => {
    setCoin(fav.coin);
    setPair(fav.pair);
    setTimeframe(fav.timeframe);
    setTimePeriod(fav.timePeriod);
    setStrategy(fav.strategy);
    setSettings(fav.settings);

    loadAndTest(
      fav.coin,
      fav.pair,
      fav.timeframe,
      fav.timePeriod,
      fav.strategy,
      fav.settings
    );

    setFavoriteSuccessToast(
      `Loaded "${fav.title}" — Capital: $${fav.settings.initialCapital.toLocaleString()} • ${fav.settings.tradeDirection} • ${fav.settings.leverage}x • SL ${fav.settings.stopLossPercent}% • TP ${fav.settings.takeProfitPercent}% • Trailing SL ${fav.settings.trailingStopPercent}% • Fee ${fav.settings.takerFeePercent}% • Slippage ${fav.settings.slippagePercent}%`
    );
    setTimeout(() => {
      setFavoriteSuccessToast(null);
    }, 5000);
  }, [loadAndTest]);

  // Compute live price & 24h/period change
  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const firstPrice = candles.length > 0 ? candles[0].close : 1;
  const priceChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  // Re-run backtest on current candles when parameters change
  const handleRunTest = () => {
    if (candles.length >= 2) {
      try {
        const result = runBacktest(candles, strategy, settings, coin, pair, timeframe);
        const { periodLabel } = resolvePeriodToRange(timePeriod, timeframe);
        result.periodLabel = periodLabel;
        setBacktestResult(result);
      } catch (err: any) {
        console.error(err);
      }
    } else {
      loadAndTest();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <Header
        coin={coin}
        pair={pair}
        timeframe={timeframe}
        strategyName={strategy.name}
        dataSource={dataSource}
        lastPrice={lastPrice}
        priceChange24h={priceChange}
        onRefresh={() => loadAndTest()}
        isLoading={isLoading}
        onOpenFavorites={() => setIsFavoritesModalOpen(true)}
        favoritesCount={favorites.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Quick Strategy Templates Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Popular Strategy Combos:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Favorites Shortcut Button */}
            <button
              id="btn-pill-favorites"
              type="button"
              onClick={() => setIsFavoritesModalOpen(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Open your library of favorite strategies"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Favorites ({favorites.length})</span>
            </button>

            <button
              id="preset-eth-rsi-1hr"
              onClick={() => applyQuickPreset('ETH', 'USDT', '1h', 'RSI_REVERSION')}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              ETH/USDT 1hr • RSI Swing
            </button>
            <button
              id="preset-btc-trend-4hr"
              onClick={() => applyQuickPreset('BTC', 'USDT', '4h', 'EMA_CROSS')}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              BTC/USDT 4hr • Golden Cross
            </button>
            <button
              id="preset-sol-supertrend-1d"
              onClick={() => applyQuickPreset('SOL', 'USDT', '1d', 'SUPERTREND')}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              SOL/USDT 1D • Supertrend Swing
            </button>
            <button
              id="preset-sol-supertrend"
              onClick={() => applyQuickPreset('SOL', 'USDT', '15m', 'SUPERTREND')}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              SOL/USDT 15m • Supertrend
            </button>
            <button
              id="preset-custom-builder"
              onClick={() => {
                const customStrat = STRATEGY_PRESETS.find(s => s.id === 'CUSTOM_RULES') || STRATEGY_PRESETS[STRATEGY_PRESETS.length - 2];
                setStrategy(customStrat);
                handleOpenCustomBuilder();
                if (candles.length >= 2) {
                  const res = runBacktest(candles, customStrat, settings, coin, pair, timeframe);
                  setBacktestResult(res);
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-purple-950 hover:bg-purple-900 border border-purple-500/50 text-purple-200 transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3 h-3 text-purple-400" />
              <span>Custom Strategy Builder & Efficiency</span>
            </button>

            {/* Layout Toggle: Chart Above Strategy vs Classic */}
            <button
              id="btn-toggle-dashboard-layout"
              onClick={() => setDashboardLayout((prev) => (prev === 'CHART_TOP' ? 'STRATEGY_FIRST' : 'CHART_TOP'))}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                dashboardLayout === 'CHART_TOP'
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Toggle Layout: Chart Above Strategy vs Classic All-in-One"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Layout: {dashboardLayout === 'CHART_TOP' ? 'Chart Above Strategy' : 'Classic All-in-One'}</span>
            </button>
          </div>
        </div>

        {/* Notice alert if using simulated data */}
        {infoNotice && (
          <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-xs text-cyan-300 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-cyan-400" />
            <span>{infoNotice}</span>
          </div>
        )}

        {/* Layout Mode 1: CHART_TOP (Candlestick Chart -> Scorecard -> Select Strategy & Parameters) */}
        {dashboardLayout === 'CHART_TOP' ? (
          <>
            {/* 1. Primary Interactive Candlestick Chart with integrated Symbol, Pair & Timeframe controls */}
            <div id="primary-chart-section" className="scroll-mt-6">
              <CandlestickChart
                candles={candles}
                result={backtestResult}
                coin={coin}
                onCoinChange={(newCoin) => {
                  setCoin(newCoin);
                  loadAndTest(newCoin, pair, timeframe, timePeriod, strategy, settings);
                }}
                pair={pair}
                onPairChange={(newPair) => {
                  setPair(newPair);
                  loadAndTest(coin, newPair, timeframe, timePeriod, strategy, settings);
                }}
                timeframe={timeframe}
                onTimeframeChange={(newTf) => {
                  setTimeframe(newTf);
                  loadAndTest(coin, pair, newTf, timePeriod, strategy, settings);
                }}
                candleLimit={candleLimit}
                onCandleLimitChange={(newLimit) => {
                  setCandleLimit(newLimit);
                  loadAndTest(coin, pair, timeframe, timePeriod, strategy, settings);
                }}
                timePeriod={timePeriod}
                onTimePeriodChange={handleTimePeriodChange}
                strategy={strategy}
                customStrategies={customStrategies}
                onStrategyChange={handleStrategyChange}
                onOpenCustomBuilder={() => {
                  setActiveTab('CUSTOM_STRATEGY');
                  setIsCustomBuilderModalOpen(true);
                }}
              />
            </div>

            {/* 3. Performance Scorecard Metrics Overview */}
            {backtestResult && (
              <MetricsOverview
                result={backtestResult}
                onOpenSaveFavorite={() => setIsSaveFavoriteModalOpen(true)}
                onOpenFavoritesManager={() => setIsFavoritesModalOpen(true)}
                isFavorited={isCurrentSetupFavorited}
                favoritesCount={favorites.length}
              />
            )}

            {/* 4. Select Trading Strategy & Parameter Controls */}
            <div id="strategy-controls-section" className="scroll-mt-6">
              <StrategyControls
                mode="STRATEGY_ONLY"
                coin={coin}
                onCoinChange={(newCoin) => {
                  setCoin(newCoin);
                  loadAndTest(newCoin, pair, timeframe, timePeriod, strategy, settings);
                }}
                pair={pair}
                onPairChange={(newPair) => {
                  setPair(newPair);
                  loadAndTest(coin, newPair, timeframe, timePeriod, strategy, settings);
                }}
                timeframe={timeframe}
                onTimeframeChange={(newTf) => {
                  setTimeframe(newTf);
                  loadAndTest(coin, pair, newTf, timePeriod, strategy, settings);
                }}
                candleLimit={candleLimit}
                onCandleLimitChange={(newLimit) => {
                  setCandleLimit(newLimit);
                  loadAndTest(coin, pair, timeframe, timePeriod, strategy, settings);
                }}
                timePeriod={timePeriod}
                onTimePeriodChange={handleTimePeriodChange}
                strategy={strategy}
                onStrategyChange={handleStrategyChange}
                settings={settings}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings);
                  if (candles.length >= 2) {
                    try {
                      const res = runBacktest(candles, strategy, newSettings, coin, pair, timeframe);
                      setBacktestResult(res);
                    } catch (e) {}
                  }
                }}
                onRunTest={handleRunTest}
                isLoading={isLoading}
                onOpenCustomBuilder={handleOpenCustomBuilder}
                onOpenPineModal={() => setIsPineModalOpen(true)}
                customStrategies={customStrategies}
                onCreateCustomStrategy={handleCreateCustomStrategy}
                onSaveAsCustomStrategy={handleSaveAsCustomStrategy}
                onUpdateCustomStrategy={handleUpdateCustomStrategy}
                onDeleteCustomStrategy={handleDeleteCustomStrategy}
                onRenameCustomStrategy={handleRenameCustomStrategy}
                onOpenSaveFavorite={() => setIsSaveFavoriteModalOpen(true)}
                onOpenFavoritesManager={() => setIsFavoritesModalOpen(true)}
                favoritesCount={favorites.length}
                isCurrentSetupFavorited={isCurrentSetupFavorited}
              />
            </div>
          </>
        ) : (
          /* Layout Mode 2: Classic (Strategy Controls -> Scorecard) */
          <>
            <StrategyControls
              mode="STRATEGY_ONLY"
              coin={coin}
              onCoinChange={(newCoin) => {
                setCoin(newCoin);
                loadAndTest(newCoin, pair, timeframe, timePeriod, strategy, settings);
              }}
              pair={pair}
              onPairChange={(newPair) => {
                setPair(newPair);
                loadAndTest(coin, newPair, timeframe, timePeriod, strategy, settings);
              }}
              timeframe={timeframe}
              onTimeframeChange={(newTf) => {
                setTimeframe(newTf);
                loadAndTest(coin, pair, newTf, timePeriod, strategy, settings);
              }}
              candleLimit={candleLimit}
              onCandleLimitChange={(newLimit) => {
                setCandleLimit(newLimit);
                loadAndTest(coin, pair, timeframe, timePeriod, strategy, settings);
              }}
              timePeriod={timePeriod}
              onTimePeriodChange={handleTimePeriodChange}
              strategy={strategy}
              onStrategyChange={handleStrategyChange}
              settings={settings}
              onSettingsChange={(newSettings) => {
                setSettings(newSettings);
                if (candles.length >= 2) {
                  try {
                    const res = runBacktest(candles, strategy, newSettings, coin, pair, timeframe);
                    setBacktestResult(res);
                  } catch (e) {}
                }
              }}
              onRunTest={handleRunTest}
              isLoading={isLoading}
              onOpenCustomBuilder={handleOpenCustomBuilder}
              onOpenPineModal={() => setIsPineModalOpen(true)}
              customStrategies={customStrategies}
              onCreateCustomStrategy={handleCreateCustomStrategy}
              onSaveAsCustomStrategy={handleSaveAsCustomStrategy}
              onUpdateCustomStrategy={handleUpdateCustomStrategy}
              onDeleteCustomStrategy={handleDeleteCustomStrategy}
              onRenameCustomStrategy={handleRenameCustomStrategy}
              onOpenSaveFavorite={() => setIsSaveFavoriteModalOpen(true)}
              onOpenFavoritesManager={() => setIsFavoritesModalOpen(true)}
              favoritesCount={favorites.length}
              isCurrentSetupFavorited={isCurrentSetupFavorited}
            />

            {backtestResult && (
              <MetricsOverview
                result={backtestResult}
                onOpenSaveFavorite={() => setIsSaveFavoriteModalOpen(true)}
                onOpenFavoritesManager={() => setIsFavoritesModalOpen(true)}
                isFavorited={isCurrentSetupFavorited}
                favoritesCount={favorites.length}
              />
            )}
          </>
        )}

        {/* Deep Dive Analysis Tabs */}
        <div id="tab-navigation-bar" className="border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0">
            {dashboardLayout === 'STRATEGY_FIRST' && (
              <button
                id="tab-chart"
                onClick={() => setActiveTab('CHART')}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'CHART'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Candlestick & Signals</span>
              </button>
            )}

            <button
              id="tab-equity"
              onClick={() => setActiveTab('EQUITY')}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'EQUITY'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LineChart className="w-4 h-4" />
              <span>Equity Curve & Drawdowns</span>
            </button>

            <button
              id="tab-trades"
              onClick={() => setActiveTab('TRADES')}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'TRADES'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Trade Execution Ledger ({backtestResult?.trades.length || 0})</span>
            </button>

            <button
              id="tab-custom-strategy"
              onClick={() => setActiveTab('CUSTOM_STRATEGY')}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'CUSTOM_STRATEGY'
                  ? 'border-purple-400 text-purple-400 bg-purple-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Strategy Studio & AI Analyzer</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-400" /> GEMINI AI
              </span>
            </button>

            <button
              id="tab-optimizer"
              onClick={() => setActiveTab('OPTIMIZER')}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'OPTIMIZER'
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Parameter Sensitivity Matrix</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <div className="hidden lg:flex items-center gap-2">
              <span>Pair:</span>
              <span className="text-white font-bold">{coin}/{pair}</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300 font-bold">{timeframe}</span>
            </div>

            <button
              id="btn-tab-layout-toggle"
              onClick={() => setDashboardLayout((prev) => (prev === 'CHART_TOP' ? 'STRATEGY_FIRST' : 'CHART_TOP'))}
              className="px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors text-[11px]"
              title="Toggle Layout"
            >
              <LayoutDashboard className="w-3 h-3 text-cyan-400" />
              <span>{dashboardLayout === 'CHART_TOP' ? 'Layout: Chart on Top' : 'Layout: Classic'}</span>
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="space-y-6">
          {activeTab === 'CUSTOM_STRATEGY' && (
            <CustomStrategyBuilder
              candles={candles}
              coin={coin}
              pair={pair}
              timeframe={timeframe}
              onTimeframeChange={(newTf) => {
                setTimeframe(newTf);
                loadAndTest(coin, pair, newTf, candleLimit, strategy, settings);
              }}
              settings={settings}
              activeStrategy={strategy}
              currentResult={backtestResult}
              isModal={false}
              customStrategies={customStrategies}
              onSelectStrategy={(newStrat) => {
                setStrategy(newStrat);
                if (candles.length >= 2) {
                  const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
                  setBacktestResult(res);
                }
              }}
              onExpand={() => setIsCustomBuilderModalOpen(true)}
              onCreateCustomStrategy={handleCreateCustomStrategy}
              onSaveAsCustomStrategy={handleSaveAsCustomStrategy}
              onApplyStrategy={(newStrategy) => {
                setStrategy(newStrategy);
                if (candles.length >= 2) {
                  const res = runBacktest(candles, newStrategy, settings, coin, pair, timeframe);
                  setBacktestResult(res);
                }
              }}
            />
          )}

          {dashboardLayout === 'STRATEGY_FIRST' && activeTab === 'CHART' && (
            <CandlestickChart
              candles={candles}
              result={backtestResult}
              coin={coin}
              onCoinChange={(newCoin) => {
                setCoin(newCoin);
                loadAndTest(newCoin, pair, timeframe, timePeriod, strategy, settings);
              }}
              pair={pair}
              onPairChange={(newPair) => {
                setPair(newPair);
                loadAndTest(coin, newPair, timeframe, timePeriod, strategy, settings);
              }}
              timeframe={timeframe}
              onTimeframeChange={(newTf) => {
                setTimeframe(newTf);
                loadAndTest(coin, pair, newTf, timePeriod, strategy, settings);
              }}
              candleLimit={candleLimit}
              onCandleLimitChange={(newLimit) => {
                setCandleLimit(newLimit);
                loadAndTest(coin, pair, timeframe, timePeriod, strategy, settings);
              }}
              timePeriod={timePeriod}
              onTimePeriodChange={handleTimePeriodChange}
              strategy={strategy}
              customStrategies={customStrategies}
              onStrategyChange={handleStrategyChange}
              onOpenCustomBuilder={() => setActiveTab('CUSTOM_STRATEGY')}
            />
          )}

          {((activeTab === 'EQUITY') || (dashboardLayout === 'CHART_TOP' && activeTab === 'CHART')) && backtestResult && (
            <EquityChart
              result={backtestResult}
              timeframe={timeframe}
            />
          )}

          {activeTab === 'TRADES' && backtestResult && (
            <TradeHistoryTable
              trades={backtestResult.trades}
              coin={coin}
              pair={pair}
            />
          )}

          {activeTab === 'OPTIMIZER' && (
            <ParameterOptimizer
              candles={candles}
              strategy={strategy}
              settings={settings}
              coin={coin}
              pair={pair}
              timeframe={timeframe}
              onApplyParams={(newParams) => {
                const updatedStrategy = {
                  ...strategy,
                  params: {
                    ...strategy.params,
                    ...newParams,
                  },
                };
                setStrategy(updatedStrategy);
                if (candles.length >= 2) {
                  const res = runBacktest(candles, updatedStrategy, settings, coin, pair, timeframe);
                  setBacktestResult(res);
                }
              }}
            />
          )}
        </div>
      </main>

      {/* Fullscreen Interactive Custom Strategy Studio Modal */}
      {isCustomBuilderModalOpen && (
        <CustomStrategyBuilder
          candles={candles}
          coin={coin}
          pair={pair}
          timeframe={timeframe}
          onTimeframeChange={(newTf) => {
            setTimeframe(newTf);
            loadAndTest(coin, pair, newTf, timePeriod, strategy, settings);
          }}
          settings={settings}
          activeStrategy={strategy}
          currentResult={backtestResult}
          isModal={true}
          customStrategies={customStrategies}
          onSelectStrategy={(newStrat) => {
            setStrategy(newStrat);
            if (candles.length >= 2) {
              const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
              setBacktestResult(res);
            }
          }}
          onClose={() => setIsCustomBuilderModalOpen(false)}
          onCreateCustomStrategy={handleCreateCustomStrategy}
          onSaveAsCustomStrategy={handleSaveAsCustomStrategy}
          onApplyStrategy={(newStrategy) => {
            setStrategy(newStrategy);
            if (candles.length >= 2) {
              const res = runBacktest(candles, newStrategy, settings, coin, pair, timeframe);
              setBacktestResult(res);
            }
          }}
        />
      )}

      {/* TradingView Pine Script (v5) Export & Conversion Studio Modal */}
      {isPineModalOpen && (
        <PineScriptExportModal
          isOpen={isPineModalOpen}
          onClose={() => setIsPineModalOpen(false)}
          activeStrategy={strategy}
          settings={settings}
          coin={coin}
          pair={pair}
          timeframe={timeframe}
          onApplyPineScript={(pineCode, stratName) => {
            const newStrat: StrategyConfig = {
              id: 'PINE_SCRIPT',
              name: stratName || 'Pine Script Strategy (v5)',
              description: 'TradingView Pine Script v5 strategy',
              params: {},
              customPineScript: pineCode,
            };
            setStrategy(newStrat);
            setIsPineModalOpen(false);
            if (candles.length >= 2) {
              const res = runBacktest(candles, newStrat, settings, coin, pair, timeframe);
              setBacktestResult(res);
            }
          }}
        />
      )}

      {/* Save Setup to Favorites Modal */}
      <SaveFavoriteModal
        isOpen={isSaveFavoriteModalOpen}
        onClose={() => setIsSaveFavoriteModalOpen(false)}
        coin={coin}
        pair={pair}
        timeframe={timeframe}
        timePeriod={timePeriod}
        strategy={strategy}
        settings={settings}
        result={backtestResult}
        onSaveFavorite={handleSaveFavorite}
      />

      {/* Favorites Library Manager Modal */}
      <FavoritesManagerModal
        isOpen={isFavoritesModalOpen}
        onClose={() => setIsFavoritesModalOpen(false)}
        favorites={favorites}
        onLoadFavorite={handleLoadFavorite}
        onDeleteFavorite={handleDeleteFavorite}
        onUpdateFavorite={handleUpdateFavorite}
        onOpenSaveCurrentModal={() => {
          setIsFavoritesModalOpen(false);
          setIsSaveFavoriteModalOpen(true);
        }}
        onImportFavorites={handleImportFavorites}
      />

      {/* Floating Favorite Action Toast */}
      {favoriteSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 border border-amber-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Star className="w-4 h-4 fill-amber-400" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-semibold text-slate-100">{favoriteSuccessToast}</p>
          </div>
          <button
            onClick={() => setFavoriteSuccessToast(null)}
            className="text-slate-400 hover:text-white text-xs font-mono p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400 font-mono">
        <p>
          Crypto Strategy Tester • Live Exchange API & Microstructure Simulator • For educational & quantitative backtesting purposes.
        </p>
      </footer>
    </div>
  );
}

function MainContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300 font-sans">
        <div className="w-9 h-9 border-2 border-purple-500/20 border-t-purple-400 rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400">Checking terminal access authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <StrategyDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
