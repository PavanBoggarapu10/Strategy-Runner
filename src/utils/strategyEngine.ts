import {
  BacktestResult,
  BacktestSettings,
  Candle,
  CustomRule,
  CustomRulesConfig,
  EquityPoint,
  QuotePair,
  RuleOperand,
  StrategyConfig,
  StrategySignal,
  Timeframe,
  Trade,
} from '../types/trading';
import {
  calculateAdaptiveEMA,
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateStochRSI,
  calculateSupertrend,
} from './indicators';
import {
  compilePineScriptToSimulator,
  DEFAULT_PINE_SCRIPT,
  FAST_SCALPER_PINE_SCRIPT,
  SUPERTREND_EMA_PINE_SCRIPT,
} from './pineScriptGenerator';
import {
  simulateLiquiditySweep,
  LIQUIDITY_SWEEP_PINE_SCRIPT,
} from './liquiditySweepEngine';

export const DEFAULT_CUSTOM_SCRIPT = `// Custom Quantitative Strategy Script (JavaScript)
// Available variables:
// - candle: { open, high, low, close, volume, time }
// - prevCandle: { open, high, low, close, volume, time }
// - indicators: { emaFast, emaSlow, rsi, macd: { macd, signal, histogram }, bollinger: { upper, middle, lower }, supertrend }
// - prevIndicators: previous bar indicators
// - position: null or { type: 'LONG'|'SHORT', entryPrice, unrealizedPnlPercent, durationBars }
// Return: 'BUY' | 'SELL' | 'HOLD'

// 1. Long Entry: Bullish EMA Crossover or oversold RSI bounce
const emaCrossover = prevIndicators && prevIndicators.emaFast <= prevIndicators.emaSlow && indicators.emaFast > indicators.emaSlow;
const rsiDip = indicators.rsi !== null && indicators.rsi < 38 && candle.close > candle.open;

if (emaCrossover || rsiDip) {
  return 'BUY';
}

// 2. Exit / Short: Bearish EMA Crossunder or overbought RSI
const emaCrossunder = prevIndicators && prevIndicators.emaFast >= prevIndicators.emaSlow && indicators.emaFast < indicators.emaSlow;
const rsiPeak = indicators.rsi !== null && indicators.rsi > 68;

if (emaCrossunder || rsiPeak) {
  return 'SELL';
}

return 'HOLD';`;

export const DEFAULT_CUSTOM_RULES: CustomRulesConfig = {
  buyLogic: 'OR',
  sellLogic: 'OR',
  buyRules: [
    {
      id: 'rule-buy-1',
      left: 'emaFast',
      operator: 'CROSS_ABOVE',
      rightType: 'INDICATOR',
      rightIndicator: 'emaSlow',
    },
    {
      id: 'rule-buy-2',
      left: 'rsi',
      operator: 'LESS_THAN',
      rightType: 'CONSTANT',
      rightConstant: 38,
    },
  ],
  sellRules: [
    {
      id: 'rule-sell-1',
      left: 'emaFast',
      operator: 'CROSS_BELOW',
      rightType: 'INDICATOR',
      rightIndicator: 'emaSlow',
    },
    {
      id: 'rule-sell-2',
      left: 'rsi',
      operator: 'GREATER_THAN',
      rightType: 'CONSTANT',
      rightConstant: 68,
    },
  ],
};

export const DEFAULT_BACKTEST_SETTINGS: BacktestSettings = {
  initialCapital: 10000,
  tradeDirection: 'BOTH',
  positionSizePercent: 100,
  leverage: 1,
  makerFeePercent: 0.04,
  takerFeePercent: 0.08,
  slippagePercent: 0.05,
  stopLossPercent: 0,
  takeProfitPercent: 0,
  trailingStopPercent: 0,
};

export const STRATEGY_PRESETS: StrategyConfig[] = [
  {
    id: 'FAST_SCALPER',
    name: '5M/15M/30M Fast Momentum Scalper (Quick TP & Exit)',
    description: 'High-expectancy momentum scalper engineered for 5m, 15m & 30m charts. Enters on 9/21 EMA pullback bounce with StochRSI reversal and volume confirmation, targeting 1:1.5+ R:R with fee-protected breakeven.',
    params: {
      fastEmaLen: 9,
      slowEmaLen: 21,
      trendEmaLen: 50,
      useTrendFilter: true,
      rsiLen: 14,
      stochLen: 14,
      smoothK: 3,
      smoothD: 3,
      oversoldThresh: 30,
      overboughtThresh: 70,
      useAtrTargets: true,
      atrLen: 14,
      atrMultTP: 2.6,
      atrMultSL: 1.8,
      quickTpPct: 2.5,
      stopLossPct: 1.6,
      enableQuickExit: false,
      enableBreakeven: true,
      breakevenAtPct: 60,
      useVolFilt: true,
      volMult: 1.0,
      useSrPatterns: true,
      srPivotLen: 5,
      srClearanceAtr: 0.8,
      srBounceConfirm: true,
      srStructuralTargets: true,
    },
    customPineScript: FAST_SCALPER_PINE_SCRIPT,
  },
  {
    id: 'SUPERTREND_EMA',
    name: 'BTCUSD Supertrend + EMA Trend Filter (1H)',
    description: 'TradingView v6 strategy combining Supertrend direction flips with 200 EMA trend filter and optional ADX momentum regime gating.',
    params: {
      atrPeriod: 10,
      factor: 1.8,
      emaLen: 200,
      adxLen: 14,
      adxSmooth: 14,
      adxThresh: 20,
      enableADX: false,
      enableSL: false,
      enableTP: false,
      slPct: 4.0,
      tpPct: 8.0,
    },
    customPineScript: SUPERTREND_EMA_PINE_SCRIPT,
  },
  {
    id: 'LIQUIDITY_SWEEP',
    name: 'Liquidity Sweep Reversal (Long & Short)',
    description: 'Institutional swing high/low liquidity sweep reversal. Detects false breakout wicks with volume surges, dynamic ATR stops beyond wicks, 1.5R take-profit, and automatic breakeven trailing.',
    params: {
      pivotLen: 7,
      maxAge: 150,
      minGapATR: 0.25,
      slAtrMult: 1.2,
      minRiskATR: 0.5,
      rrRatio: 1.5,
      useBreakeven: true,
      breakevenAtPct: 50,
      allowLongs: true,
      allowShorts: true,
      useVolFilt: true,
      volMult: 1.3,
      useWickFilt: true,
      minWickRatio: 1.5,
      useConfirm: true,
      useSession: false,
      sessWindow: '1200-1600',
    },
    customPineScript: LIQUIDITY_SWEEP_PINE_SCRIPT,
  },
  {
    id: 'GOLDEN_ALPHA',
    name: 'Crypto Golden Trend Alpha (Long & Short)',
    description: 'Institutional-grade bi-directional trend following combining 9/21 EMA crossover with 50 Macro EMA regime filter. Enters Long on golden cross above 50 EMA and enters Short on death cross below 50 EMA.',
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      macroTrendPeriod: 50,
    },
  },
  {
    id: 'EMA_CROSS',
    name: 'Dual EMA Crossover',
    description: 'Enters Long when Fast EMA crosses above Slow EMA; exits or enters Short when Fast crosses below.',
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
    },
  },
  {
    id: 'RSI_REVERSION',
    name: 'RSI Mean Reversion',
    description: 'Buys when RSI dips below oversold threshold; exits or shorts when RSI surges above overbought threshold.',
    params: {
      period: 14,
      oversold: 30,
      overbought: 70,
    },
  },
  {
    id: 'MACD_MOMENTUM',
    name: 'MACD Momentum Trend',
    description: 'Enters on MACD line crossing above Signal line with positive histogram; exits on bearish cross.',
    params: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
  },
  {
    id: 'BOLLINGER_BREAKOUT',
    name: 'Bollinger Bands Mean Reversion',
    description: 'Enters Long when price touches or dips under lower band; exits at the middle/upper band.',
    params: {
      period: 20,
      stdDev: 2,
      exitAtMiddle: true,
    },
  },
  {
    id: 'SUPERTREND',
    name: 'Supertrend Volatility Rider',
    description: 'Trend-following strategy guided by ATR envelope. Stays long during green trend, flips short/flat on red.',
    params: {
      period: 10,
      multiplier: 3,
    },
  },
  {
    id: 'GRID_TRADING',
    name: 'Dynamic Grid Scalper',
    description: 'Places geometric buy and sell grid limit orders across the Bollinger volatility channel.',
    params: {
      gridLevels: 5,
      channelPeriod: 20,
    },
  },
  {
    id: 'DCA_ACCUMULATION',
    name: 'Smart DCA Accumulator',
    description: 'Systematically accumulates position every N intervals with dynamic take-profit and dip-buying multiplier.',
    params: {
      intervalCandles: 10,
      takeProfit: 8,
      dipMultiplier: 1.5,
    },
  },
  {
    id: 'CUSTOM_RULES',
    name: 'Custom Condition Rule Builder',
    description: 'Build your own custom quantitative entry and exit rules using multi-indicator Boolean conditions.',
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customRules: DEFAULT_CUSTOM_RULES,
  },
  {
    id: 'CUSTOM_SCRIPT',
    name: 'Custom Strategy Code Sandbox',
    description: 'Write custom JavaScript trading logic with access to live candles, indicators, and active position metrics.',
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customScript: DEFAULT_CUSTOM_SCRIPT,
  },
  {
    id: 'PINE_SCRIPT',
    name: 'TradingView Pine Script (v5)',
    description: 'Execute native TradingView Pine Script v5 code directly in the backtester and export to TradingView.',
    params: {
      fastPeriod: 9,
      slowPeriod: 21,
      rsiPeriod: 14,
    },
    customPineScript: DEFAULT_PINE_SCRIPT,
  },
];

