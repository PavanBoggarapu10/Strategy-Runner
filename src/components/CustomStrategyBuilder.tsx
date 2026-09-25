import React, { useState } from 'react';
import {
  Code2,
  Cpu,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  TrendingUp,
  Percent,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Scale,
  Zap,
  X,
  Maximize2,
  FileCode,
  Copy,
  Check,
  Download,
  RefreshCw,
  Edit2,
  Save,
  BookmarkPlus,
} from 'lucide-react';
import {
  BacktestResult,
  BacktestSettings,
  Candle,
  CustomRule,
  CustomRulesConfig,
  QuotePair,
  RuleOperand,
  RuleOperator,
  StrategyConfig,
  Timeframe,
} from '../types/trading';
import {
  DEFAULT_CUSTOM_RULES,
  DEFAULT_CUSTOM_SCRIPT,
  runBacktest,
} from '../utils/strategyEngine';
import {
  DEFAULT_PINE_SCRIPT,
  PINE_TEMPLATES,
  convertJsToPineScript,
  convertRulesToPineScript,
} from '../utils/pineScriptGenerator';
import { saveCustomStrategy } from '../utils/customStrategyStorage';
import { GeminiStrategyAnalyzer } from './GeminiStrategyAnalyzer';
import { SaveAsStrategyModal } from './SaveAsStrategyModal';
import { CreateStrategyModal } from './CreateStrategyModal';

interface CustomStrategyBuilderProps {
  candles: Candle[];
  coin: string;
  pair: QuotePair;
  timeframe: Timeframe;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  settings: BacktestSettings;
  activeStrategy: StrategyConfig;
  onApplyStrategy: (strategy: StrategyConfig) => void;
  currentResult: BacktestResult | null;
  isModal?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
  onCreateCustomStrategy?: (strategy: StrategyConfig) => void;
  onSaveAsCustomStrategy?: (strategy: StrategyConfig) => void;
  customStrategies?: StrategyConfig[];
  onSelectStrategy?: (strategy: StrategyConfig) => void;
}

const OPERAND_LABELS: { value: RuleOperand; label: string; group: string }[] = [
  { value: 'close', label: 'Close Price', group: 'Price Action' },
  { value: 'open', label: 'Open Price', group: 'Price Action' },
  { value: 'high', label: 'High Price', group: 'Price Action' },
  { value: 'low', label: 'Low Price', group: 'Price Action' },
  { value: 'volume', label: 'Volume', group: 'Price Action' },
  { value: 'rsi', label: 'RSI (14)', group: 'Momentum' },
  { value: 'emaFast', label: 'Fast EMA (9)', group: 'Trend' },
  { value: 'emaSlow', label: 'Slow EMA (21)', group: 'Trend' },
  { value: 'macd', label: 'MACD Line', group: 'MACD' },
  { value: 'macdSignal', label: 'MACD Signal Line', group: 'MACD' },
  { value: 'bbLower', label: 'Bollinger Lower Band', group: 'Volatility' },
  { value: 'bbUpper', label: 'Bollinger Upper Band', group: 'Volatility' },
];

const OPERATOR_LABELS: { value: RuleOperator; label: string }[] = [
  { value: 'GREATER_THAN', label: '> (Greater Than)' },
  { value: 'LESS_THAN', label: '< (Less Than)' },
  { value: 'CROSS_ABOVE', label: 'Crosses Above ↗' },
  { value: 'CROSS_BELOW', label: 'Crosses Below ↘' },
];

const SCRIPT_TEMPLATES = [
  {
    name: 'RSI Oversold Dip-Buyer + EMA Trend',
    script: `// 1. Enter Long when RSI is oversold and price is above the Fast EMA
if (indicators.rsi < 35 && candle.close > indicators.emaFast) {
  return 'BUY';
}

// 2. Take profit when RSI enters overbought or price drops below Slow EMA
if (indicators.rsi > 68 || candle.close < indicators.emaSlow) {
  return 'SELL';
}

return 'HOLD';`,
  },
  {
    name: 'Bollinger Mean Reversion & Volatility Breakout',
    script: `// Enter Long when price drops below the Lower Bollinger Band
if (candle.close < indicators.bollinger.lower && indicators.rsi < 40) {
  return 'BUY';
}

// Exit when price reaches Upper Bollinger Band or middle revert
if (candle.close > indicators.bollinger.upper) {
  return 'SELL';
}

return 'HOLD';`,
  },
  {
    name: 'MACD Momentum & Zero-Cross Divergence',
    script: `// Buy on bullish MACD crossover with positive histogram
if (indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0) {
  return 'BUY';
}

// Exit or short on bearish MACD cross
if (indicators.macd.macd < indicators.macd.signal) {
  return 'SELL';
}

return 'HOLD';`,
  },
  {
    name: 'Supertrend Trend Follower + Volume Filter',
    script: `// Buy when Supertrend is green and price is expanding
if (indicators.supertrend.trend === 1 && candle.close > candle.open) {
  return 'BUY';
}

// Exit when Supertrend turns red
if (indicators.supertrend.trend === -1) {
  return 'SELL';
}

return 'HOLD';`,
  },
];

