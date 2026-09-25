import { Candle } from '../types/trading';
import { calculateATR, calculateAdaptiveSMA } from './indicators';

export interface LiquiditySweepParams {
  pivotLen: number;
  maxAge: number;
  minGapATR: number;
  slAtrMult: number;
  minRiskATR: number;
  rrRatio: number;
  useBreakeven: boolean;
  breakevenAtPct: number;
  allowLongs: boolean;
  allowShorts: boolean;
  useVolFilt: boolean;
  volMult: number;
  useWickFilt: boolean;
  minWickRatio: number;
  useConfirm: boolean;
  useSession: boolean;
  sessWindow: string;
}

export const DEFAULT_LIQUIDITY_SWEEP_PARAMS: LiquiditySweepParams = {
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
};

export const LIQUIDITY_SWEEP_PINE_SCRIPT = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
//@version=6
strategy("Liquidity Sweep Reversal Strategy", "Sweep Reversal Strategy", overlay = true,
     max_boxes_count = 600, max_lines_count = 500, max_labels_count = 300,
     default_qty_type = strategy.percent_of_equity, default_qty_value = 10,
     initial_capital = 10000, currency = currency.USD,
     commission_type = strategy.commission.percent, commission_value = 0.04,
     slippage = 1)

// ── Colors ───────────────────────────────────────────────────────────────
color DATA    = #DBDBDB
color HEADERS = #808080
color BG      = #161616
color BORDERS = #2E2E2E
color GOLD    = #FFD700
color POS     = #089981
color NEG     = #F23645
color ACCENT  = #2962FF

// ── Inputs: Core Strategy ─────────────────────────────────────────────────
var string grpCore  = "Swing & Level Settings"
int   pivotLen      = input.int(7, "Pivot Lookback (L/R bars)", minval = 2, maxval = 30, group = grpCore, tooltip = "Left and right bar count required to confirm a swing high or low pivot.")
int   maxAge        = input.int(150, "Level Max Age (bars)", minval = 20, maxval = 500, group = grpCore, tooltip = "Unswept levels expire and are removed after this many bars.")
float minGapATR     = input.float(0.25, "Min Level Spacing (x ATR)", minval = 0.0, step = 0.05, group = grpCore, tooltip = "Prevents clustering. New levels closer than this distance to an existing level are ignored.")

// ── Inputs: Trade Management ──────────────────────────────────────────────
var string grpTrade = "Trade Management"
float slAtrMult     = input.float(1.2, "Stop Loss (x ATR beyond wick)", minval = 0.1, step = 0.1, group = grpTrade, tooltip = "SL buffer beyond the extreme of the sweep wick, measured in ATRs.")
float minRiskATR    = input.float(0.5, "Min Stop Distance (x ATR)", minval = 0.0, step = 0.1, group = grpTrade, tooltip = "Filters trades where the stop is too tight relative to ATR.")
float rrRatio       = input.float(1.5, "Reward:Risk Ratio", minval = 0.5, step = 0.25, group = grpTrade, tooltip = "Target distance as a multiple of risk.")
bool  useBreakeven  = input.bool(true, "Move Stop to Breakeven", group = grpTrade, tooltip = "Advances the stop to the entry price once price reaches a specified progress toward TP.")
float breakevenAtPct = input.float(50.0, "Breakeven Trigger (% to TP)", minval = 10.0, maxval = 90.0, step = 5.0, group = grpTrade, tooltip = "Percentage of distance to TP required before moving stop to breakeven.")
bool  allowLongs    = input.bool(true, "Allow Longs (sweep-low)", group = grpTrade)
bool  allowShorts   = input.bool(true, "Allow Shorts (sweep-high)", group = grpTrade)

// ── Inputs: Filters ───────────────────────────────────────────────────────
var string grpFilt  = "Filters & Confirmation"
bool  useVolFilt    = input.bool(true, "Require Volume Spike on Sweep", group = grpFilt, tooltip = "Requires sweep bar volume to exceed the 20-period volume SMA by a multiplier.")
float volMult       = input.float(1.3, "Volume SMA Multiplier", minval = 1.0, step = 0.1, group = grpFilt)
bool  useWickFilt   = input.bool(true, "Require Strong Rejection Wick", group = grpFilt, tooltip = "Requires the rejection wick to be at least N times the size of the candle body.")
float minWickRatio  = input.float(1.5, "Min Wick:Body Ratio", minval = 0.5, step = 0.1, group = grpFilt)
bool  useConfirm    = input.bool(true, "Require Next-Bar Confirmation", group = grpFilt, tooltip = "Delays entry by one bar. Long requires close above midpoint of sweep wick; short requires close below midpoint.")
bool  useSession    = input.bool(false, "Restrict to Session Window", group = grpFilt, tooltip = "Only permit new entries inside designated hours. Default off for 24/7 crypto.")
string sessWindow   = input.session("1200-1600", "Session (Exchange TZ)", group = grpFilt)

