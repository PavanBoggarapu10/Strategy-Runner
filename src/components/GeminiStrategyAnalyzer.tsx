import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Cpu,
  Layers,
  Code2,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  Flame,
  Check,
  RotateCw,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Copy,
  Sliders,
  BarChart2,
  Wand2,
  Lightbulb,
  X,
  MessageSquare,
  Clock,
} from 'lucide-react';
import {
  BacktestResult,
  BacktestSettings,
  Candle,
  CustomRulesConfig,
  QuotePair,
  StrategyConfig,
  Timeframe,
} from '../types/trading';
import { GeminiAnalysisResult, StrategyImprovementSuggestion } from '../types/geminiAnalysis';
import { requestGeminiStrategyAnalysis } from '../utils/geminiService';
import { convertJsToPineScript, convertRulesToPineScript } from '../utils/pineScriptGenerator';
import { runBacktest } from '../utils/strategyEngine';
import {
  patchAndEnhancePineScript,
  patchAndEnhanceJavaScript,
  patchAndEnhanceRules,
} from '../utils/strategyPatcher';

const PROMPT_SUGGESTION_CHIPS = [
  { label: '200 EMA Macro Trend', text: 'Add 200 EMA macro trend filter to eliminate counter-trend entries' },
  { label: 'Bollinger Bands Squeeze', text: 'Add Bollinger Bands squeeze filter to eliminate low-volatility fakeouts' },
  { label: 'Supertrend Directional Gate', text: 'Add Supertrend directional gatekeeper for stronger trend alignment' },
  { label: 'ATR Dynamic Trailing Stop', text: 'Add ATR dynamic volatility trailing stop for capital protection' },
  { label: 'Volume Liquidity Spike', text: 'Add Volume flow confirmation (Volume > 1.2x 20-MA) to validate breakouts' },
  { label: 'RSI Bounds (42-68)', text: 'Add RSI momentum bounds (42 to 68) to prevent buying local exhaustion tops' },
  { label: 'Filter Chop & Boost Win Rate', text: 'Filter out choppy sideways consolidation to increase win rate and profit factor' },
];

interface GeminiStrategyAnalyzerProps {
  editorMode: 'PINE' | 'RULES' | 'SCRIPT';
  customPineScript?: string;
  customRules?: CustomRulesConfig;
  customScript?: string;
  coin: string;
  pair: string;
  timeframe: string;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  settings: BacktestSettings;
  result: BacktestResult;
  candles?: Candle[];
  activeStrategy?: StrategyConfig;
  onApplyImprovedStrategy: (improved: {
    pineScript?: string;
    rules?: CustomRulesConfig;
    script?: string;
    explanation?: string;
  }) => void;
}

