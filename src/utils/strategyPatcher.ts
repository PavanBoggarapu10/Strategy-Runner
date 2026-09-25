import { CustomRule, CustomRulesConfig, BacktestSettings } from '../types/trading';

export interface PatchResult {
  enhancedPineScript: string;
  enhancedScript: string;
  enhancedRules: CustomRulesConfig;
  patchesApplied: string[];
}

/**
 * Surgically enhances the user's existing Pine Script (v5) rather than replacing it with a new template.
 * Preserves user's variable names, inputs, and indicators while patching identified flaws.
 */
export function patchAndEnhancePineScript(
  originalPine: string,
  settings?: BacktestSettings,
  userPrompt?: string
): { code: string; patches: string[] } {
  let code = originalPine?.trim() || '';
  const patches: string[] = [];
  const promptLower = (userPrompt || '').toLowerCase();

  // If empty, start from a valid baseline
  if (!code || !code.includes('//@version')) {
    code = `//@version=5\nstrategy("Custom Algorithmic Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.08)\n\nfastPeriod = input.int(9, "Fast EMA")\nslowPeriod = input.int(21, "Slow EMA")\n\nemaFast = ta.ema(close, fastPeriod)\nemaSlow = ta.ema(close, slowPeriod)\n\nlongCondition = ta.crossover(emaFast, emaSlow)\nshortCondition = ta.crossunder(emaFast, emaSlow)\n\nif (longCondition)\n    strategy.entry("Long", strategy.long)\nif (shortCondition)\n    strategy.close("Long")\n`;
  }

  // 1. Check if Macro Trend Filter (e.g. 200 EMA or slow EMA) exists
  const hasMacroTrend = /emaTrend|trendFilter|ta\.ema\(close,\s*(?:200|100|macro)/i.test(code);
  let trendVarName = 'emaTrend';

  if (!hasMacroTrend) {
    // Inject macro trend indicator definition right after other indicator declarations
    const trendSnippet = `\n// [AI ENHANCEMENT: Macro Trend Filter - Prevents counter-trend entries in bear cycles]\nmacroTrendPeriod = input.int(200, title="Macro Trend Filter Period (AI)", minval=20)\nemaTrend = ta.ema(close, macroTrendPeriod)\nplot(emaTrend, title="AI Macro Trend 200 EMA", color=color.new(#8b5cf6, 20), linewidth=2)\n`;

    if (code.includes('// === ENTRY') || code.includes('longCondition')) {
      code = code.replace(/(\n(?:\/\/\s*===?\s*ENTRY|longCondition))/, `${trendSnippet}$1`);
    } else {
      code += `\n${trendSnippet}`;
    }
    patches.push('Added 200 EMA Macro Trend Filter to block counter-trend entries during distribution cycles.');
  } else {
    // Detect existing trend variable
    const match = code.match(/([a-zA-Z0-9_]+)\s*=\s*ta\.ema\(close,\s*(?:200|100|macro)/i);
    if (match) trendVarName = match[1];
  }

  // 2. Check if RSI momentum confirmation exists
  const hasRsi = /ta\.rsi/i.test(code);
  let rsiVarName = 'rsiVal';

  if (!hasRsi) {
    const rsiSnippet = `\n// [AI ENHANCEMENT: RSI Momentum Bounding - Prevents entering at overbought exhaustion tops]\nrsiLength = input.int(14, title="RSI Filter Period (AI)", minval=2)\nrsiVal = ta.rsi(close, rsiLength)\n`;
    if (code.includes('longCondition')) {
      code = code.replace(/(\nlongCondition)/, `${rsiSnippet}$1`);
    } else {
      code += `\n${rsiSnippet}`;
    }
    patches.push('Added RSI (14) Momentum Filter to prevent buying local exhaustion tops.');
  } else {
    const rsiMatch = code.match(/([a-zA-Z0-9_]+)\s*=\s*ta\.rsi\(/i);
    if (rsiMatch) rsiVarName = rsiMatch[1];
  }

  // Optional: User requested Bollinger Bands
  let bbFilterVar = '';
  if ((promptLower.includes('bollinger') || promptLower.includes('squeeze')) && !code.includes('ta.bb')) {
    const bbSnippet = `\n// [AI ENHANCEMENT: Bollinger Bands Squeeze Filter (User Requested)]\nbbLength = input.int(20, title="Bollinger Length (AI)")\nbbMult = input.float(2.0, title="Bollinger StdDev (AI)")\n[bbBasis, bbUpper, bbLower] = ta.bb(close, bbLength, bbMult)\nbbFilter = close < bbUpper\n`;
    if (code.includes('longCondition')) {
      code = code.replace(/(\nlongCondition)/, `${bbSnippet}$1`);
    } else {
      code += `\n${bbSnippet}`;
    }
    bbFilterVar = ' and bbFilter';
    patches.push('Added Bollinger Bands (20, 2.0) Squeeze Filter to eliminate low-volatility fakeouts.');
  }

  // Optional: User requested Volume confirmation
  let volFilterVar = '';
  if ((promptLower.includes('volume') || promptLower.includes('obv') || promptLower.includes('spike')) && !code.includes('volFilter')) {
    const volSnippet = `\n// [AI ENHANCEMENT: Volume Liquidity Confirmation (User Requested)]\nvolMa = ta.sma(volume, 20)\nvolFilter = volume > (volMa * 0.8)\n`;
    if (code.includes('longCondition')) {
      code = code.replace(/(\nlongCondition)/, `${volSnippet}$1`);
    } else {
      code += `\n${volSnippet}`;
    }
    volFilterVar = ' and volFilter';
    patches.push('Added Volume Liquidity Confirmation to validate breakouts.');
  }

  // 3. Enhance longCondition with Macro Trend Gatekeeper & RSI Filter
  const longRegex = /longCondition\s*=\s*([^\n\r]+)/;
  const longMatch = code.match(longRegex);

  if (longMatch && longMatch[1]) {
    const currentLongExpr = longMatch[1].trim();
    // Only patch if not already containing our enhanced filters
    if (!currentLongExpr.includes(trendVarName) && !currentLongExpr.includes('emaTrend')) {
      const enhancedLongExpr = `(${currentLongExpr}) and (close > ${trendVarName}) and (${rsiVarName} < 68)${bbFilterVar}${volFilterVar}`;
      code = code.replace(
        longRegex,
        `// [AI ENHANCEMENT: Bounded Entry Filter - Trend gatekeeper & RSI sweet-spot]\nlongCondition = ${enhancedLongExpr}`
      );
      patches.push('Enhanced longCondition: Requires close > Macro EMA and RSI < 68.');
    }
  }

  // 4. Enhance shortCondition / exitCondition with profit-protection exits
  const shortRegex = /(shortCondition|exitCondition)\s*=\s*([^\n\r]+)/;
  const shortMatch = code.match(shortRegex);

  if (shortMatch && shortMatch[2]) {
    const varName = shortMatch[1];
    const currentShortExpr = shortMatch[2].trim();
    if (!currentShortExpr.includes(`${rsiVarName} > 72`) && !currentShortExpr.includes('72')) {
      const enhancedShortExpr = `(${currentShortExpr}) or (${rsiVarName} > 72) or (close < ${trendVarName} and ${rsiVarName} < 45)`;
      code = code.replace(
        shortRegex,
        `// [AI ENHANCEMENT: Accelerated Exit - Protects profits on RSI blow-off or trend breakdown]\n${varName} = ${enhancedShortExpr}`
      );
      patches.push('Enhanced exitCondition: Exits on RSI > 72 blow-off tops or trend breakdown.');
    }
  }

  // 5. Ensure bracket order stop-loss exists
  const hasBracket = /strategy\.exit\(/i.test(code);
  if (!hasBracket) {
    const slPct = settings?.stopLossPercent && settings.stopLossPercent > 0 ? settings.stopLossPercent : 3.5;
    const tpPct = settings?.takeProfitPercent && settings.takeProfitPercent > 0 ? settings.takeProfitPercent : 7.0;
    const bracketSnippet = `\n// [AI ENHANCEMENT: Dynamic Risk Protection Bracket]\nif (strategy.position_size > 0)\n    stopPrice = strategy.position_avg_price * (1 - ${slPct / 100})\n    takePrice = strategy.position_avg_price * (1 + ${tpPct / 100})\n    strategy.exit("AI Risk Bracket", from_entry="Long", stop=stopPrice, limit=takePrice)\n`;
    code += `\n${bracketSnippet}`;
    patches.push(`Added Protective Bracket Order: Stop-Loss at -${slPct}% and Take-Profit at +${tpPct}%.`);
  }

  return { code, patches };
}

/**
 * Surgically enhances user's existing JavaScript code sandbox script
 */
export function patchAndEnhanceJavaScript(
  originalScript: string,
  settings?: BacktestSettings,
  userPrompt?: string
): { code: string; patches: string[] } {
  let script = originalScript?.trim() || '';
  const patches: string[] = [];
  const promptLower = (userPrompt || '').toLowerCase();

  if (!script) {
    script = `// Custom Strategy Script\nif (candle.close > indicators.emaFast) return 'BUY';\nif (candle.close < indicators.emaSlow) return 'SELL';\nreturn 'HOLD';`;
  }

  // Check if AI filters already present
  if (!script.includes('// [AI ENHANCEMENT')) {
    const slPct = settings?.stopLossPercent || 3.5;
    const tpPct = settings?.takeProfitPercent || 7.0;

    let extraPromptFilters = '';
    if (promptLower.includes('volume') || promptLower.includes('obv') || promptLower.includes('spike')) {
      extraPromptFilters += `\n// [AI ENHANCEMENT: Volume Confirmation]\nif (indicators.volume && indicators.volumeMa && indicators.volume < indicators.volumeMa * 1.1) {\n  if (!position) return 'HOLD';\n}\n`;
      patches.push('Added Volume Liquidity filter (Volume > 1.1x Volume MA).');
    }

    const filterPatch = `
// [AI ENHANCEMENT: Macro Trend & Momentum Filters]
// 1. Filter out counter-trend entries when below Slow EMA
if (indicators.emaSlow && candle.close < indicators.emaSlow) {
  // If in position and breaking below slow EMA, exit to preserve capital
  if (position && position.type === 'LONG') return 'SELL';
  // Do not open new longs against prevailing trend
  if (!position) return 'HOLD';
}

// 2. Prevent entering at overbought exhaustion levels (RSI > 68)
if (!position && indicators.rsi && indicators.rsi > 68) {
  return 'HOLD';
}
${extraPromptFilters}
// 3. Dynamic Stop Loss & Take Profit protection
if (position && position.type === 'LONG') {
  if (position.unrealizedPnlPercent <= -${slPct}) return 'SELL'; // Stop Loss
  if (position.unrealizedPnlPercent >= ${tpPct}) return 'SELL';  // Take Profit
}
`;

    // Inject right before the user's return 'BUY' statements
    if (script.includes("return 'BUY'") || script.includes('return "BUY"')) {
      script = script.replace(/(if\s*\([^)]+\)\s*return\s*['"]BUY['"];?)/, `${filterPatch}\n$1`);
    } else {
      script = `${filterPatch}\n${script}`;
    }

    patches.push('Added Slow EMA macro trend gatekeeper preventing counter-trend buys.');
    patches.push('Added RSI overbought entry cap (< 68) to eliminate peak exhaustion whipsaws.');
    patches.push(`Added position-level risk protection: Hard Stop at -${slPct}% and Take-Profit at +${tpPct}%.`);
  }

  return { code: script, patches };
}

/**
 * Surgically enhances user's visual Boolean rules
 */
export function patchAndEnhanceRules(
  originalRules: CustomRulesConfig,
  userPrompt?: string
): { rules: CustomRulesConfig; patches: string[] } {
  const patches: string[] = [];
  const promptLower = (userPrompt || '').toLowerCase();
  const rulesCopy: CustomRulesConfig = {
    buyLogic: 'AND', // Enforce AND logic so filters act as protective gatekeepers
    sellLogic: originalRules.sellLogic || 'OR',
    buyRules: [...(originalRules.buyRules || [])],
    sellRules: [...(originalRules.sellRules || [])],
  };

  // Check if Slow EMA trend filter already exists in buy rules
  const hasSlowEmaBuy = rulesCopy.buyRules.some(
    r => (r.left === 'close' && r.operator === 'GREATER_THAN' && r.rightIndicator === 'emaSlow') ||
         (r.left === 'emaFast' && r.operator === 'GREATER_THAN' && r.rightIndicator === 'emaSlow')
  );

  if (!hasSlowEmaBuy) {
    const trendRule: CustomRule = {
      id: `ai-filter-trend-${Date.now()}`,
      left: 'close',
      operator: 'GREATER_THAN',
      rightType: 'INDICATOR',
      rightIndicator: 'emaSlow',
    };
    rulesCopy.buyRules.push(trendRule);
    patches.push('Added Rule: close > emaSlow (Macro Trend Confirmation)');
  }

  // Check if RSI overbought upper bound exists in buy rules
  const hasRsiUpperBound = rulesCopy.buyRules.some(
    r => r.left === 'rsi' && r.operator === 'LESS_THAN'
  );

  if (!hasRsiUpperBound) {
    const rsiMaxRule: CustomRule = {
      id: `ai-filter-rsi-max-${Date.now() + 1}`,
      left: 'rsi',
      operator: 'LESS_THAN',
      rightType: 'CONSTANT',
      rightConstant: 68,
    };
    rulesCopy.buyRules.push(rsiMaxRule);
    patches.push('Added Rule: rsi < 68 (Prevents buying at peak exhaustion tops)');
  }

  // Check if RSI lower bound exists
  const hasRsiLowerBound = rulesCopy.buyRules.some(
    r => r.left === 'rsi' && r.operator === 'GREATER_THAN'
  );
  if (!hasRsiLowerBound) {
    const rsiMinRule: CustomRule = {
      id: `ai-filter-rsi-min-${Date.now() + 2}`,
      left: 'rsi',
      operator: 'GREATER_THAN',
      rightType: 'CONSTANT',
      rightConstant: 42,
    };
    rulesCopy.buyRules.push(rsiMinRule);
    patches.push('Added Rule: rsi > 42 (Ensures bullish momentum ignition)');
  }

  // Check sell rules for profit protection
  const hasRsiExit = rulesCopy.sellRules.some(
    r => r.left === 'rsi' && r.operator === 'GREATER_THAN'
  );
  if (!hasRsiExit) {
    const rsiExitRule: CustomRule = {
      id: `ai-filter-sell-rsi-${Date.now() + 3}`,
      left: 'rsi',
      operator: 'GREATER_THAN',
      rightType: 'CONSTANT',
      rightConstant: 72,
    };
    rulesCopy.sellRules.push(rsiExitRule);
    patches.push('Added Exit Rule: rsi > 72 (Secures profits on blow-off tops)');
  }

  return { rules: rulesCopy, patches };
}
