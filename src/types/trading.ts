export type Timeframe = 
  | '1m' 
  | '3m' 
  | '5m' 
  | '15m' 
  | '30m' 
  | '1h' 
  | '2h' 
  | '4h' 
  | '6h' 
  | '8h' 
  | '12h' 
  | '1d' 
  | '3d' 
  | '1w' 
  | '1M'
  | '1hr'
  | '4hr'
  | '1D';

/**
 * Standardizes timeframe display labels (e.g., '1h' -> '1hr', '4h' -> '4hr', '1d' -> '1D')
 */
export function formatTimeframeDisplay(tf: string): string {
  if (!tf) return '1hr';
  const lower = tf.toLowerCase();
  if (lower === '1h' || lower === '1hr') return '1hr';
  if (lower === '4h' || lower === '4hr') return '4hr';
  if (lower === '1d' || lower === '1day') return '1D';
  if (lower === '2h' || lower === '2hr') return '2hr';
  if (lower === '6h' || lower === '6hr') return '6hr';
  if (lower === '8h' || lower === '8hr') return '8hr';
  if (lower === '12h' || lower === '12hr') return '12hr';
  if (lower === '3d' || lower === '3day') return '3D';
  if (lower === '1w' || lower === '1week') return '1W';
  if (tf === '1M' || lower === '1month') return '1M';
  if (lower === '15m') return '15m';
  if (lower === '30m') return '30m';
  if (lower === '5m') return '5m';
  if (lower === '1m') return '1m';
  if (lower === '3m') return '3m';
  return tf;
}

/**
 * Normalizes timeframe string to standard exchange canonical value ('1h', '4h', '1d', etc.)
 */
export function normalizeTimeframe(tf: string): Timeframe {
  if (!tf) return '1h';
  const lower = tf.toLowerCase();
  if (lower === '1hr') return '1h';
  if (lower === '4hr') return '4h';
  if (lower === '1d') return '1d';
  if (tf === '1D') return '1d';
  return tf as Timeframe;
}

export interface CoinInfo {
  symbol: string;
  name: string;
  icon?: string;
  defaultPrice: number;
}

export type QuotePair = 'USDT' | 'USDC' | 'USD' | 'EUR' | 'BTC' | 'ETH';

export type TimePeriodPreset =
  | '1w'
  | '1M'
  | '2M'
  | '3M'
  | '6M'
  | '1Year'
  | 'CUSTOM'
  | '30d'
  | '60d'
  | '90d'
  | '6m'
  | '1y';

