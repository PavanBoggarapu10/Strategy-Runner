import {
  BacktestSettings,
  Candle,
  CustomRule,
  CustomRulesConfig,
  RuleOperand,
  RuleOperator,
  StrategyConfig,
  StrategyType,
} from '../types/trading';
import {
  calculateAdaptiveEMA,
  calculateAdaptiveSMA,
  calculateBollingerBands,
  calculateMACD,
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateDMI,
  calculateRMA,
  calculateSupertrend,
} from './indicators';
import {
  isLiquiditySweepScript,
  extractLiquiditySweepParams,
  simulateLiquiditySweep,
  LIQUIDITY_SWEEP_PINE_SCRIPT,
} from './liquiditySweepEngine';

export {
  isLiquiditySweepScript,
  extractLiquiditySweepParams,
  simulateLiquiditySweep,
  LIQUIDITY_SWEEP_PINE_SCRIPT,
};

export const DEFAULT_PINE_SCRIPT = `//@version=5
strategy("Crypto Golden Trend Alpha (Long & Short)", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

// === USER INPUT PARAMETERS ===
fastLength  = input.int(9, title="Fast EMA Period", minval=1)
slowLength  = input.int(21, title="Slow EMA Period", minval=1)
macroLength = input.int(50, title="Macro Trend EMA Period", minval=1)

// === TECHNICAL INDICATORS ===
emaFast  = ta.ema(close, fastLength)
emaSlow  = ta.ema(close, slowLength)
emaMacro = ta.ema(close, macroLength)

// === ENTRY & EXIT LOGIC ===
// 1. Long Entry: Bullish Golden Cross confirmed by Macro Bull Filter
longCondition = ta.crossover(emaFast, emaSlow) and close > emaMacro

// 2. Short Entry: Bearish Death Cross confirmed by Macro Bear Filter
shortCondition = ta.crossunder(emaFast, emaSlow) and close < emaMacro

// 3. Structural Reversal Exits
exitLongCondition  = ta.crossunder(emaFast, emaSlow)
exitShortCondition = ta.crossover(emaFast, emaSlow)

// === ORDER EXECUTION ===
if (longCondition)
    strategy.entry("Long", strategy.long)

if (exitLongCondition)
    strategy.close("Long")

if (shortCondition)
    strategy.entry("Short", strategy.short)

if (exitShortCondition)
    strategy.close("Short")

// === VISUAL CHARTS & SIGNALS ===
plot(emaFast, title="Fast EMA", color=color.new(#06b6d4, 0), linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.new(#f59e0b, 0), linewidth=2)
plot(emaMacro, title="Macro 50 EMA", color=color.new(#a855f7, 0), linewidth=2)
plotshape(longCondition, title="Long Entry Signal", location=location.belowbar, color=color.new(#10b981, 0), style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Short Entry Signal", location=location.abovebar, color=color.new(#f43f5e, 0), style=shape.triangledown, size=size.small, text="SHORT")
`;

export const SUPERTREND_EMA_PINE_SCRIPT = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © blitz_locked

//@version=6
strategy("BTCUSD Supertrend + EMA Trend Filter (1H)", overlay=true,
     initial_capital=10000,
     default_qty_type=strategy.percent_of_equity, default_qty_value=25,
     commission_type=strategy.commission.percent, commission_value=0.075,
     slippage=1)

//              ╔════════════════════════════════╗              //
//              ║      USER-DEFINED SETTINGS     ║              //
//              ╚════════════════════════════════╝              //

g_strategy = '════════ Strategy Settings ════════'
g_adx      = '════════ ADX Filter ════════'
g_visual   = '════════ Visual Settings ════════'

atrPeriod   = input.int(10, title="Supertrend ATR Length", group=g_strategy)
factor      = input.float(1.8, title="Supertrend Factor", step=0.1, group=g_strategy)

emaLen      = input.int(200, title="EMA Trend Filter Length", group=g_strategy)

enableSL    = input.bool(false, title="Enable Stop Loss", group=g_strategy)
enableTP    = input.bool(false, title="Enable Take Profit", group=g_strategy)
slPct       = input.float(4.0, title="Stop Loss %", step=0.1, group=g_strategy) / 100
tpPct       = input.float(8.0, title="Take Profit %", step=0.1, group=g_strategy) / 100

enableADX   = input.bool(false, title="Enable ADX Filter", group=g_adx, tooltip="Only take signals when ADX is above the threshold, filtering out low-conviction/choppy conditions.")
adxLen      = input.int(14, title="ADX Length", minval=1, group=g_adx)
adxSmooth   = input.int(14, title="ADX Smoothing", minval=1, group=g_adx)
adxThresh   = input.float(20.0, title="ADX Threshold", step=1.0, group=g_adx)

