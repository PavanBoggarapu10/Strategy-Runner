import {
  FavoriteStrategySetup,
  QuotePair,
  Timeframe,
  StrategyConfig,
  BacktestSettings,
  BacktestTimePeriod,
  formatTimeframeDisplay,
} from '../types/trading';
import { STRATEGY_PRESETS, DEFAULT_BACKTEST_SETTINGS } from './strategyEngine';

const STORAGE_KEY = 'crypto_strategy_favorites_v1';

export const INITIAL_FAVORITE_SETUPS: FavoriteStrategySetup[] = [
  {
    id: 'fav_btc_golden_alpha_4h',
    title: 'BTC/USDT 4hr • Golden Alpha High-Yield',
    notes: 'Institutional trend-following setup with ATR volatility trailing stop on 4-hour candles.',
    createdAt: 1711000000000,
    coin: 'BTC',
    pair: 'USDT',
    timeframe: '4h',
    timePeriod: { preset: '1M' },
    strategy: STRATEGY_PRESETS.find(s => s.id === 'GOLDEN_ALPHA') || STRATEGY_PRESETS[0],
    settings: {
      initialCapital: 10000,
      tradeDirection: 'BOTH',
      positionSizePercent: 100,
      leverage: 2,
      stopLossPercent: 2.5,
      takeProfitPercent: 6.0,
      trailingStopPercent: 1.5,
      makerFeePercent: 0.05,
      takerFeePercent: 0.075,
      slippagePercent: 0.05,
    },
    metricsSnapshot: {
      netProfit: 3450,
      netProfitPercent: 34.5,
      winRate: 66.7,
      profitFactor: 2.45,
      totalTrades: 18,
      maxDrawdownPercent: 6.2,
      alphaPercent: 18.4,
      sharpeRatio: 1.85,
      efficiencyScore: 88,
      efficiencyGrade: 'A',
    },
  },
  {
    id: 'fav_eth_rsi_swing_1h',
    title: 'ETH/USDT 1hr • RSI Mean Reversion Scalp',
    notes: '1-hour intraday oscillations with strict 2% stop loss and 3x leverage.',
    createdAt: 1711000001000,
    coin: 'ETH',
    pair: 'USDT',
    timeframe: '1h',
    timePeriod: { preset: '1M' },
    strategy: STRATEGY_PRESETS.find(s => s.id === 'RSI_REVERSION') || STRATEGY_PRESETS[1],
    settings: {
      initialCapital: 10000,
      tradeDirection: 'BOTH',
      positionSizePercent: 100,
      leverage: 3,
      stopLossPercent: 2.0,
      takeProfitPercent: 5.0,
      trailingStopPercent: 1.0,
      makerFeePercent: 0.05,
      takerFeePercent: 0.075,
      slippagePercent: 0.05,
    },
    metricsSnapshot: {
      netProfit: 2890,
      netProfitPercent: 28.9,
      winRate: 70.4,
      profitFactor: 2.2,
      totalTrades: 27,
      maxDrawdownPercent: 7.8,
      alphaPercent: 14.1,
      sharpeRatio: 1.72,
      efficiencyScore: 84,
      efficiencyGrade: 'B',
    },
  },
  {
    id: 'fav_sol_supertrend_1d',
    title: 'SOL/USDT 1D • Supertrend Swing Breakout',
    notes: 'Daily multi-week trend capture riding Supertrend flips with 3x leverage and trailing lock.',
    createdAt: 1711000002000,
    coin: 'SOL',
    pair: 'USDT',
    timeframe: '1d',
    timePeriod: { preset: '6M' },
    strategy: STRATEGY_PRESETS.find(s => s.id === 'SUPERTREND') || STRATEGY_PRESETS[4],
    settings: {
      initialCapital: 10000,
      tradeDirection: 'BOTH',
      positionSizePercent: 100,
      leverage: 3,
      stopLossPercent: 4.0,
      takeProfitPercent: 12.0,
      trailingStopPercent: 2.5,
      makerFeePercent: 0.05,
      takerFeePercent: 0.075,
      slippagePercent: 0.05,
    },
    metricsSnapshot: {
      netProfit: 5820,
      netProfitPercent: 58.2,
      winRate: 64.3,
      profitFactor: 2.65,
      totalTrades: 14,
      maxDrawdownPercent: 9.2,
      alphaPercent: 28.7,
      sharpeRatio: 2.1,
      efficiencyScore: 91,
      efficiencyGrade: 'A',
    },
  },
  {
    id: 'fav_sol_supertrend_15m',
    title: 'SOL/USDT 15m • High-Frequency Scalper',
    notes: 'Momentum breakout tracking with dynamic trailing stops during high volume trends.',
    createdAt: 1711000003000,
    coin: 'SOL',
    pair: 'USDT',
    timeframe: '15m',
    timePeriod: { preset: '1w' },
    strategy: STRATEGY_PRESETS.find(s => s.id === 'SUPERTREND') || STRATEGY_PRESETS[4],
    settings: {
      initialCapital: 10000,
      tradeDirection: 'BOTH',
      positionSizePercent: 100,
      leverage: 5,
      stopLossPercent: 1.8,
      takeProfitPercent: 4.5,
      trailingStopPercent: 1.2,
      makerFeePercent: 0.05,
      takerFeePercent: 0.075,
      slippagePercent: 0.05,
    },
    metricsSnapshot: {
      netProfit: 4120,
      netProfitPercent: 41.2,
      winRate: 62.5,
      profitFactor: 2.38,
      totalTrades: 32,
      maxDrawdownPercent: 8.9,
      alphaPercent: 21.6,
      sharpeRatio: 1.9,
      efficiencyScore: 86,
      efficiencyGrade: 'A',
    },
  },
];

