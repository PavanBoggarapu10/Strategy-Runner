import { Candle } from '../types/trading';

/**
 * Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  let sum = 0;
  
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period) return result;
  
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for the first valid period
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += data[i];
  }
  let prevEMA = initialSum / period;
  result[period - 1] = prevEMA;
  
  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i] - prevEMA) * multiplier + prevEMA;
    result[i] = currentEMA;
    prevEMA = currentEMA;
  }
  
  return result;
}

/**
 * Continuous Adaptive Exponential Moving Average (TradingView compliant)
 * Seeds from available bars to prevent null dropouts on large periods (e.g. 200 EMA)
 */
export function calculateAdaptiveEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  if (data.length === 0) return result;
  const p = Math.max(1, Math.round(period));
  const multiplier = 2 / (p + 1);
  let prev = data[0];
  result[0] = prev;
  for (let i = 1; i < data.length; i++) {
    prev = (data[i] - prev) * multiplier + prev;
    result[i] = prev;
  }
  return result;
}

/**
 * Continuous Adaptive Simple Moving Average
 */
export function calculateAdaptiveSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  if (data.length === 0) return result;
  const p = Math.max(1, Math.round(period));
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= p) {
      sum -= data[i - p];
      result[i] = sum / p;
    } else {
      result[i] = sum / (i + 1);
    }
  }
  return result;
}

/**
 * Relative Strength Index (Wilder's Smoothing)
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // First period changes
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const currentRS = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + currentRS));
    }
  }

  return rsi;
}

/**
 * MACD: 12 EMA, 26 EMA, 9 Signal EMA
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);
  
  const macdLine: (number | null)[] = new Array(closes.length).fill(null);
  const validMacdValues: number[] = [];
  const validMacdIndices: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      const val = (emaFast[i] as number) - (emaSlow[i] as number);
      macdLine[i] = val;
      validMacdValues.push(val);
      validMacdIndices.push(i);
    }
  }

  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  if (validMacdValues.length >= signalPeriod) {
    const signalSub = calculateEMA(validMacdValues, signalPeriod);
    for (let k = 0; k < signalSub.length; k++) {
      const origIndex = validMacdIndices[k];
      signalLine[origIndex] = signalSub[k];
      if (macdLine[origIndex] !== null && signalSub[k] !== null) {
        histogram[origIndex] = (macdLine[origIndex] as number) - (signalSub[k] as number);
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateSMA(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const mid = middle[i];
    if (mid === null) continue;

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(closes[j] - mid, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = mid + stdDevMultiplier * stdDev;
    lower[i] = mid - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): (number | null)[] {
  const atr: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return atr;

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    tr.push(trueRange);
  }

  // Initial ATR is simple average of TR
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += tr[i];
  }
  let currentATR = initialSum / period;
  atr[period - 1] = currentATR;

  for (let i = period; i < candles.length; i++) {
    currentATR = (currentATR * (period - 1) + tr[i]) / period;
    atr[i] = currentATR;
  }

  return atr;
}

/**
 * Supertrend Indicator
 */
export function calculateSupertrend(
  candles: Candle[],
  period: number = 10,
  multiplier: number = 3
): {
  trend: (1 | -1)[];
  line: (number | null)[];
} {
  const atr = calculateATR(candles, period);
  const trend: (1 | -1)[] = new Array(candles.length).fill(1);
  const line: (number | null)[] = new Array(candles.length).fill(null);

  let inUptrend = true;
  let upperBand = 0;
  let lowerBand = 0;

  for (let i = 0; i < candles.length; i++) {
    const currentATR = atr[i];
    if (currentATR === null) {
      line[i] = null;
      continue;
    }

    const hl2 = (candles[i].high + candles[i].low) / 2;
    const basicUpper = hl2 + multiplier * currentATR;
    const basicLower = hl2 - multiplier * currentATR;

    if (i === 0 || atr[i - 1] === null) {
      upperBand = basicUpper;
      lowerBand = basicLower;
      line[i] = inUptrend ? lowerBand : upperBand;
      trend[i] = inUptrend ? 1 : -1;
      continue;
    }

    const prevClose = candles[i - 1].close;
    upperBand = (basicUpper < upperBand || prevClose > upperBand) ? basicUpper : upperBand;
    lowerBand = (basicLower > lowerBand || prevClose < lowerBand) ? basicLower : lowerBand;

    const close = candles[i].close;

    if (inUptrend && close < lowerBand) {
      inUptrend = false;
      upperBand = basicUpper;
    } else if (!inUptrend && close > upperBand) {
      inUptrend = true;
      lowerBand = basicLower;
    }

    trend[i] = inUptrend ? 1 : -1;
    line[i] = inUptrend ? lowerBand : upperBand;
  }

  return { trend, line };
}

