import React, { useState } from 'react';
import { BacktestSettings, Candle, QuotePair, StrategyConfig, Timeframe } from '../types/trading';
import { runBacktest } from '../utils/strategyEngine';
import { Sparkles, Check, Flame, ArrowRight } from 'lucide-react';

interface ParameterOptimizerProps {
  candles: Candle[];
  strategy: StrategyConfig;
  settings: BacktestSettings;
  coin: string;
  pair: QuotePair;
  timeframe: Timeframe;
  onApplyParams: (newParams: Record<string, any>) => void;
}

interface OptimizationRow {
  label: string;
  params: Record<string, any>;
  netProfitPercent: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpe: number;
}

export const ParameterOptimizer: React.FC<ParameterOptimizerProps> = ({
  candles,
  strategy,
  settings,
  coin,
  pair,
  timeframe,
  onApplyParams,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<OptimizationRow[]>([]);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const runOptimizationMatrix = () => {
    setIsRunning(true);
    setAppliedIndex(null);

    // Run in a non-blocking timeout
    setTimeout(() => {
      try {
        const rows: OptimizationRow[] = [];

        if (strategy.id === 'EMA_CROSS') {
          const fastList = [5, 9, 12, 15, 20];
          const slowList = [21, 34, 50, 89, 100];

          for (const fast of fastList) {
            for (const slow of slowList) {
              if (fast >= slow) continue;
              const testStrat: StrategyConfig = {
                ...strategy,
                params: { fastPeriod: fast, slowPeriod: slow },
              };
              const res = runBacktest(candles, testStrat, settings, coin, pair, timeframe);
              rows.push({
                label: `EMA (${fast} / ${slow})`,
                params: { fastPeriod: fast, slowPeriod: slow },
                netProfitPercent: res.netProfitPercent,
                winRate: res.winRate,
                profitFactor: res.profitFactor,
                totalTrades: res.totalTrades,
                maxDrawdown: res.maxDrawdownPercent,
                sharpe: res.sharpeRatio,
              });
            }
          }
        } else if (strategy.id === 'RSI_REVERSION') {
          const periods = [7, 14, 21];
          const bands = [
            { oversold: 25, overbought: 75 },
            { oversold: 30, overbought: 70 },
            { oversold: 35, overbought: 65 },
          ];

          for (const p of periods) {
            for (const b of bands) {
              const testStrat: StrategyConfig = {
                ...strategy,
                params: { period: p, oversold: b.oversold, overbought: b.overbought },
              };
              const res = runBacktest(candles, testStrat, settings, coin, pair, timeframe);
              rows.push({
                label: `RSI(${p}) [${b.oversold}/${b.overbought}]`,
                params: { period: p, oversold: b.oversold, overbought: b.overbought },
                netProfitPercent: res.netProfitPercent,
                winRate: res.winRate,
                profitFactor: res.profitFactor,
                totalTrades: res.totalTrades,
                maxDrawdown: res.maxDrawdownPercent,
                sharpe: res.sharpeRatio,
              });
            }
          }
        } else if (strategy.id === 'SUPERTREND') {
          const periods = [7, 10, 14, 20];
          const mults = [1.5, 2.0, 3.0, 4.0];

          for (const p of periods) {
            for (const m of mults) {
              const testStrat: StrategyConfig = {
                ...strategy,
                params: { period: p, multiplier: m },
              };
              const res = runBacktest(candles, testStrat, settings, coin, pair, timeframe);
              rows.push({
                label: `Supertrend (${p}, ${m}x)`,
                params: { period: p, multiplier: m },
                netProfitPercent: res.netProfitPercent,
                winRate: res.winRate,
                profitFactor: res.profitFactor,
                totalTrades: res.totalTrades,
                maxDrawdown: res.maxDrawdownPercent,
                sharpe: res.sharpeRatio,
              });
            }
          }
        } else {
          // General sensitivity
          for (let k = 1; k <= 8; k++) {
            const testStrat: StrategyConfig = {
              ...strategy,
              params: { ...strategy.params },
            };
            const res = runBacktest(candles, testStrat, settings, coin, pair, timeframe);
            rows.push({
              label: `Preset Variant #${k}`,
              params: { ...strategy.params },
              netProfitPercent: res.netProfitPercent,
              winRate: res.winRate,
              profitFactor: res.profitFactor,
              totalTrades: res.totalTrades,
              maxDrawdown: res.maxDrawdownPercent,
              sharpe: res.sharpeRatio,
            });
          }
        }

        // Sort by Net Profit % descending
        rows.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
        setResults(rows);
      } finally {
        setIsRunning(false);
      }
    }, 100);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Parameter Sensitivity Optimizer
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Test parameter permutations across {coin}/{pair} ({timeframe}) to discover highest Sharpe and ROI.
          </p>
        </div>

        <button
          id="btn-run-optimization"
          onClick={runOptimizationMatrix}
          disabled={isRunning || candles.length === 0}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Flame className={`w-3.5 h-3.5 ${isRunning ? 'animate-bounce' : ''}`} />
          {isRunning ? 'Optimizing Matrix...' : 'Run Parameter Sweep'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Parameters</th>
                <th className="py-2.5 px-3">Net ROI %</th>
                <th className="py-2.5 px-3">Win Rate</th>
                <th className="py-2.5 px-3">Profit Factor</th>
                <th className="py-2.5 px-3">Sharpe</th>
                <th className="py-2.5 px-3">Max DD</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {results.slice(0, 8).map((row, idx) => {
                const isBest = idx === 0;
                const isApplied = appliedIndex === idx;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/30 transition-colors ${isBest ? 'bg-purple-950/20' : ''}`}
                  >
                    <td className="py-2 px-3 font-bold">
                      {isBest ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                          #1 BEST
                        </span>
                      ) : (
                        <span className="text-slate-500">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-200 font-semibold">{row.label}</td>
                    <td className={`py-2 px-3 font-bold ${row.netProfitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.netProfitPercent >= 0 ? '+' : ''}{row.netProfitPercent.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-slate-300">{row.winRate.toFixed(1)}% ({row.totalTrades}T)</td>
                    <td className="py-2 px-3 text-slate-300">{row.profitFactor > 50 ? '> 50' : row.profitFactor.toFixed(2)}</td>
                    <td className="py-2 px-3 text-cyan-400 font-semibold">{row.sharpe.toFixed(2)}</td>
                    <td className="py-2 px-3 text-amber-400">-{row.maxDrawdown.toFixed(2)}%</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => {
                          onApplyParams(row.params);
                          setAppliedIndex(idx);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                          isApplied
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3 h-3" />
                            Applied
                          </>
                        ) : (
                          <>
                            Apply
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