show_fill     = input.bool(true, 'Show Gradient Fill', group=g_visual)
show_markers  = input.bool(true, 'Show Flip Markers', group=g_visual)
color_preset  = input.string('Custom', 'Color Preset', options=['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'], group=g_visual)
bullish_input = input.color(#00ffaa, 'Bullish Color', group=g_visual)
bearish_input = input.color(#ff0000, 'Bearish Color', group=g_visual)
show_candles  = input.bool(false, 'Enable Bar Coloring', group=g_visual)
bar_trans     = input.int(0, 'Bar Color Transparency', minval=0, maxval=100, group=g_visual)
show_bgcolor  = input.bool(false, 'Enable Background Coloring', group=g_visual)
bg_trans      = input.int(90, 'Background Color Transparency', minval=0, maxval=100, group=g_visual)

[bullish_color, bearish_color] = switch color_preset
    'Classic' => [#00ff00, #ff0000]
    'Aqua'    => [#00d4ff, #ff8c00]
    'Cosmic'  => [#49ffce, #9932cc]
    'Cyber'   => [#00cccc, #ff6600]
    'Neon'    => [#ffff00, #ff00ff]
    'Custom'  => [bullish_input, bearish_input]

//              ╔════════════════════════════════╗              //
//              ║        CORE CALCULATION        ║              //
//              ╚════════════════════════════════╝              //

[supertrend, direction] = ta.supertrend(factor, atrPeriod)
trendEMA = ta.ema(close, emaLen)

bullFlip = ta.change(direction) < 0   // flipped to uptrend
bearFlip = ta.change(direction) > 0   // flipped to downtrend

// ADX calculation (Wilder's DMI/ADX)
[diplus, diminus, adx] = ta.dmi(adxLen, adxSmooth)
adxOK = not enableADX or adx > adxThresh

longCondition  = bullFlip and close > trendEMA and adxOK
shortCondition = bearFlip and close < trendEMA and adxOK

trend_color = direction < 0 ? bullish_color : bearish_color

//              ╔════════════════════════════════╗              //
//              ║           EXECUTION            ║              //
//              ╚════════════════════════════════╝              //

if longCondition
    strategy.entry("Long", strategy.long)

if shortCondition
    strategy.entry("Short", strategy.short)

if bearFlip
    strategy.close("Long")
if bullFlip
    strategy.close("Short")

if strategy.position_size > 0
    entryPrice = strategy.position_avg_price
    if enableSL
        strategy.exit("Long SL/TP", "Long", stop = entryPrice * (1 - slPct),
             limit = enableTP ? entryPrice * (1 + tpPct) : na)

if strategy.position_size < 0
    entryPrice = strategy.position_avg_price
    if enableSL
        strategy.exit("Short SL/TP", "Short", stop = entryPrice * (1 + slPct),
             limit = enableTP ? entryPrice * (1 - tpPct) : na)

//              ╔════════════════════════════════╗              //
//              ║         VISUALIZATION          ║              //
//              ╚════════════════════════════════╝              //

// Glow + core Supertrend line
st_up = direction < 0 ? supertrend : na
st_dn = direction > 0 ? supertrend : na

plot(st_up, 'Glow Up',   color=color.new(bullish_color, 70), linewidth=6, style=plot.style_linebr)
plot(st_dn, 'Glow Down', color=color.new(bearish_color, 70), linewidth=6, style=plot.style_linebr)
p_st_up = plot(st_up, 'Bullish Supertrend', color=bullish_color, linewidth=2, style=plot.style_linebr)
p_st_dn = plot(st_dn, 'Bearish Supertrend', color=bearish_color, linewidth=2, style=plot.style_linebr)

// EMA trend filter line
plot(trendEMA, title="EMA Trend Filter", color=color.new(color.orange, 20), linewidth=1)

// Gradient fill between Supertrend line and price (layered, QuantAlgo-style)
p_price = plot(close, 'Price Anchor', color=na, display=display.none, editable=false)

step_up  = not na(st_up) ? (close - st_up) / 4.0 : na
grad1_up = not na(step_up) ? st_up + step_up * 1.0 : na
grad2_up = not na(step_up) ? st_up + step_up * 2.0 : na
grad3_up = not na(step_up) ? st_up + step_up * 3.0 : na

step_dn  = not na(st_dn) ? (close - st_dn) / 4.0 : na
grad1_dn = not na(step_dn) ? st_dn + step_dn * 1.0 : na
grad2_dn = not na(step_dn) ? st_dn + step_dn * 2.0 : na
grad3_dn = not na(step_dn) ? st_dn + step_dn * 3.0 : na

p_g1u = plot(show_fill ? grad1_up : na, display=display.none, editable=false)
p_g2u = plot(show_fill ? grad2_up : na, display=display.none, editable=false)
p_g3u = plot(show_fill ? grad3_up : na, display=display.none, editable=false)
p_g1d = plot(show_fill ? grad1_dn : na, display=display.none, editable=false)
p_g2d = plot(show_fill ? grad2_dn : na, display=display.none, editable=false)
p_g3d = plot(show_fill ? grad3_dn : na, display=display.none, editable=false)

fill(p_st_up, p_g1u, color=show_fill ? color.new(bullish_color, 65) : na, title='Up Gradient 1')
fill(p_g1u, p_g2u,   color=show_fill ? color.new(bullish_color, 78) : na, title='Up Gradient 2')
fill(p_g2u, p_g3u,   color=show_fill ? color.new(bullish_color, 88) : na, title='Up Gradient 3')
fill(p_g3u, p_price, color=show_fill ? color.new(bullish_color, 95) : na, title='Up Gradient 4')

fill(p_st_dn, p_g1d, color=show_fill ? color.new(bearish_color, 65) : na, title='Down Gradient 1')
fill(p_g1d, p_g2d,   color=show_fill ? color.new(bearish_color, 78) : na, title='Down Gradient 2')
fill(p_g2d, p_g3d,   color=show_fill ? color.new(bearish_color, 88) : na, title='Down Gradient 3')
fill(p_g3d, p_price, color=show_fill ? color.new(bearish_color, 95) : na, title='Down Gradient 4')

// Flip markers
plotshape(show_markers and bullFlip ? supertrend : na, title='Bullish Flip', style=shape.triangleup, location=location.belowbar, color=bullish_color, size=size.small)
plotshape(show_markers and bearFlip ? supertrend : na, title='Bearish Flip', style=shape.triangledown, location=location.abovebar, color=bearish_color, size=size.small)

// Entry markers
plotshape(longCondition, title='Long Entry', style=shape.circle, location=location.belowbar, color=color.new(bullish_color, 0), size=size.tiny)
plotshape(shortCondition, title='Short Entry', style=shape.circle, location=location.abovebar, color=color.new(bearish_color, 0), size=size.tiny)

// Optional bar/background tint
barcolor(show_candles ? color.new(trend_color, bar_trans) : na, title='Trend Bar Color')
bgcolor(show_bgcolor ? color.new(trend_color, bg_trans) : na, title='Trend Background Color')
`;

export const FAST_SCALPER_PINE_SCRIPT = `//@version=6
strategy("Blitz Scalper Pro (5m/15m/30m Quick Profit & Exit)",
     overlay=true,
     initial_capital=10000,
     default_qty_type=strategy.percent_of_equity,
     default_qty_value=100,
     commission_type=strategy.commission.percent,
     commission_value=0.06,
     slippage=1)

//              ╔════════════════════════════════╗
//              ║            INPUTS              ║
//              ╚════════════════════════════════╝

g_scalp   = '════════ Scalp Momentum (5m/15m/30m) ════════'
g_sr      = '════════ Support & Resistance Patterns ════════'
g_trend   = '════════ Macro Baseline Filter ════════'
g_risk    = '════════ Quick Profit & Exit ════════'
g_visual  = '════════ Visual Styles & Colors ════════'

// --- Scalp Settings ---
fastEmaLen       = input.int(9, title="Fast EMA (Micro-Trend)", minval=1, group=g_scalp)
slowEmaLen       = input.int(21, title="Slow EMA (Dynamic Support/Res)", minval=1, group=g_scalp)
rsiLen           = input.int(14, title="RSI Lookback Period", minval=1, group=g_scalp)
stochLen         = input.int(14, title="Stoch Lookback Period", minval=1, group=g_scalp)
smoothK          = input.int(3, title="Stoch %K Smoothing", minval=1, group=g_scalp)
smoothD          = input.int(3, title="Stoch %D Smoothing", minval=1, group=g_scalp)
oversoldThresh   = input.int(30, title="Oversold Level (Long Trigger)", minval=5, maxval=45, group=g_scalp)
overboughtThresh = input.int(70, title="Overbought Level (Short Trigger)", minval=55, maxval=95, group=g_scalp)

// --- Support & Resistance Patterns ---
useSrFilter      = input.bool(true, title="Enable Support & Resistance Patterns", group=g_sr, tooltip="Filters out scalp entries directly into strong overhead resistance or underlying support floors.")
srPivotLen       = input.int(5, title="S/R Swing Pivot Lookback", minval=2, group=g_sr)
srClearanceMult  = input.float(0.8, title="Min Overhead Clearance (x ATR)", step=0.1, group=g_sr)
useSrStructural  = input.bool(true, title="S/R Structural TP/SL Anchoring", group=g_sr)

// --- Trend & Volume Filter ---
useTrendFilter   = input.bool(true, title="Enable 50 EMA Macro Filter", group=g_trend, tooltip="Only take Longs above 50 EMA, Shorts below 50 EMA to prevent counter-trend traps.")
trendEmaLen      = input.int(50, title="Macro Baseline EMA Length", minval=10, group=g_trend)
useVolFilter     = input.bool(true, title="Enable Volume Spike Filter", group=g_trend, tooltip="Ensures institutional participation on entries.")

// --- Quick Profit & Risk Management ---
useAtrTargets    = input.bool(true, title="Use Dynamic ATR Profit Targets", group=g_risk, tooltip="Adapts target sizes to live 5m/15m volatility.")
atrLen           = input.int(14, title="ATR Length", minval=1, group=g_risk)
atrMultTP        = input.float(2.8, title="ATR Take Profit Multiplier (Quick TP)", step=0.1, group=g_risk)
atrMultSL        = input.float(1.8, title="ATR Stop Loss Multiplier", step=0.1, group=g_risk)

quickTpPct       = input.float(2.5, title="Fixed Take Profit % (if ATR disabled)", step=0.1, group=g_risk) / 100
stopLossPct      = input.float(1.6, title="Fixed Stop Loss % (if ATR disabled)", step=0.1, group=g_risk) / 100
enableQuickExit  = input.bool(false, title="Exit on Momentum Exhaustion (Stoch Extreme)", group=g_risk, tooltip="Locks in profit when StochRSI reaches extreme levels if already in positive profit.")
enableBreakeven  = input.bool(true, title="Auto Breakeven Stop @ 60% TP Progress", group=g_risk)

// --- Visual Settings ---
showRibbon       = input.bool(true, title="Show 9/21 EMA Scalp Ribbon", group=g_visual)
showSrLevels     = input.bool(true, title="Show Key Support & Resistance Lines", group=g_visual)
showLabels       = input.bool(true, title="Show Entry & Quick Profit Labels", group=g_visual)
bullish_color    = #00ffaa
bearish_color    = #ff3b69

//              ╔════════════════════════════════╗
//              ║          CALCULATIONS          ║
//              ╚════════════════════════════════╝

emaFast  = ta.ema(close, fastEmaLen)
emaSlow  = ta.ema(close, slowEmaLen)
emaTrend = ta.ema(close, trendEmaLen)
atrVal   = ta.atr(atrLen)
volSma   = ta.sma(volume, 20)

// Dynamic Swing Support & Resistance Detection
hiPivot = ta.pivothigh(high, srPivotLen, srPivotLen)
loPivot = ta.pivotlow(low, srPivotLen, srPivotLen)

var float resLevel = na
var float supLevel = na

if (not na(hiPivot))
    resLevel := hiPivot

if (not na(loPivot))
    supLevel := loPivot

// Polarity Flip: Broken resistance becomes support; broken support becomes resistance
if (not na(resLevel) and close > resLevel + (atrVal * 0.25))
    supLevel := resLevel
    resLevel := na

if (not na(supLevel) and close < supLevel - (atrVal * 0.25))
    resLevel := supLevel
    supLevel := na

// S/R Patterns
supportBounce = not na(supLevel) and (low <= supLevel + (atrVal * 0.45)) and (close > supLevel) and (close > open)
resistReject  = not na(resLevel) and (high >= resLevel - (atrVal * 0.45)) and (close < resLevel) and (close < open)

// Clearance Filter (Ensure sufficient room to run before running into S/R ceiling/floor)
hasLongClearance  = not useSrFilter or na(resLevel) or (resLevel - close >= atrVal * srClearanceMult)
hasShortClearance = not useSrFilter or na(supLevel) or (close - supLevel >= atrVal * srClearanceMult)

// Stochastic RSI (Momentum Engine)
rsiVal  = ta.rsi(close, rsiLen)
stochK  = ta.sma(ta.stoch(rsiVal, rsiVal, rsiVal, stochLen), smoothK)
stochD  = ta.sma(stochK, smoothD)

// Scalp Setup Conditions
trendBull = not useTrendFilter or (close > emaTrend and emaFast > emaSlow and emaFast >= emaFast[1])
trendBear = not useTrendFilter or (close < emaTrend and emaFast < emaSlow and emaFast <= emaFast[1])
volFilter = not useVolFilter or (volume >= volSma * 0.95)

// Micro Pullback Entry: Stoch crosses upward from oversold / downward from overbought + Candle confirmation
pullbackLong  = low <= emaFast * 1.003 and close > open
pullbackShort = high >= emaFast * 0.997 and close < open

scalpLongTrigger  = ta.crossover(stochK, stochD) and (stochK[1] <= oversoldThresh or stochD[1] <= oversoldThresh or stochK <= oversoldThresh + 5) and (pullbackLong or supportBounce) and volFilter and hasLongClearance
scalpShortTrigger = ta.crossunder(stochK, stochD) and (stochK[1] >= overboughtThresh or stochD[1] >= overboughtThresh or stochK >= overboughtThresh - 5) and (pullbackShort or resistReject) and volFilter and hasShortClearance

longCondition  = trendBull and scalpLongTrigger
shortCondition = trendBear and scalpShortTrigger

// Tracking Entry Prices & Dynamic Targets
var float entryPrice = na
var float targetTP   = na
var float targetSL   = na
var float triggerBE  = na
var bool  beActive   = false

if (longCondition and strategy.position_size <= 0)
    entryPrice := close
    tpDist = useAtrTargets ? (atrVal * atrMultTP) : (close * quickTpPct)
    slDist = useAtrTargets ? (atrVal * atrMultSL) : (close * stopLossPct)

    // Structural S/R anchoring
    if (useSrFilter and useSrStructural)
        if (not na(supLevel) and math.abs(close - supLevel) < atrVal * 2.5)
            slDist := math.max(close - supLevel + (atrVal * 0.25), atrVal * 1.4)
        if (not na(resLevel))
            distR = resLevel - close
            tpDist := math.min(distR * 0.92, atrVal * 3.8)
            if (tpDist < slDist * 1.3)
                tpDist := slDist * 1.6

    targetTP  := close + tpDist
    targetSL  := close - slDist
    triggerBE := close + (tpDist * 0.6)
    beActive  := false
    strategy.entry("Scalp Long", strategy.long)

if (shortCondition and strategy.position_size >= 0)
    entryPrice := close
    tpDist = useAtrTargets ? (atrVal * atrMultTP) : (close * quickTpPct)
    slDist = useAtrTargets ? (atrVal * atrMultSL) : (close * stopLossPct)

    // Structural S/R anchoring
    if (useSrFilter and useSrStructural)
        if (not na(resLevel) and math.abs(resLevel - close) < atrVal * 2.5)
            slDist := math.max(resLevel - close + (atrVal * 0.25), atrVal * 1.4)
        if (not na(supLevel))
            distS = close - supLevel
            tpDist := math.min(distS * 0.92, atrVal * 3.8)
            if (tpDist < slDist * 1.3)
                tpDist := slDist * 1.6

    targetTP  := close - tpDist
    targetSL  := close + slDist
    triggerBE := close - (tpDist * 0.6)
    beActive  := false
    strategy.entry("Scalp Short", strategy.short)

// Auto-Breakeven Adjustment (includes fee allowance)
if (enableBreakeven and not beActive)
    if (strategy.position_size > 0 and high >= triggerBE)
        targetSL := entryPrice * 1.002
        beActive := true
    else if (strategy.position_size < 0 and low <= triggerBE)
        targetSL := entryPrice * 0.998
        beActive := true

// Quick Profit Exhaustion Exit (Take Profit and Exit!)
exhaustLongExit  = enableQuickExit and strategy.position_size > 0 and (close > entryPrice) and (ta.crossunder(stochK, stochD) and stochK >= 75)
exhaustShortExit = enableQuickExit and strategy.position_size < 0 and (close < entryPrice) and (ta.crossover(stochK, stochD) and stochK <= 25)

if (exhaustLongExit)
    strategy.close("Scalp Long", comment="Quick Profit Exit")

if (exhaustShortExit)
    strategy.close("Scalp Short", comment="Quick Profit Exit")

// Core Target & Stop Execution
if (strategy.position_size > 0)
    strategy.exit("Long Exit", "Scalp Long", stop=targetSL, limit=targetTP, comment="TP/SL Exit")

if (strategy.position_size < 0)
    strategy.exit("Short Exit", "Scalp Short", stop=targetSL, limit=targetTP, comment="TP/SL Exit")

//              ╔════════════════════════════════╗
//              ║         VISUALIZATION          ║
//              ╚════════════════════════════════╝

p_fast  = plot(emaFast,  title="9 Fast EMA",  color=color.new(#00e5ff, 20), linewidth=1)
p_slow  = plot(emaSlow,  title="21 Slow EMA", color=color.new(#7c4dff, 20), linewidth=2)
p_trend = plot(emaTrend, title="50 Macro Baseline", color=color.new(#ffab00, 30), linewidth=2)

fillColor = emaFast > emaSlow ? color.new(bullish_color, 85) : color.new(bearish_color, 85)
fill(p_fast, p_slow, color=showRibbon ? fillColor : na, title="EMA Ribbon Fill")

// Markers
plotshape(showLabels and longCondition, title="Scalp Long Signal", style=shape.triangleup, location=location.belowbar, color=bullish_color, size=size.small, text="SCALP\\nLONG", textcolor=color.white)
plotshape(showLabels and shortCondition, title="Scalp Short Signal", style=shape.triangledown, location=location.abovebar, color=bearish_color, size=size.small, text="SCALP\\nSHORT", textcolor=color.white)

// Support & Resistance Key Levels
plot(showSrLevels and useSrFilter ? resLevel : na, title="Key Resistance Level", color=color.new(#ff3b69, 25), style=plot.style_circles, linewidth=2)
plot(showSrLevels and useSrFilter ? supLevel : na, title="Key Support Level", color=color.new(#00ffaa, 25), style=plot.style_circles, linewidth=2)

plotshape(showLabels and exhaustLongExit, title="Quick Profit Exit (Long)", style=shape.diamond, location=location.abovebar, color=#ffd700, size=size.tiny, text="QUICK\\nEXIT", textcolor=color.black)
plotshape(showLabels and exhaustShortExit, title="Quick Profit Exit (Short)", style=shape.diamond, location=location.belowbar, color=#ffd700, size=size.tiny, text="QUICK\\nEXIT", textcolor=color.black)
`;

export const PINE_TEMPLATES = [
  {
    name: '5M/15M/30M Fast Momentum Scalper (Quick TP & Exit)',
    description: 'High-frequency momentum scalper engineered for 5m, 15m & 30m charts. Enters on 9/21 EMA pullback with StochRSI reversal, targeting quick 1.5R - 2R profit exits with tight stops and breakeven lock.',
    script: FAST_SCALPER_PINE_SCRIPT,
  },
  {
    name: 'BTCUSD Supertrend + EMA Trend Filter (1H)',
    description: 'TradingView v6 strategy combining Supertrend direction flips with 200 EMA trend filter and optional ADX momentum regime gating.',
    script: SUPERTREND_EMA_PINE_SCRIPT,
  },
  {
    name: 'Liquidity Sweep Reversal Strategy (Long & Short)',
    description: 'Smart Money swing pivot high/low liquidity sweep reversal strategy. Enters on false breakout wicks with volume surge, 1.2x ATR stop loss beyond wicks, 1.5R take-profit, and automatic breakeven trailing.',
    script: LIQUIDITY_SWEEP_PINE_SCRIPT,
  },
  {
    name: 'Crypto Golden Trend Alpha (Long & Short)',
    description: 'High-alpha quantitative strategy combining 9/21 EMA crossover with 50 Macro EMA filter. Takes both Longs (above 50 EMA) and Shorts (below 50 EMA) with structural momentum exits.',
    script: `//@version=5
strategy("Crypto Golden Trend Alpha (Long & Short)", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

fastLength  = input.int(9, title="Fast EMA Period", minval=1)
slowLength  = input.int(21, title="Slow EMA Period", minval=1)
macroLength = input.int(50, title="Macro Trend EMA Period", minval=1)

emaFast  = ta.ema(close, fastLength)
emaSlow  = ta.ema(close, slowLength)
emaMacro = ta.ema(close, macroLength)

longCondition  = ta.crossover(emaFast, emaSlow) and close > emaMacro
shortCondition = ta.crossunder(emaFast, emaSlow) and close < emaMacro

exitLongCondition  = ta.crossunder(emaFast, emaSlow)
exitShortCondition = ta.crossover(emaFast, emaSlow)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (exitLongCondition)
    strategy.close("Long")

if (shortCondition)
    strategy.entry("Short", strategy.short)

if (exitShortCondition)
    strategy.close("Short")

plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)
plot(emaMacro, title="Macro 50 EMA", color=color.purple, linewidth=2)
plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Short Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SHORT")
`,
  },
  {
    name: 'Dual EMA Golden Cross (Trend Following)',
    description: 'Classic trend-following strategy using Fast and Slow Exponential Moving Averages with crossover signals.',
    script: `//@version=5
strategy("Dual EMA Golden Cross", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

fastPeriod = input.int(9, title="Fast EMA Period", minval=1)
slowPeriod = input.int(21, title="Slow EMA Period", minval=1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(7.0, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(3.5, title="Stop Loss %", minval=0.1, step=0.1) / 100

emaFast = ta.ema(close, fastPeriod)
emaSlow = ta.ema(close, slowPeriod)

longCondition  = ta.crossover(emaFast, emaSlow)
shortCondition = ta.crossunder(emaFast, emaSlow)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)
plotshape(longCondition, title="Buy", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`,
  },
  {
    name: 'RSI Mean Reversion + Dynamic Filter',
    description: 'Counter-trend strategy accumulating when RSI is heavily oversold and trimming on overbought conditions.',
    script: `//@version=5
strategy("RSI Mean Reversion", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

rsiPeriod  = input.int(14, title="RSI Length", minval=1)
oversold   = input.int(30, title="Oversold Level", minval=1, maxval=50)
overbought = input.int(70, title="Overbought Level", minval=50, maxval=100)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(6.0, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(3.0, title="Stop Loss %", minval=0.1, step=0.1) / 100

rsiVal = ta.rsi(close, rsiPeriod)

longCondition  = ta.crossover(rsiVal, oversold) or (rsiVal < oversold and close > open)
shortCondition = ta.crossunder(rsiVal, overbought) or (rsiVal > overbought)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plotshape(longCondition, title="Buy", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`,
  },
  {
    name: 'MACD Momentum Trend Divergence',
    description: 'Momentum strategy combining MACD line crossover with histogram confirmation.',
    script: `//@version=5
strategy("MACD Momentum Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

fastPeriod   = input.int(12, title="MACD Fast Period", minval=1)
slowPeriod   = input.int(26, title="MACD Slow Period", minval=1)
signalPeriod = input.int(9, title="MACD Signal Period", minval=1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(8.0, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(4.0, title="Stop Loss %", minval=0.1, step=0.1) / 100

[macdLine, signalLine, histLine] = ta.macd(close, fastPeriod, slowPeriod, signalPeriod)

longCondition  = ta.crossover(macdLine, signalLine) and histLine > 0
shortCondition = ta.crossunder(macdLine, signalLine)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plotshape(longCondition, title="Buy", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`,
  },
  {
    name: 'Bollinger Bands Volatility Breakout',
    description: 'Volatility envelope strategy entering on lower band touches and exiting on upper band expansion.',
    script: `//@version=5
strategy("Bollinger Bands Mean Reversion", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

bbPeriod = input.int(20, title="Bollinger Period", minval=1)
bbMult   = input.float(2.0, title="StdDev Multiplier", minval=0.5, step=0.1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(7.0, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(3.5, title="Stop Loss %", minval=0.1, step=0.1) / 100

[bbMiddle, bbUpper, bbLower] = ta.bb(close, bbPeriod, bbMult)

longCondition  = ta.crossover(close, bbLower) or close < bbLower
shortCondition = ta.crossunder(close, bbUpper) or close > bbUpper

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plot(bbUpper, title="Upper Band", color=color.new(#38bdf8, 30))
plot(bbMiddle, title="Middle Band", color=color.new(#94a3b8, 50))
plot(bbLower, title="Lower Band", color=color.new(#38bdf8, 30))
`,
  },
  {
    name: 'Supertrend Volatility Trend-Follower',
    description: 'ATR-based adaptive trailing band strategy capturing massive 15-25%+ trend runs while cutting whipsaws.',
    script: `//@version=5
strategy("Supertrend Volatility Rider", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

atrPeriod = input.int(10, title="ATR Period", minval=1)
factor    = input.float(3.0, title="ATR Factor", minval=0.5, step=0.5)

[supertrend, direction] = ta.supertrend(factor, atrPeriod)

// Direction -1 indicates bullish/uptrend in Pine Script, 1 indicates downtrend
longCondition  = ta.change(direction) < 0 and direction == -1
shortCondition = ta.change(direction) > 0 and direction == 1

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

plot(direction == -1 ? supertrend : na, title="Supertrend Bull", color=color.green, style=plot.style_linebr, linewidth=2)
plot(direction == 1 ? supertrend : na, title="Supertrend Bear", color=color.red, style=plot.style_linebr, linewidth=2)
`,
  },
  {
    name: 'Crypto Momentum & Trend Pullback Pro',
    description: 'High-win-rate trend pullback strategy with macro EMA filter, dynamic value dip, bounce confirmation, and wide volatility buffer.',
    script: `//@version=5
strategy("Crypto Momentum & Trend Pullback Pro", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)

// === INPUTS ===
fastLength      = input.int(9, title="Fast EMA Period")
slowLength      = input.int(21, title="Slow EMA Period")
trendLength     = input.int(200, title="Macro Trend EMA")
rsiLength       = input.int(14, title="RSI Period")
adxThreshold    = input.int(18, title="Min ADX Trend Strength")
atrMultiplierSL = input.float(2.8, title="Stop Loss (x ATR)")
atrMultiplierTP = input.float(6.0, title="Take Profit (x ATR - 1:2.1 R:R)")

// === CORE INDICATORS ===
emaFast = ta.ema(close, fastLength)
emaSlow = ta.ema(close, slowLength)
ema200  = ta.ema(close, trendLength)
rsiVal  = ta.rsi(close, rsiLength)
atrVal  = ta.atr(14)

// === DIRECTIONAL MOVEMENT SYSTEM (ADX & DMI) ===
dmPlus  = ta.change(high) > -ta.change(low) ? math.max(ta.change(high), 0) : 0
dmMinus = -ta.change(low) > ta.change(high) ? math.max(-ta.change(low), 0) : 0
tr      = ta.rma(ta.tr, 14)
plusDI  = 100 * ta.rma(dmPlus, 14) / tr
minusDI = 100 * ta.rma(dmMinus, 14) / tr
adxVal  = 100 * ta.rma(math.abs(plusDI - minusDI) / (plusDI + minusDI), 14)

// === 1. REGIME & MOMENTUM FILTER ===
trendFilter    = close > ema200 and emaFast > emaSlow
adxFilter      = adxVal > adxThreshold and plusDI > minusDI

// === 2. PULLBACK SETUP (Dip to Support / Dynamic Value Zone) ===
pullbackSetup  = (low[1] <= emaSlow[1] * 1.01 or low <= emaSlow * 1.008 or rsiVal[1] < 48)

// === 3. BULLISH REVERSAL TRIGGER (Edge Confirmation) ===
bounceTrigger  = close > emaFast and close > open and close > close[1]

// Composite Long Entry Trigger
longCondition  = trendFilter and adxFilter and pullbackSetup and bounceTrigger

// Structural Trend Exit (Exit only on true trend break or macro EMA loss)
exitCondition  = ta.crossunder(close, emaSlow) or close < ema200

// === STRATEGY EXECUTION ===
if (longCondition)
    strategy.entry("Long", strategy.long)

if (exitCondition)
    strategy.close("Long")

// Dynamic ATR Trailing Stops & Targets
if (strategy.position_size > 0)
    stopLossPrice   = strategy.position_avg_price - (atrVal * atrMultiplierSL)
    takeProfitPrice = strategy.position_avg_price + (atrVal * atrMultiplierTP)
    strategy.exit("Exit Bracket", from_entry="Long", stop=stopLossPrice, limit=takeProfitPrice)

// === VISUAL SIGNALS ===
plot(emaFast, title="Fast EMA", color=color.new(#06b6d4, 0), linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.new(#f59e0b, 0), linewidth=2)
plot(ema200,  title="200 Macro EMA", color=color.new(#a855f7, 0), linewidth=2)
plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(exitCondition, title="Exit Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="EXIT")
`,
  },
];

/**
 * Converts a JavaScript strategy condition snippet into TradingView Pine Script (v5)
 */
export function convertJsToPineScript(
  jsCode: string,
  strategyName: string = 'Custom Pine Script Strategy',
  settings?: BacktestSettings
): string {
  const initCap = settings?.initialCapital ?? 10000;
  const qtyVal = settings?.positionSizePercent ?? 100;
  const commVal = settings?.takerFeePercent ?? 0.08;
  const tpVal = settings?.takeProfitPercent ?? 7.0;
  const slVal = settings?.stopLossPercent ?? 3.5;

  // Clean and parse JS conditions
  let buyCondition = 'false';
  let sellCondition = 'false';

  // Extract condition before return 'BUY' or return 'LONG'
  const buyMatch = jsCode.match(/if\s*\(([\s\S]*?)\)\s*\{?\s*return\s*['"](BUY|LONG)['"]/i);
  if (buyMatch && buyMatch[1]) {
    buyCondition = buyMatch[1].trim();
  }

  // Extract condition before return 'SELL' or return 'SHORT' or return 'EXIT'
  const sellMatch = jsCode.match(/if\s*\(([\s\S]*?)\)\s*\{?\s*return\s*['"](SELL|SHORT|EXIT)['"]/i);
  if (sellMatch && sellMatch[1]) {
    sellCondition = sellMatch[1].trim();
  }

  // If no direct if-return match, check for condition assignments
  if (buyCondition === 'false') {
    const buyVarMatch = jsCode.match(/(?:const|let|var)?\s*buyCondition\s*=\s*([^;]+);/i);
    if (buyVarMatch) buyCondition = buyVarMatch[1].trim();
  }
  if (sellCondition === 'false') {
    const sellVarMatch = jsCode.match(/(?:const|let|var)?\s*(?:sellCondition|exitCondition)\s*=\s*([^;]+);/i);
    if (sellVarMatch) sellCondition = sellVarMatch[1].trim();
  }

  // Translate JS expression syntax to Pine Script v5
  const translateExpression = (expr: string): string => {
    let pine = expr;
    // Replace boolean operators
    pine = pine.replace(/&&/g, ' and ');
    pine = pine.replace(/\|\|/g, ' or ');
    pine = pine.replace(/===/g, ' == ');
    pine = pine.replace(/!==/g, ' != ');
    pine = pine.replace(/!([a-zA-Z])/g, 'not $1');

    // Replace candle fields
    pine = pine.replace(/candle\.close/g, 'close');
    pine = pine.replace(/candle\.open/g, 'open');
    pine = pine.replace(/candle\.high/g, 'high');
    pine = pine.replace(/candle\.low/g, 'low');
    pine = pine.replace(/candle\.volume/g, 'volume');

    pine = pine.replace(/prevCandle\.close/g, 'close[1]');
    pine = pine.replace(/prevCandle\.open/g, 'open[1]');
    pine = pine.replace(/prevCandle\.high/g, 'high[1]');
    pine = pine.replace(/prevCandle\.low/g, 'low[1]');
    pine = pine.replace(/prevCandle\.volume/g, 'volume[1]');

    // Replace indicator fields
    pine = pine.replace(/indicators\.rsi/g, 'rsiVal');
    pine = pine.replace(/indicators\.emaFast/g, 'emaFast');
    pine = pine.replace(/indicators\.emaSlow/g, 'emaSlow');
    pine = pine.replace(/indicators\.macd\.macd/g, 'macdLine');
    pine = pine.replace(/indicators\.macd\.signal/g, 'signalLine');
    pine = pine.replace(/indicators\.macd\.histogram/g, 'histLine');
    pine = pine.replace(/indicators\.bollinger\.upper/g, 'bbUpper');
    pine = pine.replace(/indicators\.bollinger\.middle/g, 'bbMiddle');
    pine = pine.replace(/indicators\.bollinger\.lower/g, 'bbLower');
    pine = pine.replace(/indicators\.supertrend\.trend\s*==\s*1/g, 'stDirection == -1');
    pine = pine.replace(/indicators\.supertrend\.trend\s*==\s*-1/g, 'stDirection == 1');
    pine = pine.replace(/indicators\.supertrend\.line/g, 'stLine');

    // Clean whitespace
    pine = pine.replace(/\s+/g, ' ').trim();
    return pine || 'false';
  };

  const pineBuy = translateExpression(buyCondition);
  const pineSell = translateExpression(sellCondition);

  // Detect which indicators are used
  const usesRsi = jsCode.includes('rsi') || pineBuy.includes('rsiVal') || pineSell.includes('rsiVal');
  const usesEmaFast = jsCode.includes('emaFast') || pineBuy.includes('emaFast') || pineSell.includes('emaFast');
  const usesEmaSlow = jsCode.includes('emaSlow') || pineBuy.includes('emaSlow') || pineSell.includes('emaSlow');
  const usesMacd = jsCode.includes('macd') || pineBuy.includes('macd') || pineSell.includes('macd');
  const usesBollinger = jsCode.includes('bollinger') || pineBuy.includes('bb') || pineSell.includes('bb');
  const usesSupertrend = jsCode.includes('supertrend') || pineBuy.includes('st') || pineSell.includes('st');

  // Build Pine Script v5 file
  const lines: string[] = [
    '//@version=5',
    `strategy("${strategyName}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})`,
    '',
    '// === INPUT PARAMETERS ===',
  ];

  if (usesEmaFast || usesEmaSlow) {
    lines.push('fastPeriod = input.int(9, title="Fast EMA Period", minval=1)');
    lines.push('slowPeriod = input.int(21, title="Slow EMA Period", minval=1)');
  }
  if (usesRsi) {
    lines.push('rsiPeriod = input.int(14, title="RSI Period", minval=1)');
  }
  if (usesMacd) {
    lines.push('macdFast = input.int(12, title="MACD Fast Length", minval=1)');
    lines.push('macdSlow = input.int(26, title="MACD Slow Length", minval=1)');
    lines.push('macdSignal = input.int(9, title="MACD Signal Length", minval=1)');
  }
  if (usesBollinger) {
    lines.push('bbPeriod = input.int(20, title="Bollinger Period", minval=1)');
    lines.push('bbMult = input.float(2.0, title="Bollinger StdDev", minval=0.5, step=0.1)');
  }
  if (usesSupertrend) {
    lines.push('stPeriod = input.int(10, title="Supertrend ATR Period", minval=1)');
    lines.push('stFactor = input.float(3.0, title="Supertrend ATR Factor", minval=0.5, step=0.5)');
  }

  lines.push('');
  lines.push('// === RISK CONTROLS ===');
  lines.push(`useTakeProfit = input.bool(true, title="Use Take Profit")`);
  lines.push(`tpPercent = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100`);
  lines.push(`useStopLoss = input.bool(true, title="Use Stop Loss")`);
  lines.push(`slPercent = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100`);
  lines.push('');
  lines.push('// === TECHNICAL INDICATOR CALCULATIONS ===');

  if (usesEmaFast) lines.push('emaFast = ta.ema(close, fastPeriod)');
  if (usesEmaSlow) lines.push('emaSlow = ta.ema(close, slowPeriod)');
  if (usesRsi) lines.push('rsiVal = ta.rsi(close, rsiPeriod)');
  if (usesMacd) lines.push('[macdLine, signalLine, histLine] = ta.macd(close, macdFast, macdSlow, macdSignal)');
  if (usesBollinger) lines.push('[bbMiddle, bbUpper, bbLower] = ta.bb(close, bbPeriod, bbMult)');
  if (usesSupertrend) lines.push('[stLine, stDirection] = ta.supertrend(stFactor, stPeriod)');

  lines.push('');
  lines.push('// === ENTRY & EXIT LOGIC (CONVERTED FROM JAVASCRIPT) ===');
  lines.push(`longCondition = ${pineBuy !== 'false' ? pineBuy : 'ta.crossover(ta.ema(close, 9), ta.ema(close, 21))'}`);
  lines.push(`exitCondition = ${pineSell !== 'false' ? pineSell : 'ta.crossunder(ta.ema(close, 9), ta.ema(close, 21))'}`);
  lines.push('');
  lines.push('// === STRATEGY EXECUTION ORDERS ===');
  lines.push('if (longCondition)');
  lines.push('    strategy.entry("Long", strategy.long)');
  lines.push('');
  lines.push('if (exitCondition)');
  lines.push('    strategy.close("Long")');
  lines.push('');
  lines.push('// Bracket Orders for Stop-Loss & Take-Profit');
  lines.push('if (strategy.position_size > 0)');
  lines.push('    stopPrice = strategy.position_avg_price * (1 - slPercent)');
  lines.push('    targetPrice = strategy.position_avg_price * (1 + tpPercent)');
  lines.push('    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? stopPrice : na, limit=useTakeProfit ? targetPrice : na)');
  lines.push('');
  lines.push('// === CHARTS & VISUAL INDICATOR PLOTS ===');
  if (usesEmaFast) lines.push('plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)');
  if (usesEmaSlow) lines.push('plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)');
  if (usesBollinger) {
    lines.push('plot(bbUpper, title="Upper BB", color=color.blue)');
    lines.push('plot(bbLower, title="Lower BB", color=color.blue)');
  }
  lines.push('plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")');
  lines.push('plotshape(exitCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")');

  return lines.join('\n');
}

/**
 * Converts custom Boolean rules from the Visual Rule Builder to Pine Script v5
 */
export function convertRulesToPineScript(
  rules: CustomRulesConfig,
  strategyName: string = 'Custom Rule Strategy',
  settings?: BacktestSettings
): string {
  const initCap = settings?.initialCapital ?? 10000;
  const qtyVal = settings?.positionSizePercent ?? 100;
  const commVal = settings?.takerFeePercent ?? 0.08;
  const tpVal = settings?.takeProfitPercent ?? 7.0;
  const slVal = settings?.stopLossPercent ?? 3.5;

  const mapOperand = (op: RuleOperand): string => {
    switch (op) {
      case 'close': return 'close';
      case 'open': return 'open';
      case 'high': return 'high';
      case 'low': return 'low';
      case 'volume': return 'volume';
      case 'rsi': return 'rsiVal';
      case 'emaFast': return 'emaFast';
      case 'emaSlow': return 'emaSlow';
      case 'macd': return 'macdLine';
      case 'macdSignal': return 'signalLine';
      case 'bbUpper': return 'bbUpper';
      case 'bbLower': return 'bbLower';
      default: return op;
    }
  };

  const formatRule = (r: CustomRule): string => {
    const left = mapOperand(r.left);
    const right = r.rightType === 'CONSTANT' ? `${r.rightConstant ?? 0}` : mapOperand(r.rightIndicator || 'close');

    switch (r.operator) {
      case 'GREATER_THAN':
        return `${left} > ${right}`;
      case 'LESS_THAN':
        return `${left} < ${right}`;
      case 'CROSS_ABOVE':
        return `ta.crossover(${left}, ${right})`;
      case 'CROSS_BELOW':
        return `ta.crossunder(${left}, ${right})`;
      default:
        return `${left} == ${right}`;
    }
  };

  const buyConditions = (rules.buyRules || []).map(formatRule);
  const sellConditions = (rules.sellRules || []).map(formatRule);

  const buyJoiner = rules.buyLogic === 'AND' ? ' and ' : ' or ';
  const sellJoiner = rules.sellLogic === 'AND' ? ' and ' : ' or ';

  const pineBuyStr = buyConditions.length > 0 ? buyConditions.join(buyJoiner) : 'ta.crossover(ta.ema(close, 9), ta.ema(close, 21))';
  const pineSellStr = sellConditions.length > 0 ? sellConditions.join(sellJoiner) : 'ta.crossunder(ta.ema(close, 9), ta.ema(close, 21))';

  return `//@version=5
strategy("${strategyName}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === USER INPUT PARAMETERS ===
fastPeriod = input.int(9, title="Fast EMA Period", minval=1)
slowPeriod = input.int(21, title="Slow EMA Period", minval=1)
rsiPeriod  = input.int(14, title="RSI Period", minval=1)
macdFast   = input.int(12, title="MACD Fast Length", minval=1)
macdSlow   = input.int(26, title="MACD Slow Length", minval=1)
macdSignal = input.int(9, title="MACD Signal Length", minval=1)
bbPeriod   = input.int(20, title="Bollinger Period", minval=1)
bbMult     = input.float(2.0, title="Bollinger StdDev", minval=0.5, step=0.1)

// === RISK MANAGEMENT ===
useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === TECHNICAL INDICATOR CALCULATIONS ===
emaFast = ta.ema(close, fastPeriod)
emaSlow = ta.ema(close, slowPeriod)
rsiVal  = ta.rsi(close, rsiPeriod)
[macdLine, signalLine, histLine] = ta.macd(close, macdFast, macdSlow, macdSignal)
[bbMiddle, bbUpper, bbLower]     = ta.bb(close, bbPeriod, bbMult)

// === CONVERTED RULES CONDITIONS ===
longCondition = ${pineBuyStr}
exitCondition = ${pineSellStr}

// === STRATEGY EXECUTION ORDERS ===
if (longCondition)
    strategy.entry("Long", strategy.long)

if (exitCondition)
    strategy.close("Long")

// Bracket Stop Loss & Take Profit
if (strategy.position_size > 0)
    stopLevel = strategy.position_avg_price * (1 - slPercent)
    takeLevel = strategy.position_avg_price * (1 + tpPercent)
    strategy.exit("Exit Bracket", from_entry="Long", stop=useStopLoss ? stopLevel : na, limit=useTakeProfit ? takeLevel : na)

// === PLOTS & VISUAL SIGNALS ===
plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)
plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(exitCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`;
}

/**
 * Converts any Preset Strategy into TradingView Pine Script (v5)
 */
export function convertPresetToPineScript(
  strategy: StrategyConfig,
  settings?: BacktestSettings
): string {
  const initCap = settings?.initialCapital ?? 10000;
  const qtyVal = settings?.positionSizePercent ?? 100;
  const commVal = settings?.takerFeePercent ?? 0.08;
  const tpVal = settings?.takeProfitPercent ?? 7.0;
  const slVal = settings?.stopLossPercent ?? 3.5;

  if (strategy.id === 'CUSTOM_SCRIPT' && strategy.customScript) {
    return convertJsToPineScript(strategy.customScript, strategy.name, settings);
  }

  if (strategy.id === 'CUSTOM_RULES' && strategy.customRules) {
    return convertRulesToPineScript(strategy.customRules, strategy.name, settings);
  }

  if (strategy.customPineScript) {
    return strategy.customPineScript;
  }

  switch (strategy.id) {
    case 'GOLDEN_ALPHA': {
      const fastP = Number(strategy.params.fastPeriod || 9);
      const slowP = Number(strategy.params.slowPeriod || 21);
      const macroP = Number(strategy.params.macroTrendPeriod || 50);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
fastPeriod  = input.int(${fastP}, title="Fast EMA Period", minval=1)
slowPeriod  = input.int(${slowP}, title="Slow EMA Period", minval=1)
macroPeriod = input.int(${macroP}, title="Macro Trend EMA Period", minval=1)

// === INDICATORS ===
emaFast  = ta.ema(close, fastPeriod)
emaSlow  = ta.ema(close, slowPeriod)
emaMacro = ta.ema(close, macroPeriod)

// === SIGNALS ===
longCondition  = ta.crossover(emaFast, emaSlow) and close > emaMacro
shortCondition = ta.crossunder(emaFast, emaSlow) and close < emaMacro

exitLongCondition  = ta.crossunder(emaFast, emaSlow)
exitShortCondition = ta.crossover(emaFast, emaSlow)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (exitLongCondition)
    strategy.close("Long")

if (shortCondition)
    strategy.entry("Short", strategy.short)

if (exitShortCondition)
    strategy.close("Short")

plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)
plot(emaMacro, title="Macro 50 EMA", color=color.purple, linewidth=2)
plotshape(longCondition, title="Long Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Short Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SHORT")
`;
    }

    case 'EMA_CROSS': {
      const fastP = Number(strategy.params.fastPeriod || 9);
      const slowP = Number(strategy.params.slowPeriod || 21);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
fastPeriod = input.int(${fastP}, title="Fast EMA Period", minval=1)
slowPeriod = input.int(${slowP}, title="Slow EMA Period", minval=1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === INDICATORS ===
emaFast = ta.ema(close, fastPeriod)
emaSlow = ta.ema(close, slowPeriod)

// === SIGNALS ===
longCondition  = ta.crossover(emaFast, emaSlow)
shortCondition = ta.crossunder(emaFast, emaSlow)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plot(emaFast, title="Fast EMA", color=color.cyan, linewidth=2)
plot(emaSlow, title="Slow EMA", color=color.orange, linewidth=2)
plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`;
    }

    case 'RSI_REVERSION': {
      const period = Number(strategy.params.period || 14);
      const oversold = Number(strategy.params.oversold || 30);
      const overbought = Number(strategy.params.overbought || 70);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
rsiPeriod  = input.int(${period}, title="RSI Period", minval=1)
oversold   = input.int(${oversold}, title="Oversold Level", minval=1, maxval=50)
overbought = input.int(${overbought}, title="Overbought Level", minval=50, maxval=100)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === INDICATORS ===
rsiVal = ta.rsi(close, rsiPeriod)

// === SIGNALS ===
longCondition  = ta.crossover(rsiVal, oversold) or (rsiVal < oversold and close > open)
shortCondition = ta.crossunder(rsiVal, overbought) or (rsiVal > overbought)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`;
    }

    case 'MACD_MOMENTUM': {
      const fastP = Number(strategy.params.fastPeriod || 12);
      const slowP = Number(strategy.params.slowPeriod || 26);
      const sigP = Number(strategy.params.signalPeriod || 9);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
fastPeriod   = input.int(${fastP}, title="Fast Length", minval=1)
slowPeriod   = input.int(${slowP}, title="Slow Length", minval=1)
signalPeriod = input.int(${sigP}, title="Signal Length", minval=1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === INDICATORS ===
[macdLine, signalLine, histLine] = ta.macd(close, fastPeriod, slowPeriod, signalPeriod)

// === SIGNALS ===
longCondition  = ta.crossover(macdLine, signalLine) and histLine > 0
shortCondition = ta.crossunder(macdLine, signalLine)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plotshape(longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(shortCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
`;
    }

    case 'BOLLINGER_BREAKOUT': {
      const period = Number(strategy.params.period || 20);
      const stdDev = Number(strategy.params.stdDev || 2.0);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
bbPeriod = input.int(${period}, title="Bollinger Period", minval=1)
bbMult   = input.float(${stdDev.toFixed(1)}, title="StdDev Multiplier", minval=0.5, step=0.1)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === INDICATORS ===
[bbMiddle, bbUpper, bbLower] = ta.bb(close, bbPeriod, bbMult)

// === SIGNALS ===
longCondition  = ta.crossover(close, bbLower) or close < bbLower
shortCondition = ta.crossunder(close, bbUpper) or close > bbUpper

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plot(bbUpper, title="Upper Band", color=color.blue)
plot(bbMiddle, title="Middle Band", color=color.gray)
plot(bbLower, title="Lower Band", color=color.blue)
`;
    }

    case 'SUPERTREND': {
      const period = Number(strategy.params.period || 10);
      const mult = Number(strategy.params.multiplier || 3.0);
      return `//@version=5
strategy("${strategy.name}", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
atrPeriod = input.int(${period}, title="ATR Period", minval=1)
factor    = input.float(${mult.toFixed(1)}, title="ATR Multiplier", minval=0.5, step=0.5)

useTakeProfit = input.bool(true, title="Enable Take Profit")
tpPercent     = input.float(${tpVal.toFixed(1)}, title="Take Profit %", minval=0.1, step=0.1) / 100
useStopLoss   = input.bool(true, title="Enable Stop Loss")
slPercent     = input.float(${slVal.toFixed(1)}, title="Stop Loss %", minval=0.1, step=0.1) / 100

// === INDICATORS ===
[supertrend, direction] = ta.supertrend(factor, atrPeriod)

// In Pine Script, direction == -1 is bullish, 1 is bearish
longCondition  = ta.change(direction) < 0 and direction == -1
shortCondition = ta.change(direction) > 0 and direction == 1

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

if (strategy.position_size > 0)
    strategy.exit("Exit SL/TP", from_entry="Long", stop=useStopLoss ? strategy.position_avg_price * (1 - slPercent) : na, limit=useTakeProfit ? strategy.position_avg_price * (1 + tpPercent) : na)

plot(direction == -1 ? supertrend : na, title="Supertrend Bull", color=color.green, linewidth=2, style=plot.style_linebr)
plot(direction == 1 ? supertrend : na, title="Supertrend Bear", color=color.red, linewidth=2, style=plot.style_linebr)
`;
    }

    case 'GRID_TRADING': {
      const levels = Number(strategy.params.gridLevels || 5);
      const chan = Number(strategy.params.channelPeriod || 20);
      return `//@version=5
strategy("Dynamic Grid Scalper", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=${qtyVal}, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
channelPeriod = input.int(${chan}, title="Channel Period", minval=5)
gridLevels    = input.int(${levels}, title="Grid Sub-Levels", minval=2, maxval=12)

[bbMiddle, bbUpper, bbLower] = ta.bb(close, channelPeriod, 2.0)
spread = (bbUpper - bbLower) / gridLevels

longCondition  = close <= (bbLower + spread)
shortCondition = close >= (bbUpper - spread)

if (longCondition)
    strategy.entry("Grid Long", strategy.long)

if (shortCondition)
    strategy.close("Grid Long")

plot(bbUpper, title="Upper Grid Limit", color=color.blue)
plot(bbLower, title="Lower Grid Limit", color=color.blue)
`;
    }

    case 'DCA_ACCUMULATION': {
      const interval = Number(strategy.params.intervalCandles || 10);
      const tpTarget = Number(strategy.params.takeProfit || 8);
      return `//@version=5
strategy("Smart DCA Accumulator", overlay=true, initial_capital=${initCap}, default_qty_type=strategy.percent_of_equity, default_qty_value=20, commission_type=strategy.commission.percent, commission_value=${commVal})

// === PARAMETERS ===
intervalBars = input.int(${interval}, title="DCA Interval (Bars)", minval=1)
takeProfitPct = input.float(${tpTarget.toFixed(1)}, title="Take Profit %", minval=0.5) / 100

// Accumulate every N bars
dcaCondition = (bar_index % intervalBars == 0)

if (dcaCondition)
    strategy.entry("DCA", strategy.long)

if (strategy.position_size > 0)
    targetPrice = strategy.position_avg_price * (1 + takeProfitPct)
    strategy.exit("Take Profit", from_entry="DCA", limit=targetPrice)
`;
    }

    case 'LIQUIDITY_SWEEP': {
      return strategy.customPineScript || LIQUIDITY_SWEEP_PINE_SCRIPT;
    }

    default:
      return DEFAULT_PINE_SCRIPT;
  }
}

/**
 * Transpiles and evaluates Pine Script v5/v6 code to a high-fidelity signal generator
 * in JavaScript for browser backtesting simulation.
 * Fully supports custom indicators, multi-condition filters, macro trend EMAs,
 * volume metrics, swing pivot liquidity sweeps, and Bollinger Bands.
 */
export function compilePineScriptToSimulator(
  pineCode: string,
  candles?: Candle[],
  userParams?: Record<string, any>
): (
  candle: Candle,
  prevCandle: Candle | null,
  indicators: any,
  position: any,
  barIndex: number,
  prevIndicators: any
) => any {
  // 0. Specialized high-performance engine for Liquidity Sweep Reversal strategies
  if (isLiquiditySweepScript(pineCode)) {
    try {
      const sweepParams = { ...extractLiquiditySweepParams(pineCode), ...(userParams || {}) };
      const sweepSim = simulateLiquiditySweep(candles || [], sweepParams);
      return (candle, prevCandle, indicators, position, barIndex) => {
        const sig = sweepSim.signalsMap.get(barIndex);
        if (sig) {
          return {
            signal: sig.signal,
            stopLossPrice: sig.sl,
            takeProfitPrice: sig.tp,
            breakevenTriggerPrice: sig.beTrigger,
          };
        }
        return 'HOLD';
      };
    } catch (sweepErr) {
      console.warn('Error running specialized liquidity sweep simulator:', sweepErr);
    }
  }

  // 1. Extract inputs and parameter variables
  const params: Record<string, any> = {};
  const variableLines: string[] = [];
  const lines = pineCode.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line || line.startsWith('@')) continue;

    // Matches var = input.int(defVal, ...) or typed inputs: int/float/bool/string var = input(...)
    const inputMatch =
      line.match(/^(?:(?:var|varip)\s+)?(?:int|float|bool|string|color)\s+([a-zA-Z0-9_]+)\s*(?::=|=)\s*input(?:\.[a-zA-Z0-9_]+)?\s*\(\s*([^,\)]+)(?:\s*,\s*[^)]*)?\)\s*(\/[0-9\.]+|\*[0-9\.]+)?/i) ||
      line.match(/^([a-zA-Z0-9_]+)\s*(?::=|=)\s*input(?:\.[a-zA-Z0-9_]+)?\s*\(\s*([^,\)]+)(?:\s*,\s*[^)]*)?\)\s*(\/[0-9\.]+|\*[0-9\.]+)?/i);

    if (inputMatch) {
      const varName = inputMatch[1];
      let valStr = inputMatch[2].trim().replace(/^["']|["']$/g, '');
      const num = Number(valStr);
      let parsedVal: any = isNaN(num) ? (valStr === 'true' ? true : valStr === 'false' ? false : valStr) : num;
      if (typeof parsedVal === 'number' && inputMatch[3]) {
        const op = inputMatch[3].trim();
        if (op.startsWith('/')) parsedVal = parsedVal / Number(op.slice(1));
        else if (op.startsWith('*')) parsedVal = parsedVal * Number(op.slice(1));
      }
      params[varName] = parsedVal;
      variableLines.push(`var ${varName} = ${JSON.stringify(parsedVal)};`);
      continue;
    }

    // Matches typed or untyped number/bool: var = 123 or float x = 0.05
    const numBoolMatch =
      line.match(/^(?:(?:var|varip)\s+)?(?:int|float|bool|string|color)\s+([a-zA-Z0-9_]+)\s*(?::=|=)\s*([0-9\.]+|true|false)\s*(\/[0-9\.]+|\*[0-9\.]+)?\s*$/i) ||
      line.match(/^([a-zA-Z0-9_]+)\s*(?::=|=)\s*([0-9\.]+|true|false)\s*(\/[0-9\.]+|\*[0-9\.]+)?\s*$/i);

    if (numBoolMatch) {
      const varName = numBoolMatch[1];
      const rawVal = numBoolMatch[2];
      let parsedVal: any = rawVal === 'true' ? true : rawVal === 'false' ? false : Number(rawVal);
      if (typeof parsedVal === 'number' && numBoolMatch[3]) {
        const op = numBoolMatch[3].trim();
        if (op.startsWith('/')) parsedVal = parsedVal / Number(op.slice(1));
        else if (op.startsWith('*')) parsedVal = parsedVal * Number(op.slice(1));
      }
      params[varName] = parsedVal;
      variableLines.push(`var ${varName} = ${JSON.stringify(parsedVal)};`);
      continue;
    }
  }

  // Apply user runtime overrides if provided
  if (userParams) {
    Object.keys(userParams).forEach((k) => {
      if (userParams[k] !== undefined) {
        params[k] = userParams[k];
      }
    });
  }

  // 2. Precompute indicator series if candles are provided
  const seriesMap: Record<string, (number | null)[]> = {};
  if (candles && candles.length > 0) {
    const closes = candles.map((c) => c.close);
    const opens = candles.map((c) => c.open);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    // Scan for technical indicator assignments
    for (const rawLine of lines) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;

      // ta.ema(source, length)
      const emaMatch = line.match(/([a-zA-Z0-9_]+)\s*(?::=|=)\s*ta\.ema\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (emaMatch) {
        const varName = emaMatch[1];
        const srcName = emaMatch[2].toLowerCase();
        const lenStr = emaMatch[3];
        const period = params[lenStr] || Number(lenStr) || 14;
        const srcData = srcName === 'open' ? opens : srcName === 'high' ? highs : srcName === 'low' ? lows : srcName === 'volume' ? volumes : closes;
        seriesMap[varName] = calculateAdaptiveEMA(srcData, period);
      }

      // ta.sma(source, length)
      const smaMatch = line.match(/([a-zA-Z0-9_]+)\s*(?::=|=)\s*ta\.sma\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (smaMatch) {
        const varName = smaMatch[1];
        const srcName = smaMatch[2].toLowerCase();
        const lenStr = smaMatch[3];
        const period = params[lenStr] || Number(lenStr) || 20;
        const srcData = srcName === 'open' ? opens : srcName === 'high' ? highs : srcName === 'low' ? lows : srcName === 'volume' ? volumes : closes;
        seriesMap[varName] = calculateAdaptiveSMA(srcData, period);
      }

      // ta.rsi(source, length)
      const rsiMatch = line.match(/([a-zA-Z0-9_]+)\s*(?::=|=)\s*ta\.rsi\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (rsiMatch) {
        const varName = rsiMatch[1];
        const lenStr = rsiMatch[3];
        const period = params[lenStr] || Number(lenStr) || 14;
        seriesMap[varName] = calculateRSI(closes, period);
      }

      // ta.atr(length)
      const atrMatch = line.match(/([a-zA-Z0-9_]+)\s*(?::=|=)\s*ta\.atr\s*\(\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/i);
      if (atrMatch) {
        const varName = atrMatch[1];
        const lenStr = atrMatch[2];
        const period = params[lenStr] || Number(lenStr) || 14;
        seriesMap[varName] = calculateATR(candles, period);
      }

      // [bbBasis, bbUpper, bbLower] = ta.bb(source, length, mult)
      const bbMatch = line.match(/\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*(?::=|=)\s*ta\.bb\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*,\s*([0-9\.]+|[a-zA-Z0-9_]+)\s*\)/i);
      if (bbMatch) {
        const basisName = bbMatch[1];
        const upperName = bbMatch[2];
        const lowerName = bbMatch[3];
        const len = params[bbMatch[5]] || Number(bbMatch[5]) || 20;
        const mult = params[bbMatch[6]] || Number(bbMatch[6]) || 2.0;
        const bb = calculateBollingerBands(closes, len, mult);
        seriesMap[basisName] = bb.middle;
        seriesMap[upperName] = bb.upper;
        seriesMap[lowerName] = bb.lower;
      }

      // [supertrend, direction] = ta.supertrend(factor, atrPeriod)
      const stMatch = line.match(/\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*(?::=|=)\s*ta\.supertrend\s*\(\s*([0-9\.]+|[a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/i);
      if (stMatch) {
        const lineName = stMatch[1];
        const dirName = stMatch[2];
        const factor = params[stMatch[3]] || Number(stMatch[3]) || 3.0;
        const atrPeriod = params[stMatch[4]] || Number(stMatch[4]) || 10;
        const st = calculateSupertrend(candles, atrPeriod, factor);
        seriesMap[lineName] = st.line;
        // In Pine Script: -1 is uptrend (bull), 1 is downtrend (bear)
        const pineDir = st.trend.map((t) => (t === 1 ? -1 : 1));
        seriesMap[dirName] = pineDir;
        seriesMap['supertrend'] = st.line;
        seriesMap['direction'] = pineDir;
      }

      // [diplus, diminus, adx] = ta.dmi(length, smoothing)
      const dmiMatch = line.match(/\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*(?::=|=)\s*ta\.dmi\s*\(\s*([0-9]+|[a-zA-Z0-9_]+)\s*(?:,\s*([0-9]+|[a-zA-Z0-9_]+))?\s*\)/i);
      if (dmiMatch) {
        const p1 = dmiMatch[1];
        const p2 = dmiMatch[2];
        const p3 = dmiMatch[3];
        const len = params[dmiMatch[4]] || Number(dmiMatch[4]) || 14;
        const dmi = calculateDMI(candles, len);
        seriesMap[p1] = dmi.plusDI;
        seriesMap[p2] = dmi.minusDI;
        seriesMap[p3] = dmi.adx;
        seriesMap['plusDI'] = dmi.plusDI;
        seriesMap['minusDI'] = dmi.minusDI;
        seriesMap['diplus'] = dmi.plusDI;
        seriesMap['diminus'] = dmi.minusDI;
        seriesMap['adx'] = dmi.adx;
        seriesMap['adxVal'] = dmi.adx;
      }

      // [macdLine, signalLine, histLine] = ta.macd(source, fast, slow, signal)
      const macdMatch = line.match(/\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*(?::=|=)\s*ta\.macd\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/i);
      if (macdMatch) {
        const lineName = macdMatch[1];
        const signalName = macdMatch[2];
        const histName = macdMatch[3];
        const fast = params[macdMatch[5]] || Number(macdMatch[5]) || 12;
        const slow = params[macdMatch[6]] || Number(macdMatch[6]) || 26;
        const sig = params[macdMatch[7]] || Number(macdMatch[7]) || 9;
        const m = calculateMACD(closes, fast, slow, sig);
        seriesMap[lineName] = m.macd;
        seriesMap[signalName] = m.signal;
        seriesMap[histName] = m.histogram;
      }
    }

    // Precompute inline ta.sma and ta.ema expressions
    const inlineSmaRegex = /ta\.sma\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/gi;
    let inlineMatch;
    while ((inlineMatch = inlineSmaRegex.exec(pineCode)) !== null) {
      const srcName = inlineMatch[1].toLowerCase();
      const lenStr = inlineMatch[2];
      const period = params[lenStr] || Number(lenStr) || 20;
      const key = `__inline_sma_${srcName}_${period}`;
      const srcData = srcName === 'open' ? opens : srcName === 'high' ? highs : srcName === 'low' ? lows : srcName === 'volume' ? volumes : closes;
      seriesMap[key] = calculateAdaptiveSMA(srcData, period);
    }

    const inlineEmaRegex = /ta\.ema\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/gi;
    while ((inlineMatch = inlineEmaRegex.exec(pineCode)) !== null) {
      const srcName = inlineMatch[1].toLowerCase();
      const lenStr = inlineMatch[2];
      const period = params[lenStr] || Number(lenStr) || 14;
      const key = `__inline_ema_${srcName}_${period}`;
      const srcData = srcName === 'open' ? opens : srcName === 'high' ? highs : srcName === 'low' ? lows : srcName === 'volume' ? volumes : closes;
      seriesMap[key] = calculateAdaptiveEMA(srcData, period);
    }

    // If ADX or DMI is referenced in script, precalculate native Wilder ADX and DMI
    if (pineCode.includes('adxVal') || pineCode.includes('adx') || pineCode.includes('plusDI') || pineCode.includes('minusDI')) {
      const dmi = calculateDMI(candles, 14);
      seriesMap['adxVal'] = dmi.adx;
      seriesMap['adx'] = dmi.adx;
      seriesMap['plusDI'] = dmi.plusDI;
      seriesMap['minusDI'] = dmi.minusDI;
    }

    if (!seriesMap['atrVal']) seriesMap['atrVal'] = calculateATR(candles, 14);
    if (!seriesMap['atr']) seriesMap['atr'] = seriesMap['atrVal'];
    if (!seriesMap['tr']) seriesMap['tr'] = seriesMap['atrVal'];

    // Ensure common aliases and defaults are always available
    if (!seriesMap['emaFast']) seriesMap['emaFast'] = calculateAdaptiveEMA(closes, params['fastLength'] || params['fastPeriod'] || 9);
    if (!seriesMap['emaSlow']) seriesMap['emaSlow'] = calculateAdaptiveEMA(closes, params['slowLength'] || params['slowPeriod'] || 21);
    if (!seriesMap['ema200']) seriesMap['ema200'] = calculateAdaptiveEMA(closes, params['trendLength'] || 200);
    if (!seriesMap['emaTrend']) seriesMap['emaTrend'] = seriesMap['ema200'] || calculateAdaptiveEMA(closes, params['macroTrendPeriod'] || 200);
    if (!seriesMap['rsiVal']) seriesMap['rsiVal'] = calculateRSI(closes, params['rsiLength'] || params['rsiPeriod'] || 14);
    if (!seriesMap['volMa']) seriesMap['volMa'] = calculateAdaptiveSMA(volumes, 20);
  }

  // 3. Robust Multi-line Variable Assignment Map
  const assignmentMap = new Map<string, string>();
  let inStrategyHeader = false;
  let strategyParenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].replace(/\/\/.*$/, '').trim();
    if (!rawLine || rawLine.startsWith('@') || rawLine.startsWith('type ') || rawLine.startsWith('table.')) continue;

    // Skip strategy(...) or indicator(...) declaration block
    if (/^(?:strategy|indicator)\s*\(/i.test(rawLine)) {
      inStrategyHeader = true;
      strategyParenDepth = 0;
    }
    if (inStrategyHeader) {
      strategyParenDepth += (rawLine.match(/\(/g) || []).length - (rawLine.match(/\)/g) || []).length;
      if (strategyParenDepth <= 0) {
        inStrategyHeader = false;
      }
      continue;
    }

    // Support single and multi-variable assignments, typed or untyped, with = or :=
    const assignMatch =
      rawLine.match(/^(?:(?:var|varip)\s+)?(?:int|float|bool|string|color)\s+([a-zA-Z0-9_]+|\[[^\]]+\])\s*(?::=|=)\s*(.+)$/i) ||
      rawLine.match(/^([a-zA-Z0-9_]+|\[[^\]]+\])\s*(?::=|=)\s*(.+)$/i);

    if (assignMatch) {
      const varTarget = assignMatch[1];
      let expr = assignMatch[2].trim().replace(/[,;]+$/, '');

      // If expression has unmatched closing parens, it belongs to an outer function call
      const openPInitial = (expr.match(/\(/g) || []).length;
      const closePInitial = (expr.match(/\)/g) || []).length;
      if (closePInitial > openPInitial) continue;

      // Check if expression continues onto subsequent lines (unbalanced parens/brackets or trailing operators)
      let openParen = openPInitial - closePInitial;
      let openBracket = (expr.match(/\[/g) || []).length - (expr.match(/\]/g) || []).length;

      while (
        (openParen > 0 || openBracket > 0 || /(?:\s+(?:and|or)|[?:+\-*\/])$/i.test(expr)) &&
        i + 1 < lines.length
      ) {
        i++;
        const nextLine = lines[i].replace(/\/\/.*$/, '').trim();
        if (!nextLine) continue;
        if (/^(?:[a-zA-Z0-9_]+|\[[^\]]+\])\s*(?::=|=)/i.test(nextLine) || /^(?:if\b|strategy\.|plot|fill|barcolor|bgcolor)/i.test(nextLine)) {
          i--; // Next statement started
          break;
        }
        expr += ' ' + nextLine;
        openParen = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
        openBracket = (expr.match(/\[/g) || []).length - (expr.match(/\]/g) || []).length;
      }

      expr = expr.replace(/[,;]+$/, '').trim();

      if (varTarget.startsWith('[') && varTarget.endsWith(']')) {
        const destVars = varTarget.slice(1, -1).split(',').map((s) => s.trim());
        destVars.forEach((v) => {
          if (v) assignmentMap.set(v, expr);
        });
      } else {
        assignmentMap.set(varTarget, expr);
      }
    }
  }

  // 4. Extract longCondition and shortCondition / exitCondition
  let longExpr = 'false';
  let shortExpr = 'false';
  let exitLongExpr = 'false';
  let exitShortExpr = 'false';

  const longVarNames = [
    'doLong', 'longCondition', 'buyCondition', 'longSignal', 'buySignal', 'enterLong',
    'longEntry', 'buy_signal', 'long_signal', 'bullCondition', 'bullishSignal',
    'bullish', 'buy', 'long', 'sweepLowSignal'
  ];

  const exitVarNames = [
    'exitCondition', 'exitLong', 'exitShort', 'closeCondition', 'exitSignal',
    'takeProfit', 'stopLoss'
  ];

  const shortVarNames = [
    'doShort', 'shortCondition', 'sellCondition', 'shortSignal', 'sellSignal',
    'shortEntry', 'enterShort', 'sell_signal', 'short_signal', 'bearCondition',
    'bearishSignal', 'bearish', 'sell', 'short', 'sweepHighSignal'
  ];

  // Look up in assignmentMap
  for (const name of longVarNames) {
    if (assignmentMap.has(name)) {
      longExpr = assignmentMap.get(name)!;
      break;
    }
  }

  for (const name of exitVarNames) {
    if (assignmentMap.has(name)) {
      exitLongExpr = assignmentMap.get(name)!;
      break;
    }
  }

  for (const name of shortVarNames) {
    if (assignmentMap.has(name)) {
      shortExpr = assignmentMap.get(name)!;
      break;
    }
  }

  // Strategy orders check
  if (longExpr === 'false') {
    const whenLong = pineCode.match(/strategy\.entry\([^)]*?(?:strategy\.long|["'](?:long|buy)["'])[^)]*?,\s*when\s*=\s*([^,\)\n\r]+)/i);
    if (whenLong && whenLong[1]) {
      const cond = whenLong[1].trim();
      longExpr = assignmentMap.get(cond) || cond;
    } else {
      const ifLongMatch = pineCode.match(/if\s*(?:\(([^)]+)\)|([^\n\r{]+?))\s*(?:[\n\r]+[ \t]+|\s*\{?\s*)strategy\.entry\([^)]*(?:long|buy)/i);
      if (ifLongMatch) {
        const cond = (ifLongMatch[1] || ifLongMatch[2]).replace(/\/\/.*$/, '').trim();
        longExpr = assignmentMap.get(cond) || cond;
      }
    }
  }

  // Check specific strategy.close for Long
  if (exitLongExpr === 'false') {
    const ifCloseLongMatch =
      pineCode.match(/if\s*(?:\(([^)]+)\)|([^\n\r{]+?))\s*(?:[\n\r]+[ \t]+|\s*\{?\s*)strategy\.(?:close|exit)\s*\(\s*["'](?:Long|Buy|long|buy)[^"']*["']/i) ||
      pineCode.match(/if\s*(?:\(([^)]+)\)|([^\n\r{]+?))\s*(?:[\n\r]+[ \t]+|\s*\{?\s*)strategy\.(?:close|exit)/i);
    if (ifCloseLongMatch) {
      const cond = (ifCloseLongMatch[1] || ifCloseLongMatch[2]).replace(/\/\/.*$/, '').trim();
      exitLongExpr = assignmentMap.get(cond) || cond;
    }
  }

  // Check short entry
  if (shortExpr === 'false') {
    const whenShort = pineCode.match(/strategy\.entry\([^)]*?(?:strategy\.short|["'](?:short|sell)["'])[^)]*?,\s*when\s*=\s*([^,\)\n\r]+)/i);
    if (whenShort && whenShort[1]) {
      const cond = whenShort[1].trim();
      shortExpr = assignmentMap.get(cond) || cond;
    } else {
      const ifShortMatch = pineCode.match(/if\s*(?:\(([^)]+)\)|([^\n\r{]+?))\s*(?:[\n\r]+[ \t]+|\s*\{?\s*)strategy\.entry\([^)]*?(?:strategy\.short|["'](?:short|sell)["'])/i);
      if (ifShortMatch) {
        const cond = (ifShortMatch[1] || ifShortMatch[2]).replace(/\/\/.*$/, '').trim();
        shortExpr = assignmentMap.get(cond) || cond;
      }
    }
  }

  // Check specific strategy.close for Short
  if (exitShortExpr === 'false') {
    const ifCloseShortMatch = pineCode.match(/if\s*(?:\(([^)]+)\)|([^\n\r{]+?))\s*(?:[\n\r]+[ \t]+|\s*\{?\s*)strategy\.(?:close|exit)\s*\(\s*["'](?:Short|Sell|short|sell)[^"']*["']/i);
    if (ifCloseShortMatch) {
      const cond = (ifCloseShortMatch[1] || ifCloseShortMatch[2]).replace(/\/\/.*$/, '').trim();
      exitShortExpr = assignmentMap.get(cond) || cond;
    }
  }

  // Visual plotshape labels fallback
  if (longExpr === 'false') {
    const plotshapeBuyMatch = pineCode.match(/plotshape\s*\(\s*([^,\)]+)[^)]*?(?:text\s*=\s*["']BUY["']|title\s*=\s*["'][^"']*buy[^"']*["']|shape\.triangleup)/i);
    if (plotshapeBuyMatch && plotshapeBuyMatch[1]) {
      const cand = plotshapeBuyMatch[1].trim();
      if (cand && cand !== 'na' && cand !== 'false') {
        longExpr = assignmentMap.get(cand) || cand;
      }
    }
  }

  if (shortExpr === 'false' && exitLongExpr === 'false') {
    const plotshapeSellMatch = pineCode.match(/plotshape\s*\(\s*([^,\)]+)[^)]*?(?:text\s*=\s*["']SELL["']|title\s*=\s*["'][^"']*(?:sell|exit)[^"']*["']|shape\.triangledown)/i);
    if (plotshapeSellMatch && plotshapeSellMatch[1]) {
      const cand = plotshapeSellMatch[1].trim();
      if (cand && cand !== 'na' && cand !== 'false') {
        shortExpr = assignmentMap.get(cand) || cand;
        exitLongExpr = shortExpr;
      }
    }
  }

  // Ensure exits are set if counterpart entry exists (reversal default)
  if (exitLongExpr === 'false' && shortExpr !== 'false') {
    exitLongExpr = shortExpr;
  }
  if (exitShortExpr === 'false' && longExpr !== 'false') {
    exitShortExpr = longExpr;
  }

  // 5. Extract intermediate filter declarations
  const intermediateLines: { name: string; expr: string }[] = [];
  const primarySignals = new Set([
    'longCondition', 'buyCondition', 'shortCondition', 'exitCondition', 'sellCondition',
    'exitLong', 'exitShort', 'closeCondition', 'adxVal', 'adx', 'atrVal', 'atr',
    'dmPlus', 'dmMinus', 'tr', 'plusDI', 'minusDI', 'diplus', 'diminus'
  ]);

  const visualOrColorRegex = /^(?:color\.|#|switch\b|plot|barcolor|bgcolor)/i;
  const isVisualVar = (name: string, expr: string): boolean => {
    return (
      visualOrColorRegex.test(expr) ||
      /color|gradient|trans|show_|marker|candle|bg_/i.test(name) ||
      /^p_/i.test(name) ||
      /^st_(?:up|dn)$/i.test(name) ||
      /^grad[0-9]/i.test(name) ||
      /^step_/i.test(name)
    );
  };

  assignmentMap.forEach((expr, name) => {
    if (
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) &&
      !expr.startsWith('input') &&
      !expr.startsWith('strategy') &&
      !isVisualVar(name, expr) &&
      !/^['"].*['"]$/.test(expr) &&
      !seriesMap[name] &&
      !params[name] &&
      !primarySignals.has(name)
    ) {
      intermediateLines.push({ name, expr });
    }
  });

  // Helper to convert a Pine expression to valid JS evaluator
  let coCount = 0;
  let cuCount = 0;
  let chCount = 0;

  const transpilePineCondition = (pine: string): string => {
    let js = pine.replace(/\/\/.*$/, '').trim();

    // Math replacements
    js = js.replace(/\bmath\.max\b/g, 'Math.max');
    js = js.replace(/\bmath\.min\b/g, 'Math.min');
    js = js.replace(/\bmath\.abs\b/g, 'Math.abs');
    js = js.replace(/\bmath\.sqrt\b/g, 'Math.sqrt');
    js = js.replace(/\bmath\.round\b/g, 'Math.round');
    js = js.replace(/\bmath\.floor\b/g, 'Math.floor');
    js = js.replace(/\bmath\.ceil\b/g, 'Math.ceil');
    js = js.replace(/\bmath\.pow\b/g, 'Math.pow');

    // Inline ta.sma replacement to precomputed series
    js = js.replace(/ta\.sma\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/gi, (_, s, l) => {
      const p = params[l] || Number(l) || 20;
      return `(seriesMap['__inline_sma_${s.toLowerCase()}_${p}'] ? seriesMap['__inline_sma_${s.toLowerCase()}_${p}'][barIndex] : volume)`;
    });

    // Inline ta.ema replacement to precomputed series
    js = js.replace(/ta\.ema\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([0-9]+|[a-zA-Z0-9_]+)\s*\)/gi, (_, s, l) => {
      const p = params[l] || Number(l) || 14;
      return `(seriesMap['__inline_ema_${s.toLowerCase()}_${p}'] ? seriesMap['__inline_ema_${s.toLowerCase()}_${p}'][barIndex] : close)`;
    });

    // Boolean logic
    js = js.replace(/\band\b/g, '&&');
    js = js.replace(/\bor\b/g, '||');
    js = js.replace(/\bnot\s+/g, '!');

    // na(...) and not na(...) functions
    js = js.replace(/!\s*na\s*\(\s*([^)]+)\s*\)/g, '($1 !== null && typeof $1 !== "undefined" && !Number.isNaN($1))');
    js = js.replace(/\bnot\s+na\s*\(\s*([^)]+)\s*\)/g, '($1 !== null && typeof $1 !== "undefined" && !Number.isNaN($1))');
    js = js.replace(/\bna\s*\(\s*([^)]+)\s*\)/g, '($1 === null || typeof $1 === "undefined" || Number.isNaN($1))');

    // ta.crossover(a, b) -> __crossover('co_X', a, b)
    js = js.replace(/ta\.crossover\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, (_, a, b) => {
      return `__crossover('co_${coCount++}', ${a.trim()}, ${b.trim()})`;
    });

    // ta.crossunder(a, b) -> __crossunder('cu_X', a, b)
    js = js.replace(/ta\.crossunder\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, (_, a, b) => {
      return `__crossunder('cu_${cuCount++}', ${a.trim()}, ${b.trim()})`;
    });

    // ta.change(a) -> __change('ch_X', a)
    js = js.replace(/ta\.change\s*\(\s*([^)]+)\s*\)/g, (_, a) => {
      return `__change('ch_${chCount++}', ${a.trim()})`;
    });

    // Pine built-ins
    js = js.replace(/\bstrategy\.position_size\s*>\s*0\b/g, '(position && position.type === "LONG")');
    js = js.replace(/\bstrategy\.position_size\s*<\s*0\b/g, '(position && position.type === "SHORT")');
    js = js.replace(/\bstrategy\.position_size\s*==\s*0\b/g, '(!position)');
    js = js.replace(/\bstrategy\.position_size\b/g, '(position ? (position.type === "LONG" ? 1 : -1) : 0)');
    js = js.replace(/\bstrategy\.position_avg_price\b/g, '(position ? position.entryPrice : close)');
    js = js.replace(/\bbar_index\b/g, 'barIndex');
    js = js.replace(/\bna\b/g, 'null');

    // Price action and variable history offsets (e.g., close[1], high[2], myVar[1])
    js = js.replace(/\bclose\[1\]/g, '(prevCandle ? prevCandle.close : close)');
    js = js.replace(/\bopen\[1\]/g, '(prevCandle ? prevCandle.open : open)');
    js = js.replace(/\bhigh\[1\]/g, '(prevCandle ? prevCandle.high : high)');
    js = js.replace(/\blow\[1\]/g, '(prevCandle ? prevCandle.low : low)');
    js = js.replace(/\bvolume\[1\]/g, '(prevCandle ? prevCandle.volume : volume)');
    // If referencing seriesMap or other variable offset like val[1], fallback to seriesMap[val][barIndex - 1] if available
    js = js.replace(/\b([a-zA-Z0-9_]+)\[([0-9]+)\]/g, (_, name, offset) => {
      return `(seriesMap['${name}'] && barIndex >= ${offset} ? seriesMap['${name}'][barIndex - ${offset}] : (barIndex >= ${offset} && typeof ${name} !== 'undefined' ? ${name} : null))`;
    });

    return js;
  };

  const jsLong = transpilePineCondition(longExpr);
  const jsShort = transpilePineCondition(shortExpr);
  const jsExitLong = transpilePineCondition(exitLongExpr);
  const jsExitShort = transpilePineCondition(exitShortExpr);
  const varDeclarations = Object.entries(params)
    .filter(([k]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k))
    .map(([k, v]) => `var ${k} = ${JSON.stringify(v)};`)
    .join('\n');

  // Transpile intermediate variables
  const transpiledIntermediates = intermediateLines.map((item) => ({
    name: item.name,
    jsExpr: transpilePineCondition(item.expr),
  }));

  // Stateful tracking across bars for crossover & change detection
  const historyMap = new Map<string, { a: number | null; b: number | null }>();
  const changeMap = new Map<string, number | null>();

  const __crossover = (key: string, a: any, b: any): boolean => {
    const numA = (typeof a === 'number' && !isNaN(a)) ? a : null;
    const numB = (typeof b === 'number' && !isNaN(b)) ? b : null;
    const prev = historyMap.get(key);
    historyMap.set(key, { a: numA, b: numB });
    if (!prev || prev.a === null || prev.b === null || numA === null || numB === null) {
      return false;
    }
    return prev.a <= prev.b && numA > numB;
  };

  const __crossunder = (key: string, a: any, b: any): boolean => {
    const numA = (typeof a === 'number' && !isNaN(a)) ? a : null;
    const numB = (typeof b === 'number' && !isNaN(b)) ? b : null;
    const prev = historyMap.get(key);
    historyMap.set(key, { a: numA, b: numB });
    if (!prev || prev.a === null || prev.b === null || numA === null || numB === null) {
      return false;
    }
    return prev.a >= prev.b && numA < numB;
  };

  const __change = (key: string, val: any): number => {
    const numVal = (typeof val === 'number' && !isNaN(val)) ? val : null;
    const prev = changeMap.get(key);
    changeMap.set(key, numVal);
    if (prev === undefined || prev === null || numVal === null) return 0;
    return numVal - prev;
  };

  // Compile the execution function
  let fnBody = '';
  try {
    const intermediateCode = transpiledIntermediates
      .map((item) => `var ${item.name}; try { ${item.name} = (${item.jsExpr}); } catch(e) { ${item.name} = false; }`)
      .join('\n');

    const seriesDeclarations = Object.keys(seriesMap)
      .map((k) => `var ${k} = (seriesMap['${k}'] && seriesMap['${k}'][barIndex] !== undefined && seriesMap['${k}'][barIndex] !== null) ? seriesMap['${k}'][barIndex] : null;`)
      .join('\n');

    fnBody = `
      var close = candle.close;
      var open = candle.open;
      var high = candle.high;
      var low = candle.low;
      var volume = candle.volume;

      ${varDeclarations}

      // Precalculated series
      ${seriesDeclarations}

      // Standard indicator defaults if not already present in seriesMap
      var emaFast = (seriesMap['emaFast'] && seriesMap['emaFast'][barIndex] !== undefined && seriesMap['emaFast'][barIndex] !== null) ? seriesMap['emaFast'][barIndex] : (indicators ? indicators.emaFast : close);
      var emaSlow = (seriesMap['emaSlow'] && seriesMap['emaSlow'][barIndex] !== undefined && seriesMap['emaSlow'][barIndex] !== null) ? seriesMap['emaSlow'][barIndex] : (indicators ? indicators.emaSlow : close);
      var emaTrend = (seriesMap['emaTrend'] && seriesMap['emaTrend'][barIndex] !== undefined && seriesMap['emaTrend'][barIndex] !== null) ? seriesMap['emaTrend'][barIndex] : (seriesMap['trend'] ? seriesMap['trend'][barIndex] : ((indicators && indicators.emaSlow) || close));
      var rsiVal = (seriesMap['rsiVal'] && seriesMap['rsiVal'][barIndex] !== undefined && seriesMap['rsiVal'][barIndex] !== null) ? seriesMap['rsiVal'][barIndex] : (indicators && indicators.rsi !== undefined && indicators.rsi !== null ? indicators.rsi : 50);
      var rsi = rsiVal;
      var volMa = (seriesMap['volMa'] && seriesMap['volMa'][barIndex] !== undefined && seriesMap['volMa'][barIndex] !== null) ? seriesMap['volMa'][barIndex] : volume;

      // ADX, DMI, ATR, and EMA200
      var adxVal = (seriesMap['adxVal'] && seriesMap['adxVal'][barIndex] !== undefined && seriesMap['adxVal'][barIndex] !== null) ? seriesMap['adxVal'][barIndex] : 25;
      var adx = adxVal;
      var plusDI = (seriesMap['plusDI'] && seriesMap['plusDI'][barIndex] !== undefined && seriesMap['plusDI'][barIndex] !== null) ? seriesMap['plusDI'][barIndex] : 25;
      var minusDI = (seriesMap['minusDI'] && seriesMap['minusDI'][barIndex] !== undefined && seriesMap['minusDI'][barIndex] !== null) ? seriesMap['minusDI'][barIndex] : 25;
      var atrVal = (seriesMap['atrVal'] && seriesMap['atrVal'][barIndex] !== undefined && seriesMap['atrVal'][barIndex] !== null) ? seriesMap['atrVal'][barIndex] : Math.max(high - low, 1);
      var atr = atrVal;
      var tr = atrVal;
      var ema200 = (seriesMap['ema200'] && seriesMap['ema200'][barIndex] !== undefined && seriesMap['ema200'][barIndex] !== null) ? seriesMap['ema200'][barIndex] : emaTrend;

      // Bollinger Bands
      var bbUpper = (seriesMap['bbUpper'] && seriesMap['bbUpper'][barIndex] !== undefined) ? seriesMap['bbUpper'][barIndex] : (indicators && indicators.bollinger ? indicators.bollinger.upper : close * 1.02);
      var bbBasis = (seriesMap['bbBasis'] && seriesMap['bbBasis'][barIndex] !== undefined) ? seriesMap['bbBasis'][barIndex] : ((seriesMap['bbMiddle'] && seriesMap['bbMiddle'][barIndex] !== undefined) ? seriesMap['bbMiddle'][barIndex] : (indicators && indicators.bollinger ? indicators.bollinger.middle : close));
      var bbMiddle = bbBasis;
      var bbLower = (seriesMap['bbLower'] && seriesMap['bbLower'][barIndex] !== undefined) ? seriesMap['bbLower'][barIndex] : (indicators && indicators.bollinger ? indicators.bollinger.lower : close * 0.98);

      // MACD
      var macdLine = indicators && indicators.macd ? indicators.macd.macd : 0;
      var signalLine = indicators && indicators.macd ? indicators.macd.signal : 0;
      var histLine = indicators && indicators.macd ? indicators.macd.histogram : 0;

      // Supertrend
      var supertrend = (seriesMap['supertrend'] && seriesMap['supertrend'][barIndex] !== undefined && seriesMap['supertrend'][barIndex] !== null)
        ? seriesMap['supertrend'][barIndex]
        : (indicators && indicators.supertrend ? indicators.supertrend.line : close);
      var direction = (seriesMap['direction'] && seriesMap['direction'][barIndex] !== undefined && seriesMap['direction'][barIndex] !== null)
        ? seriesMap['direction'][barIndex]
        : (indicators && indicators.supertrend ? (indicators.supertrend.trend === 1 ? -1 : 1) : 1);
      var stDirection = direction;

      // Intermediate filter variables
      ${intermediateCode}

      // Dynamic position exit evaluation (TP, SL, trend reversal)
      if (position) {
        try {
          var hasSL = (typeof enableSL !== 'undefined' ? Boolean(enableSL) : (typeof useStopLoss !== 'undefined' ? Boolean(useStopLoss) : false));
          var hasTP = (typeof enableTP !== 'undefined' ? Boolean(enableTP) : (typeof useTakeProfit !== 'undefined' ? Boolean(useTakeProfit) : false));
          var rawSL = (typeof slPct === 'number') ? slPct : ((typeof stopLossPercent === 'number') ? stopLossPercent : 0);
          var rawTP = (typeof tpPct === 'number') ? tpPct : ((typeof takeProfitPercent === 'number') ? takeProfitPercent : 0);
          var slFrac = rawSL > 1 ? rawSL / 100 : rawSL;
          var tpFrac = rawTP > 1 ? rawTP / 100 : rawTP;

          if (position.type === 'LONG') {
            if (typeof atrMultiplierSL === 'number' && atrMultiplierSL > 0) {
              var slDist = atrVal * atrMultiplierSL;
              if (low <= position.entryPrice - slDist) return 'CLOSE_LONG';
            }
            if (typeof atrMultiplierTP === 'number' && atrMultiplierTP > 0) {
              var tpDist = atrVal * atrMultiplierTP;
              if (high >= position.entryPrice + tpDist) return 'CLOSE_LONG';
            }
            if (hasSL && slFrac > 0 && low <= position.entryPrice * (1 - slFrac)) return 'CLOSE_LONG';
            if (hasTP && tpFrac > 0 && high >= position.entryPrice * (1 + tpFrac)) return 'CLOSE_LONG';
            if (Boolean(${jsExitLong})) return 'CLOSE_LONG';
          }
          if (position.type === 'SHORT') {
            if (typeof atrMultiplierSL === 'number' && atrMultiplierSL > 0) {
              var slDistShort = atrVal * atrMultiplierSL;
              if (high >= position.entryPrice + slDistShort) return 'CLOSE_SHORT';
            }
            if (typeof atrMultiplierTP === 'number' && atrMultiplierTP > 0) {
              var tpDistShort = atrVal * atrMultiplierTP;
              if (low <= position.entryPrice - tpDistShort) return 'CLOSE_SHORT';
            }
            if (hasSL && slFrac > 0 && high >= position.entryPrice * (1 + slFrac)) return 'CLOSE_SHORT';
            if (hasTP && tpFrac > 0 && low <= position.entryPrice * (1 - tpFrac)) return 'CLOSE_SHORT';
            if (Boolean(${jsExitShort})) return 'CLOSE_SHORT';
          }
        } catch (e) {}
      }

      // Entry evaluation
      try {
        var isLong = Boolean(${jsLong});
        if (isLong && (!position || position.type === 'SHORT')) return 'BUY';
        var isShort = Boolean(${jsShort});
        if (isShort && (!position || position.type === 'LONG')) return 'SELL';
      } catch (err) {}
      return 'HOLD';
    `;

    const compiled = new Function(
      'candle',
      'prevCandle',
      'indicators',
      'position',
      'barIndex',
      'prevIndicators',
      'seriesMap',
      '__crossover',
      '__crossunder',
      '__change',
      fnBody
    );

    return (candle, prevCandle, indicators, position, barIndex, prevIndicators) => {
      try {
        return compiled(
          candle,
          prevCandle,
          indicators,
          position,
          barIndex,
          prevIndicators,
          seriesMap,
          __crossover,
          __crossunder,
          __change
        );
      } catch (e) {
        return 'HOLD';
      }
    };
  } catch (err: any) {
    console.warn('Failed to compile Pine Script function, using fallback:', err?.message || err);
    return () => 'HOLD';
  }
}
