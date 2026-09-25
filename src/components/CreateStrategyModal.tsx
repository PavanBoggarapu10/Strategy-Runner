import React, { useState } from 'react';
import { CustomRulesConfig, StrategyConfig, StrategyType } from '../types/trading';
import {
  STRATEGY_PRESETS,
  DEFAULT_CUSTOM_RULES,
  DEFAULT_CUSTOM_SCRIPT,
} from '../utils/strategyEngine';
import { DEFAULT_PINE_SCRIPT, PINE_TEMPLATES } from '../utils/pineScriptGenerator';
import {
  X,
  Plus,
  Code2,
  Layers,
  Sparkles,
  FileCode,
  Check,
  TrendingUp,
} from 'lucide-react';

interface CreateStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newStrategy: StrategyConfig) => void;
}

export const CreateStrategyModal: React.FC<CreateStrategyModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('My Custom Strategy');
  const [description, setDescription] = useState('');
  const [engineType, setEngineType] = useState<StrategyType>('PINE_SCRIPT');
  const [selectedPineTemplate, setSelectedPineTemplate] = useState(PINE_TEMPLATES[0]?.name || 'Dual EMA Golden Cross (Trend Following)');
  const [selectedPresetClone, setSelectedPresetClone] = useState('EMA_CROSS');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    let pineCode: string | undefined = undefined;
    let rulesConfig: CustomRulesConfig | undefined = undefined;
    let scriptCode: string | undefined = undefined;
    let params: Record<string, any> = { fastPeriod: 9, slowPeriod: 21, rsiPeriod: 14 };

    if (engineType === 'PINE_SCRIPT') {
      const tpl = PINE_TEMPLATES.find(p => p.name === selectedPineTemplate);
      pineCode = tpl ? tpl.script : DEFAULT_PINE_SCRIPT;
    } else if (engineType === 'CUSTOM_RULES') {
      rulesConfig = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_RULES));
    } else if (engineType === 'CUSTOM_SCRIPT') {
      scriptCode = DEFAULT_CUSTOM_SCRIPT;
    } else {
      // Cloned from built-in preset
      const preset = STRATEGY_PRESETS.find(p => p.id === selectedPresetClone);
      if (preset) {
        params = { ...preset.params };
      }
    }

    const created: StrategyConfig = {
      id: newId,
      baseType: engineType,
      name: name.trim(),
      description: description.trim() || `User custom ${engineType} algorithmic trading strategy.`,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
      params,
      customPineScript: pineCode,
      customRules: rulesConfig,
      customScript: scriptCode,
    };

    onCreate(created);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 ring-1 ring-cyan-500/20 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Custom Strategy</h2>
              <p className="text-xs text-slate-400">
                Configure a new strategy with a custom editable label and execution engine.
              </p>
            </div>
          </div>
          <button
            id="btn-close-create-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Strategy Label / Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Strategy Label / Name</span>
              <span className="text-rose-400">*</span>
            </label>
            <input
              id="input-new-strategy-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BTC 5m Supertrend Scalper, ETH Dual EMA"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium placeholder-slate-500 outline-none transition-all"
            />
            <p className="text-[11px] text-slate-400">
              This label will appear in your custom strategy library and can be edited anytime.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Strategy Description (Optional)
            </label>
            <textarea
              id="input-new-strategy-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Enters long when EMA9 crosses EMA21 with RSI filter..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none transition-all"
            />
          </div>

          {/* Engine Architecture Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Execution Engine / Architecture
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Pine Script */}
              <button
                id="btn-engine-pine"
                type="button"
                onClick={() => setEngineType('PINE_SCRIPT')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                  engineType === 'PINE_SCRIPT'
                    ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                    <FileCode className="w-4 h-4" />
                    <span>Pine Script (v5)</span>
                  </div>
                  {engineType === 'PINE_SCRIPT' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  TradingView Pine Script v5 with live simulator and TradingView export.
                </p>
              </button>

              {/* Option 2: Visual Rules */}
              <button
                id="btn-engine-rules"
                type="button"
                onClick={() => setEngineType('CUSTOM_RULES')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                  engineType === 'CUSTOM_RULES'
                    ? 'bg-purple-950/50 border-purple-500 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                    <Layers className="w-4 h-4" />
                    <span>Visual Rules</span>
                  </div>
                  {engineType === 'CUSTOM_RULES' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  No-code multi-indicator rule conditions with AND/OR logic.
                </p>
              </button>

              {/* Option 3: JS Sandbox */}
              <button
                id="btn-engine-script"
                type="button"
                onClick={() => setEngineType('CUSTOM_SCRIPT')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                  engineType === 'CUSTOM_SCRIPT'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
                    <Code2 className="w-4 h-4" />
                    <span>JS Sandbox</span>
                  </div>
                  {engineType === 'CUSTOM_SCRIPT' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Write algorithmic JavaScript trading logic with access to live indicators.
                </p>
              </button>
            </div>
          </div>

          {/* Starter Template Selection for Pine Script */}
          {engineType === 'PINE_SCRIPT' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Starter Pine Script Template</span>
              </label>
              <select
                id="select-starter-pine-template"
                value={selectedPineTemplate}
                onChange={(e) => setSelectedPineTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 outline-none"
              >
                {PINE_TEMPLATES.map((tpl) => (
                  <option key={tpl.name} value={tpl.name}>
                    {tpl.name} — {tpl.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              id="btn-cancel-create-strategy"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-strategy"
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Strategy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
