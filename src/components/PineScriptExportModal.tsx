import React, { useState, useEffect } from 'react';
import {
  Code,
  Copy,
  Check,
  Download,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  X,
  FileCode,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { BacktestSettings, StrategyConfig } from '../types/trading';
import {
  convertJsToPineScript,
  convertPresetToPineScript,
  convertRulesToPineScript,
  DEFAULT_PINE_SCRIPT,
  PINE_TEMPLATES,
} from '../utils/pineScriptGenerator';
import { STRATEGY_PRESETS } from '../utils/strategyEngine';

interface PineScriptExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStrategy: StrategyConfig;
  settings: BacktestSettings;
  coin: string;
  pair: string;
  timeframe: string;
  onApplyPineScript?: (pineCode: string, strategyName: string) => void;
}

export const PineScriptExportModal: React.FC<PineScriptExportModalProps> = ({
  isOpen,
  onClose,
  activeStrategy,
  settings,
  coin,
  pair,
  timeframe,
  onApplyPineScript,
}) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(activeStrategy.id);
  const [generatedPineCode, setGeneratedPineCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'VIEW' | 'CONVERT_JS'>('VIEW');
  const [customJsInput, setCustomJsInput] = useState<string>(
    activeStrategy.customScript ||
      `// Enter Long when RSI is oversold and price is above Fast EMA\nif (indicators.rsi < 35 && candle.close > indicators.emaFast) {\n  return 'BUY';\n}\n\n// Take profit when RSI enters overbought\nif (indicators.rsi > 70 || candle.close < indicators.emaSlow) {\n  return 'SELL';\n}\n\nreturn 'HOLD';`
  );
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Generate Pine Script whenever selected strategy changes
  useEffect(() => {
    let strat: StrategyConfig | undefined;
    if (selectedStrategyId === activeStrategy.id) {
      strat = activeStrategy;
    } else {
      strat = STRATEGY_PRESETS.find((p) => p.id === selectedStrategyId);
    }

    if (strat) {
      const code = convertPresetToPineScript(strat, settings);
      setGeneratedPineCode(code);
    } else {
      setGeneratedPineCode(DEFAULT_PINE_SCRIPT);
    }
  }, [selectedStrategyId, activeStrategy, settings]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPineCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const filename = `${coin.toLowerCase()}_${pair.toLowerCase()}_${selectedStrategyId.toLowerCase()}_v5.pine`;
    const blob = new Blob([generatedPineCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConvertCustomJs = () => {
    const converted = convertJsToPineScript(customJsInput, `${coin}/${pair} Converted Strategy`, settings);
    setGeneratedPineCode(converted);
    setActiveView('VIEW');
  };

  const handleApplyToApp = () => {
    if (onApplyPineScript) {
      onApplyPineScript(generatedPineCode, `${activeStrategy.name} (Pine Script v5)`);
      setAppliedNotice('Pine Script loaded as active backtesting strategy in the app!');
      setTimeout(() => setAppliedNotice(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-7 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-cyan-500/30 ring-1 ring-cyan-500/20 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">TradingView Pine Script (v5) Studio</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                  @version=5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Convert JavaScript, Visual Rules, or preset strategies into production-ready Pine Script for TradingView.
              </p>
            </div>
          </div>

          <button
            id="btn-close-pine-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Filter Bar */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Navigation view toggle */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              id="btn-tab-pine-viewer"
              onClick={() => setActiveView('VIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'VIEW'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Pine Script (v5) Code</span>
            </button>
            <button
              id="btn-tab-pine-converter"
              onClick={() => setActiveView('CONVERT_JS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'CONVERT_JS'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Convert JavaScript to Pine Script</span>
            </button>
          </div>

          {/* Preset Selector */}
          {activeView === 'VIEW' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Strategy Source:</span>
              <select
                id="select-pine-strategy-source"
                value={selectedStrategyId}
                onChange={(e) => setSelectedStrategyId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-cyan-400"
              >
                <optgroup label="Current Active Strategy">
                  <option value={activeStrategy.id}>
                    Active: {activeStrategy.name} ({activeStrategy.id})
                  </option>
                </optgroup>
                <optgroup label="Preset Strategies">
                  {STRATEGY_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {appliedNotice && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{appliedNotice}</span>
            </div>
          )}

          {activeView === 'CONVERT_JS' ? (
            /* CONVERTER VIEW: JS -> Pine Script */
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    Paste or Edit JavaScript Trading Logic:
                  </span>
                  <button
                    id="btn-load-sample-js"
                    type="button"
                    onClick={() =>
                      setCustomJsInput(
                        `// Buy on oversold RSI & Bullish MACD\nif (indicators.rsi < 35 && indicators.macd.histogram > 0) {\n  return 'BUY';\n}\n\n// Exit when price hits upper Bollinger Band or RSI > 72\nif (candle.close > indicators.bollinger.upper || indicators.rsi > 72) {\n  return 'SELL';\n}\n\nreturn 'HOLD';`
                      )
                    }
                    className="text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    Load Sample JS Snippet
                  </button>
                </div>
                <textarea
                  id="textarea-js-to-convert"
                  value={customJsInput}
                  onChange={(e) => setCustomJsInput(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder="Paste JavaScript trading script here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-amber-300 leading-relaxed focus:outline-none focus:border-amber-400 resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  id="btn-trigger-convert-js"
                  type="button"
                  onClick={handleConvertCustomJs}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Convert to TradingView Pine Script (v5)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* PINE SCRIPT VIEWER & EXPORTER */
            <div className="space-y-4">
              {/* Pine Script Code Preview */}
              <div className="relative group">
                <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                  <button
                    id="btn-copy-pine-code"
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-medium border border-slate-700 flex items-center gap-1.5 shadow backdrop-blur transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-download-pine-file"
                    type="button"
                    onClick={handleDownload}
                    className="px-3 py-1.5 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 shadow transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.pine File</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-900/70 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      {coin}_{pair}_{selectedStrategyId}.pine (TradingView Pine Script v5)
                    </span>
                    <span>{generatedPineCode.split('\n').length} lines</span>
                  </div>

                  <textarea
                    id="textarea-generated-pine"
                    value={generatedPineCode}
                    onChange={(e) => setGeneratedPineCode(e.target.value)}
                    rows={16}
                    spellCheck={false}
                    className="w-full bg-slate-950 p-4 font-mono text-xs text-cyan-300 leading-relaxed focus:outline-none resize-y selection:bg-cyan-900 selection:text-white"
                  />
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>
                    Ready for TradingView • Tested on <strong>{coin}/{pair}</strong> ({timeframe})
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {onApplyPineScript && (
                    <button
                      id="btn-apply-pine-to-app"
                      type="button"
                      onClick={handleApplyToApp}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Test as Active Strategy in App</span>
                    </button>
                  )}

                  <button
                    id="btn-copy-pine-bottom"
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30"
                  >
                    {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Pine Script'}</span>
                  </button>
                </div>
              </div>

              {/* TradingView 4-Step Guide */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>How to Run in TradingView in 4 Simple Steps:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400 pt-1">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-cyan-400 font-mono">1. Copy Code</div>
                    <p className="text-[11px] leading-relaxed">
                      Click <strong>Copy Pine Script</strong> above or download the <code>.pine</code> file.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-cyan-400 font-mono">2. Open Pine Editor</div>
                    <p className="text-[11px] leading-relaxed">
                      In TradingView, click the <strong>Pine Editor</strong> tab located at the bottom toolbar.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-cyan-400 font-mono">3. Paste & Save</div>
                    <p className="text-[11px] leading-relaxed">
                      Select all default text, paste this script, and click <strong>Save</strong>.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-emerald-400 font-mono">4. Add to Chart</div>
                    <p className="text-[11px] leading-relaxed">
                      Click <strong>Add to Chart</strong>. TradingView will display signals and strategy tester results!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