// ── Indicators ────────────────────────────────────────────────────────────
float atr    = ta.atr(14)
float volSMA = ta.sma(volume, 20)

// ── Types & Variables ─────────────────────────────────────────────────────
type Level
    float price
    int   bar
    bool  isHigh

var Level[] highs = array.new<Level>()
var Level[] lows  = array.new<Level>()

tooClose(float px, Level[] arr) =>
    bool closeMatch = false
    if array.size(arr) > 0
        for i = 0 to array.size(arr) - 1
            Level lv = array.get(arr, i)
            if math.abs(lv.price - px) < atr * minGapATR
                closeMatch := true
                break
    closeMatch

// ── Pivot Detection ───────────────────────────────────────────────────────
float pivH = ta.pivothigh(high, pivotLen, pivotLen)
float pivL = ta.pivotlow(low, pivotLen, pivotLen)

if not na(pivH) and not tooClose(pivH, highs)
    array.push(highs, Level.new(pivH, bar_index - pivotLen, true))

if not na(pivL) and not tooClose(pivL, lows)
    array.push(lows, Level.new(pivL, bar_index - pivotLen, false))

// ── Sweep Evaluation ──────────────────────────────────────────────────────
bool sweepHighSignal = false
bool sweepLowSignal  = false
float sweepHighWick  = high
float sweepLowWick   = low

if array.size(highs) > 0
    for i = array.size(highs) - 1 to 0
        Level lv = array.get(highs, i)
        bool wicked = high > lv.price and close < lv.price
        float body  = math.abs(close - open)
        float wick  = high - math.max(close, open)
        bool wickOK = not useWickFilt or (body > 0 and wick / body >= minWickRatio) or (body == 0 and wick > 0)
        bool volOK  = not useVolFilt or volume > volSMA * volMult
        bool aged   = (bar_index - lv.bar) > maxAge

        if wicked and volOK and wickOK
            sweepHighSignal := true
            sweepHighWick   := math.max(sweepHighWick, high)
            array.remove(highs, i)
        else if aged
            array.remove(highs, i)

if array.size(lows) > 0
    for i = array.size(lows) - 1 to 0
        Level lv = array.get(lows, i)
        bool wicked = low < lv.price and close > lv.price
        float body  = math.abs(close - open)
        float wick  = math.min(close, open) - low
        bool wickOK = not useWickFilt or (body > 0 and wick / body >= minWickRatio) or (body == 0 and wick > 0)
        bool volOK  = not useVolFilt or volume > volSMA * volMult
        bool aged   = (bar_index - lv.bar) > maxAge

        if wicked and volOK and wickOK
            sweepLowSignal := true
            sweepLowWick   := math.min(sweepLowWick, low)
            array.remove(lows, i)
        else if aged
            array.remove(lows, i)

// ── Confirmation & Entry ──────────────────────────────────────────────────
var bool pendingLong   = false
var bool pendingShort  = false
var float pendingWick  = na
var float pendingMid   = na

bool sessionOK = not useSession or not na(time(timeframe.period, sessWindow))
bool doLong    = false
bool doShort   = false
float wickLvl  = na

if strategy.position_size == 0
    if useConfirm
        if pendingLong and close > pendingMid and allowLongs and sessionOK
            doLong  := true
            wickLvl := pendingWick
        if pendingShort and close < pendingMid and allowShorts and sessionOK
            doShort := true
            wickLvl := pendingWick
        pendingLong  := false
        pendingShort := false

        if sweepLowSignal
            pendingLong  := true
            pendingWick  := sweepLowWick
            pendingMid   := (sweepLowWick + close) / 2.0
        if sweepHighSignal
            pendingShort := true
            pendingWick  := sweepHighWick
            pendingMid   := (sweepHighWick + close) / 2.0
    else
        if sweepLowSignal and allowLongs and sessionOK
            doLong  := true
            wickLvl := sweepLowWick
        if sweepHighSignal and allowShorts and sessionOK
            doShort := true
            wickLvl := sweepHighWick