/**
 * Retrieves all saved favorite strategy setups from localStorage.
 */
export function getFavoriteStrategies(): FavoriteStrategySetup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_FAVORITE_SETUPS));
      return INITIAL_FAVORITE_SETUPS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_FAVORITE_SETUPS;
  } catch (err) {
    console.warn('Failed to load favorites from localStorage:', err);
    return INITIAL_FAVORITE_SETUPS;
  }
}

/**
 * Saves a new favorite setup or updates an existing one.
 */
export function saveFavoriteStrategy(
  setup: Omit<FavoriteStrategySetup, 'id' | 'createdAt'> & { id?: string }
): { favorites: FavoriteStrategySetup[]; saved: FavoriteStrategySetup } {
  try {
    const current = getFavoriteStrategies();
    const id = setup.id || `fav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const newFavorite: FavoriteStrategySetup = {
      ...setup,
      id,
      createdAt: now,
      updatedAt: now,
      title: setup.title.trim() || `${setup.coin}/${setup.pair} ${setup.timeframe} • ${setup.strategy.name}`,
    };

    const existingIndex = current.findIndex(f => f.id === id);
    let nextList: FavoriteStrategySetup[];
    if (existingIndex >= 0) {
      nextList = [...current];
      nextList[existingIndex] = { ...newFavorite, createdAt: current[existingIndex].createdAt };
    } else {
      nextList = [newFavorite, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return { favorites: nextList, saved: newFavorite };
  } catch (err) {
    console.warn('Failed to save favorite strategy setup:', err);
    const fallbackList = getFavoriteStrategies();
    return {
      favorites: fallbackList,
      saved: {
        ...setup,
        id: setup.id || `fav_${Date.now()}`,
        createdAt: Date.now(),
      },
    };
  }
}

/**
 * Deletes a favorite strategy setup by ID.
 */
export function deleteFavoriteStrategy(id: string): FavoriteStrategySetup[] {
  try {
    const current = getFavoriteStrategies();
    const nextList = current.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (err) {
    console.warn('Failed to delete favorite strategy setup:', err);
    return getFavoriteStrategies();
  }
}

/**
 * Updates favorite title and optional notes.
 */
export function updateFavoriteStrategyDetails(
  id: string,
  newTitle: string,
  newNotes?: string
): FavoriteStrategySetup[] {
  try {
    const current = getFavoriteStrategies();
    const nextList = current.map(f => {
      if (f.id === id) {
        return {
          ...f,
          title: newTitle.trim() || f.title,
          notes: newNotes !== undefined ? newNotes.trim() : f.notes,
          updatedAt: Date.now(),
        };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (err) {
    console.warn('Failed to update favorite details:', err);
    return getFavoriteStrategies();
  }
}

/**
 * Checks if current market + strategy setup is already matched in favorites.
 */
export function isStrategySetupFavorited(
  favorites: FavoriteStrategySetup[],
  coin: string,
  pair: QuotePair,
  timeframe: Timeframe,
  strategyId: string,
  settings: BacktestSettings
): boolean {
  return favorites.some(
    f =>
      f.coin.toUpperCase() === coin.toUpperCase() &&
      f.pair.toUpperCase() === pair.toUpperCase() &&
      (f.timeframe === timeframe || formatTimeframeDisplay(f.timeframe) === formatTimeframeDisplay(timeframe)) &&
      f.strategy.id === strategyId &&
      f.settings.initialCapital === settings.initialCapital &&
      f.settings.tradeDirection === settings.tradeDirection &&
      f.settings.leverage === settings.leverage &&
      f.settings.stopLossPercent === settings.stopLossPercent &&
      f.settings.takeProfitPercent === settings.takeProfitPercent &&
      f.settings.trailingStopPercent === settings.trailingStopPercent &&
      f.settings.takerFeePercent === settings.takerFeePercent &&
      f.settings.slippagePercent === settings.slippagePercent
  );
}

/**
 * Exports favorites list to a JSON string for backup/sharing.
 */
export function exportFavoritesAsJson(favorites: FavoriteStrategySetup[]): string {
  return JSON.stringify(favorites, null, 2);
}

/**
 * Imports favorites from a JSON string.
 */
export function importFavoritesFromJson(jsonStr: string): FavoriteStrategySetup[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid favorites JSON format: root is not an array.');
    }
    const current = getFavoriteStrategies();
    // Merge without duplicates by ID
    const currentIds = new Set(current.map(c => c.id));
    const imported = parsed.filter(item => item && item.id && item.coin && item.strategy && item.settings);
    const merged = [...imported.filter(item => !currentIds.has(item.id)), ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('Failed to import favorites JSON:', err);
    throw err;
  }
}
