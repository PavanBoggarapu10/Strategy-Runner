import React, { useState } from 'react';
import {
  MousePointer,
  TrendingUp,
  Minus,
  ArrowUpRight,
  Magnet,
  RotateCcw,
  Trash2,
  Clock,
  Palette,
  ChevronRight,
} from 'lucide-react';
import { DrawingToolType, DRAWING_COLORS } from '../types/drawings';

interface ChartDrawingToolbarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  isMagnetEnabled: boolean;
  onToggleMagnet: () => void;
  activeColor: string;
  onSelectColor: (color: string) => void;
  futureMarginBars: number;
  onChangeFutureMargin: (bars: number) => void;
  onUndoDrawing: () => void;
  onClearDrawings: () => void;
  drawingsCount: number;
  selectedDrawingId: string | null;
  onDeleteSelectedDrawing: () => void;
}

export const ChartDrawingToolbar: React.FC<ChartDrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  isMagnetEnabled,
  onToggleMagnet,
  activeColor,
  onSelectColor,
  futureMarginBars,
  onChangeFutureMargin,
  onUndoDrawing,
  onClearDrawings,
  drawingsCount,
  selectedDrawingId,
  onDeleteSelectedDrawing,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFuturePicker, setShowFuturePicker] = useState(false);

  const futurePresets = [
    { label: '0 bars', bars: 0, desc: 'No future space' },
    { label: '+15 bars', bars: 15, desc: 'Short future projection' },
    { label: '+30 bars', bars: 30, desc: 'Default projection' },
    { label: '+50 bars', bars: 50, desc: 'Wide forecasting space' },
  ];

  return (
    <aside
      aria-label="Chart Drawing Tools"
      className="relative flex flex-col items-center gap-1 bg-slate-950/95 backdrop-blur-md border border-slate-800/90 rounded-2xl p-1.5 shadow-2xl text-xs select-none w-11 z-30"
    >
      {/* 1. Pan / Select Tool */}
      <div className="relative group">
        <button
          id="drawing-tool-select"
          type="button"
          onClick={() => onSelectTool('select')}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            activeTool === 'select'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Pan & Inspect Mode"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Pan & Inspect <span className="text-slate-400 text-[10px]">(Normal)</span>
        </div>
      </div>

      {/* 2. Trendline */}
      <div className="relative group">
        <button
          id="drawing-tool-trendline"
          type="button"
          onClick={() => onSelectTool('trendline')}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            activeTool === 'trendline'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Trendline Tool"
        >
          <TrendingUp className="w-4 h-4" />
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Trendline <span className="text-slate-400 text-[10px]">(Click start & end point)</span>
        </div>
      </div>

      {/* 3. Horizontal Support / Resistance */}
      <div className="relative group">
        <button
          id="drawing-tool-horizontal"
          type="button"
          onClick={() => onSelectTool('horizontal')}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            activeTool === 'horizontal'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Horizontal S/R Line Tool"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Horizontal Line <span className="text-slate-400 text-[10px]">(Single click price level)</span>
        </div>
      </div>

      {/* 4. Ray Line */}
      <div className="relative group">
        <button
          id="drawing-tool-ray"
          type="button"
          onClick={() => onSelectTool('ray')}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            activeTool === 'ray'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Ray Projection Tool"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Ray Line <span className="text-slate-400 text-[10px]">(Extends into future space)</span>
        </div>
      </div>

      {/* 5. Fibonacci Retracement */}
      <div className="relative group">
        <button
          id="drawing-tool-fibonacci"
          type="button"
          onClick={() => onSelectTool('fibonacci')}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            activeTool === 'fibonacci'
              ? 'bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-400/30 scale-105'
              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30'
          }`}
          aria-label="Fibonacci Retracement Tool"
        >
          <span className="font-serif font-black text-sm">φ</span>
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Fibonacci Retracement{' '}
          <span className="text-emerald-400 text-[10px] font-semibold">(Golden Pocket 0.618-0.65)</span>
        </div>
      </div>

      {/* Separator */}
      <div className="w-5 h-px bg-slate-800 my-0.5" />

      {/* 6. Magnet Snap Toggle */}
      <div className="relative group">
        <button
          id="drawing-toggle-magnet"
          type="button"
          onClick={onToggleMagnet}
          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isMagnetEnabled
              ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-400/20'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/80'
          }`}
          aria-label={isMagnetEnabled ? 'Magnet Snap ON' : 'Magnet Snap OFF'}
        >
          <Magnet className="w-4 h-4" />
        </button>
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
          Magnet Snap:{' '}
          <span className={isMagnetEnabled ? 'text-amber-300 font-bold' : 'text-slate-400'}>
            {isMagnetEnabled ? 'ACTIVE (Snaps to High/Low/Open/Close)' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="w-5 h-px bg-slate-800 my-0.5" />

      {/* 7. Color Picker Button with Flyout Palette */}
      <div className="relative">
        <button
          id="drawing-color-palette-btn"
          type="button"
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowFuturePicker(false);
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Line Color Palette"
          aria-label="Select Drawing Color"
        >
          <span
            className="w-4 h-4 rounded-full border-2 border-slate-950 shadow-sm"
            style={{ backgroundColor: activeColor }}
          />
        </button>

        {showColorPicker && (
          <div
            className="absolute left-full ml-2.5 top-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100"
            onMouseLeave={() => setShowColorPicker(false)}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-0.5">
              <Palette className="w-3 h-3 text-cyan-400" />
              <span>Line Color</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DRAWING_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onSelectColor(c.value);
                    setShowColorPicker(false);
                  }}
                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform flex items-center justify-center ${
                    activeColor === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 8. Future Blank Margin Selector with Flyout */}
      <div className="relative">
        <button
          id="drawing-future-margin-btn"
          type="button"
          onClick={() => {
            setShowFuturePicker(!showFuturePicker);
            setShowColorPicker(false);
          }}
          className={`w-8 h-8 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            futureMarginBars > 0
              ? 'text-amber-300 hover:bg-amber-400/10'
              : 'text-slate-400 hover:bg-slate-800/80'
          }`}
          title={`Future Space: +${futureMarginBars} bars`}
          aria-label="Future Margin Setting"
        >
          <Clock className="w-3 h-3 mb-0.5 opacity-80" />
          <span className="text-[8px] font-mono font-bold leading-none">
            {futureMarginBars > 0 ? `+${futureMarginBars}` : '0b'}
          </span>
        </button>

        {showFuturePicker && (
          <div
            className="absolute left-full ml-2.5 top-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl z-50 w-36 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100"
            onMouseLeave={() => setShowFuturePicker(false)}
          >
            <div className="text-[10px] text-slate-400 font-medium px-1 pb-0.5 border-b border-slate-800">
              Future Blank Space
            </div>
            {futurePresets.map((p) => (
              <button
                key={p.bars}
                type="button"
                onClick={() => {
                  onChangeFutureMargin(p.bars);
                  setShowFuturePicker(false);
                }}
                className={`flex items-center justify-between px-2 py-1 rounded-lg text-left text-[10px] font-mono transition-colors cursor-pointer ${
                  futureMarginBars === p.bars
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{p.label}</span>
                {futureMarginBars === p.bars && <ChevronRight className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Separator (if drawings exist) */}
      {drawingsCount > 0 && <div className="w-5 h-px bg-slate-800 my-0.5" />}

      {/* 9. Drawings Count Badge & Undo Button */}
      {drawingsCount > 0 && (
        <>
          <div className="relative group">
            <button
              id="drawing-btn-undo"
              type="button"
              onClick={onUndoDrawing}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Undo Last Drawing"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
              Undo Last Line <span className="text-slate-400 text-[10px]">(Ctrl+Z)</span>
            </div>
          </div>

          {/* Delete Selected or Clear All */}
          <div className="relative group">
            {selectedDrawingId ? (
              <button
                id="drawing-btn-delete-selected"
                type="button"
                onClick={onDeleteSelectedDrawing}
                className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Delete Selected Drawing"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="drawing-btn-clear-all"
                type="button"
                onClick={onClearDrawings}
                className="w-8 h-8 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Clear All Drawings"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white rounded-md text-[11px] whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-sans">
              {selectedDrawingId
                ? 'Delete Selected Drawing (Del / Backspace)'
                : `Clear All Drawings (${drawingsCount})`}
            </div>
          </div>

          {/* Drawings counter dot */}
          <span
            className="text-[9px] font-mono font-bold text-cyan-400 px-1 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/20"
            title={`${drawingsCount} active drawings on chart`}
          >
            {drawingsCount}
          </span>
        </>
      )}
    </aside>
  );
};