function getOperandValue(
  operand: RuleOperand,
  idx: number,
  candles: Candle[],
  indicators: any
): number | null {
  const c = candles[idx];
  if (!c) return null;
  switch (operand) {
    case 'close': return c.close;
    case 'open': return c.open;
    case 'high': return c.high;
    case 'low': return c.low;
    case 'volume': return c.volume;
    case 'rsi': return indicators.rsi?.[idx] ?? null;
    case 'emaFast': return indicators.emaFast?.[idx] ?? null;
    case 'emaSlow': return indicators.emaSlow?.[idx] ?? null;
    case 'macd': return indicators.macd?.macd?.[idx] ?? null;
    case 'macdSignal': return indicators.macd?.signal?.[idx] ?? null;
    case 'bbUpper': return indicators.bollinger?.upper?.[idx] ?? null;
    case 'bbLower': return indicators.bollinger?.lower?.[idx] ?? null;
    default: return null;
  }
}

function evaluateRule(
  rule: CustomRule,
  idx: number,
  candles: Candle[],
  indicators: any
): boolean {
  if (idx < 1) return false;
  const currLeft = getOperandValue(rule.left, idx, candles, indicators);
  const prevLeft = getOperandValue(rule.left, idx - 1, candles, indicators);

  const currRight = rule.rightType === 'CONSTANT'
    ? (rule.rightConstant ?? 0)
    : getOperandValue(rule.rightIndicator || 'close', idx, candles, indicators);
  const prevRight = rule.rightType === 'CONSTANT'
    ? (rule.rightConstant ?? 0)
    : getOperandValue(rule.rightIndicator || 'close', idx - 1, candles, indicators);

  if (currLeft === null || currRight === null) return false;

  switch (rule.operator) {
    case 'GREATER_THAN':
      return currLeft > currRight;
    case 'LESS_THAN':
      return currLeft < currRight;
    case 'CROSS_ABOVE':
      if (prevLeft === null || prevRight === null) return false;
      return prevLeft <= prevRight && currLeft > currRight;
    case 'CROSS_BELOW':
      if (prevLeft === null || prevRight === null) return false;
      return prevLeft >= prevRight && currLeft < currRight;
    default:
      return false;
  }
}