export const CustomStrategyBuilder: React.FC<CustomStrategyBuilderProps> = ({
  candles,
  coin,
  pair,
  timeframe,
  onTimeframeChange,
  settings,
  activeStrategy,
  onApplyStrategy,
  currentResult,
  isModal,
  onClose,
  onExpand,
  onCreateCustomStrategy,
  onSaveAsCustomStrategy,
  customStrategies,
  onSelectStrategy,
}) => {
  // Strategy Label & Custom Strategy Management
  const [strategyLabel, setStrategyLabel] = useState<string>(activeStrategy.name || 'My Custom Strategy');
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Mode: Pine Script v5 vs Visual Rules vs JavaScript Code Sandbox
  const [editorMode, setEditorMode] = useState<'PINE' | 'RULES' | 'SCRIPT'>(
    activeStrategy.baseType === 'CUSTOM_RULES' || activeStrategy.id === 'CUSTOM_RULES'
      ? 'RULES'
      : activeStrategy.baseType === 'CUSTOM_SCRIPT' || activeStrategy.id === 'CUSTOM_SCRIPT'
      ? 'SCRIPT'
      : 'PINE'
  );

  // Pine Script State
  const [customPineScript, setCustomPineScript] = useState<string>(
    activeStrategy.customPineScript ||
      (activeStrategy.customScript
        ? convertJsToPineScript(activeStrategy.customScript, activeStrategy.name, settings)
        : DEFAULT_PINE_SCRIPT)
  );
  const [pineCopied, setPineCopied] = useState<boolean>(false);

  // Visual Rules State
  const [customRules, setCustomRules] = useState<CustomRulesConfig>(
    activeStrategy.customRules || DEFAULT_CUSTOM_RULES
  );

  // Script State
  const [customScript, setCustomScript] = useState<string>(
    activeStrategy.customScript || DEFAULT_CUSTOM_SCRIPT
  );

  // Snapshot structure for resetting to previous saved data
  interface SavedSnapshot {
    pineScript: string;
    rules: CustomRulesConfig;
    script: string;
    label: string;
    mode: 'PINE' | 'RULES' | 'SCRIPT';
    config: StrategyConfig;
  }

  // Track the last saved data and pre-AI-fix state
  const [lastSavedState, setLastSavedState] = useState<SavedSnapshot>(() => ({
    pineScript:
      activeStrategy.customPineScript ||
      (activeStrategy.customScript
        ? convertJsToPineScript(activeStrategy.customScript, activeStrategy.name, settings)
        : DEFAULT_PINE_SCRIPT),
    rules: activeStrategy.customRules || DEFAULT_CUSTOM_RULES,
    script: activeStrategy.customScript || DEFAULT_CUSTOM_SCRIPT,
    label: activeStrategy.name || 'My Custom Strategy',
    mode:
      activeStrategy.baseType === 'CUSTOM_RULES' || activeStrategy.id === 'CUSTOM_RULES'
        ? 'RULES'
        : activeStrategy.baseType === 'CUSTOM_SCRIPT' || activeStrategy.id === 'CUSTOM_SCRIPT'
        ? 'SCRIPT'
        : 'PINE',
    config: activeStrategy,
  }));

  const [preAiFixState, setPreAiFixState] = useState<SavedSnapshot | null>(null);

  // Sync snapshot and editor states when activeStrategy changes from parent
  React.useEffect(() => {
    const resolvedPine =
      activeStrategy.customPineScript ||
      (activeStrategy.customScript
        ? convertJsToPineScript(activeStrategy.customScript, activeStrategy.name, settings)
        : DEFAULT_PINE_SCRIPT);
    const resolvedRules = activeStrategy.customRules || DEFAULT_CUSTOM_RULES;
    const resolvedScript = activeStrategy.customScript || DEFAULT_CUSTOM_SCRIPT;
    const resolvedLabel = activeStrategy.name || 'My Custom Strategy';
    const resolvedMode: 'PINE' | 'RULES' | 'SCRIPT' =
      activeStrategy.baseType === 'CUSTOM_RULES' || activeStrategy.id === 'CUSTOM_RULES'
        ? 'RULES'
        : activeStrategy.baseType === 'CUSTOM_SCRIPT' || activeStrategy.id === 'CUSTOM_SCRIPT'
        ? 'SCRIPT'
        : 'PINE';

    setCustomPineScript(resolvedPine);
    setCustomRules(resolvedRules);
    setCustomScript(resolvedScript);
    setStrategyLabel(resolvedLabel);
    setEditorMode(resolvedMode);

    const snap: SavedSnapshot = {
      pineScript: resolvedPine,
      rules: resolvedRules,
      script: resolvedScript,
      label: resolvedLabel,
      mode: resolvedMode,
      config: activeStrategy,
    };
    setLastSavedState(snap);
    setPreAiFixState(null);
  }, [activeStrategy.id, activeStrategy.updatedAt, activeStrategy.name]);

  // Local test result
  const [testResult, setTestResult] = useState<BacktestResult | null>(currentResult);
  const [testError, setTestError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Benchmark for efficiency comparison (Dual EMA)
  const [benchmarkResult, setBenchmarkResult] = useState<BacktestResult | null>(null);

  // Convert JS to Pine Script
  const handleConvertJsToPine = () => {
    const converted = convertJsToPineScript(customScript, 'Converted JS Strategy', settings);
    setCustomPineScript(converted);
    setEditorMode('PINE');
  };

  // Convert Rules to Pine Script
  const handleConvertRulesToPine = () => {
    const converted = convertRulesToPineScript(customRules, 'Converted Visual Rules Strategy', settings);
    setCustomPineScript(converted);
    setEditorMode('PINE');
  };

  // Copy Pine Script to clipboard
  const handleCopyPine = () => {
    navigator.clipboard.writeText(customPineScript);
    setPineCopied(true);
    setTimeout(() => setPineCopied(false), 2200);
  };

  // Download .pine file
  const handleDownloadPine = () => {
    const filename = `${coin.toLowerCase()}_${pair.toLowerCase()}_strategy_v5.pine`;
    const blob = new Blob([customPineScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to construct current strategy config
  const getCurrentConfig = (): StrategyConfig => {
    const isCustom = Boolean(activeStrategy.isCustom);
    return {
      ...activeStrategy,
      id: isCustom ? activeStrategy.id : (
        editorMode === 'PINE' ? 'PINE_SCRIPT' : editorMode === 'RULES' ? 'CUSTOM_RULES' : 'CUSTOM_SCRIPT'
      ),
      baseType: activeStrategy.baseType || (
        editorMode === 'PINE' ? 'PINE_SCRIPT' : editorMode === 'RULES' ? 'CUSTOM_RULES' : 'CUSTOM_SCRIPT'
      ),
      isCustom,
      name: strategyLabel || activeStrategy.name || 'Custom Strategy',
      description: activeStrategy.description || (
        editorMode === 'PINE'
          ? 'TradingView Pine Script v5 algorithmic strategy.'
          : editorMode === 'RULES'
          ? 'User-defined algorithmic rules based on multi-indicator conditions.'
          : 'Custom JavaScript algorithmic trading strategy.'
      ),
      params: {
        ...activeStrategy.params,
        fastPeriod: activeStrategy.params?.fastPeriod || 9,
        slowPeriod: activeStrategy.params?.slowPeriod || 21,
        rsiPeriod: activeStrategy.params?.rsiPeriod || 14,
      },
      customPineScript: editorMode === 'PINE' ? customPineScript : undefined,
      customRules: editorMode === 'RULES' ? customRules : undefined,
      customScript: editorMode === 'SCRIPT' ? customScript : undefined,
    };
  };

  // Run initial test
  const executeCustomTest = () => {
    if (!candles || candles.length < 2) {
      setTestError('Not enough candle data loaded to execute strategy test.');
      return;
    }

    setIsExecuting(true);
    setTestError(null);

    try {
      const testStratConfig = getCurrentConfig();

      // Run user strategy test
      const res = runBacktest(candles, testStratConfig, settings, coin, pair, timeframe);
      setTestResult(res);

      // Run benchmark (Dual EMA) for side-by-side comparison
      const bStrat: StrategyConfig = {
        id: 'EMA_CROSS',
        name: 'Benchmark (EMA 9/21)',
        description: 'Standard benchmark',
        params: { fastPeriod: 9, slowPeriod: 21 },
      };
      const bRes = runBacktest(candles, bStrat, settings, coin, pair, timeframe);
      setBenchmarkResult(bRes);

      // Notify parent
      onApplyStrategy(testStratConfig);
    } catch (err: any) {
      console.error(err);
      setTestError(err.message || 'Error executing custom strategy test.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApplyGeminiImprovedStrategy = (improved: {
    pineScript?: string;
    rules?: CustomRulesConfig;
    script?: string;
    explanation?: string;
  }) => {
    // 1. Snapshot the current pre-fix state so the Reset button can restore back to it!
    const preFixSnapshot: SavedSnapshot = {
      pineScript: customPineScript,
      rules: customRules,
      script: customScript,
      label: strategyLabel,
      mode: editorMode,
      config: getCurrentConfig(),
    };
    setPreAiFixState(preFixSnapshot);

    // 2. Resolve Pine Script code
    let resolvedPine = improved.pineScript?.trim();
    if (!resolvedPine || (!resolvedPine.includes('strategy(') && !resolvedPine.includes('//@version'))) {
      if (improved.rules) {
        resolvedPine = convertRulesToPineScript(improved.rules, `${strategyLabel} (AI Optimized)`, settings);
      } else if (improved.script) {
        resolvedPine = convertJsToPineScript(improved.script, `${strategyLabel} (AI Optimized)`, settings);
      } else {
        resolvedPine = customPineScript;
      }
    }

    // 3. Update all editor states and switch editor to PINE mode so the user sees the Pine Script window immediately
    setCustomPineScript(resolvedPine);
    if (improved.rules) setCustomRules(improved.rules);
    if (improved.script) setCustomScript(improved.script);
    setEditorMode('PINE');

    const newLabel = strategyLabel.toLowerCase().includes('ai')
      ? strategyLabel
      : `${strategyLabel} (AI Optimized)`;
    setStrategyLabel(newLabel);

    // 4. Auto-save strategy to storage
    const updatedStratConfig: StrategyConfig = {
      ...activeStrategy,
      id: activeStrategy.isCustom ? activeStrategy.id : `custom_pine_${Date.now()}`,
      baseType: 'PINE_SCRIPT',
      name: newLabel,
      description: improved.explanation || 'Gemini AI optimized TradingView Pine Script v5 strategy.',
      params: {
        ...activeStrategy.params,
        fastPeriod: activeStrategy.params?.fastPeriod || 9,
        slowPeriod: activeStrategy.params?.slowPeriod || 21,
        rsiPeriod: activeStrategy.params?.rsiPeriod || 14,
      },
      customPineScript: resolvedPine,
      customRules: improved.rules || customRules,
      customScript: improved.script || customScript,
      isCustom: true,
      updatedAt: Date.now(),
    };

    // Auto-save into localStorage
    saveCustomStrategy(updatedStratConfig);
    if (onCreateCustomStrategy) {
      onCreateCustomStrategy(updatedStratConfig);
    }
    onApplyStrategy(updatedStratConfig);

    // 5. Re-run backtest immediately so chart, signals, and scorecard update
    if (candles.length > 20) {
      try {
        const res = runBacktest(candles, updatedStratConfig, settings, coin, pair, timeframe);
        setTestResult(res);
      } catch (e) {
        console.error('Backtest error after AI fix:', e);
      }
    }

    // 6. Show notification and scroll into Pine Script window
    setSaveNotice('AI Fix applied & auto-saved to Pine Script window!');
    setTimeout(() => setSaveNotice(null), 5000);

    setTimeout(() => {
      const textarea = document.getElementById('textarea-custom-pine-script');
      if (textarea) {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // Reset to previous saved data handler
  const handleResetToPreviousSaved = () => {
    const targetState = preAiFixState || lastSavedState;
    if (!targetState) return;

    // Restore editor states
    setCustomPineScript(targetState.pineScript);
    setCustomRules(targetState.rules);
    setCustomScript(targetState.script);
    setStrategyLabel(targetState.label);
    setEditorMode(targetState.mode || 'PINE');

    // Restore strategy config and auto-save
    const restoredConfig: StrategyConfig = {
      ...targetState.config,
      name: targetState.label,
      customPineScript: targetState.pineScript,
      customRules: targetState.rules,
      customScript: targetState.script,
      updatedAt: Date.now(),
    };

    saveCustomStrategy(restoredConfig);
    if (onCreateCustomStrategy) {
      onCreateCustomStrategy(restoredConfig);
    }
    onApplyStrategy(restoredConfig);

    // Re-run backtest
    if (candles.length > 20) {
      try {
        const res = runBacktest(candles, restoredConfig, settings, coin, pair, timeframe);
        setTestResult(res);
      } catch (e) {
        console.error('Backtest error after reset:', e);
      }
    }

    // Clear pre-fix state once restored
    setPreAiFixState(null);

    setSaveNotice('Reset to previous saved strategy data');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  // Rule Helpers
  const handleAddBuyRule = () => {
    const newRule: CustomRule = {
      id: `rule-buy-${Date.now()}`,
      left: 'close',
      operator: 'GREATER_THAN',
      rightType: 'INDICATOR',
      rightIndicator: 'emaFast',
    };
    setCustomRules({
      ...customRules,
      buyRules: [...customRules.buyRules, newRule],
    });
  };

  const handleRemoveBuyRule = (id: string) => {
    setCustomRules({
      ...customRules,
      buyRules: customRules.buyRules.filter(r => r.id !== id),
    });
  };

  const handleUpdateBuyRule = (id: string, updates: Partial<CustomRule>) => {
    setCustomRules({
      ...customRules,
      buyRules: customRules.buyRules.map(r => (r.id === id ? { ...r, ...updates } : r)),
    });
  };

  const handleAddSellRule = () => {
    const newRule: CustomRule = {
      id: `rule-sell-${Date.now()}`,
      left: 'rsi',
      operator: 'GREATER_THAN',
      rightType: 'CONSTANT',
      rightConstant: 70,
    };
    setCustomRules({
      ...customRules,
      sellRules: [...customRules.sellRules, newRule],
    });
  };

  const handleRemoveSellRule = (id: string) => {
    setCustomRules({
      ...customRules,
      sellRules: customRules.sellRules.filter(r => r.id !== id),
    });
  };

  const handleUpdateSellRule = (id: string, updates: Partial<CustomRule>) => {
    setCustomRules({
      ...customRules,
      sellRules: customRules.sellRules.map(r => (r.id === id ? { ...r, ...updates } : r)),
    });
  };

  const res = testResult || currentResult;

  // Grade color helper
  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30';
      case 'B':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 ring-1 ring-cyan-500/30';
      case 'C':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 ring-1 ring-amber-500/30';
      case 'D':
      case 'F':
      default:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 ring-1 ring-rose-500/30';
    }
  };

  const builderContent = (
    <div id="custom-strategy-builder-section" className="space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  TradingView Pine Script (v5) & Algorithmic Strategy Studio
                </h2>
                <p className="text-xs text-slate-400">
                  Build and test native TradingView Pine Script v5 strategies, visual Boolean rule sets, or JavaScript sandbox algorithms.
                </p>

                {/* Active Strategy Editable Label Bar */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Strategy:</span>
                  {isEditingLabel ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        id="input-builder-strategy-label"
                        type="text"
                        value={strategyLabel}
                        onChange={(e) => setStrategyLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setIsEditingLabel(false);
                        }}
                        autoFocus
                        className="px-2 py-0.5 bg-slate-950 border border-purple-500 rounded text-xs font-bold text-white font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setIsEditingLabel(false)}
                        className="p-1 rounded bg-purple-600 hover:bg-purple-500 text-white"
                        title="Save Label"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-cyan-300 font-mono bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                        {strategyLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingLabel(true)}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        title="Edit Strategy Label"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-950/70 text-purple-300 border border-purple-500/30">
                        {activeStrategy.isCustom ? 'My Strategy' : 'Preset'}
                      </span>
                    </div>
                  )}

                  {/* Interactive Timeframe Selector in Strategy Studio */}
                  {onTimeframeChange && (
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded-xl border border-slate-800 ml-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span className="text-[11px] text-slate-400 font-medium">Interval:</span>
                      <div className="flex items-center gap-0.5">
                        {(['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const).map((tf) => (
                          <button
                            key={tf}
                            id={`builder-tf-btn-${tf}`}
                            type="button"
                            onClick={() => onTimeframeChange(tf)}
                            className={`px-1.5 py-0.2 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              timeframe === tf
                                ? 'bg-amber-400 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title={`Test strategy on ${tf}`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {saveNotice && (
                    <span className="text-[11px] text-emerald-400 font-medium ml-2 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {saveNotice}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                id="btn-mode-pine"
                type="button"
                onClick={() => setEditorMode('PINE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editorMode === 'PINE'
                    ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-200" />
                <span>Pine Script (v5)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  TV
                </span>
              </button>
              <button
                id="btn-mode-rules"
                type="button"
                onClick={() => setEditorMode('RULES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editorMode === 'RULES'
                    ? 'bg-purple-600 text-white shadow shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Rule Builder</span>
              </button>
              <button
                id="btn-mode-script"
                type="button"
                onClick={() => setEditorMode('SCRIPT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editorMode === 'SCRIPT'
                    ? 'bg-purple-600 text-white shadow shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JS Sandbox</span>
              </button>
            </div>

            {/* Modal Close / Expand Controls */}
            {onExpand && !isModal && (
              <button
                id="btn-expand-builder"
                type="button"
                onClick={onExpand}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Open in Fullscreen Studio Modal"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            {isModal && onClose && (
              <button
                id="btn-close-builder-modal"
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                title="Close Studio"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {testError && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{testError}</span>
          </div>
        )}
      </div>

      {/* Editor Body */}
      {editorMode === 'PINE' ? (
        /* TRADINGVIEW PINE SCRIPT (v5) STUDIO */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">TradingView Pine Script (v5) Studio</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  @version=5
                </span>
              </div>
            </div>

            {/* Pine Actions & Template loader */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Load Template:</span>
              <select
                id="select-pine-template"
                onChange={(e) => {
                  const t = PINE_TEMPLATES.find((x) => x.name === e.target.value);
                  if (t) setCustomPineScript(t.script);
                }}
                className="bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select Pine algorithm...</option>
                {PINE_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.name} value={tmpl.name}>
                    {tmpl.name}
                  </option>
                ))}
              </select>

              <button
                id="btn-copy-pine-inline"
                type="button"
                onClick={handleCopyPine}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Copy Pine Script to Clipboard"
              >
                {pineCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{pineCopied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                id="btn-download-pine-inline"
                type="button"
                onClick={handleDownloadPine}
                className="px-2.5 py-1 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                title="Download as .pine file for TradingView"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.pine</span>
              </button>
            </div>
          </div>

          {/* Code Textarea with TradingView dark syntax theme */}
          <div className="relative font-mono text-xs">
            <textarea
              id="textarea-custom-pine-script"
              value={customPineScript}
              onChange={(e) => setCustomPineScript(e.target.value)}
              rows={15}
              spellCheck={false}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-cyan-300 font-mono leading-relaxed focus:border-cyan-500 focus:outline-none resize-y selection:bg-cyan-900 selection:text-white"
            />
          </div>

          {/* Pine Script Documentation & Compatibility Helper */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-slate-400 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulated Pine Functions & Native TradingView Compatibility:</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-sans">
                ✓ Copy code straight into TradingView &gt; Pine Editor
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1">
              <div><span className="text-cyan-400">Indicators</span>: ta.ema(), ta.rsi(), ta.atr(), ta.rma(), ta.bb(), ta.macd()</div>
              <div><span className="text-cyan-400">Momentum</span>: ta.crossover(), ta.crossunder(), ta.change()</div>
              <div><span className="text-cyan-400">Directional</span>: ADX / DMI, plusDI, minusDI, trendFilter</div>
              <div><span className="text-cyan-400">Orders & Exits</span>: strategy.entry(), strategy.close(), strategy.exit()</div>
            </div>
          </div>
        </div>
      ) : editorMode === 'RULES' ? (
        /* VISUAL RULE BUILDER */
        <div className="space-y-4">
          {/* Quick Convert to Pine Script Banner */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/40 border border-cyan-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>
                Want to convert these visual condition rules into <strong>TradingView Pine Script (v5)</strong>?
              </span>
            </div>
            <button
              id="btn-convert-rules-to-pine"
              type="button"
              onClick={handleConvertRulesToPine}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Convert to Pine Script (v5)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* BUY / ENTRY CONDITIONS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                  Buy / Long Entry Triggers
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Match Logic:</span>
                <select
                  id="select-buy-logic"
                  value={customRules.buyLogic}
                  onChange={(e) => setCustomRules({ ...customRules, buyLogic: e.target.value as 'AND' | 'OR' })}
                  className="bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs rounded px-2 py-1 focus:outline-none"
                >
                  <option value="AND">ALL Rules (AND)</option>
                  <option value="OR">ANY Rule (OR)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {customRules.buyRules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2 relative group"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Condition #{index + 1}</span>
                    <button
                      id={`btn-remove-buy-rule-${index}`}
                      onClick={() => handleRemoveBuyRule(rule.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                    {/* Left Operand */}
                    <div className="sm:col-span-4">
                      <select
                        id={`select-buy-left-${index}`}
                        value={rule.left}
                        onChange={(e) => handleUpdateBuyRule(rule.id, { left: e.target.value as RuleOperand })}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 font-mono focus:border-purple-500 focus:outline-none"
                      >
                        {OPERAND_LABELS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operator */}
                    <div className="sm:col-span-4">
                      <select
                        id={`select-buy-op-${index}`}
                        value={rule.operator}
                        onChange={(e) => handleUpdateBuyRule(rule.id, { operator: e.target.value as RuleOperator })}
                        className="w-full bg-slate-900 border border-slate-800 text-purple-300 rounded-lg p-2 font-mono focus:border-purple-500 focus:outline-none text-center"
                      >
                        {OPERATOR_LABELS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Right Operand Type Toggle & Input */}
                    <div className="sm:col-span-4 flex items-center gap-1.5">
                      {rule.rightType === 'CONSTANT' ? (
                        <input
                          id={`input-buy-const-${index}`}
                          type="number"
                          value={rule.rightConstant ?? 0}
                          onChange={(e) => handleUpdateBuyRule(rule.id, { rightConstant: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 text-amber-400 font-mono rounded-lg p-2 focus:border-purple-500 focus:outline-none"
                        />
                      ) : (
                        <select
                          id={`select-buy-right-ind-${index}`}
                          value={rule.rightIndicator || 'close'}
                          onChange={(e) => handleUpdateBuyRule(rule.id, { rightIndicator: e.target.value as RuleOperand })}
                          className="w-full bg-slate-900 border border-slate-800 text-cyan-300 font-mono rounded-lg p-2 focus:border-purple-500 focus:outline-none"
                        >
                          {OPERAND_LABELS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        id={`btn-toggle-buy-type-${index}`}
                        onClick={() =>
                          handleUpdateBuyRule(rule.id, {
                            rightType: rule.rightType === 'CONSTANT' ? 'INDICATOR' : 'CONSTANT',
                            rightConstant: rule.rightConstant ?? 30,
                            rightIndicator: rule.rightIndicator || 'emaFast',
                          })
                        }
                        className="px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white"
                        title="Toggle between Constant Number and Indicator"
                      >
                        {rule.rightType === 'CONSTANT' ? '#' : 'Fx'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                id="btn-add-buy-condition"
                onClick={handleAddBuyRule}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-800 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors bg-slate-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Add Buy Entry Condition</span>
              </button>
            </div>
          </div>

          {/* SELL / EXIT CONDITIONS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
                <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wide">
                  Sell / Exit Triggers
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Match Logic:</span>
                <select
                  id="select-sell-logic"
                  value={customRules.sellLogic}
                  onChange={(e) => setCustomRules({ ...customRules, sellLogic: e.target.value as 'AND' | 'OR' })}
                  className="bg-slate-950 border border-slate-800 text-rose-300 font-mono text-xs rounded px-2 py-1 focus:outline-none"
                >
                  <option value="OR">ANY Rule (OR)</option>
                  <option value="AND">ALL Rules (AND)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {customRules.sellRules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2 relative group"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Condition #{index + 1}</span>
                    <button
                      id={`btn-remove-sell-rule-${index}`}
                      onClick={() => handleRemoveSellRule(rule.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                    {/* Left Operand */}
                    <div className="sm:col-span-4">
                      <select
                        id={`select-sell-left-${index}`}
                        value={rule.left}
                        onChange={(e) => handleUpdateSellRule(rule.id, { left: e.target.value as RuleOperand })}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 font-mono focus:border-purple-500 focus:outline-none"
                      >
                        {OPERAND_LABELS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operator */}
                    <div className="sm:col-span-4">
                      <select
                        id={`select-sell-op-${index}`}
                        value={rule.operator}
                        onChange={(e) => handleUpdateSellRule(rule.id, { operator: e.target.value as RuleOperator })}
                        className="w-full bg-slate-900 border border-slate-800 text-purple-300 rounded-lg p-2 font-mono focus:border-purple-500 focus:outline-none text-center"
                      >
                        {OPERATOR_LABELS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Right Operand Type Toggle & Input */}
                    <div className="sm:col-span-4 flex items-center gap-1.5">
                      {rule.rightType === 'CONSTANT' ? (
                        <input
                          id={`input-sell-const-${index}`}
                          type="number"
                          value={rule.rightConstant ?? 0}
                          onChange={(e) => handleUpdateSellRule(rule.id, { rightConstant: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 text-amber-400 font-mono rounded-lg p-2 focus:border-purple-500 focus:outline-none"
                        />
                      ) : (
                        <select
                          id={`select-sell-right-ind-${index}`}
                          value={rule.rightIndicator || 'close'}
                          onChange={(e) => handleUpdateSellRule(rule.id, { rightIndicator: e.target.value as RuleOperand })}
                          className="w-full bg-slate-900 border border-slate-800 text-cyan-300 font-mono rounded-lg p-2 focus:border-purple-500 focus:outline-none"
                        >
                          {OPERAND_LABELS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        id={`btn-toggle-sell-type-${index}`}
                        onClick={() =>
                          handleUpdateSellRule(rule.id, {
                            rightType: rule.rightType === 'CONSTANT' ? 'INDICATOR' : 'CONSTANT',
                            rightConstant: rule.rightConstant ?? 70,
                            rightIndicator: rule.rightIndicator || 'emaSlow',
                          })
                        }
                        className="px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white"
                        title="Toggle between Constant Number and Indicator"
                      >
                        {rule.rightType === 'CONSTANT' ? '#' : 'Fx'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                id="btn-add-sell-condition"
                onClick={handleAddSellRule}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors bg-slate-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Add Sell / Exit Condition</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : (
        /* CODE SANDBOX */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          {/* Quick Convert JS to Pine Script Banner */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-amber-950/40 border border-cyan-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>
                Want to convert this JavaScript code into <strong>TradingView Pine Script (v5)</strong>?
              </span>
            </div>
            <button
              id="btn-convert-js-to-pine"
              type="button"
              onClick={handleConvertJsToPine}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Convert to Pine Script (v5)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white">JavaScript Strategy Execution Sandbox</span>
            </div>

            {/* Template loader */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Load Template:</span>
              <select
                id="select-script-template"
                onChange={(e) => {
                  const t = SCRIPT_TEMPLATES.find((x) => x.name === e.target.value);
                  if (t) setCustomScript(t.script);
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="">Select strategy algorithm...</option>
                {SCRIPT_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.name} value={tmpl.name}>
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Code Textarea with high contrast syntax theme */}
          <div className="relative font-mono text-xs">
            <textarea
              id="textarea-custom-script"
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-emerald-300 font-mono leading-relaxed focus:border-purple-500 focus:outline-none resize-y selection:bg-purple-900 selection:text-white"
            />
          </div>

          {/* Available variables documentation helper */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Available Runtime Arguments:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1">
              <div><span className="text-amber-400">candle</span>: open, high, low, close, volume</div>
              <div><span className="text-amber-400">indicators</span>: rsi, emaFast, emaSlow</div>
              <div><span className="text-amber-400">indicators</span>: macd.macd, macd.signal, bollinger.lower</div>
              <div><span className="text-amber-400">position</span>: null | &#123; type, entryPrice, unrealizedPnlPercent &#125;</div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION BAR: Test & Run Efficiency Audit */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            Target: <strong className="text-white">{coin}/{pair}</strong> • Timeframe: <strong className="text-cyan-400">{timeframe}</strong> ({candles.length} bars)
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-save-as-new-builder"
            type="button"
            onClick={() => setIsSaveAsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            title="Save current strategy logic to a new strategy with editable label"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save As New Strategy...</span>
          </button>

          {activeStrategy.isCustom && (
            <button
              id="btn-save-changes-builder"
              type="button"
              onClick={() => {
                const updated = getCurrentConfig();
                saveCustomStrategy(updated);
                if (onCreateCustomStrategy) {
                  onCreateCustomStrategy(updated);
                }
                onApplyStrategy(updated);
                setLastSavedState({
                  pineScript: customPineScript,
                  rules: customRules,
                  script: customScript,
                  label: strategyLabel,
                  mode: editorMode,
                  config: updated,
                });
                setSaveNotice(`Saved changes to "${updated.name}"`);
                setTimeout(() => setSaveNotice(null), 3000);
              }}
              className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-850 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Save changes to active custom strategy"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save Changes</span>
            </button>
          )}

          <button
            id="btn-create-new-strat-builder"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-2 rounded-xl border border-cyan-500/30 bg-slate-950 hover:bg-slate-800 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Strategy</span>
          </button>

          <button
            id="btn-reset-strategy"
            type="button"
            onClick={handleResetToPreviousSaved}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset changes back to previous saved strategy data"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset to Previous Saved</span>
          </button>

          <button
            id="btn-run-custom-test"
            onClick={executeCustomTest}
            disabled={isExecuting}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Play className={`w-4 h-4 fill-white ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'Simulating Strategy...' : 'Test Strategy & Compute Efficiency'}</span>
          </button>
        </div>
      </div>

      {/* STRATEGY EFFICIENCY AUDIT & PERFORMANCE DASHBOARD */}
      {res && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl">
          {/* Header & Overall Score */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${getGradeBadge(res.efficiencyGrade)}`}>
                  Efficiency Grade: {res.efficiencyGrade}
                </div>
                <h3 className="text-base font-bold text-white">
                  Quantitative Strategy Efficiency Assessment
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Mathematical evaluation of edge consistency, downside protection, capital exposure, and fee drag.
              </p>
            </div>

            {/* Scorecard Gauge */}
            <div className="flex items-center gap-4 bg-slate-950 border border-slate-800/90 rounded-xl px-4 py-2.5">
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Efficiency Score</div>
                <div className="text-2xl font-black font-mono text-purple-400">
                  {res.efficiencyScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                </div>
              </div>
              <div className="h-9 w-px bg-slate-800" />
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Market Exposure</div>
                <div className="text-lg font-bold font-mono text-cyan-400">
                  {res.marketExposurePercent}%
                </div>
              </div>
            </div>
          </div>

          {/* 4 Pillars of Strategy Efficiency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1: Profitability */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Profitability & Alpha
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {res.efficiencyBreakdown.profitability}/100
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${res.efficiencyBreakdown.profitability}%` }}
                />
              </div>
              <div className="pt-2 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Net Return:</span>
                  <span className={res.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {res.netProfitPercent >= 0 ? `+${res.netProfitPercent}%` : `${res.netProfitPercent}%`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Alpha vs B&H:</span>
                  <span className={res.alphaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {res.alphaPercent >= 0 ? `+${res.alphaPercent}%` : `${res.alphaPercent}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Risk Control */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Downside Risk Control
                </span>
                <span className="font-mono font-bold text-cyan-400">
                  {res.efficiencyBreakdown.riskControl}/100
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${res.efficiencyBreakdown.riskControl}%` }}
                />
              </div>
              <div className="pt-2 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Max Drawdown:</span>
                  <span className="text-amber-400">-{res.maxDrawdownPercent}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Profit/DD Ratio:</span>
                  <span className="text-white font-semibold">{res.profitToMaxDrawdownRatio}x</span>
                </div>
              </div>
            </div>

            {/* Pillar 3: Consistency */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-400" />
                  Signal Consistency
                </span>
                <span className="font-mono font-bold text-purple-400">
                  {res.efficiencyBreakdown.consistency}/100
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${res.efficiencyBreakdown.consistency}%` }}
                />
              </div>
              <div className="pt-2 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Win Rate:</span>
                  <span className="text-emerald-400 font-semibold">{res.winRate}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Profit Factor:</span>
                  <span className="text-purple-400 font-semibold">{res.profitFactor}</span>
                </div>
              </div>
            </div>

            {/* Pillar 4: Execution Quality */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Execution & Cost Drag
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {res.efficiencyBreakdown.executionQuality}/100
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${res.efficiencyBreakdown.executionQuality}%` }}
                />
              </div>
              <div className="pt-2 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Fee Drag:</span>
                  <span className="text-rose-400 font-semibold">{res.feeDragPercent}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Expectancy/Trade:</span>
                  <span className={res.expectancyPerTrade >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    ${res.expectancyPerTrade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benchmarking Comparison Matrix */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                Benchmark Efficiency Comparison Matrix
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Asset: {coin}/{pair}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Performance Metric</th>
                    <th className="p-3 text-purple-400 font-bold">Your Custom Strategy</th>
                    <th className="p-3 text-slate-300">Buy & Hold Benchmark</th>
                    <th className="p-3 text-cyan-300">Standard EMA Cross</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="p-3 text-slate-400">Net Return %</td>
                    <td className={`p-3 font-bold ${res.netProfitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {res.netProfitPercent >= 0 ? `+${res.netProfitPercent}%` : `${res.netProfitPercent}%`}
                    </td>
                    <td className="p-3 text-slate-300">
                      {res.buyAndHoldReturnPercent >= 0 ? `+${res.buyAndHoldReturnPercent}%` : `${res.buyAndHoldReturnPercent}%`}
                    </td>
                    <td className="p-3 text-cyan-300">
                      {benchmarkResult ? `${benchmarkResult.netProfitPercent}%` : '--'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Maximum Drawdown</td>
                    <td className="p-3 text-amber-400 font-semibold">-{res.maxDrawdownPercent}%</td>
                    <td className="p-3 text-rose-400">Benchmark Asset DD</td>
                    <td className="p-3 text-amber-300">
                      {benchmarkResult ? `-${benchmarkResult.maxDrawdownPercent}%` : '--'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Win Rate</td>
                    <td className="p-3 text-emerald-400 font-semibold">{res.winRate}% ({res.winningTrades}/{res.totalTrades})</td>
                    <td className="p-3 text-slate-500">N/A (Hold)</td>
                    <td className="p-3 text-slate-300">
                      {benchmarkResult ? `${benchmarkResult.winRate}%` : '--'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Sharpe Ratio</td>
                    <td className="p-3 text-purple-400 font-bold">{res.sharpeRatio}</td>
                    <td className="p-3 text-slate-400">~0.75</td>
                    <td className="p-3 text-slate-300">
                      {benchmarkResult ? `${benchmarkResult.sharpeRatio}` : '--'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-400">Market Exposure</td>
                    <td className="p-3 text-cyan-400 font-semibold">{res.marketExposurePercent}% (Risk Protected)</td>
                    <td className="p-3 text-rose-400">100% (Full Exposure)</td>
                    <td className="p-3 text-slate-300">
                      {benchmarkResult ? `${benchmarkResult.marketExposurePercent}%` : '--'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Efficiency Diagnostics Insights */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Automated Quantitative Strategy Diagnosis
            </h4>

            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              {res.netProfitPercent > res.buyAndHoldReturnPercent ? (
                <li className="text-emerald-300">
                  <strong>Alpha Outperformance</strong>: Strategy outperformed buy & hold by <strong>+{res.alphaPercent}%</strong> during this market period.
                </li>
              ) : (
                <li className="text-amber-300">
                  <strong>Underperforming Benchmark</strong>: Strategy lagged buy & hold by <strong>{res.alphaPercent}%</strong>. Consider tuning entry filters or tightening stops.
                </li>
              )}

              {res.maxDrawdownPercent < 15 ? (
                <li className="text-cyan-300">
                  <strong>Robust Capital Preservation</strong>: Max drawdown was capped at only <strong>{res.maxDrawdownPercent}%</strong>, offering strong defensive characteristics.
                </li>
              ) : (
                <li className="text-rose-300">
                  <strong>Elevated Drawdown Risk</strong>: Max drawdown reached <strong>{res.maxDrawdownPercent}%</strong>. Adding a tighter stop-loss or ATR filter is advised.
                </li>
              )}

              {res.feeDragPercent > 25 ? (
                <li className="text-amber-300">
                  <strong>High Fee Friction ({res.feeDragPercent}%)</strong>: Taker fees and slippage consumed a significant portion of profits. Consider longer timeframes or fewer scalp trades.
                </li>
              ) : (
                <li className="text-emerald-300">
                  <strong>Clean Fee Profile ({res.feeDragPercent}%)</strong>: Strategy exhibits minimal friction drag, ensuring edge retention after exchange costs.
                </li>
              )}

              <li className="text-slate-300">
                <strong>Expectancy Value</strong>: Generated <strong>${res.expectancyPerTrade}</strong> in expected mathematical payoff per trade over <strong>{res.totalTrades}</strong> executions.
              </li>
            </ul>
          </div>

          {/* Gemini AI Strategy Diagnostic & Efficiency Optimizer */}
          <GeminiStrategyAnalyzer
            editorMode={editorMode}
            customPineScript={customPineScript}
            customRules={customRules}
            customScript={customScript}
            coin={coin}
            pair={pair}
            timeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
            settings={settings}
            result={res}
            candles={candles}
            activeStrategy={activeStrategy}
            onApplyImprovedStrategy={handleApplyGeminiImprovedStrategy}
          />
        </div>
      )}

      {/* Modals for Save As and Create New Strategy */}
      {isSaveAsModalOpen && (
        <SaveAsStrategyModal
          isOpen={isSaveAsModalOpen}
          onClose={() => setIsSaveAsModalOpen(false)}
          sourceStrategy={getCurrentConfig()}
          onSaveAs={(newLabel, newDesc) => {
            const currentCfg = getCurrentConfig();
            const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const cloned: StrategyConfig = {
              ...currentCfg,
              id: newId,
              baseType: currentCfg.baseType || (
                editorMode === 'PINE' ? 'PINE_SCRIPT' : editorMode === 'RULES' ? 'CUSTOM_RULES' : 'CUSTOM_SCRIPT'
              ),
              name: newLabel,
              description: newDesc || `Saved custom strategy`,
              isCustom: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            if (onSaveAsCustomStrategy) {
              onSaveAsCustomStrategy(cloned);
            } else {
              onApplyStrategy(cloned);
            }
            setStrategyLabel(newLabel);
            setSaveNotice(`Saved as new strategy: "${newLabel}"`);
            setTimeout(() => setSaveNotice(null), 3000);
          }}
        />
      )}

      {isCreateModalOpen && (
        <CreateStrategyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(newStrat) => {
            if (onCreateCustomStrategy) {
              onCreateCustomStrategy(newStrat);
            }
            onApplyStrategy(newStrat);
            setStrategyLabel(newStrat.name);
            setSaveNotice(`Created new strategy: "${newStrat.name}"`);
            setTimeout(() => setSaveNotice(null), 3000);
          }}
        />
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-slate-950 border border-purple-500/30 ring-1 ring-purple-500/20 rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative">
          {builderContent}
        </div>
      </div>
    );
  }

  return builderContent;
};