/**
 * Wilder's Relative Moving Average (ta.rma in Pine Script)
 */
export function calculateRMA(data: number[], period: number = 14): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length === 0) return result;
  const p = Math.max(1, Math.round(period));
  let sum = 0;
  const initCount = Math.min(data.length, p);
  for (let i = 0; i < initCount; i++) sum += data[i];
  let prev = sum / initCount;
  result[initCount - 1] = prev;
  for (let i = initCount; i < data.length; i++) {
    prev = (prev * (p - 1) + data[i]) / p;
    result[i] = prev;
  }
  // Fill initial bars for stability
  for (let i = 0; i < initCount - 1; i++) {
    result[i] = result[initCount - 1];
  }
  return result;
}

/**
 * Average Directional Index (ADX) & Directional Movement Index (DMI)
 */
export function calculateDMI(candles: Candle[], period: number = 14): {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
} {
  const n = candles.length;
  const adx = new Array(n).fill(25);
  const plusDI = new Array(n).fill(25);
  const minusDI = new Array(n).fill(25);
  if (n < 2) return { adx, plusDI, minusDI };

  const tr: number[] = [candles[0].high - candles[0].low];
  const dmPlus: number[] = [0];
  const dmMinus: number[] = [0];

  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    dmPlus.push(up > down && up > 0 ? up : 0);
    dmMinus.push(down > up && down > 0 ? down : 0);
    const trueRange = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    tr.push(trueRange);
  }

  const smoothTR = calculateRMA(tr, period);
  const smoothPlus = calculateRMA(dmPlus, period);
  const smoothMinus = calculateRMA(dmMinus, period);

  const dx: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const sTR = smoothTR[i];
    const pDI = sTR > 0 ? (100 * smoothPlus[i]) / sTR : 0;
    const mDI = sTR > 0 ? (100 * smoothMinus[i]) / sTR : 0;
    plusDI[i] = pDI;
    minusDI[i] = mDI;
    const sum = pDI + mDI;
    dx[i] = sum > 0 ? (100 * Math.abs(pDI - mDI)) / sum : 0;
  }

  const smoothADX = calculateRMA(dx, period);
  for (let i = 0; i < n; i++) {
    adx[i] = smoothADX[i] !== undefined && !isNaN(smoothADX[i]) ? smoothADX[i] : 25;
  }
  return { adx, plusDI, minusDI };
}

export function calculateADX(candles: Candle[], period: number = 14): number[] {
  return calculateDMI(candles, period).adx;
}

/**
 * Stochastic RSI (%K and %D)
 * Standard TradingView formulation: ta.stoch(rsi, rsi, rsi, stochPeriod) smoothed with SMA
 */
export function calculateStochRSI(
  closes: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const rsi = calculateRSI(closes, rsiPeriod);
  const n = closes.length;
  const rawStoch: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (i < rsiPeriod + stochPeriod) continue;
    let minRsi = Infinity;
    let maxRsi = -Infinity;
    let hasNull = false;

    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const val = rsi[j];
      if (val === null || isNaN(val)) {
        hasNull = true;
        break;
      }
      if (val < minRsi) minRsi = val;
      if (val > maxRsi) maxRsi = val;
    }

    if (hasNull || minRsi === maxRsi) {
      rawStoch[i] = 50;
    } else {
      const currentRsi = rsi[i];
      if (currentRsi !== null) {
        rawStoch[i] = ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
      }
    }
  }

  // Smooth K
  const k: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < smoothK - 1) continue;
    let sum = 0;
    let count = 0;
    for (let j = i - smoothK + 1; j <= i; j++) {
      if (rawStoch[j] !== null) {
        sum += rawStoch[j]!;
        count++;
      }
    }
    if (count === smoothK) {
      k[i] = sum / smoothK;
    }
  }

  // Smooth D (SMA of K)
  const d: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < smoothD - 1) continue;
    let sum = 0;
    let count = 0;
    for (let j = i - smoothD + 1; j <= i; j++) {
      if (k[j] !== null) {
        sum += k[j]!;
        count++;
      }
    }
    if (count === smoothD) {
      d[i] = sum / smoothD;
    }
  }

  return { k, d };
}