export function runBacktest(
  candles: Candle[],
  strategy: StrategyConfig,
  settings: BacktestSettings,
  symbol: string,
  pair: QuotePair,
  timeframe: Timeframe
): BacktestResult {
  if (!candles || candles.length < 2) {
    throw new Error('Not enough candle data to execute backtest (minimum 2 candles required).');
  }

  const closes = candles.map(c => c.close);
  const totalCandles = candles.length;
  const initialCapital = settings.initialCapital;
  let capital = initialCapital;

  // Compute indicators (always compute base indicators so custom scripts/rules have access)
  // Resolve strategy execution type (handles custom strategies with unique IDs, e.g. "custom_1726...")
  const executionType: string = strategy.baseType || (
    (strategy.id === 'FAST_SCALPER') ? 'FAST_SCALPER' :
    (strategy.id === 'SUPERTREND_EMA') ? 'PINE_SCRIPT' :
    (strategy.id === 'LIQUIDITY_SWEEP') ? 'LIQUIDITY_SWEEP' :
    (strategy.customPineScript && strategy.customPineScript.trim().length > 0) ? 'PINE_SCRIPT' :
    strategy.customRules ? 'CUSTOM_RULES' :
    (strategy.customScript && strategy.customScript.trim().length > 0) ? 'CUSTOM_SCRIPT' :
    strategy.id
  );

  const isScalper = executionType === 'FAST_SCALPER';
  const isCustom = executionType === 'CUSTOM_SCRIPT' ||
    executionType === 'CUSTOM_RULES' ||
    executionType === 'PINE_SCRIPT' ||
    Boolean(strategy.customPineScript) ||
    Boolean(strategy.customRules) ||
    Boolean(strategy.customScript) ||
    Boolean(strategy.isCustom);

  const params = strategy.params || (strategy as any).parameters || {};
  const emaFast = (executionType === 'EMA_CROSS' || executionType === 'GOLDEN_ALPHA' || isScalper || isCustom)
    ? calculateAdaptiveEMA(closes, Number(params.fastEmaLen || params.fastPeriod || 9))
    : undefined;
  const emaSlow = (executionType === 'EMA_CROSS' || executionType === 'GOLDEN_ALPHA' || isScalper || isCustom)
    ? calculateAdaptiveEMA(closes, Number(params.slowEmaLen || params.slowPeriod || 21))
    : undefined;
  const emaMacro = (executionType === 'GOLDEN_ALPHA' || isScalper || isCustom)
    ? calculateAdaptiveEMA(closes, Number(params.trendEmaLen || params.macroTrendPeriod || 50))
    : undefined;

  const stochRsi = (isScalper || isCustom)
    ? calculateStochRSI(
        closes,
        Number(params.rsiLen || 14),
        Number(params.stochLen || 14),
        Number(params.smoothK || 3),
        Number(params.smoothD || 3)
      )
    : undefined;

  const atr = (isScalper || executionType === 'LIQUIDITY_SWEEP' || executionType === 'SUPERTREND_EMA' || isCustom)
    ? calculateATR(candles, Number(params.atrLen || params.atrPeriod || 14))
    : undefined;

  const volSma = (isScalper || isCustom)
    ? calculateSMA(candles.map(c => c.volume), 20)
    : undefined;

  const rsi = (executionType === 'RSI_REVERSION' || isCustom)
    ? calculateRSI(closes, Number(params.period || 14))
    : undefined;

  const macd = (executionType === 'MACD_MOMENTUM' || isCustom)
    ? calculateMACD(
        closes,
        Number(params.fastPeriod || 12),
        Number(params.slowPeriod || 26),
        Number(params.signalPeriod || 9)
      )
    : undefined;

  const bollinger = (executionType === 'BOLLINGER_BREAKOUT' || executionType === 'GRID_TRADING' || isCustom)
    ? calculateBollingerBands(closes, Number(params.period || params.channelPeriod || 20), Number(params.stdDev || 2))
    : undefined;

  const supertrend = (executionType === 'SUPERTREND' || isCustom)
    ? calculateSupertrend(candles, Number(params.period || 10), Number(params.multiplier || 3))
    : undefined;

  const liquiditySweepSim = (executionType === 'LIQUIDITY_SWEEP')
    ? simulateLiquiditySweep(candles, params)
    : undefined;

  // Compile custom script if provided (supports Pine Script v5/v6 and JavaScript)
  let customScriptFn: ((candle: Candle, prevCandle: Candle, indicators: any, position: any, barIndex: number, prevIndicators?: any) => any) | null = null;
  if (executionType === 'PINE_SCRIPT' || Boolean(strategy.customPineScript)) {
    customScriptFn = compilePineScriptToSimulator(strategy.customPineScript || DEFAULT_PINE_SCRIPT, candles, params);
  } else if ((executionType === 'CUSTOM_SCRIPT' || Boolean(strategy.customScript)) && strategy.customScript) {
    try {
      customScriptFn = new Function(
        'candle',
        'prevCandle',
        'indicators',
        'position',
        'barIndex',
        'prevIndicators',
        `"use strict";
        try {
          ${strategy.customScript}
        } catch(e) {
          return 'HOLD';
        }`
      ) as any;
    } catch (err) {
      console.warn('Custom script syntax error:', err);
    }
  }

  // State
  interface ActivePosition {
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    entryTime: number;
    contracts: number;
    sizeUSD: number;
    highestPrice: number;
    lowestPrice: number;
    entryCandleIndex: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    breakevenTriggerPrice?: number;
    breakevenDone?: boolean;
  }

  let position: ActivePosition | null = null;
  const trades: Trade[] = [];
  const signals: StrategySignal[] = [];
  const equityCurve: EquityPoint[] = [];

  const feeRate = (settings.takerFeePercent + settings.slippagePercent) / 100;
  let peakCapital = initialCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;
  let totalFeesPaid = 0;
  let marketExposureCandles = 0;

  const firstPrice = candles[0].close;

  // Support & Resistance Dynamic Level Tracking (Bounded shelves for limited, clean dots)
  interface SRLevelRecord {
    price: number;
    startBarIndex: number;
    endBarIndex: number;
    type: 'SUPPORT' | 'RESISTANCE';
    touches: number;
    broken: boolean;
  }
  const rollingSupports: SRLevelRecord[] = [];
  const rollingResistances: SRLevelRecord[] = [];

  // Loop through candles
  for (let i = 1; i < totalCandles; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];

    let currentEquity = capital;

    // Update Dynamic S/R Levels (5-bar swing confirmation to keep dots limited and pristine)
    const srPivotLen = Math.max(3, Number(params.srPivotLen || 5));
    const pIdx = i - srPivotLen;
    if (pIdx >= srPivotLen) {
      let isPivH = true;
      let isPivL = true;
      const centerH = candles[pIdx].high;
      const centerL = candles[pIdx].low;
      const curAtr = (atr && atr[i]) ? atr[i]! : (candle.high - candle.low);

      for (let k = pIdx - srPivotLen; k <= i; k++) {
        if (k === pIdx) continue;
        if (candles[k].high > centerH) isPivH = false;
        if (candles[k].low < centerL) isPivL = false;
      }

      if (isPivH) {
        // Find existing non-broken resistance within 0.8 ATR to prevent dot clutter
        const existing = rollingResistances.find(r => !r.broken && Math.abs(r.price - centerH) < curAtr * 0.8);
        if (existing) {
          existing.touches++;
          existing.endBarIndex = Math.min(totalCandles - 1, i + 24);
        } else {
          rollingResistances.push({
            price: centerH,
            startBarIndex: pIdx,
            endBarIndex: Math.min(totalCandles - 1, pIdx + 22),
            type: 'RESISTANCE',
            touches: 1,
            broken: false,
          });
        }
      }

      if (isPivL) {
        // Find existing non-broken support within 0.8 ATR to prevent dot clutter
        const existing = rollingSupports.find(s => !s.broken && Math.abs(s.price - centerL) < curAtr * 0.8);
        if (existing) {
          existing.touches++;
          existing.endBarIndex = Math.min(totalCandles - 1, i + 24);
        } else {
          rollingSupports.push({
            price: centerL,
            startBarIndex: pIdx,
            endBarIndex: Math.min(totalCandles - 1, pIdx + 22),
            type: 'SUPPORT',
            touches: 1,
            broken: false,
          });
        }
      }
    }

    // Polarity Flip: Broken resistance becomes support; broken support becomes resistance
    const curAtrVal = (atr && atr[i]) ? atr[i]! : (candle.high - candle.low);
    for (const r of rollingResistances) {
      if (!r.broken && candle.close > r.price + (curAtrVal * 0.3)) {
        r.broken = true;
        r.endBarIndex = i; // Close resistance shelf at break
        if (r.touches >= 2) {
          rollingSupports.push({
            price: r.price,
            startBarIndex: i,
            endBarIndex: Math.min(totalCandles - 1, i + 20),
            type: 'SUPPORT',
            touches: 1,
            broken: false,
          });
        }
      }
    }
    for (const s of rollingSupports) {
      if (!s.broken && candle.close < s.price - (curAtrVal * 0.3)) {
        s.broken = true;
        s.endBarIndex = i; // Close support shelf at break
        if (s.touches >= 2) {
          rollingResistances.push({
            price: s.price,
            startBarIndex: i,
            endBarIndex: Math.min(totalCandles - 1, i + 20),
            type: 'RESISTANCE',
            touches: 1,
            broken: false,
          });
        }
      }
    }

    // Track market exposure if position is open
    if (position) {
      marketExposureCandles++;
    }

    // Check stop loss / take profit / trailing stop on active position
    if (position) {
      const isLong = position.type === 'LONG';
      // Update high/low
      if (candle.high > position.highestPrice) position.highestPrice = candle.high;
      if (candle.low < position.lowestPrice) position.lowestPrice = candle.low;

      let exitPrice: number | null = null;
      let exitReason: Trade['exitReason'] = 'SIGNAL';

      // 1. Check Liquidation (leverage)
      if (settings.leverage > 1) {
        const liqThreshold = 1 / settings.leverage;
        if (isLong && (candle.low <= position.entryPrice * (1 - liqThreshold))) {
          exitPrice = position.entryPrice * (1 - liqThreshold);
          exitReason = 'LIQUIDATION';
        } else if (!isLong && (candle.high >= position.entryPrice * (1 + liqThreshold))) {
          exitPrice = position.entryPrice * (1 + liqThreshold);
          exitReason = 'LIQUIDATION';
        }
      }

      // 2. Stop Loss (Dynamic per-trade or global % setting)
      if (!exitPrice) {
        if (position.stopLossPrice) {
          if (isLong && candle.low <= position.stopLossPrice) {
            exitPrice = Math.min(candle.open, position.stopLossPrice);
            exitReason = 'STOP_LOSS';
          } else if (!isLong && candle.high >= position.stopLossPrice) {
            exitPrice = Math.max(candle.open, position.stopLossPrice);
            exitReason = 'STOP_LOSS';
          }
        } else if (settings.stopLossPercent > 0) {
          const slDist = (settings.stopLossPercent / 100) / settings.leverage;
          if (isLong && candle.low <= position.entryPrice * (1 - slDist)) {
            exitPrice = Math.min(candle.open, position.entryPrice * (1 - slDist));
            exitReason = 'STOP_LOSS';
          } else if (!isLong && candle.high >= position.entryPrice * (1 + slDist)) {
            exitPrice = Math.max(candle.open, position.entryPrice * (1 + slDist));
            exitReason = 'STOP_LOSS';
          }
        }
      }

      // 3. Take Profit (Dynamic per-trade or global % setting)
      if (!exitPrice) {
        if (position.takeProfitPrice) {
          if (isLong && candle.high >= position.takeProfitPrice) {
            exitPrice = Math.max(candle.open, position.takeProfitPrice);
            exitReason = 'TAKE_PROFIT';
          } else if (!isLong && candle.low <= position.takeProfitPrice) {
            exitPrice = Math.min(candle.open, position.takeProfitPrice);
            exitReason = 'TAKE_PROFIT';
          }
        } else if (settings.takeProfitPercent > 0) {
          const tpDist = (settings.takeProfitPercent / 100) / settings.leverage;
          if (isLong && candle.high >= position.entryPrice * (1 + tpDist)) {
            exitPrice = Math.max(candle.open, position.entryPrice * (1 + tpDist));
            exitReason = 'TAKE_PROFIT';
          } else if (!isLong && candle.low <= position.entryPrice * (1 - tpDist)) {
            exitPrice = Math.min(candle.open, position.entryPrice * (1 - tpDist));
            exitReason = 'TAKE_PROFIT';
          }
        }
      }

      // 3b. Dynamic Breakeven Stop Movement (with fee protection buffer)
      if (position.breakevenTriggerPrice && !position.breakevenDone) {
        const feeBuffer = position.entryPrice * (feeRate * 2.2);
        if (isLong && candle.high >= position.breakevenTriggerPrice) {
          position.stopLossPrice = position.entryPrice + feeBuffer;
          position.breakevenDone = true;
        } else if (!isLong && candle.low <= position.breakevenTriggerPrice) {
          position.stopLossPrice = position.entryPrice - feeBuffer;
          position.breakevenDone = true;
        }
      }

      // 4. Trailing Stop
      if (!exitPrice && settings.trailingStopPercent > 0) {
        const trailDist = (settings.trailingStopPercent / 100) / settings.leverage;
        if (isLong) {
          const trailTrigger = position.highestPrice * (1 - trailDist);
          if (candle.low <= trailTrigger && position.highestPrice > position.entryPrice) {
            exitPrice = trailTrigger;
            exitReason = 'TRAILING_STOP';
          }
        } else {
          const trailTrigger = position.lowestPrice * (1 + trailDist);
          if (candle.high >= trailTrigger && position.lowestPrice < position.entryPrice) {
            exitPrice = trailTrigger;
            exitReason = 'TRAILING_STOP';
          }
        }
      }

      // Execute exit if triggered
      if (exitPrice !== null) {
        const grossPnl = isLong
          ? (exitPrice - position.entryPrice) * position.contracts
          : (position.entryPrice - exitPrice) * position.contracts;
        
        const exitFee = exitPrice * position.contracts * feeRate;
        totalFeesPaid += exitFee;
        const netTradePnl = grossPnl - exitFee;

        capital += (position.sizeUSD / settings.leverage) + netTradePnl;
        if (capital < 0) capital = 0;

        const maxRunup = isLong
          ? ((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage
          : ((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage;

        const maxDrawdown = isLong
          ? ((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage
          : ((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage;

        trades.push({
          id: trades.length + 1,
          type: position.type,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: candle.time,
          exitPrice: Number(exitPrice.toFixed(4)),
          size: Number(position.sizeUSD.toFixed(2)),
          contracts: Number(position.contracts.toFixed(6)),
          fee: Number(exitFee.toFixed(2)),
          pnl: Number(netTradePnl.toFixed(2)),
          pnlPercent: Number(((netTradePnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
          exitReason,
          maxRunup: Number(maxRunup.toFixed(2)),
          maxDrawdown: Number(maxDrawdown.toFixed(2)),
          durationCandles: i - position.entryCandleIndex,
        });

        position = null;
      }
    }

    // Evaluate Strategy Signal for entries / reversals
    let signal: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'CLOSE' | 'FLAT' = 'FLAT';
    let dynamicSL: number | undefined = undefined;
    let dynamicTP: number | undefined = undefined;
    let dynamicBE: number | undefined = undefined;
    let customSignalLabel: string | undefined = undefined;

    switch (executionType) {
      case 'FAST_SCALPER': {
        if (
          emaFast && emaSlow && emaMacro && stochRsi &&
          emaFast[i] !== null && emaSlow[i] !== null && emaMacro[i] !== null &&
          emaFast[i - 1] !== null && emaSlow[i - 1] !== null &&
          stochRsi.k[i] !== null && stochRsi.d[i] !== null &&
          stochRsi.k[i - 1] !== null && stochRsi.d[i - 1] !== null
        ) {
          const currK = stochRsi.k[i]!;
          const currD = stochRsi.d[i]!;
          const prevK = stochRsi.k[i - 1]!;
          const prevD = stochRsi.d[i - 1]!;

          const fastVal = emaFast[i]!;
          const slowVal = emaSlow[i]!;
          const macroVal = emaMacro[i]!;
          const prevFast = emaFast[i - 1]!;

          const useTrend = params.useTrendFilter !== false;
          const isBullTrend = !useTrend || (candle.close > macroVal && fastVal > slowVal);
          const isBearTrend = !useTrend || (candle.close < macroVal && fastVal < slowVal);

          const oversold = Number(params.oversoldThresh || 30);
          const overbought = Number(params.overboughtThresh || 70);

          const isStochCrossUp = prevK <= prevD && currK > currD;
          const isStochCrossDown = prevK >= prevD && currK < currD;

          // Volume Filter Check
          const useVol = params.useVolFilt !== false;
          const volMult = Number(params.volMult || 1.0);
          const avgVol = volSma ? volSma[i] : undefined;
          const volOk = !useVol || !avgVol || (candle.volume >= avgVol * volMult * 0.95);

          // Dynamic S/R Pattern Matching
          const useSr = params.useSrPatterns !== false;
          const currAtr = (atr && atr[i]) ? atr[i]! : (candle.high - candle.low);
          const srClearanceMult = Number(params.srClearanceAtr || 0.8);

          const unbrokenR = rollingResistances
            .filter(r => !r.broken && r.price > candle.close)
            .sort((a, b) => a.price - b.price);
          const unbrokenS = rollingSupports
            .filter(s => !s.broken && s.price < candle.close)
            .sort((a, b) => b.price - a.price);

          const nearestR = unbrokenR[0];
          const nearestS = unbrokenS[0];

          // S/R Pattern 1: Support Bounce (taps support within 0.45 ATR, holds, and prints bullish rejection)
          const isSupportBounce = Boolean(
            nearestS &&
            candle.low <= nearestS.price + (currAtr * 0.45) &&
            candle.close > nearestS.price &&
            candle.close > candle.open
          );

          // S/R Pattern 2: Resistance Rejection (taps resistance within 0.45 ATR, rejects, and prints bearish rejection)
          const isResistReject = Boolean(
            nearestR &&
            candle.high >= nearestR.price - (currAtr * 0.45) &&
            candle.close < nearestR.price &&
            candle.close < candle.open
          );

          // S/R Pattern 3: Room to Run / Clearance Filter
          const distToR = nearestR ? (nearestR.price - candle.close) : (currAtr * 10);
          const distToS = nearestS ? (candle.close - nearestS.price) : (currAtr * 10);
          const hasLongClearance = !useSr || (distToR >= currAtr * srClearanceMult);
          const hasShortClearance = !useSr || (distToS >= currAtr * srClearanceMult);

          // Quality Pullback Bounce confirmation:
          const isPullbackLong = candle.low <= fastVal * 1.003;
          const isCandleConfirmLong = candle.close > candle.open;
          const isSlopeUp = fastVal >= prevFast;

          const isPullbackShort = candle.high >= fastVal * 0.997;
          const isCandleConfirmShort = candle.close < candle.open;
          const isSlopeDown = fastVal <= prevFast;

          // Pullback entry trigger: K crosses D upward from oversold / downward from overbought
          const longTrigger = isStochCrossUp &&
            (prevK <= oversold || prevD <= oversold || currK <= oversold + 10) &&
            (isPullbackLong || isSupportBounce) &&
            isCandleConfirmLong &&
            isSlopeUp &&
            volOk &&
            hasLongClearance;

          const shortTrigger = isStochCrossDown &&
            (prevK >= overbought || prevD >= overbought || currK >= overbought - 10) &&
            (isPullbackShort || isResistReject) &&
            isCandleConfirmShort &&
            isSlopeDown &&
            volOk &&
            hasShortClearance;

          // Calculate Dynamic Take Profit and Stop Loss for scalping
          const useAtr = params.useAtrTargets !== false;
          const atrMultTP = Number(params.atrMultTP || 2.8);
          const atrMultSL = Number(params.atrMultSL || 1.8);
          const quickTpPct = Number(params.quickTpPct || 2.5) / 100;
          const slPct = Number(params.stopLossPct || 1.6) / 100;

          let tpDist = useAtr ? (currAtr * atrMultTP) : (candle.close * quickTpPct);
          let slDist = useAtr ? (currAtr * atrMultSL) : (candle.close * slPct);
          const beProgress = Number(params.breakevenAtPct || 60) / 100;

          // S/R Structural TP and SL anchoring
          if (useSr && params.srStructuralTargets !== false) {
            if (longTrigger) {
              if (nearestS && Math.abs(candle.close - nearestS.price) < currAtr * 2.5) {
                slDist = Math.max(candle.close - nearestS.price + (currAtr * 0.25), currAtr * 1.4);
              }
              if (nearestR) {
                tpDist = Math.min(distToR * 0.92, currAtr * 3.8);
                if (tpDist < slDist * 1.3) tpDist = slDist * 1.6;
              }
            } else if (shortTrigger) {
              if (nearestR && Math.abs(nearestR.price - candle.close) < currAtr * 2.5) {
                slDist = Math.max(nearestR.price - candle.close + (currAtr * 0.25), currAtr * 1.4);
              }
              if (nearestS) {
                tpDist = Math.min(distToS * 0.92, currAtr * 3.8);
                if (tpDist < slDist * 1.3) tpDist = slDist * 1.6;
              }
            }
          }

          if (longTrigger && isBullTrend && (!position || position.type === 'SHORT')) {
            signal = 'BUY';
            customSignalLabel = isSupportBounce ? 'LONG (S/R Bounce)' : 'SCALP LONG';
            dynamicTP = candle.close + tpDist;
            dynamicSL = candle.close - slDist;
            if (params.enableBreakeven !== false) {
              dynamicBE = candle.close + (tpDist * beProgress);
            }
          } else if (shortTrigger && isBearTrend && (!position || position.type === 'LONG')) {
            signal = 'SELL';
            customSignalLabel = isResistReject ? 'SHORT (S/R Reject)' : 'SCALP SHORT';
            dynamicTP = candle.close - tpDist;
            dynamicSL = candle.close + slDist;
            if (params.enableBreakeven !== false) {
              dynamicBE = candle.close - (tpDist * beProgress);
            }
          }

          // Smart Momentum Exhaustion Exit: Only exit if already up by at least 1.0x ATR profit
          if (params.enableQuickExit && position) {
            const minProfitDist = useAtr ? (currAtr * 1.0) : (position.entryPrice * 0.012);
            if (position.type === 'LONG') {
              if (candle.close >= position.entryPrice + minProfitDist && (currK >= 70 || prevK >= 70) && isStochCrossDown) {
                signal = 'CLOSE_LONG';
              }
            } else if (position.type === 'SHORT') {
              if (candle.close <= position.entryPrice - minProfitDist && (currK <= 30 || prevK <= 30) && isStochCrossUp) {
                signal = 'CLOSE_SHORT';
              }
            }
          }
        }
        break;
      }

      case 'LIQUIDITY_SWEEP': {
        if (liquiditySweepSim) {
          const sweepSig = liquiditySweepSim.signalsMap.get(i);
          if (sweepSig) {
            signal = sweepSig.signal;
            dynamicSL = sweepSig.sl;
            dynamicTP = sweepSig.tp;
            dynamicBE = sweepSig.beTrigger;
          }
        }
        break;
      }

      case 'GOLDEN_ALPHA': {
        if (
          emaFast && emaSlow && emaMacro &&
          emaFast[i] !== null && emaSlow[i] !== null && emaMacro[i] !== null &&
          emaFast[i - 1] !== null && emaSlow[i - 1] !== null
        ) {
          const prevFast = emaFast[i - 1]!;
          const prevSlow = emaSlow[i - 1]!;
          const currFast = emaFast[i]!;
          const currSlow = emaSlow[i]!;
          const macroVal = emaMacro[i]!;

          const isGoldenCross = prevFast <= prevSlow && currFast > currSlow;
          const isDeathCross = prevFast >= prevSlow && currFast < currSlow;

          if (isGoldenCross) {
            // Bullish Golden Cross: Open Long if above Macro Trend filter; otherwise close Short
            if (candle.close > macroVal) {
              signal = 'BUY';
            } else {
              signal = 'CLOSE_SHORT';
            }
          } else if (isDeathCross) {
            // Bearish Death Cross: Open Short if below Macro Trend filter; otherwise close Long
            if (candle.close < macroVal) {
              signal = 'SELL';
            } else {
              signal = 'CLOSE_LONG';
            }
          }
        }
        break;
      }

      case 'EMA_CROSS': {
        if (emaFast && emaSlow && emaFast[i] !== null && emaSlow[i] !== null && emaFast[i - 1] !== null && emaSlow[i - 1] !== null) {
          const prevFast = emaFast[i - 1]!;
          const prevSlow = emaSlow[i - 1]!;
          const currFast = emaFast[i]!;
          const currSlow = emaSlow[i]!;

          if (prevFast <= prevSlow && currFast > currSlow) {
            signal = 'BUY';
          } else if (prevFast >= prevSlow && currFast < currSlow) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'RSI_REVERSION': {
        if (rsi && rsi[i] !== null && rsi[i - 1] !== null) {
          const oversold = Number(strategy.params.oversold || 30);
          const overbought = Number(strategy.params.overbought || 70);
          const prevRSI = rsi[i - 1]!;
          const currRSI = rsi[i]!;

          if (prevRSI < oversold && currRSI >= oversold) {
            signal = 'BUY';
          } else if (prevRSI > overbought && currRSI <= overbought) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'MACD_MOMENTUM': {
        if (macd && macd.macd[i] !== null && macd.signal[i] !== null && macd.macd[i - 1] !== null && macd.signal[i - 1] !== null) {
          const prevM = macd.macd[i - 1]!;
          const prevS = macd.signal[i - 1]!;
          const currM = macd.macd[i]!;
          const currS = macd.signal[i]!;

          if (prevM <= prevS && currM > currS) {
            signal = 'BUY';
          } else if (prevM >= prevS && currM < currS) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'BOLLINGER_BREAKOUT': {
        if (bollinger && bollinger.lower[i] !== null && bollinger.upper[i] !== null) {
          const lower = bollinger.lower[i]!;
          const upper = bollinger.upper[i]!;
          const mid = bollinger.middle[i]!;

          if (candle.close < lower) {
            signal = 'BUY';
          } else if (candle.close > upper || (strategy.params.exitAtMiddle && candle.close > mid)) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'SUPERTREND': {
        if (supertrend && supertrend.trend[i] !== undefined && supertrend.trend[i - 1] !== undefined) {
          if (supertrend.trend[i - 1] === -1 && supertrend.trend[i] === 1) {
            signal = 'BUY';
          } else if (supertrend.trend[i - 1] === 1 && supertrend.trend[i] === -1) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'GRID_TRADING': {
        if (bollinger && bollinger.lower[i] !== null) {
          const spread = (bollinger.upper[i]! - bollinger.lower[i]!) / Number(strategy.params.gridLevels || 5);
          if (candle.close <= bollinger.lower[i]! + spread) {
            signal = 'BUY';
          } else if (candle.close >= bollinger.upper[i]! - spread) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'DCA_ACCUMULATION': {
        const interval = Number(strategy.params.intervalCandles || 10);
        if (i % interval === 0) {
          signal = 'BUY';
        }
        break;
      }

      case 'CUSTOM_RULES': {
        const rules = strategy.customRules || DEFAULT_CUSTOM_RULES;
        const indicatorsObj = { emaFast, emaSlow, rsi, macd, bollinger, supertrend };

        // Evaluate Buy Rules
        if (rules.buyRules && rules.buyRules.length > 0) {
          const buyMatches = rules.buyRules.map(r => evaluateRule(r, i, candles, indicatorsObj));
          const buyTriggered = rules.buyLogic === 'AND'
            ? buyMatches.every(Boolean)
            : buyMatches.some(Boolean);
          if (buyTriggered) {
            signal = 'BUY';
          }
        }

        // Evaluate Sell Rules
        if (rules.sellRules && rules.sellRules.length > 0 && signal !== 'BUY') {
          const sellMatches = rules.sellRules.map(r => evaluateRule(r, i, candles, indicatorsObj));
          const sellTriggered = rules.sellLogic === 'AND'
            ? sellMatches.every(Boolean)
            : sellMatches.some(Boolean);
          if (sellTriggered) {
            signal = 'SELL';
          }
        }
        break;
      }

      case 'PINE_SCRIPT':
      case 'CUSTOM_SCRIPT': {
        if (customScriptFn) {
          try {
            const currentIndicators = {
              emaFast: emaFast?.[i] ?? null,
              emaSlow: emaSlow?.[i] ?? null,
              rsi: rsi?.[i] ?? null,
              macd: {
                macd: macd?.macd?.[i] ?? null,
                signal: macd?.signal?.[i] ?? null,
                histogram: macd?.histogram?.[i] ?? null,
              },
              bollinger: {
                upper: bollinger?.upper?.[i] ?? null,
                middle: bollinger?.middle?.[i] ?? null,
                lower: bollinger?.lower?.[i] ?? null,
              },
              supertrend: {
                trend: supertrend?.trend?.[i] ?? null,
                line: supertrend?.line?.[i] ?? null,
              },
            };

            const prevIndicators = {
              emaFast: emaFast?.[i - 1] ?? null,
              emaSlow: emaSlow?.[i - 1] ?? null,
              rsi: rsi?.[i - 1] ?? null,
              macd: {
                macd: macd?.macd?.[i - 1] ?? null,
                signal: macd?.signal?.[i - 1] ?? null,
                histogram: macd?.histogram?.[i - 1] ?? null,
              },
              bollinger: {
                upper: bollinger?.upper?.[i - 1] ?? null,
                middle: bollinger?.middle?.[i - 1] ?? null,
                lower: bollinger?.lower?.[i - 1] ?? null,
              },
              supertrend: {
                trend: supertrend?.trend?.[i - 1] ?? null,
                line: supertrend?.line?.[i - 1] ?? null,
              },
            };

            const posSummary = position ? {
              type: position.type,
              entryPrice: position.entryPrice,
              unrealizedPnlPercent: position.type === 'LONG'
                ? ((candle.close - position.entryPrice) / position.entryPrice) * 100 * settings.leverage
                : ((position.entryPrice - candle.close) / position.entryPrice) * 100 * settings.leverage,
              durationBars: i - position.entryCandleIndex,
            } : null;

            const scriptResult = customScriptFn(candle, prevCandle, currentIndicators, posSummary, i, prevIndicators);
            if (typeof scriptResult === 'string') {
              const resUpper = scriptResult.toUpperCase().trim();
              if (resUpper === 'BUY' || resUpper === 'LONG') signal = 'BUY';
              else if (resUpper === 'SELL' || resUpper === 'SHORT') signal = 'SELL';
              else if (resUpper === 'CLOSE_LONG' || resUpper === 'EXIT_LONG') signal = 'CLOSE_LONG';
              else if (resUpper === 'CLOSE_SHORT' || resUpper === 'EXIT_SHORT') signal = 'CLOSE_SHORT';
              else if (resUpper === 'CLOSE' || resUpper === 'EXIT' || resUpper === 'FLAT') signal = 'CLOSE';
            } else if (scriptResult && typeof scriptResult === 'object') {
              const resUpper = ((scriptResult as any).signal || 'HOLD').toUpperCase().trim();
              if (resUpper === 'BUY' || resUpper === 'LONG') signal = 'BUY';
              else if (resUpper === 'SELL' || resUpper === 'SHORT') signal = 'SELL';
              else if (resUpper === 'CLOSE_LONG' || resUpper === 'EXIT_LONG') signal = 'CLOSE_LONG';
              else if (resUpper === 'CLOSE_SHORT' || resUpper === 'EXIT_SHORT') signal = 'CLOSE_SHORT';
              else if (resUpper === 'CLOSE' || resUpper === 'EXIT' || resUpper === 'FLAT') signal = 'CLOSE';

              if ((scriptResult as any).stopLossPrice) dynamicSL = (scriptResult as any).stopLossPrice;
              if ((scriptResult as any).takeProfitPrice) dynamicTP = (scriptResult as any).takeProfitPrice;
              if ((scriptResult as any).breakevenTriggerPrice) dynamicBE = (scriptResult as any).breakevenTriggerPrice;
            }
          } catch (e) {
            // Safe evaluation error containment
          }
        }
        break;
      }
    }

    // Track raw strategy signals
    if (signal === 'BUY' || signal === 'SELL' || signal === 'CLOSE_LONG' || signal === 'CLOSE_SHORT' || signal === 'CLOSE') {
      signals.push({
        time: candle.time,
        type: signal === 'BUY' ? 'BUY' : 'SELL',
        price: candle.close,
        barIndex: i,
        label: customSignalLabel || (signal === 'BUY' ? 'BUY' : (signal === 'SELL' ? 'SHORT' : (executionType === 'FAST_SCALPER' ? 'QUICK EXIT' : 'EXIT'))),
      });
    }

    // Process Signal Action
    if (signal === 'CLOSE_LONG' || (signal === 'CLOSE' && position?.type === 'LONG')) {
      if (position && position.type === 'LONG') {
        const grossPnl = (candle.close - position.entryPrice) * position.contracts;
        const exitFee = candle.close * position.contracts * feeRate;
        totalFeesPaid += exitFee;
        const netPnl = grossPnl - exitFee;
        capital += (position.sizeUSD / settings.leverage) + netPnl;

        trades.push({
          id: trades.length + 1,
          type: 'LONG',
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: candle.time,
          exitPrice: candle.close,
          size: Number(position.sizeUSD.toFixed(2)),
          contracts: Number(position.contracts.toFixed(6)),
          fee: Number(exitFee.toFixed(2)),
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((netPnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
          exitReason: 'SIGNAL',
          maxRunup: Number((((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          maxDrawdown: Number((((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          durationCandles: i - position.entryCandleIndex,
        });
        position = null;
      }
    } else if (signal === 'CLOSE_SHORT' || (signal === 'CLOSE' && position?.type === 'SHORT')) {
      if (position && position.type === 'SHORT') {
        const grossPnl = (position.entryPrice - candle.close) * position.contracts;
        const exitFee = candle.close * position.contracts * feeRate;
        totalFeesPaid += exitFee;
        const netPnl = grossPnl - exitFee;
        capital += (position.sizeUSD / settings.leverage) + netPnl;

        trades.push({
          id: trades.length + 1,
          type: 'SHORT',
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: candle.time,
          exitPrice: candle.close,
          size: Number(position.sizeUSD.toFixed(2)),
          contracts: Number(position.contracts.toFixed(6)),
          fee: Number(exitFee.toFixed(2)),
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((netPnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
          exitReason: 'SIGNAL',
          maxRunup: Number((((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          maxDrawdown: Number((((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          durationCandles: i - position.entryCandleIndex,
        });
        position = null;
      }
    } else if (signal === 'BUY') {
      // If currently Short, close Short
      if (position && position.type === 'SHORT') {
        const grossPnl = (position.entryPrice - candle.close) * position.contracts;
        const exitFee = candle.close * position.contracts * feeRate;
        totalFeesPaid += exitFee;
        const netPnl = grossPnl - exitFee;
        capital += (position.sizeUSD / settings.leverage) + netPnl;

        trades.push({
          id: trades.length + 1,
          type: 'SHORT',
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: candle.time,
          exitPrice: candle.close,
          size: Number(position.sizeUSD.toFixed(2)),
          contracts: Number(position.contracts.toFixed(6)),
          fee: Number(exitFee.toFixed(2)),
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((netPnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
          exitReason: 'SIGNAL',
          maxRunup: Number((((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          maxDrawdown: Number((((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          durationCandles: i - position.entryCandleIndex,
        });
        position = null;
      }

      // Open Long if flat and allowed
      if (!position && (settings.tradeDirection === 'BOTH' || settings.tradeDirection === 'LONG_ONLY') && capital > 10) {
        const alloc = capital * (settings.positionSizePercent / 100);
        const entryFee = alloc * settings.leverage * feeRate;
        totalFeesPaid += entryFee;
        const margin = alloc - entryFee;
        capital -= alloc;

        const effectiveSize = margin * settings.leverage;
        const contracts = effectiveSize / candle.close;

        position = {
          type: 'LONG',
          entryPrice: candle.close,
          entryTime: candle.time,
          contracts,
          sizeUSD: effectiveSize,
          highestPrice: candle.close,
          lowestPrice: candle.close,
          entryCandleIndex: i,
          stopLossPrice: dynamicSL,
          takeProfitPrice: dynamicTP,
          breakevenTriggerPrice: dynamicBE,
          breakevenDone: false,
        };
      }
    } else if (signal === 'SELL') {
      // If currently Long, close Long
      if (position && position.type === 'LONG') {
        const grossPnl = (candle.close - position.entryPrice) * position.contracts;
        const exitFee = candle.close * position.contracts * feeRate;
        totalFeesPaid += exitFee;
        const netPnl = grossPnl - exitFee;
        capital += (position.sizeUSD / settings.leverage) + netPnl;

        trades.push({
          id: trades.length + 1,
          type: 'LONG',
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: candle.time,
          exitPrice: candle.close,
          size: Number(position.sizeUSD.toFixed(2)),
          contracts: Number(position.contracts.toFixed(6)),
          fee: Number(exitFee.toFixed(2)),
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((netPnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
          exitReason: 'SIGNAL',
          maxRunup: Number((((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          maxDrawdown: Number((((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
          durationCandles: i - position.entryCandleIndex,
        });
        position = null;
      }

      // Open Short if flat and allowed
      if (!position && (settings.tradeDirection === 'BOTH' || settings.tradeDirection === 'SHORT_ONLY') && capital > 10) {
        const alloc = capital * (settings.positionSizePercent / 100);
        const entryFee = alloc * settings.leverage * feeRate;
        totalFeesPaid += entryFee;
        const margin = alloc - entryFee;
        capital -= alloc;

        const effectiveSize = margin * settings.leverage;
        const contracts = effectiveSize / candle.close;

        position = {
          type: 'SHORT',
          entryPrice: candle.close,
          entryTime: candle.time,
          contracts,
          sizeUSD: effectiveSize,
          highestPrice: candle.close,
          lowestPrice: candle.close,
          entryCandleIndex: i,
          stopLossPrice: dynamicSL,
          takeProfitPrice: dynamicTP,
          breakevenTriggerPrice: dynamicBE,
          breakevenDone: false,
        };
      }
    }

    // Compute instantaneous unrealized equity
    let unrealized = 0;
    if (position) {
      unrealized = position.type === 'LONG'
        ? (candle.close - position.entryPrice) * position.contracts
        : (position.entryPrice - candle.close) * position.contracts;
      currentEquity = capital + (position.sizeUSD / settings.leverage) + unrealized;
    } else {
      currentEquity = capital;
    }

    if (currentEquity > peakCapital) {
      peakCapital = currentEquity;
    }
    const currentDrawdownAmount = peakCapital - currentEquity;
    const currentDrawdownPercent = (currentDrawdownAmount / peakCapital) * 100;
    if (currentDrawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = currentDrawdownPercent;
      maxDrawdownAmount = currentDrawdownAmount;
    }

    // Benchmark equity (Buy and hold 100% of initial capital in the asset)
    const benchmarkEquity = initialCapital * (candle.close / firstPrice);

    equityCurve.push({
      time: candle.time,
      equity: Number(currentEquity.toFixed(2)),
      drawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
      benchmarkEquity: Number(benchmarkEquity.toFixed(2)),
    });
  }

  // Close any open position at final candle
  if (position) {
    const finalCandle = candles[candles.length - 1];
    const isLong = position.type === 'LONG';
    const grossPnl = isLong
      ? (finalCandle.close - position.entryPrice) * position.contracts
      : (position.entryPrice - finalCandle.close) * position.contracts;
    const exitFee = finalCandle.close * position.contracts * feeRate;
    totalFeesPaid += exitFee;
    const netPnl = grossPnl - exitFee;
    capital += (position.sizeUSD / settings.leverage) + netPnl;

    trades.push({
      id: trades.length + 1,
      type: position.type,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime: finalCandle.time,
      exitPrice: finalCandle.close,
      size: Number(position.sizeUSD.toFixed(2)),
      contracts: Number(position.contracts.toFixed(6)),
      fee: Number(exitFee.toFixed(2)),
      pnl: Number(netPnl.toFixed(2)),
      pnlPercent: Number(((netPnl / (position.sizeUSD / settings.leverage)) * 100).toFixed(2)),
      exitReason: 'END_OF_DATA',
      maxRunup: Number((((position.highestPrice - position.entryPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
      maxDrawdown: Number((((position.entryPrice - position.lowestPrice) / position.entryPrice) * 100 * settings.leverage).toFixed(2)),
      durationCandles: candles.length - 1 - position.entryCandleIndex,
    });
  }

  // Final performance calculations
  const finalCapital = capital;
  const netProfit = finalCapital - initialCapital;
  const netProfitPercent = (netProfit / initialCapital) * 100;
  
  const lastPrice = candles[candles.length - 1].close;
  const buyAndHoldReturnPercent = ((lastPrice - firstPrice) / firstPrice) * 100;
  const alphaPercent = netProfitPercent - buyAndHoldReturnPercent;

  const totalTrades = trades.length;
  const winningTradesList = trades.filter(t => t.pnl > 0);
  const losingTradesList = trades.filter(t => t.pnl < 0);
  const winningTrades = winningTradesList.length;
  const losingTrades = losingTradesList.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const grossProfit = winningTradesList.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(losingTradesList.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

  const avgTradePnlPercent = totalTrades > 0
    ? trades.reduce((acc, t) => acc + t.pnlPercent, 0) / totalTrades
    : 0;

  const avgWinPnlPercent = winningTrades > 0
    ? winningTradesList.reduce((acc, t) => acc + t.pnlPercent, 0) / winningTrades
    : 0;

  const avgLossPnlPercent = losingTrades > 0
    ? Math.abs(losingTradesList.reduce((acc, t) => acc + t.pnlPercent, 0) / losingTrades)
    : 0;

  const riskRewardRatio = avgLossPnlPercent > 0 ? avgWinPnlPercent / avgLossPnlPercent : avgWinPnlPercent > 0 ? 10 : 0;

  const avgTradeDurationCandles = totalTrades > 0
    ? trades.reduce((acc, t) => acc + t.durationCandles, 0) / totalTrades
    : 0;

  // Annualized Sharpe Ratio estimation based on return variance
  const tradeReturns = trades.map(t => t.pnlPercent / 100);
  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (tradeReturns.length > 2) {
    const meanReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
    const variance = tradeReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (tradeReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    const downsideVariance = tradeReturns
      .filter(r => r < 0)
      .reduce((a, b) => a + Math.pow(b, 2), 0) / Math.max(1, losingTrades);
    const downsideStdDev = Math.sqrt(downsideVariance);

    // Scaling factor (approx trades per year depending on timeframe)
    const annualFactor = Math.min(252, Math.max(12, Math.sqrt(totalTrades * 12)));
    sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * annualFactor : 0;
    sortinoRatio = downsideStdDev > 0 ? (meanReturn / downsideStdDev) * annualFactor : 0;
  }

  const calmarRatio = maxDrawdownPercent > 0 ? (netProfitPercent / maxDrawdownPercent) : 0;

  // Strategy Efficiency Diagnostics
  const marketExposurePercent = totalCandles > 1
    ? (marketExposureCandles / (totalCandles - 1)) * 100
    : 0;

  const expectancyPerTrade = totalTrades > 0
    ? (grossProfit - grossLoss) / totalTrades
    : 0;

  const profitToMaxDrawdownRatio = maxDrawdownPercent > 0
    ? netProfitPercent / maxDrawdownPercent
    : netProfitPercent > 0 ? 10 : 0;

  const feeDragPercent = grossProfit > 0
    ? (totalFeesPaid / grossProfit) * 100
    : 0;

  // Efficiency Sub-Scores (0 to 100)
  let profitabilityScore = 50;
  if (netProfitPercent > 0) {
    profitabilityScore = Math.min(100, 50 + (netProfitPercent * 1.5) + (alphaPercent > 0 ? 15 : -10));
  } else {
    profitabilityScore = Math.max(0, 50 + (netProfitPercent * 2));
  }

  let riskControlScore = 50;
  if (maxDrawdownPercent < 5) riskControlScore = 95;
  else if (maxDrawdownPercent < 12) riskControlScore = 80;
  else if (maxDrawdownPercent < 20) riskControlScore = 65;
  else if (maxDrawdownPercent < 35) riskControlScore = 40;
  else riskControlScore = Math.max(10, 100 - (maxDrawdownPercent * 2));

  if (profitToMaxDrawdownRatio > 3) riskControlScore = Math.min(100, riskControlScore + 10);

  const winRateScore = Math.min(100, winRate * 1.5);
  const pfScore = profitFactor >= 2 ? 100 : profitFactor >= 1.5 ? 80 : profitFactor >= 1.1 ? 60 : 30;
  const sharpeBonus = sharpeRatio > 1.5 ? 20 : sharpeRatio > 0.8 ? 10 : sharpeRatio < 0 ? -20 : 0;
  const consistencyScore = Math.max(0, Math.min(100, (winRateScore * 0.5 + pfScore * 0.5) + sharpeBonus));

  let executionQualityScore = 70;
  if (feeDragPercent > 40) executionQualityScore -= 35;
  else if (feeDragPercent > 20) executionQualityScore -= 15;
  else executionQualityScore += 15;

  if (riskRewardRatio >= 2) executionQualityScore += 15;
  else if (riskRewardRatio < 0.8) executionQualityScore -= 20;

  executionQualityScore = Math.max(0, Math.min(100, executionQualityScore));

  // Weighted Composite Score
  const rawEfficiency = (
    profitabilityScore * 0.30 +
    riskControlScore * 0.30 +
    consistencyScore * 0.25 +
    executionQualityScore * 0.15
  );
  const efficiencyScore = Number(Math.max(0, Math.min(100, rawEfficiency)).toFixed(1));

  let efficiencyGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'C';
  if (efficiencyScore >= 88) efficiencyGrade = 'A+';
  else if (efficiencyScore >= 75) efficiencyGrade = 'A';
  else if (efficiencyScore >= 60) efficiencyGrade = 'B';
  else if (efficiencyScore >= 45) efficiencyGrade = 'C';
  else if (efficiencyScore >= 30) efficiencyGrade = 'D';
  else efficiencyGrade = 'F';

  return {
    symbol,
    pair,
    timeframe,
    strategyName: strategy.name,
    candlesCount: candles.length,
    startTime: candles[0].time,
    endTime: candles[candles.length - 1].time,

    initialCapital,
    finalCapital: Number(finalCapital.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netProfitPercent: Number(netProfitPercent.toFixed(2)),
    buyAndHoldReturnPercent: Number(buyAndHoldReturnPercent.toFixed(2)),
    alphaPercent: Number(alphaPercent.toFixed(2)),

    totalTrades,
    winningTrades,
    losingTrades,
    winRate: Number(winRate.toFixed(1)),

    profitFactor: Number(profitFactor.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    maxDrawdownAmount: Number(maxDrawdownAmount.toFixed(2)),

    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    sortinoRatio: Number(sortinoRatio.toFixed(2)),
    calmarRatio: Number(calmarRatio.toFixed(2)),

    avgTradePnlPercent: Number(avgTradePnlPercent.toFixed(2)),
    avgWinPnlPercent: Number(avgWinPnlPercent.toFixed(2)),
    avgLossPnlPercent: Number(avgLossPnlPercent.toFixed(2)),
    riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
    avgTradeDurationCandles: Number(avgTradeDurationCandles.toFixed(1)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),

    // Efficiency Metrics
    efficiencyScore,
    efficiencyGrade,
    marketExposurePercent: Number(marketExposurePercent.toFixed(1)),
    expectancyPerTrade: Number(expectancyPerTrade.toFixed(2)),
    profitToMaxDrawdownRatio: Number(profitToMaxDrawdownRatio.toFixed(2)),
    feeDragPercent: Number(feeDragPercent.toFixed(1)),
    efficiencyBreakdown: {
      profitability: Math.round(profitabilityScore),
      riskControl: Math.round(riskControlScore),
      consistency: Math.round(consistencyScore),
      executionQuality: Math.round(executionQualityScore),
    },

    trades,
    signals,
    equityCurve,
    indicators: {
      emaFast,
      emaSlow,
      rsi,
      macd,
      bollinger,
      supertrend,
      supportLevels: rollingSupports.map(s => ({
        price: Number(s.price.toFixed(2)),
        touches: s.touches,
        startBarIndex: s.startBarIndex,
        endBarIndex: s.endBarIndex,
      })),
      resistanceLevels: rollingResistances.map(r => ({
        price: Number(r.price.toFixed(2)),
        touches: r.touches,
        startBarIndex: r.startBarIndex,
        endBarIndex: r.endBarIndex,
      })),
      srShelves: [
        ...rollingSupports.map(s => ({ price: Number(s.price.toFixed(2)), type: 'SUPPORT' as const, startBarIndex: s.startBarIndex, endBarIndex: s.endBarIndex, touches: s.touches })),
        ...rollingResistances.map(r => ({ price: Number(r.price.toFixed(2)), type: 'RESISTANCE' as const, startBarIndex: r.startBarIndex, endBarIndex: r.endBarIndex, touches: r.touches })),
      ].sort((a, b) => a.startBarIndex - b.startBarIndex),
    },
  };
}