export interface BacktestTimePeriod {
  preset: TimePeriodPreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export const DEFAULT_TIME_PERIOD: BacktestTimePeriod = {
  preset: '1M',
};

export interface Candle {
  time: number; // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StrategyType = 
  | 'EMA_CROSS' 
  | 'RSI_REVERSION' 
  | 'MACD_MOMENTUM' 
  | 'BOLLINGER_BREAKOUT' 
  | 'SUPERTREND' 
  | 'GRID_TRADING'
  | 'DCA_ACCUMULATION'
  | 'GOLDEN_ALPHA'
  | 'LIQUIDITY_SWEEP'
  | 'SUPERTREND_EMA'
  | 'CUSTOM_SCRIPT'
  | 'CUSTOM_RULES'
  | 'PINE_SCRIPT';

export type RuleOperand = 
  | 'close'
  | 'open'
  | 'high'
  | 'low'
  | 'volume'
  | 'rsi'
  | 'emaFast'
  | 'emaSlow'
  | 'macd'
  | 'macdSignal'
  | 'bbUpper'
  | 'bbLower';

export type RuleOperator = 'GREATER_THAN' | 'LESS_THAN' | 'CROSS_ABOVE' | 'CROSS_BELOW';

export interface CustomRule {
  id: string;
  left: RuleOperand;
  operator: RuleOperator;
  rightType: 'INDICATOR' | 'CONSTANT';
  rightIndicator?: RuleOperand;
  rightConstant?: number;
}

export interface CustomRulesConfig {
  buyRules: CustomRule[];
  sellRules: CustomRule[];
  buyLogic: 'AND' | 'OR';
  sellLogic: 'AND' | 'OR';
}

export interface StrategyConfig {
  id: StrategyType | string;
  baseType?: StrategyType;
  name: string;
  description: string;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
  params: Record<string, number | string | boolean>;
  customScript?: string;
  customPineScript?: string;
  customRules?: CustomRulesConfig;
}

export interface BacktestSettings {
  initialCapital: number;
  tradeDirection: 'BOTH' | 'LONG_ONLY' | 'SHORT_ONLY';
  positionSizePercent: number; // e.g. 100% or 50%
  leverage: number; // 1 to 10
  makerFeePercent: number; // 0.05%
  takerFeePercent: number; // 0.075%
  slippagePercent: number; // 0.05%
  stopLossPercent: number; // 0 to 50% (0 = disabled)
  takeProfitPercent: number; // 0 to 100% (0 = disabled)
  trailingStopPercent: number; // 0 = disabled
}

export interface Trade {
  id: number;
  type: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  size: number; // in quote currency
  contracts: number; // in base currency
  fee: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'LIQUIDATION' | 'END_OF_DATA';
  maxRunup: number;
  maxDrawdown: number;
  durationCandles: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdownPercent: number;
  benchmarkEquity: number;
}

export interface StrategySignal {
  time: number;
  type: 'BUY' | 'SELL';
  price: number;
  barIndex: number;
  label?: string;
  source?: string;
}

export interface BacktestResult {
  symbol: string;
  pair: QuotePair;
  timeframe: Timeframe;
  strategyName: string;
  candlesCount: number;
  startTime: number;
  endTime: number;
  periodLabel?: string;
  
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  netProfitPercent: number;
  buyAndHoldReturnPercent: number;
  alphaPercent: number;
  
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  profitFactor: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdownPercent: number;
  maxDrawdownAmount: number;
  
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  avgTradePnlPercent: number;
  avgWinPnlPercent: number;
  avgLossPnlPercent: number;
  riskRewardRatio: number;
  avgTradeDurationCandles: number;
  totalFeesPaid: number;

  // Strategy Efficiency Diagnostics
  efficiencyScore: number;
  efficiencyGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  marketExposurePercent: number;
  expectancyPerTrade: number;
  profitToMaxDrawdownRatio: number;
  feeDragPercent: number;
  efficiencyBreakdown: {
    profitability: number; // 0-100
    riskControl: number; // 0-100
    consistency: number; // 0-100
    executionQuality: number; // 0-100
  };
  
  trades: Trade[];
  signals?: StrategySignal[];
  equityCurve: EquityPoint[];
  indicators: {
    emaFast?: (number | null)[];
    emaSlow?: (number | null)[];
    rsi?: (number | null)[];
    macd?: {
      macd: (number | null)[];
      signal: (number | null)[];
      histogram: (number | null)[];
    };
    bollinger?: {
      upper: (number | null)[];
      middle: (number | null)[];
      lower: (number | null)[];
    };
    supertrend?: {
      trend: (1 | -1)[];
      line: (number | null)[];
    };
    supportLevels?: { price: number; touches: number; strength?: number; startBarIndex?: number; endBarIndex?: number }[];
    resistanceLevels?: { price: number; touches: number; strength?: number; startBarIndex?: number; endBarIndex?: number }[];
    srShelves?: { price: number; type: 'SUPPORT' | 'RESISTANCE'; startBarIndex: number; endBarIndex: number; touches: number }[];
  };
}

export interface FavoriteStrategySetup {
  id: string;
  title: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  
  // Market context
  coin: string;
  pair: QuotePair;
  timeframe: Timeframe;
  timePeriod: BacktestTimePeriod;

  // Strategy configuration & parameters
  strategy: StrategyConfig;

  // The 8 settings explicitly specified by user:
  // capital amount, direction, Leverage, Stop Loss, Take Profit, trailing stop loss, fee%, Slippage
  settings: BacktestSettings;

  // Performance metrics snapshot when saved
  metricsSnapshot?: {
    netProfit: number;
    netProfitPercent: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    maxDrawdownPercent: number;
    alphaPercent: number;
    sharpeRatio: number;
    efficiencyScore?: number;
    efficiencyGrade?: string;
  };
}