// ── Trade Management & Orders ─────────────────────────────────────────────
var float activeSL    = na
var float activeTP    = na
var float activeEntry = na
var bool  beDone      = false

if doLong or doShort
    bool isLong   = doLong
    float sl      = isLong ? wickLvl - atr * slAtrMult : wickLvl + atr * slAtrMult
    float risk    = isLong ? close - sl : sl - close
    bool qualifies = risk >= atr * minRiskATR

    if qualifies
        float tp = isLong ? close + risk * rrRatio : close - risk * rrRatio
        activeSL    := sl
        activeTP    := tp
        activeEntry := close
        beDone      := false

        strategy.entry(isLong ? "Long" : "Short", isLong ? strategy.long : strategy.short)
        strategy.exit(isLong ? "Exit Long" : "Exit Short", from_entry = isLong ? "Long" : "Short", stop = sl, limit = tp)

if strategy.position_size != 0 and useBreakeven and not beDone and not na(activeEntry)
    bool inLong = strategy.position_size > 0
    float trigger = inLong ? activeEntry + (activeTP - activeEntry) * (breakevenAtPct / 100.0) : activeEntry - (activeEntry - activeTP) * (breakevenAtPct / 100.0)
    if (inLong and high >= trigger) or (not inLong and low <= trigger)
        activeSL := activeEntry
        beDone   := true
        strategy.exit(inLong ? "Exit Long" : "Exit Short", from_entry = inLong ? "Long" : "Short", stop = activeEntry, limit = activeTP)

