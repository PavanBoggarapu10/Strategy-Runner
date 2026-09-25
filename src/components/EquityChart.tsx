import React, { useEffect, useRef, useState } from 'react';
import { BacktestResult, EquityPoint } from '../types/trading';
import { DollarSign, Percent, TrendingDown } from 'lucide-react';

interface EquityChartProps {
  result: BacktestResult;
  timeframe: string;
}

export const EquityChart: React.FC<EquityChartProps> = ({ result, timeframe }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<'BOTH' | 'EQUITY_ONLY' | 'DRAWDOWN_ONLY'>('BOTH');
  const [hoverData, setHoverData] = useState<{ point: EquityPoint; x: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result.equityCurve || result.equityCurve.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const curve = result.equityCurve;
    const rightAxisWidth = 60;
    const chartW = width - rightAxisWidth;

    const isSplit = viewMode === 'BOTH';
    const equityChartH = isSplit ? height * 0.65 : viewMode === 'EQUITY_ONLY' ? height - 25 : 0;
    const drawdownChartH = isSplit ? height * 0.28 : viewMode === 'DRAWDOWN_ONLY' ? height - 25 : 0;
    const drawdownTopY = isSplit ? height * 0.70 : 10;

    // Find Equity min & max
    let minEquity = Infinity;
    let maxEquity = -Infinity;
    for (const p of curve) {
      if (p.equity < minEquity) minEquity = p.equity;
      if (p.equity > maxEquity) maxEquity = p.equity;
      if (p.benchmarkEquity < minEquity) minEquity = p.benchmarkEquity;
      if (p.benchmarkEquity > maxEquity) maxEquity = p.benchmarkEquity;
    }

    const padding = (maxEquity - minEquity) * 0.08 || 100;
    minEquity -= padding;
    maxEquity += padding;
    const equityRange = maxEquity - minEquity || 1;

    // Coordinate helpers
    const getX = (i: number) => (i / (curve.length - 1)) * chartW;
    const getEquityY = (eq: number) => equityChartH - 20 - ((eq - minEquity) / equityRange) * (equityChartH - 30);

    // 1. Draw Grid Lines for Equity
    if (viewMode !== 'DRAWDOWN_ONLY') {
      ctx.strokeStyle = '#182234';
      ctx.lineWidth = 1;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const steps = 4;
      for (let s = 0; s <= steps; s++) {
        const val = minEquity + (equityRange / steps) * s;
        const y = getEquityY(val);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();

        ctx.fillText(`$${Math.round(val).toLocaleString()}`, chartW + 5, y);
      }

      // Benchmark line (dashed slate)
      ctx.beginPath();
      ctx.strokeStyle = '#64748b';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < curve.length; i++) {
        const x = getX(i);
        const y = getEquityY(curve[i].benchmarkEquity);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Equity gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, equityChartH);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.beginPath();
      ctx.moveTo(0, equityChartH);
      for (let i = 0; i < curve.length; i++) {
        ctx.lineTo(getX(i), getEquityY(curve[i].equity));
      }
      ctx.lineTo(chartW, equityChartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Strategy Equity line (emerald)
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < curve.length; i++) {
        const x = getX(i);
        const y = getEquityY(curve[i].equity);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. Draw Underwater Drawdown Area
    if (viewMode !== 'EQUITY_ONLY') {
      const maxDD = Math.max(10, result.maxDrawdownPercent * 1.2);
      const getDDY = (dd: number) => drawdownTopY + (dd / maxDD) * (drawdownChartH - 10);

      // Baseline for 0%
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, drawdownTopY);
      ctx.lineTo(chartW, drawdownTopY);
      ctx.stroke();

      // Drawdown gradient fill
      const ddGrad = ctx.createLinearGradient(0, drawdownTopY, 0, drawdownTopY + drawdownChartH);
      ddGrad.addColorStop(0, 'rgba(244, 63, 94, 0.05)');
      ddGrad.addColorStop(1, 'rgba(244, 63, 94, 0.35)');

      ctx.beginPath();
      ctx.moveTo(0, drawdownTopY);
      for (let i = 0; i < curve.length; i++) {
        ctx.lineTo(getX(i), getDDY(curve[i].drawdownPercent));
      }
      ctx.lineTo(chartW, drawdownTopY);
      ctx.closePath();
      ctx.fillStyle = ddGrad;
      ctx.fill();

      // Drawdown line (crimson)
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < curve.length; i++) {
        const x = getX(i);
        const y = getDDY(curve[i].drawdownPercent);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Drawdown label
      ctx.fillStyle = '#f87171';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`-${result.maxDrawdownPercent.toFixed(1)}% Max DD`, chartW + 5, drawdownTopY + drawdownChartH / 2);
    }

    // Draw hover guide line if active
    if (hoverData) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.moveTo(hoverData.x, 0);
      ctx.lineTo(hoverData.x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [result, viewMode, hoverData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !result.equityCurve?.length) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartW = rect.width - 60;

    if (x >= 0 && x <= chartW) {
      const idx = Math.min(
        result.equityCurve.length - 1,
        Math.max(0, Math.round((x / chartW) * (result.equityCurve.length - 1)))
      );
      setHoverData({ point: result.equityCurve[idx], x });
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Top Controls Bar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">Portfolio Equity Curve</span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              ${result.finalCapital.toLocaleString()} ({result.netProfitPercent >= 0 ? '+' : ''}{result.netProfitPercent.toFixed(2)}%)
            </span>
          </div>

          {/* Legend indicator */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
              Strategy
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-0.5 bg-slate-500 inline-block" />
              Buy & Hold
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
              Drawdown
            </span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setViewMode('BOTH')}
            className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'BOTH' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode('EQUITY_ONLY')}
            className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'EQUITY_ONLY' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Equity Only
          </button>
          <button
            onClick={() => setViewMode('DRAWDOWN_ONLY')}
            className={`px-2 py-0.5 rounded transition-colors ${viewMode === 'DRAWDOWN_ONLY' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Drawdown Only
          </button>
        </div>
      </div>

      {/* Hover info box if present */}
      {hoverData && (
        <div className="px-4 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">{new Date(hoverData.point.time).toLocaleString()}</span>
          <span>Strategy: <strong className="text-emerald-400">${hoverData.point.equity.toLocaleString()}</strong></span>
          <span>B&H: <strong className="text-slate-300">${hoverData.point.benchmarkEquity.toLocaleString()}</strong></span>
          <span>DD: <strong className="text-rose-400">-{hoverData.point.drawdownPercent}%</strong></span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full h-[260px] bg-[#090d16] select-none cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
};
