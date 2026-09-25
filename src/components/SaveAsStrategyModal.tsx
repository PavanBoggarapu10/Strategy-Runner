import React, { useState, useEffect } from 'react';
import { StrategyConfig } from '../types/trading';
import { X, Copy, Check, Sparkles, Tag } from 'lucide-react';

interface SaveAsStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStrategy: StrategyConfig;
  onSaveAs: (newLabel: string, newDescription: string) => void;
}

export const SaveAsStrategyModal: React.FC<SaveAsStrategyModalProps> = ({
  isOpen,
  onClose,
  sourceStrategy,
  onSaveAs,
}) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen && sourceStrategy) {
      setLabel(`${sourceStrategy.name} (Copy)`);
      setDescription(sourceStrategy.description || '');
    }
  }, [isOpen, sourceStrategy]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSaveAs(label.trim(), description.trim());
    onClose();
  };

  const engineType = sourceStrategy.baseType || (
    sourceStrategy.customPineScript ? 'PINE_SCRIPT' :
    sourceStrategy.customRules ? 'CUSTOM_RULES' :
    sourceStrategy.customScript ? 'CUSTOM_SCRIPT' :
    sourceStrategy.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 ring-1 ring-emerald-500/20 rounded-2xl w-full max-w-lg overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Save Strategy As New</h2>
              <p className="text-xs text-slate-400">
                Save an independent copy with an editable label to your strategy library.
              </p>
            </div>
          </div>
          <button
            id="btn-close-save-as-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative notice */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-white">
              Source Strategy: <span className="text-emerald-400">{sourceStrategy.name}</span>
            </div>
            <p className="text-slate-400">
              Saving as new will not overwrite your existing strategy. A new custom strategy item will be added to your custom strategy list.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Editable Label / Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Strategy Label / Name</span>
              <span className="text-rose-400">*</span>
            </label>
            <input
              id="input-save-as-name"
              type="text"
              required
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. BTC Breakout v2, My Tuned EMA"
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium placeholder-slate-500 outline-none transition-all"
            />
            <p className="text-[11px] text-slate-400">
              You can edit this label anytime from the strategy controls or builder.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Strategy Description / Notes
            </label>
            <textarea
              id="input-save-as-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes on parameters, indicators, or adjustments..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none transition-all"
            />
          </div>

          {/* Engine Preview */}
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-400">Engine Type:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              {engineType}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              id="btn-cancel-save-as"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-save-as"
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save As New Strategy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