plotshape(sweepLowSignal, title = "Sweep Low Signal", location = location.belowbar, color = color.green, style = shape.triangleup, size = size.small, text = "SWEEP LOW")
plotshape(sweepHighSignal, title = "Sweep High Signal", location = location.abovebar, color = color.red, style = shape.triangledown, size = size.small, text = "SWEEP HIGH")
`;

/**
 * Checks if a Pine Script string describes a Liquidity Sweep Reversal strategy
 */
export function isLiquiditySweepScript(pineCode: string): boolean {
  if (!pineCode) return false;
  const codeLower = pineCode.toLowerCase();
  return (
    codeLower.includes('liquidity sweep') ||
    codeLower.includes('sweep reversal') ||
    (codeLower.includes('pivothigh') && codeLower.includes('pivotlow')) ||
    (codeLower.includes('sweephigh') && codeLower.includes('sweeplow')) ||
    (codeLower.includes('pendinglong') && codeLower.includes('pendingshort'))
  );
}

/**
 * Parses user input parameters dynamically from Pine Script code lines
 */
export function extractLiquiditySweepParams(pineCode: string): LiquiditySweepParams {
  const params: LiquiditySweepParams = { ...DEFAULT_LIQUIDITY_SWEEP_PARAMS };
  if (!pineCode) return params;

  const lines = pineCode.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    const parseNum = (regex: RegExp): number | null => {
      const m = line.match(regex);
      if (m && m[1]) {
        const val = parseFloat(m[1]);
        return isNaN(val) ? null : val;
      }
      return null;
    };

    const parseBool = (regex: RegExp): boolean | null => {
      const m = line.match(regex);
      if (m && m[1]) {
        return m[1].toLowerCase() === 'true';
      }
      return null;
    };

    const parseStr = (regex: RegExp): string | null => {
      const m = line.match(regex);
      if (m && m[1]) {
        return m[1].trim().replace(/^["']|["']$/g, '');
      }
      return null;
    };

    // pivotLen
    if (/pivotLen\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.int)?\s*\(\s*([0-9]+)/i);
      if (val !== null) params.pivotLen = Math.max(2, Math.round(val));
    }
    // maxAge
    if (/maxAge\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.int)?\s*\(\s*([0-9]+)/i);
      if (val !== null) params.maxAge = Math.max(10, Math.round(val));
    }
    // minGapATR
    if (/minGapATR\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.minGapATR = val;
    }
    // slAtrMult
    if (/slAtrMult\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.slAtrMult = val;
    }
    // minRiskATR
    if (/minRiskATR\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.minRiskATR = val;
    }
    // rrRatio
    if (/rrRatio\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.rrRatio = val;
    }
    // useBreakeven
    if (/useBreakeven\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.useBreakeven = val;
    }
    // breakevenAtPct
    if (/breakevenAtPct\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.breakevenAtPct = val;
    }
    // allowLongs
    if (/allowLongs\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.allowLongs = val;
    }
    // allowShorts
    if (/allowShorts\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.allowShorts = val;
    }
    // useVolFilt
    if (/useVolFilt\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.useVolFilt = val;
    }
    // volMult
    if (/volMult\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.volMult = val;
    }
    // useWickFilt
    if (/useWickFilt\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.useWickFilt = val;
    }
    // minWickRatio
    if (/minWickRatio\s*=/i.test(line)) {
      const val = parseNum(/input(?:\.float)?\s*\(\s*([0-9\.]+)/i);
      if (val !== null) params.minWickRatio = val;
    }
    // useConfirm
    if (/useConfirm\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.useConfirm = val;
    }
    // useSession
    if (/useSession\s*=/i.test(line)) {
      const val = parseBool(/input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (val !== null) params.useSession = val;
    }
    // sessWindow
    if (/sessWindow\s*=/i.test(line)) {
      const val = parseStr(/input(?:\.session)?\s*\(\s*["']([^"']+)["']/i);
      if (val !== null) params.sessWindow = val;
    }
  }

  return params;
}

export interface SweepSignal {
  signal: 'BUY' | 'SELL';
  sl: number;
  tp: number;
  beTrigger: number;
  wickLvl: number;
  risk: number;
}

export interface SweepSimulationResult {
  signalsMap: Map<number, SweepSignal>;
  highLevels: { price: number; bar: number }[];
  lowLevels: { price: number; bar: number }[];
  sweptHighBars: number[];
  sweptLowBars: number[];
}

/**
 * High-performance stateful simulation of Liquidity Sweep Reversal Strategy on candles.
 * Implements precise swing pivot detection, level management, rejection wicks,
 * volume spikes, confirmation bar delays, ATR stop loss beyond wicks, risk-reward take-profit,
 * and breakeven trailing.
 */
export function simulateLiquiditySweep(
  candles: Candle[],
  customParams?: Partial<LiquiditySweepParams>
): SweepSimulationResult {
  const p: LiquiditySweepParams = {
    ...DEFAULT_LIQUIDITY_SWEEP_PARAMS,
    ...(customParams || {}),
  };

  const signalsMap = new Map<number, SweepSignal>();
  const highLevels: { price: number; bar: number }[] = [];
  const lowLevels: { price: number; bar: number }[] = [];
  const sweptHighBars: number[] = [];
  const sweptLowBars: number[] = [];

  if (!candles || candles.length < p.pivotLen * 2 + 5) {
    return { signalsMap, highLevels, lowLevels, sweptHighBars, sweptLowBars };
  }

  const atrs = calculateATR(candles, 14);
  const volSmas = calculateAdaptiveSMA(candles.map((c) => c.volume), 20);

  interface Level {
    price: number;
    bar: number;
  }
  const highs: Level[] = [];
  const lows: Level[] = [];

  let pendingLong = false;
  let pendingShort = false;
  let pendingWick = 0;
  let pendingMid = 0;

  // Session time parsing
  let sessionStartHour = 12;
  let sessionEndHour = 16;
  if (p.sessWindow) {
    const sessMatch = p.sessWindow.match(/([0-9]{2})[0-9]{2}-([0-9]{2})[0-9]{2}/);
    if (sessMatch) {
      sessionStartHour = parseInt(sessMatch[1], 10);
      sessionEndHour = parseInt(sessMatch[2], 10);
    }
  }

  for (let i = p.pivotLen * 2; i < candles.length; i++) {
    const c = candles[i];
    const atr = atrs[i] || Math.max(c.high - c.low, 1);
    const volSma = volSmas[i] || c.volume;

    // 1. Pivot Detection at bar (i - pivotLen)
    const pIdx = i - p.pivotLen;
    if (pIdx >= p.pivotLen) {
      let isPivH = true;
      let isPivL = true;
      const centerH = candles[pIdx].high;
      const centerL = candles[pIdx].low;

      for (let k = pIdx - p.pivotLen; k <= i; k++) {
        if (k === pIdx) continue;
        if (candles[k].high > centerH) isPivH = false;
        if (candles[k].low < centerL) isPivL = false;
      }

      if (isPivH) {
        const isDuplicate = highs.some((lv) => Math.abs(lv.price - centerH) < atr * p.minGapATR);
        if (!isDuplicate) {
          highs.push({ price: centerH, bar: pIdx });
          highLevels.push({ price: centerH, bar: pIdx });
        }
      }

      if (isPivL) {
        const isDuplicate = lows.some((lv) => Math.abs(lv.price - centerL) < atr * p.minGapATR);
        if (!isDuplicate) {
          lows.push({ price: centerL, bar: pIdx });
          lowLevels.push({ price: centerL, bar: pIdx });
        }
      }
    }

    // 2. Sweep Evaluation on Highs
    let sweepHighSignal = false;
    let sweepLowSignal = false;
    let sweepHighWick = c.high;
    let sweepLowWick = c.low;

    for (let hi = highs.length - 1; hi >= 0; hi--) {
      const lv = highs[hi];
      const wicked = c.high > lv.price && c.close < lv.price;
      const body = Math.abs(c.close - c.open);
      const wickSz = c.high - Math.max(c.close, c.open);
      const wickOK = !p.useWickFilt || (body > 0 && wickSz / body >= p.minWickRatio) || (body === 0 && wickSz > 0);
      const volOK = !p.useVolFilt || c.volume > volSma * p.volMult;
      const aged = i - lv.bar > p.maxAge;

      if (wicked && volOK && wickOK) {
        sweepHighSignal = true;
        sweepHighWick = Math.max(sweepHighWick, c.high);
        sweptHighBars.push(i);
        highs.splice(hi, 1);
      } else if (aged) {
        highs.splice(hi, 1);
      }
    }

    // 3. Sweep Evaluation on Lows
    for (let li = lows.length - 1; li >= 0; li--) {
      const lv = lows[li];
      const wicked = c.low < lv.price && c.close > lv.price;
      const body = Math.abs(c.close - c.open);
      const wickSz = Math.min(c.close, c.open) - c.low;
      const wickOK = !p.useWickFilt || (body > 0 && wickSz / body >= p.minWickRatio) || (body === 0 && wickSz > 0);
      const volOK = !p.useVolFilt || c.volume > volSma * p.volMult;
      const aged = i - lv.bar > p.maxAge;

      if (wicked && volOK && wickOK) {
        sweepLowSignal = true;
        sweepLowWick = Math.min(sweepLowWick, c.low);
        sweptLowBars.push(i);
        lows.splice(li, 1);
      } else if (aged) {
        lows.splice(li, 1);
      }
    }

    // 4. Session Check
    let sessionOK = true;
    if (p.useSession) {
      const d = new Date(c.time);
      const h = d.getUTCHours();
      sessionOK = sessionStartHour <= sessionEndHour
        ? h >= sessionStartHour && h < sessionEndHour
        : h >= sessionStartHour || h < sessionEndHour;
    }

    // 5. Entry & Confirmation Logic
    let doLong = false;
    let doShort = false;
    let wickLvl = 0;

    if (p.useConfirm) {
      if (pendingLong && c.close > pendingMid && p.allowLongs && sessionOK) {
        doLong = true;
        wickLvl = pendingWick;
      }
      if (pendingShort && c.close < pendingMid && p.allowShorts && sessionOK) {
        doShort = true;
        wickLvl = pendingWick;
      }
      pendingLong = false;
      pendingShort = false;

      if (sweepLowSignal) {
        pendingLong = true;
        pendingWick = sweepLowWick;
        pendingMid = (sweepLowWick + c.close) / 2.0;
      }
      if (sweepHighSignal) {
        pendingShort = true;
        pendingWick = sweepHighWick;
        pendingMid = (sweepHighWick + c.close) / 2.0;
      }
    } else {
      if (sweepLowSignal && p.allowLongs && sessionOK) {
        doLong = true;
        wickLvl = sweepLowWick;
      }
      if (sweepHighSignal && p.allowShorts && sessionOK) {
        doShort = true;
        wickLvl = sweepHighWick;
      }
    }

    // 6. Trade Level Calculation
    if (doLong || doShort) {
      const isLong = doLong;
      const sl = isLong ? wickLvl - atr * p.slAtrMult : wickLvl + atr * p.slAtrMult;
      const risk = isLong ? c.close - sl : sl - c.close;
      const qualifies = risk >= atr * p.minRiskATR;

      if (qualifies) {
        const tp = isLong ? c.close + risk * p.rrRatio : c.close - risk * p.rrRatio;
        const beTrigger = isLong
          ? c.close + (tp - c.close) * (p.breakevenAtPct / 100.0)
          : c.close - (c.close - tp) * (p.breakevenAtPct / 100.0);

        signalsMap.set(i, {
          signal: isLong ? 'BUY' : 'SELL',
          sl,
          tp,
          beTrigger,
          wickLvl,
          risk,
        });
      }
    }
  }

  return { signalsMap, highLevels, lowLevels, sweptHighBars, sweptLowBars };
}
