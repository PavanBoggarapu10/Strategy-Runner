import { CustomRulesConfig, StrategyConfig, StrategyType } from '../types/trading';
import {
  DEFAULT_CUSTOM_RULES,
  DEFAULT_CUSTOM_SCRIPT,
  STRATEGY_PRESETS,
} from './strategyEngine';
import { DEFAULT_PINE_SCRIPT } from './pineScriptGenerator';

const STORAGE_KEY = 'crypto_custom_strategies_v2';

export const INITIAL_CUSTOM_STRATEGIES: StrategyConfig[] = [
  {
    id: 'custom_pine_default',
    baseType: 'PINE_SCRIPT',
    name: 'My Pine Script Strategy (v5)',
    description: 'Custom TradingView Pine Script v5 strategy with live backtesting.',
    isCustom: true,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customPineScript: DEFAULT_PINE_SCRIPT,
  },
  {
    id: 'custom_rules_default',
    baseType: 'CUSTOM_RULES',
    name: 'My Multi-Condition Rule Strategy',
    description: 'Visual rule builder with multi-indicator conditions and Boolean logic.',
    isCustom: true,
    createdAt: 1710000001000,
    updatedAt: 1710000001000,
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customRules: DEFAULT_CUSTOM_RULES,
  },
  {
    id: 'custom_script_default',
    baseType: 'CUSTOM_SCRIPT',
    name: 'My Quantitative JS Sandbox',
    description: 'Custom JavaScript algorithmic trading logic with tick-level simulation.',
    isCustom: true,
    createdAt: 1710000002000,
    updatedAt: 1710000002000,
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customScript: DEFAULT_CUSTOM_SCRIPT,
  },
];

/**
 * Loads all saved user custom strategies from localStorage.
 */
export function getSavedCustomStrategies(): StrategyConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CUSTOM_STRATEGIES));
      return INITIAL_CUSTOM_STRATEGIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Automatically refresh built-in defaults if they contained the old conditions
      const refreshed = parsed.map((strat: StrategyConfig) => {
        if (strat.id === 'custom_pine_default' && (!strat.customPineScript || strat.customPineScript.includes('close > emaFast'))) {
          return { ...strat, customPineScript: DEFAULT_PINE_SCRIPT };
        }
        if (strat.id === 'custom_rules_default' && strat.customRules?.buyRules?.some((r: any) => r.rightIndicator === 'emaFast')) {
          return { ...strat, customRules: DEFAULT_CUSTOM_RULES };
        }
        if (strat.id === 'custom_script_default' && strat.customScript?.includes('rsi < 36 && candle.close > indicators.emaFast')) {
          return { ...strat, customScript: DEFAULT_CUSTOM_SCRIPT };
        }
        return strat;
      });
      return refreshed;
    }
    return INITIAL_CUSTOM_STRATEGIES;
  } catch (err) {
    console.warn('Failed to load custom strategies from localStorage:', err);
    return INITIAL_CUSTOM_STRATEGIES;
  }
}

/**
 * Saves or updates a custom strategy in storage.
 */
export function saveCustomStrategy(strategy: StrategyConfig): StrategyConfig[] {
  try {
    const current = getSavedCustomStrategies();
    const existingIndex = current.findIndex(s => s.id === strategy.id);
    const updatedStrategy: StrategyConfig = {
      ...strategy,
      isCustom: true,
      updatedAt: Date.now(),
      createdAt: strategy.createdAt || Date.now(),
    };

    let nextList: StrategyConfig[];
    if (existingIndex >= 0) {
      nextList = [...current];
      nextList[existingIndex] = updatedStrategy;
    } else {
      nextList = [updatedStrategy, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (err) {
    console.warn('Failed to save custom strategy:', err);
    return getSavedCustomStrategies();
  }
}

/**
 * Creates a brand new custom strategy and saves it.
 */
export function createCustomStrategy(options: {
  name: string;
  description?: string;
  baseType: StrategyType;
  templateCode?: string;
  customPineScript?: string;
  customRules?: CustomRulesConfig;
  customScript?: string;
  params?: Record<string, any>;
}): StrategyConfig {
  const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  let pineCode: string | undefined = undefined;
  let rulesConfig: CustomRulesConfig | undefined = undefined;
  let scriptCode: string | undefined = undefined;
  let params: Record<string, any> = options.params ? { ...options.params } : { fastPeriod: 9, slowPeriod: 21, rsiPeriod: 14 };

  if (options.baseType === 'PINE_SCRIPT') {
    pineCode = options.customPineScript || options.templateCode || DEFAULT_PINE_SCRIPT;
  } else if (options.baseType === 'CUSTOM_RULES') {
    rulesConfig = options.customRules || JSON.parse(JSON.stringify(DEFAULT_CUSTOM_RULES));
  } else if (options.baseType === 'CUSTOM_SCRIPT') {
    scriptCode = options.customScript || options.templateCode || DEFAULT_CUSTOM_SCRIPT;
  } else {
    // If cloned from an existing preset like EMA_CROSS or RSI_REVERSION
    const preset = STRATEGY_PRESETS.find(p => p.id === options.baseType);
    if (preset) {
      params = { ...preset.params, ...params };
    }
  }

  const newStrategy: StrategyConfig = {
    id: newId,
    baseType: options.baseType,
    name: options.name.trim() || 'New Custom Strategy',
    description: options.description?.trim() || `User custom ${options.baseType} algorithmic strategy.`,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
    params,
    customPineScript: pineCode,
    customRules: rulesConfig,
    customScript: scriptCode,
  };

  saveCustomStrategy(newStrategy);
  return newStrategy;
}

/**
 * Duplicates / "Saves As" an existing strategy with a new editable label.
 */
export function duplicateCustomStrategy(source: StrategyConfig, newName?: string): StrategyConfig {
  const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const label = newName?.trim() || `${source.name} (Copy)`;

  const cloned: StrategyConfig = {
    ...source,
    id: newId,
    baseType: source.baseType || (
      source.customPineScript ? 'PINE_SCRIPT' :
      source.customRules ? 'CUSTOM_RULES' :
      source.customScript ? 'CUSTOM_SCRIPT' :
      (source.id as StrategyType)
    ),
    name: label,
    description: source.description || `Copy of ${source.name}`,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
    params: { ...source.params },
    customPineScript: source.customPineScript,
    customRules: source.customRules ? JSON.parse(JSON.stringify(source.customRules)) : undefined,
    customScript: source.customScript,
  };

  saveCustomStrategy(cloned);
  return cloned;
}

/**
 * Deletes a custom strategy by ID.
 */
export function deleteCustomStrategy(id: string): StrategyConfig[] {
  try {
    const current = getSavedCustomStrategies();
    const nextList = current.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (err) {
    console.warn('Failed to delete custom strategy:', err);
    return getSavedCustomStrategies();
  }
}

/**
 * Updates just the label (name) and optional description of a custom strategy.
 */
export function updateCustomStrategyLabel(id: string, newLabel: string, newDescription?: string): StrategyConfig[] {
  try {
    const current = getSavedCustomStrategies();
    const nextList = current.map(s => {
      if (s.id === id) {
        return {
          ...s,
          name: newLabel.trim() || s.name,
          description: newDescription !== undefined ? newDescription.trim() : s.description,
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (err) {
    console.warn('Failed to update strategy label:', err);
    return getSavedCustomStrategies();
  }
}

export const renameCustomStrategy = updateCustomStrategyLabel;