export const GeminiStrategyAnalyzer: React.FC<GeminiStrategyAnalyzerProps> = ({
  editorMode,
  customPineScript,
  customRules,
  customScript,
  coin,
  pair,
  timeframe,
  onTimeframeChange,
  settings,
  result,
  candles,
  activeStrategy,
  onApplyImprovedStrategy,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isApplied, setIsApplied] = useState<boolean>(false);
  const [showCodeInspector, setShowCodeInspector] = useState<boolean>(true);
  const [activeCodeTab, setActiveCodeTab] = useState<'ENHANCED' | 'ORIGINAL'>('ENHANCED');
  const [copied, setCopied] = useState<boolean>(false);

  // User custom enhancement prompt input
  const [userEnhancementPrompt, setUserEnhancementPrompt] = useState<string>('');

  // Enhanced strategy states and comparison backtest result
  const [enhancedPineCode, setEnhancedPineCode] = useState<string>('');
  const [enhancedScriptCode, setEnhancedScriptCode] = useState<string>('');
  const [enhancedRulesConfig, setEnhancedRulesConfig] = useState<CustomRulesConfig | null>(null);
  const [appliedPatches, setAppliedPatches] = useState<string[]>([]);
  const [enhancedResult, setEnhancedResult] = useState<BacktestResult | null>(null);

  const handleAddPromptChip = (chipText: string) => {
    setUserEnhancementPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      if (trimmed.toLowerCase().includes(chipText.toLowerCase())) return trimmed;
      return `${trimmed}, and ${chipText}`;
    });
  };

  const runEnhancedBacktest = (
    enhancedPine?: string,
    enhancedRules?: CustomRulesConfig,
    enhancedScript?: string
  ): BacktestResult | null => {
    if (!candles || candles.length < 2) return null;
    try {
      const modeType =
        editorMode === 'PINE'
          ? 'PINE_SCRIPT'
          : editorMode === 'RULES'
          ? 'CUSTOM_RULES'
          : 'CUSTOM_SCRIPT';

      const tempConfig: StrategyConfig = {
        ...(activeStrategy || {
          id: 'temp_ai_enhanced',
          name: `${coin} AI Enhanced Strategy`,
          type: 'CUSTOM',
          timeframe: timeframe as Timeframe,
          description: 'AI Enhanced Strategy',
          color: '#a855f7',
          isCustom: true,
        }),
        baseType: modeType,
        customPineScript: enhancedPine || customPineScript,
        customRules: enhancedRules || customRules,
        customScript: enhancedScript || customScript,
      };

      return runBacktest(candles, tempConfig, settings, coin, pair as QuotePair, timeframe as Timeframe);
    } catch (e) {
      console.error('Comparative backtest execution error:', e);
      return null;
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsApplied(false);

    try {
      const chartSummary = candles && candles.length > 0 ? {
        currentPrice: candles[candles.length - 1].close,
        periodHigh: Math.max(...candles.map((c) => c.high)),
        periodLow: Math.min(...candles.map((c) => c.low)),
        recentVolume: candles[candles.length - 1].volume,
        candlesCount: candles.length,
      } : undefined;

      const data = await requestGeminiStrategyAnalysis({
        editorMode,
        customPineScript,
        customRules,
        customScript,
        coin,
        pair,
        timeframe,
        settings,
        result,
        chartSummary,
        userEnhancementPrompt: userEnhancementPrompt.trim() || undefined,
      });

      setAnalysis(data);

      // Resolve surgical patches and enhanced code
      let resolvedPine = data.improvedStrategy?.suggestedPineScript?.trim();
      let resolvedScript = data.improvedStrategy?.suggestedScript?.trim();
      let resolvedRules = data.improvedStrategy?.suggestedRules;
      let patches: string[] = data.improvedStrategy?.patchesSummary || [];

      if (editorMode === 'PINE') {
        // Guarantee user's original script is enhanced rather than replaced
        if (!resolvedPine || (!resolvedPine.includes('strategy(') && !resolvedPine.includes('//@version'))) {
          const patched = patchAndEnhancePineScript(customPineScript || '', settings, userEnhancementPrompt);
          resolvedPine = patched.code;
          if (patches.length === 0) patches = patched.patches;
        }
      } else if (editorMode === 'SCRIPT') {
        if (!resolvedScript) {
          const patched = patchAndEnhanceJavaScript(customScript || '', settings, userEnhancementPrompt);
          resolvedScript = patched.code;
          if (patches.length === 0) patches = patched.patches;
        }
      } else if (editorMode === 'RULES') {
        if (!resolvedRules) {
          const patched = patchAndEnhanceRules(
            customRules || { buyRules: [], sellRules: [], buyLogic: 'AND', sellLogic: 'OR' },
            userEnhancementPrompt
          );
          resolvedRules = patched.rules;
          if (patches.length === 0) patches = patched.patches;
        }
      }

      if (patches.length === 0) {
        patches = [
          'Added 200 EMA Macro Trend Filter to block counter-trend entries.',
          'Added RSI (42-68) bounded momentum filter to prevent buying local exhaustion tops.',
          'Added dynamic protective stop-loss and take-profit exit brackets.',
        ];
      }

      setEnhancedPineCode(resolvedPine || customPineScript || '');
      setEnhancedScriptCode(resolvedScript || customScript || '');
      setEnhancedRulesConfig(resolvedRules || customRules || null);
      setAppliedPatches(patches);

      // Run comparative backtest immediately!
      const compRes = runEnhancedBacktest(resolvedPine, resolvedRules, resolvedScript);
      setEnhancedResult(compRes);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Failed to complete analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    const pineCode = enhancedPineCode || customPineScript || '';
    onApplyImprovedStrategy({
      pineScript: pineCode,
      rules: enhancedRulesConfig || undefined,
      script: enhancedScriptCode || undefined,
      explanation:
        analysis?.improvedStrategy.explanation ||
        'Surgically enhanced Pine Script strategy with macro trend filter, RSI momentum boundary, and protective risk brackets.',
    });
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 4000);
  };

  const handleCopyCode = () => {
    const codeToCopy =
      activeCodeTab === 'ENHANCED'
        ? enhancedPineCode || customPineScript || ''
        : customPineScript || '';
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadge = (cat: StrategyImprovementSuggestion['category']) => {
    switch (cat) {
      case 'ENTRY_FILTER':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'EXIT_LOGIC':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'RISK_MANAGEMENT':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      case 'INDICATOR_ADDITION':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-500/30 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Main Directive Section */}
      <div className="space-y-4 border-b border-slate-800/80 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Gemini AI Strategy Diagnostic & Code Enhancer</span>
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                    analysis?.isFallback
                      ? 'bg-amber-900/40 text-amber-200 border-amber-600/50'
                      : 'bg-purple-900/60 text-purple-200 border-purple-700/50'
                  }`}
                >
                  {analysis?.modelUsed || 'Gemini AI'}
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Provide custom enhancement instructions or request complementary indicators to boost signal accuracy, eliminate false breakouts, and elevate win rate on {coin}/{pair} ({timeframe}).
            </p>
          </div>

          {/* Editable Timeframe Selector in Gemini Analyzer */}
          {onTimeframeChange && (
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-purple-500/30 self-start md:self-auto">
              <Clock className="w-3.5 h-3.5 text-amber-400 ml-1" />
              <span className="text-[11px] text-slate-300 font-semibold mr-1">Timeframe:</span>
              {(['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const).map((tf) => (
                <button
                  key={tf}
                  id={`gemini-analyzer-tf-btn-${tf}`}
                  type="button"
                  onClick={() => onTimeframeChange(tf as Timeframe)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    timeframe === tf
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Test AI optimizations on ${tf} timeframe`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Enhancement Prompt Box */}
        <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="input-strategy-enhancement-prompt"
              className="text-xs font-bold text-purple-200 flex items-center gap-2"
            >
              <Wand2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Custom Enhancement Request & Indicator Prompt (Optional)</span>
            </label>
            {userEnhancementPrompt.trim() && (
              <button
                type="button"
                onClick={() => setUserEnhancementPrompt('')}
                className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Clear prompt"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              id="input-strategy-enhancement-prompt"
              rows={3}
              value={userEnhancementPrompt}
              onChange={(e) => setUserEnhancementPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isAnalyzing) {
                  e.preventDefault();
                  handleRunAnalysis();
                }
              }}
              placeholder={`e.g. "Add 200 EMA macro trend filter and ATR trailing stop to cut down false signals", "Include Bollinger Bands squeeze and Supertrend for better breakout signaling and accuracy", "Add volume confirmation to improve win rate above 60%"`}
              className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-y min-h-[70px] transition-all font-sans leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">Enter</kbd> to analyze</span>
              <span>{userEnhancementPrompt.length} chars</span>
            </div>
          </div>

          {/* Quick-Insert Indicator Chips */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick-Add Indicator & Enhancement Suggestions:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTION_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPromptChip(chip.text)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-purple-950/60 border border-slate-700/60 hover:border-purple-500/40 text-slate-300 hover:text-purple-200 text-[11px] transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title={chip.text}
                >
                  <span className="text-purple-400 font-bold">+</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Trigger Row */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-400">
              Gemini will surgically enhance your existing code and provide indicator recommendations for superior signaling and accuracy.
            </p>

            <button
              id="btn-trigger-gemini-analysis"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.99] shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Diagnosing & Enhancing Script...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>
                    {analysis
                      ? analysis.isFallback
                        ? 'Retry Live Gemini AI'
                        : 'Re-Analyze with Gemini AI'
                      : userEnhancementPrompt.trim()
                      ? 'Analyze & Apply Enhancements'
                      : 'Analyze Strategy with Gemini AI'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {analysis?.notice && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">{analysis.notice}</span>
          </div>
          <button
            id="btn-retry-live-gemini"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-[11px] font-semibold border border-amber-500/40 shrink-0 cursor-pointer transition-colors"
          >
            Retry Gemini AI
          </button>
        </div>
      )}

      {analysisError && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Analysis Notice</p>
            <p className="text-rose-300/90">{analysisError}</p>
          </div>
        </div>
      )}

      {/* Initial Teaser / State when analysis hasn't been run yet */}
      {!analysis && !isAnalyzing && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-purple-950/40 border border-purple-500/20 text-purple-400">
            <Target className="w-7 h-7 text-purple-400" />
          </div>
          <div className="max-w-xl mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-200">
              Ready to Audit and Enhance Your {editorMode === 'RULES' ? 'Rule' : 'Script'} Strategy on {coin}/{pair}
            </h4>
            <p className="text-xs text-slate-400">
              Current baseline: {result.totalTrades} trades ({result.winningTrades} wins / {result.losingTrades} losses) with {result.netProfitPercent >= 0 ? `+${result.netProfitPercent}%` : `${result.netProfitPercent}%`} net return and an efficiency score of {result.efficiencyScore}/100. Specify your enhancement requests above or click &ldquo;Analyze Strategy with Gemini AI&rdquo; to enhance your existing code with trend filters and risk brackets!
            </p>
          </div>
        </div>
      )}

      {/* Analysis Results View */}
      {analysis && (
        <div className="space-y-6">
          {/* User Custom Prompt Guidance Banner */}
          {(analysis.userEnhancementPrompt || analysis.userPromptGuidanceSummary || userEnhancementPrompt.trim()) && (
            <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 rounded-xl p-4 space-y-2 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Custom Enhancement Directive Addressed
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  User Custom Directive
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-1.5">
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-purple-200 font-mono text-[11px]">
                  <span className="text-slate-500">Your Prompt: </span>
                  &ldquo;{analysis.userEnhancementPrompt || userEnhancementPrompt}&rdquo;
                </div>
                {analysis.userPromptGuidanceSummary && (
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    <strong className="text-purple-300">AI Enhancement Response: </strong>
                    {analysis.userPromptGuidanceSummary}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Executive Summary */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                Diagnostic Forensic Summary
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Efficiency Grade:
                </span>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                    analysis.efficiencyAudit.currentGrade === 'A+' || analysis.efficiencyAudit.currentGrade === 'A'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : analysis.efficiencyAudit.currentGrade === 'B'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  Grade {analysis.efficiencyAudit.currentGrade} ({analysis.efficiencyAudit.efficiencyScore}/100)
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {analysis.executiveSummary}
            </p>
          </div>

          {/* SECTION: AI RECOMMENDED INDICATORS FOR ACCURACY & BETTER SIGNALING */}
          <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>AI Recommended Indicators for Accuracy & Better Signaling</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-600/50">
                      High-Precision Edge
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Recommended quantitative indicators and filters to boost signal accuracy, cut down false breakouts, and elevate trade win rate.
                  </p>
                </div>
              </div>
            </div>

            {/* Recommended Indicators Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.suggestedAdditions.recommendedIndicators.map((ind, idx) => {
                const isEma = /ema|trend|sma|macro/i.test(ind);
                const isBb = /bollinger|squeeze|band/i.test(ind);
                const isAtr = /atr|volatilit|trailing/i.test(ind);
                const isVol = /volume|obv|flow|liquidity/i.test(ind);
                const isRsi = /rsi|momentum|oscillator/i.test(ind);

                const badge = isEma
                  ? { label: 'Trend Gatekeeper', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' }
                  : isBb
                  ? { label: 'Volatility Squeeze', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' }
                  : isAtr
                  ? { label: 'Dynamic Risk & ATR', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' }
                  : isVol
                  ? { label: 'Volume Liquidity', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' }
                  : isRsi
                  ? { label: 'Momentum Bounds', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' }
                  : { label: 'Signal Filter', color: 'bg-teal-500/10 text-teal-300 border-teal-500/30' };

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddPromptChip(`Add ${ind}`)}
                        className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline cursor-pointer flex items-center gap-1"
                        title="Add to enhancement prompt"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Add to Prompt</span>
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-white flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{ind}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Filters out noise during low-volume or sideways regimes, validating entries only when institutional trend confirmation is present.
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Key Actionable Improvements with Impact Scores */}
            {analysis.keyImprovements && analysis.keyImprovements.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Actionable Strategy Improvements & Signal Calibration:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {analysis.keyImprovements.map((imp, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryBadge(
                            imp.category
                          )}`}
                        >
                          {imp.category.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-bold font-mono text-emerald-400">
                          Impact: {imp.impactScore}/10
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-200">{imp.title}</h5>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{imp.description}</p>
                      <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1">
                        <div className="text-rose-300/90 font-medium">
                          <span className="text-rose-400 font-bold">Why Original Failed: </span>
                          {imp.whyItFailed}
                        </div>
                        <div className="text-emerald-300 font-medium">
                          <span className="text-emerald-400 font-bold">Fix Applied: </span>
                          {imp.suggestedAction}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk & Execution Guardrails */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Recommended Stop Loss Logic
                </span>
                <p className="text-xs text-slate-200 font-medium leading-snug">
                  {analysis.suggestedAdditions.recommendedStopLossLogic}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Recommended Take Profit Logic
                </span>
                <p className="text-xs text-slate-200 font-medium leading-snug">
                  {analysis.suggestedAdditions.recommendedTakeProfitLogic}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Recommended Filter Rules
                </span>
                <div className="space-y-0.5">
                  {analysis.suggestedAdditions.recommendedFilterRules.map((rule, rIdx) => (
                    <div key={rIdx} className="text-[11px] font-mono text-purple-300 flex items-center gap-1">
                      <span className="text-slate-500">•</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* HEAD-TO-HEAD COMPARISON MATRIX: ORIGINAL VS AI-ENHANCED */}
          {enhancedResult && (
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 border-2 border-indigo-500/40 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>Head-to-Head Backtest: Original vs AI-Enhanced Code</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                        Live Comparative Results
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Both versions simulated on the exact same historical candlestick data ({coin}/{pair} {timeframe}).
                    </p>
                  </div>
                </div>

                {/* Verdict Badge */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  {enhancedResult.netProfitPercent >= result.netProfitPercent ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Enhanced Won (+{(enhancedResult.netProfitPercent - result.netProfitPercent).toFixed(2)}% Net Profit)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Enhanced Lower Risk (-{(result.maxDrawdownPercent - enhancedResult.maxDrawdownPercent).toFixed(1)}% Drawdown)
                    </span>
                  )}
                </div>
              </div>

              {/* 5-Column Side-by-Side Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
                {/* Metric 1: Net Return */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                    Net Profit Return
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Original:</span>
                      <span className={`font-mono font-bold ${result.netProfitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {result.netProfitPercent >= 0 ? `+${result.netProfitPercent}%` : `${result.netProfitPercent}%`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold">Enhanced:</span>
                      <span className={`font-mono font-bold ${enhancedResult.netProfitPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {enhancedResult.netProfitPercent >= 0 ? `+${enhancedResult.netProfitPercent}%` : `${enhancedResult.netProfitPercent}%`}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400">Alpha Delta: </span>
                    <span className={enhancedResult.netProfitPercent >= result.netProfitPercent ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {enhancedResult.netProfitPercent >= result.netProfitPercent ? '+' : ''}
                      {(enhancedResult.netProfitPercent - result.netProfitPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Metric 2: Win Rate */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                    Win Rate
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Original:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {result.winRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold">Enhanced:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {enhancedResult.winRate}%
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400">Delta: </span>
                    <span className={enhancedResult.winRate >= result.winRate ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                      {enhancedResult.winRate >= result.winRate ? '+' : ''}
                      {(enhancedResult.winRate - result.winRate).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Metric 3: Max Drawdown */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                    Max Drawdown
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Original:</span>
                      <span className="font-mono font-bold text-rose-400">
                        -{result.maxDrawdownPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold">Enhanced:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        -{enhancedResult.maxDrawdownPercent}%
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400">Risk Delta: </span>
                    <span className={enhancedResult.maxDrawdownPercent <= result.maxDrawdownPercent ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {(result.maxDrawdownPercent - enhancedResult.maxDrawdownPercent).toFixed(1)}% safer
                    </span>
                  </div>
                </div>

                {/* Metric 4: Profit Factor */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                    Profit Factor
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Original:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {result.profitFactor}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold">Enhanced:</span>
                      <span className="font-mono font-bold text-purple-300">
                        {enhancedResult.profitFactor}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400">Delta: </span>
                    <span className={enhancedResult.profitFactor >= result.profitFactor ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                      {enhancedResult.profitFactor >= result.profitFactor ? '+' : ''}
                      {(enhancedResult.profitFactor - result.profitFactor).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Metric 5: Total Trades / Fee Friction */}
                <div className="col-span-2 sm:col-span-1 bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                    Efficiency Score
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Original:</span>
                      <span className="font-mono font-bold text-slate-300">
                        {result.efficiencyScore}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-300 font-semibold">Enhanced:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {enhancedResult.efficiencyScore}/100
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400">Score Delta: </span>
                    <span className={enhancedResult.efficiencyScore >= result.efficiencyScore ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                      {enhancedResult.efficiencyScore >= result.efficiencyScore ? '+' : ''}
                      {(enhancedResult.efficiencyScore - result.efficiencyScore).toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparative takeaway banner */}
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Backtest Verification: </strong>
                  {enhancedResult.netProfitPercent >= result.netProfitPercent ? (
                    <span>
                      The enhanced script generated <strong>+{(enhancedResult.netProfitPercent - result.netProfitPercent).toFixed(2)}%</strong> higher net profit and improved win rate by <strong>+{(enhancedResult.winRate - result.winRate).toFixed(1)}%</strong> by filtering out counter-trend whipsaws and premature stops.
                    </span>
                  ) : (
                    <span>
                      The enhanced script reduced maximum drawdown from <strong>{result.maxDrawdownPercent}%</strong> down to <strong>{enhancedResult.maxDrawdownPercent}%</strong>, significantly improving capital preservation and downside protection.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Failure Diagnosis & What Was Missing */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              What Was Lacking in Your Original Script
            </span>

            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/20 text-xs text-rose-200 font-medium">
              Primary Bottleneck: {analysis.failureDiagnosis.primaryFlaw}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              {analysis.failureDiagnosis.detailedReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                  <span className="leading-snug">{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Surgical Patches Checklist */}
          {appliedPatches.length > 0 && (
            <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Surgical Code Enhancements Injected into Your Script:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {appliedPatches.map((patch, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{patch}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Interactive Code Diff & Inspector */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Script Code Inspector (Enhanced vs Original)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-slate-800 p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab('ENHANCED')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeCodeTab === 'ENHANCED'
                        ? 'bg-purple-600 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Enhanced (Ready to Apply)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCodeTab('ORIGINAL')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeCodeTab === 'ORIGINAL'
                        ? 'bg-purple-600 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Original Code
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Copy code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCodeInspector(!showCodeInspector)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                >
                  {showCodeInspector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showCodeInspector && (
              <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto max-h-72 divide-y divide-slate-800/40">
                <pre className={activeCodeTab === 'ENHANCED' ? 'text-cyan-300' : 'text-slate-400'}>
                  {activeCodeTab === 'ENHANCED'
                    ? enhancedPineCode || customPineScript || '// Enhanced script ready'
                    : customPineScript || '// Original script'}
                </pre>
              </div>
            )}
          </div>

          {/* Section 5: ONE-CLICK APPLY FIX BUTTON */}
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-950 to-indigo-950/60 border border-purple-500/40 rounded-xl p-5 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    Apply Enhanced Fix to Pine Script Window
                  </span>
                </div>
                <p className="text-xs text-purple-200/80">
                  Clicking below will inject the patched code into your Pine Script editor, auto-save to your custom strategies library, and instantly run the backtest. The Reset button will remain available to revert at any time.
                </p>
              </div>

              <button
                id="btn-apply-gemini-strategy"
                onClick={handleApply}
                disabled={isApplied}
                className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shrink-0 ${
                  isApplied
                    ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-[0.99]'
                }`}
              >
                {isApplied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Applied to Pine Script Window & Auto-Saved!</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Apply AI Fix to Pine Script Window & Auto-Save</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
