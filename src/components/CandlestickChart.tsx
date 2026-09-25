import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Candle, BacktestResult, Timeframe, StrategyConfig, QuotePair, BacktestTimePeriod, TimePeriodPreset, formatTimeframeDisplay } from '../types/trading';
import { SUPPORTED_COINS, SUPPORTED_PAIRS } from '../utils/dataService';
import { STRATEGY_PRESETS } from '../utils/strategyEngine';
import { ChartDrawingToolbar } from './ChartDrawingToolbar';
import { ChartDrawing, DrawingToolType } from '../types/drawings';
import { renderDrawingsOnCanvas, snapToCandleOHLC } from '../utils/chartDrawingRenderer';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  Clock,
  Check,
  Activity,
  Layers,
  Sparkles,
  Brain,
  Cpu,
  MoveVertical,
  MoveHorizontal,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Search,
  Coins,
  DollarSign,
} from 'lucide-react';

interface CandlestickChartProps {
  candles: Candle[];
  result: BacktestResult | null;
  coin: string;
  onCoinChange?: (coin: string) => void;
  pair: string;
  onPairChange?: (pair: QuotePair) => void;
  timeframe: Timeframe;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  candleLimit?: number;
  onCandleLimitChange?: (limit: number) => void;
  timePeriod?: BacktestTimePeriod;
  onTimePeriodChange?: (period: BacktestTimePeriod) => void;
  strategy?: StrategyConfig;
  customStrategies?: StrategyConfig[];
  onStrategyChange?: (strategy: StrategyConfig) => void;
  onOpenCustomBuilder?: () => void;
}

export interface IndicatorToggles {
  emaFast: boolean;
  emaSlow: boolean;
  ema50: boolean;
  ema200: boolean;
  bollinger: boolean;
  supertrend: boolean;
  extrema: boolean;
  volume: boolean;
  signals: boolean;
  rsi: boolean;
  srLevels: boolean;
}

// Commonly used timeframes shown directly on the toolbar (Starting with 1hr, 4hr, 1D as requested)
const COMMON_TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1h', label: '1hr' },
  { value: '4h', label: '4hr' },
  { value: '1d', label: '1D' },
  { value: '15m', label: '15m' },
  { value: '1w', label: '1W' },
  { value: '1M', label: '1M' },
];

// All available intervals grouped for the expand panel
const TIMEFRAME_GROUPS: { group: string; items: { value: Timeframe; label: string }[] }[] = [
  {
    group: 'Minutes',
    items: [
      { value: '1m', label: '1m' },
      { value: '3m', label: '3m' },
      { value: '5m', label: '5m' },
      { value: '15m', label: '15m' },
      { value: '30m', label: '30m' },
    ],
  },
  {
    group: 'Hours',
    items: [
      { value: '1h', label: '1hr' },
      { value: '2h', label: '2hr' },
      { value: '4h', label: '4hr' },
      { value: '6h', label: '6hr' },
      { value: '8h', label: '8hr' },
      { value: '12h', label: '12hr' },
    ],
  },
  {
    group: 'Daily & Weekly',
    items: [
      { value: '1d', label: '1D' },
      { value: '3d', label: '3D' },
      { value: '1w', label: '1W' },
      { value: '1M', label: '1M' },
    ],
  },
];

// Helper to compute Exponential Moving Average (EMA)
function computeEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  result[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1]! * (1 - k);
  }
  return result;
}

// Helper to compute Relative Strength Index (RSI 14)
function computeRSI(prices: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length <= period) return rsi;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += -diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

// Helper to compute Rolling Extrema High/Low Channel
function computeExtrema(candles: Candle[], period: number = 20): { high: (number | null)[]; low: (number | null)[] } {
  const highArr: (number | null)[] = new Array(candles.length).fill(null);
  const lowArr: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    let maxH = -Infinity;
    let minL = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > maxH) maxH = candles[j].high;
      if (candles[j].low < minL) minL = candles[j].low;
    }
    highArr[i] = maxH;
    lowArr[i] = minL;
  }
  return { high: highArr, low: lowArr };
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  result,
  coin,
  onCoinChange,
  pair,
  onPairChange,
  timeframe,
  onTimeframeChange,
  candleLimit,
  onCandleLimitChange,
  timePeriod,
  onTimePeriodChange,
  strategy,
  customStrategies = [],
  onStrategyChange,
  onOpenCustomBuilder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const symbolDropdownRef = useRef<HTMLDivElement>(null);
  const tfDropdownRef = useRef<HTMLDivElement>(null);
  const indDropdownRef = useRef<HTMLDivElement>(null);
  const stratDropdownRef = useRef<HTMLDivElement>(null);

  // Symbol & Pair selector dropdown state
  const [isSymbolOpen, setIsSymbolOpen] = useState(false);
  const [customCoinQuery, setCustomCoinQuery] = useState('');

  // View state: start index and count of candles to show (Data Range)
  const [startIndex, setStartIndex] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState<number>(100);

  // Future Blank Space Offset (Margin of blank bars past latest candle for drawing & projection)
  const [futureMarginBars, setFutureMarginBars] = useState<number>(30);

  // Drawing Tools State (Trend line, Horizontal S/R, Ray, Fibonacci Retracements)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>('select');
  const [isMagnetEnabled, setIsMagnetEnabled] = useState<boolean>(true);
  const [activeDrawingColor, setActiveDrawingColor] = useState<string>('#06b6d4');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [activeDrawing, setActiveDrawing] = useState<ChartDrawing | null>(null);

  // User Drawn Lines Persistence (keyed per coin/pair)
  const [drawings, setDrawings] = useState<ChartDrawing[]>(() => {
    try {
      const saved = localStorage.getItem(`trading_drawings_${coin}_${pair}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Sync drawings on pair/coin change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`trading_drawings_${coin}_${pair}`);
      if (saved) setDrawings(JSON.parse(saved));
      else setDrawings([]);
    } catch (e) {}
    setActiveDrawing(null);
    setSelectedDrawingId(null);
  }, [coin, pair]);

  const saveDrawings = (newDrawings: ChartDrawing[]) => {
    setDrawings(newDrawings);
    try {
      localStorage.setItem(`trading_drawings_${coin}_${pair}`, JSON.stringify(newDrawings));
    } catch (e) {}
  };

  const handleUndoDrawing = () => {
    if (drawings.length === 0) return;
    const next = drawings.slice(0, -1);
    saveDrawings(next);
    setSelectedDrawingId(null);
  };

  const handleClearDrawings = () => {
    saveDrawings([]);
    setActiveDrawing(null);
    setSelectedDrawingId(null);
  };

  const handleDeleteSelectedDrawing = () => {
    if (!selectedDrawingId) return;
    const next = drawings.filter((d) => d.id !== selectedDrawingId);
    saveDrawings(next);
    setSelectedDrawingId(null);
  };

  // Keyboard Shortcuts for Drawings (Esc cancels, Del deletes selected, Ctrl+Z undoes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDrawing) {
          setActiveDrawing(null);
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        } else if (activeDrawingTool !== 'select') {
          setActiveDrawingTool('select');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          handleDeleteSelectedDrawing();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        handleUndoDrawing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawing, selectedDrawingId, activeDrawingTool, drawings]);

  // Price Scale Zoom & Squeeze (1.0 = auto, >1 = squeezed/compressed, <1 = expanded)
  const [priceZoom, setPriceZoom] = useState<number>(1.0);
  const [pricePanOffset, setPricePanOffset] = useState<number>(0);

  // Dynamic Chart Height & Fullscreen State (Resizable by dragging bottom handle or selecting presets)
  const [chartHeight, setChartHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('trading_chart_custom_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 320 && val <= 1200) return val;
      }
    } catch (e) {}
    return 520;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(520);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Listen to container resizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Exit fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Interactive Hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Master switches
  const [showIndicators, setShowIndicators] = useState(true);

  // Individual Indicator Toggles
  const [indicatorToggles, setIndicatorToggles] = useState<IndicatorToggles>({
    emaFast: true,
    emaSlow: true,
    ema50: false,
    ema200: false,
    bollinger: true,
    supertrend: true,
    extrema: false,
    volume: true,
    signals: true,
    rsi: false,
    srLevels: true,
  });

  // Dropdown states
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isTimeframeExpanded, setIsTimeframeExpanded] = useState(false);

  // Real-time strategy applied visual toast state
  const [appliedToast, setAppliedToast] = useState<string | null>(null);
  const prevStratId = useRef(strategy?.id);

  // Automatically enable signals and show notification when active strategy changes
  useEffect(() => {
    if (strategy && prevStratId.current !== strategy.id) {
      prevStratId.current = strategy.id;
      setIndicatorToggles((prev) => ({ ...prev, signals: true }));
      setAppliedToast(`Applied strategy: ${strategy.name}`);
    }
  }, [strategy]);

  // Dismiss toast after 3 seconds
  useEffect(() => {
    if (appliedToast) {
      const timer = setTimeout(() => setAppliedToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [appliedToast]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(event.target as Node)) {
        setIsSymbolOpen(false);
      }
      if (stratDropdownRef.current && !stratDropdownRef.current.contains(event.target as Node)) {
        setIsStrategyOpen(false);
      }
      if (indDropdownRef.current && !indDropdownRef.current.contains(event.target as Node)) {
        setIsIndicatorsOpen(false);
      }
      if (tfDropdownRef.current && !tfDropdownRef.current.contains(event.target as Node)) {
        setIsTimeframeExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Precompute standalone indicators across candles
  const closePrices = useMemo(() => candles.map((c) => c.close), [candles]);
  const computedEma50 = useMemo(() => computeEMA(closePrices, 50), [closePrices]);
  const computedEma200 = useMemo(() => computeEMA(closePrices, 200), [closePrices]);
  const computedRsi14 = useMemo(() => computeRSI(closePrices, 14), [closePrices]);
  const computedExtrema = useMemo(() => computeExtrema(candles, 20), [candles]);

  // Multi-mode drag tracking (2D chart pan & hold, squeezing time, squeezing price)
  const dragMode = useRef<'PAN_CHART' | 'PAN_TIME' | 'PAN_PRICE' | 'SQUEEZE_PRICE' | 'SQUEEZE_TIME' | null>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartIndex = useRef(0);
  const dragStartVisibleCount = useRef(100);
  const dragStartPriceZoom = useRef(1.0);
  const dragStartPriceOffset = useRef(0);

  // Reset to latest candles whenever dataset changes, keeping futureMarginBars space
  useEffect(() => {
    if (candles.length > 0) {
      const count = Math.min(candles.length, 120);
      setVisibleCount(count);
      setStartIndex(Math.max(0, candles.length - count + futureMarginBars));
    }
  }, [candles, futureMarginBars]);

  // Active indicator count
  const activeIndicatorCount = Object.values(indicatorToggles).filter(Boolean).length;

  // Toggle single indicator
  const toggleIndicator = (key: keyof IndicatorToggles) => {
    setIndicatorToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = containerDimensions.width > 0 ? containerDimensions.width : (rect.width || 800);
    const height = containerDimensions.height > 0 ? containerDimensions.height : (rect.height || chartHeight);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090d16'; // Deep navy background
    ctx.fillRect(0, 0, width, height);

    // Bounds check and real candle slice (allowing future blank projection space)
    const realCandleStart = Math.max(0, Math.min(candles.length - 1, startIndex));
    const realCandleEnd = Math.min(candles.length, Math.max(0, startIndex + visibleCount));
    const visibleCandles = candles.slice(realCandleStart, realCandleEnd);
    const clampedStartIndex = realCandleStart;
    const sliceEnd = realCandleEnd;

    // Layout dimensions
    const priceAxisWidth = 65;
    const timeAxisHeight = 24;
    const chartWidth = width - priceAxisWidth;

    const showVol = indicatorToggles.volume;
    const showRsiSub = indicatorToggles.rsi;

    const volumeHeight = showVol ? Math.min(height * 0.18, 65) : 0;
    const rsiHeight = showRsiSub ? Math.min(height * 0.2, 75) : 0;
    const priceChartHeight = height - timeAxisHeight - volumeHeight - rsiHeight;

    // Find Price Min and Max
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    if (visibleCandles.length > 0) {
      for (const c of visibleCandles) {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
        if (c.volume > maxVolume) maxVolume = c.volume;
      }
    } else {
      const fallbackP = candles[candles.length - 1]?.close || 100;
      minPrice = fallbackP * 0.97;
      maxPrice = fallbackP * 1.03;
    }

    // Include indicators in price scale if master switch & toggle are active
    if (showIndicators) {
      if (result?.indicators) {
        const { emaFast, emaSlow, bollinger, supertrend } = result.indicators;
        for (let i = clampedStartIndex; i < sliceEnd; i++) {
          if (indicatorToggles.emaFast && emaFast && emaFast[i] !== null) {
            minPrice = Math.min(minPrice, emaFast[i]!);
            maxPrice = Math.max(maxPrice, emaFast[i]!);
          }
          if (indicatorToggles.emaSlow && emaSlow && emaSlow[i] !== null) {
            minPrice = Math.min(minPrice, emaSlow[i]!);
            maxPrice = Math.max(maxPrice, emaSlow[i]!);
          }
          if (indicatorToggles.bollinger && bollinger && bollinger.lower[i] !== null && bollinger.upper[i] !== null) {
            minPrice = Math.min(minPrice, bollinger.lower[i]!);
            maxPrice = Math.max(maxPrice, bollinger.upper[i]!);
          }
          if (indicatorToggles.supertrend && supertrend && supertrend.line[i] !== null) {
            minPrice = Math.min(minPrice, supertrend.line[i]!);
            maxPrice = Math.max(maxPrice, supertrend.line[i]!);
          }
        }
      }

      // Standalone EMA 50 & 200
      for (let i = clampedStartIndex; i < sliceEnd; i++) {
        if (indicatorToggles.ema50 && computedEma50[i] !== null) {
          minPrice = Math.min(minPrice, computedEma50[i]!);
          maxPrice = Math.max(maxPrice, computedEma50[i]!);
        }
        if (indicatorToggles.ema200 && computedEma200[i] !== null) {
          minPrice = Math.min(minPrice, computedEma200[i]!);
          maxPrice = Math.max(maxPrice, computedEma200[i]!);
        }
      }
    }

    // Add padding to price scale (5%) and apply interactive Price Squeeze / Vertical Pan
    const basePadding = (maxPrice - minPrice) * 0.05 || maxPrice * 0.02 || 1;
    const baseMin = minPrice - basePadding;
    const baseMax = maxPrice + basePadding;
    const baseRange = Math.max(1e-6, baseMax - baseMin);
    const baseMid = (baseMax + baseMin) / 2 + pricePanOffset;

    // Squeeze / Expand factor: priceZoom > 1 squeezes candles vertically (wider range shown); priceZoom < 1 expands
    const effectiveRange = Math.max(1e-6, baseRange * priceZoom);
    minPrice = baseMid - effectiveRange / 2;
    maxPrice = baseMid + effectiveRange / 2;
    const priceRange = maxPrice - minPrice || 1;

    // Coordinate helpers: candleWidth scales with total visible slots (including future blank space)
    const candleWidth = chartWidth / visibleCount;
    const barWidth = Math.max(1, candleWidth * 0.72);

    const getY = (price: number) => {
      return priceChartHeight - ((price - minPrice) / priceRange) * priceChartHeight;
    };

    // getX for candle index relative to visibleCandles
    const getX = (idx: number) => {
      const globalIdx = clampedStartIndex + idx;
      return (globalIdx - startIndex) * candleWidth + candleWidth / 2;
    };

    // getGlobalX for any arbitrary bar index (including future projection bars >= candles.length)
    const getGlobalX = (globalBarIndex: number) => {
      return (globalBarIndex - startIndex) * candleWidth + candleWidth / 2;
    };

    // Draw Grid Lines (Horizontal price grid)
    ctx.strokeStyle = '#182234';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const gridSteps = 6;
    for (let g = 0; g <= gridSteps; g++) {
      const p = minPrice + (priceRange / gridSteps) * g;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const formattedPrice = p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(2) : p.toLocaleString(undefined, { maximumFractionDigits: 2 });
      ctx.fillText(formattedPrice, chartWidth + 6, y);
    }

    // Draw Time Axis Grid & Timestamps across visible space (historical candles + future blank space)
    const timeStep = Math.max(1, Math.floor(visibleCount / 6));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const intervalMs = candles.length >= 2
      ? Math.max(60000, (candles[candles.length - 1].time - candles[0].time) / (candles.length - 1))
      : 300000;

    for (let s = 0; s < visibleCount; s += timeStep) {
      const gIdx = startIndex + s;
      const x = getGlobalX(gIdx);
      if (x < 0 || x > chartWidth) continue;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - timeAxisHeight);
      ctx.stroke();

      let timeStr = '';
      let isFuture = false;

      if (gIdx >= 0 && gIdx < candles.length) {
        const d = new Date(candles[gIdx].time);
        timeStr = timeframe.includes('m') || timeframe.includes('h')
          ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
      } else if (gIdx >= candles.length && candles.length > 0) {
        isFuture = true;
        const futureBarsAhead = gIdx - (candles.length - 1);
        const projTime = candles[candles.length - 1].time + futureBarsAhead * intervalMs;
        const d = new Date(projTime);
        timeStr = timeframe.includes('m') || timeframe.includes('h')
          ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
      }

      if (timeStr) {
        ctx.fillStyle = isFuture ? '#38bdf8' : '#64748b';
        ctx.fillText(timeStr, x, height - timeAxisHeight + 6);
      }
    }


    // Draw Bollinger Bands cloud fill if active
    if (showIndicators && indicatorToggles.bollinger && result?.indicators?.bollinger) {
      const bb = result.indicators.bollinger;
      ctx.beginPath();
      let started = false;

      for (let i = 0; i < visibleCandles.length; i++) {
        const globalIdx = clampedStartIndex + i;
        const upper = bb.upper[globalIdx];
        if (upper !== null) {
          const x = getX(i);
          const y = getY(upper);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      for (let i = visibleCandles.length - 1; i >= 0; i--) {
        const globalIdx = clampedStartIndex + i;
        const lower = bb.lower[globalIdx];
        if (lower !== null) {
          const x = getX(i);
          const y = getY(lower);
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.fillStyle = 'rgba(14, 165, 233, 0.05)';
      ctx.fill();

      // Lower & Upper & Middle lines
      const drawBBLine = (lineArr: (number | null)[], color: string, dash: number[] = []) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash(dash);
        let active = false;
        for (let i = 0; i < visibleCandles.length; i++) {
          const globalIdx = clampedStartIndex + i;
          const val = lineArr[globalIdx];
          if (val !== null) {
            const x = getX(i);
            const y = getY(val);
            if (!active) {
              ctx.moveTo(x, y);
              active = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };

      drawBBLine(bb.upper, 'rgba(56, 189, 248, 0.45)');
      drawBBLine(bb.middle, 'rgba(251, 191, 36, 0.35)', [4, 4]);
      drawBBLine(bb.lower, 'rgba(56, 189, 248, 0.45)');
    }

    // Draw Extrema High/Low Channels if active
    if (showIndicators && indicatorToggles.extrema) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      let startHigh = false;
      for (let i = 0; i < visibleCandles.length; i++) {
        const gIdx = clampedStartIndex + i;
        const val = computedExtrema.high[gIdx];
        if (val !== null) {
          const x = getX(i);
          const y = getY(val);
          if (!startHigh) { ctx.moveTo(x, y); startHigh = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();

      ctx.beginPath();
      let startLow = false;
      for (let i = 0; i < visibleCandles.length; i++) {
        const gIdx = clampedStartIndex + i;
        const val = computedExtrema.low[gIdx];
        if (val !== null) {
          const x = getX(i);
          const y = getY(val);
          if (!startLow) { ctx.moveTo(x, y); startLow = true; }
          else { ctx.lineTo(x, y); }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Volume Bars
    if (showVol && maxVolume > 0) {
      const volBaseY = priceChartHeight + volumeHeight;
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const x = getX(i);
        const isUp = c.close >= c.open;
        const barH = (c.volume / maxVolume) * volumeHeight;

        ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)';
        ctx.fillRect(x - barWidth / 2, volBaseY - barH, barWidth, barH);
      }
    }

    // Draw Candlesticks (Wick + Body)
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = getX(i);
      const isUp = c.close >= c.open;

      const candleColor = isUp ? '#10b981' : '#f43f5e';
      const wickColor = isUp ? '#34d399' : '#fb7185';

      const highY = getY(c.high);
      const lowY = getY(c.low);
      const openY = getY(c.open);
      const closeY = getY(c.close);

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

      ctx.fillStyle = candleColor;
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    }

    // Draw Moving Averages & Supertrend
    if (showIndicators) {
      const drawSeries = (arr: (number | null)[], strokeStyle: string, lineWidth: number = 1.6, dash: number[] = []) => {
        ctx.beginPath();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dash);
        let active = false;

        for (let i = 0; i < visibleCandles.length; i++) {
          const globalIdx = clampedStartIndex + i;
          const val = arr[globalIdx];
          if (val !== null && val !== undefined) {
            const x = getX(i);
            const y = getY(val);
            if (!active) {
              ctx.moveTo(x, y);
              active = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };

      // Draw EMA Ribbon / Cloud between Fast EMA and Slow EMA (matching Image 2)
      if ((indicatorToggles.emaFast || indicatorToggles.emaSlow) && result?.indicators?.emaFast && result?.indicators?.emaSlow) {
        const fastArr = result.indicators.emaFast;
        const slowArr = result.indicators.emaSlow;
        for (let i = 1; i < visibleCandles.length; i++) {
          const g1 = clampedStartIndex + i - 1;
          const g2 = clampedStartIndex + i;
          const f1 = fastArr[g1];
          const f2 = fastArr[g2];
          const s1 = slowArr[g1];
          const s2 = slowArr[g2];
          if (f1 !== null && f2 !== null && s1 !== null && s2 !== null) {
            const x1 = getX(i - 1);
            const x2 = getX(i);
            const yF1 = getY(f1);
            const yF2 = getY(f2);
            const yS1 = getY(s1);
            const yS2 = getY(s2);
            ctx.beginPath();
            ctx.moveTo(x1, yF1);
            ctx.lineTo(x2, yF2);
            ctx.lineTo(x2, yS2);
            ctx.lineTo(x1, yS1);
            ctx.closePath();
            // Bearish = violet/purple cloud, Bullish = teal/cyan cloud
            ctx.fillStyle = f2 < s2 ? 'rgba(168, 85, 247, 0.24)' : 'rgba(20, 184, 166, 0.20)';
            ctx.fill();
          }
        }
      }

      // Fast EMA (Vibrant Purple / Fuchsia matching Image 2)
      if (indicatorToggles.emaFast && result?.indicators?.emaFast) {
        drawSeries(result.indicators.emaFast, '#c084fc', 2.0);
      }

      // Slow EMA (Bright Cyan matching Image 2)
      if (indicatorToggles.emaSlow && result?.indicators?.emaSlow) {
        drawSeries(result.indicators.emaSlow, '#38bdf8', 2.0);
      }

      // 50 EMA / Macro Trend (Warm Amber / Gold matching Image 2)
      if (indicatorToggles.ema50) {
        drawSeries(computedEma50, '#f59e0b', 2.0);
      }

      // 200 EMA (Orange)
      if (indicatorToggles.ema200) {
        drawSeries(computedEma200, '#fb923c', 2.0);
      }

      // Supertrend (Green / Red)
      if (indicatorToggles.supertrend && result?.indicators?.supertrend?.line) {
        const supertrend = result.indicators.supertrend;
        for (let i = 1; i < visibleCandles.length; i++) {
          const gIdx = clampedStartIndex + i;
          const prevIdx = gIdx - 1;
          const val1 = supertrend.line[prevIdx];
          const val2 = supertrend.line[gIdx];
          const trend = supertrend.trend[gIdx];

          if (val1 !== null && val2 !== null) {
            ctx.beginPath();
            ctx.strokeStyle = trend === 1 ? '#10b981' : '#f43f5e';
            ctx.lineWidth = 2;
            ctx.moveTo(getX(i - 1), getY(val1));
            ctx.lineTo(getX(i), getY(val2));
            ctx.stroke();
          }
        }
      }
    }

    // Draw Strategy Trade and Signal Markers (Styled exactly like Image 2)
    if (indicatorToggles.signals && (result?.trades || result?.signals)) {
      const plottedEntryTimes = new Set<number>();

      if (result?.trades) {
        for (const trade of result.trades) {
          plottedEntryTimes.add(trade.entryTime);
          // Entry Marker
          const entryIdx = visibleCandles.findIndex((c) => c.time === trade.entryTime || Math.abs(c.time - trade.entryTime) < 10000);
          if (entryIdx !== -1) {
            const candle = visibleCandles[entryIdx];
            const x = getX(entryIdx);
            const isLong = trade.type === 'LONG';

            if (isLong) {
              const y = getY(candle.low);
              // Bold solid teal upward arrow ▲
              ctx.beginPath();
              ctx.fillStyle = '#00f2fe';
              ctx.moveTo(x, y + 10);
              ctx.lineTo(x - 7, y + 22);
              ctx.lineTo(x + 7, y + 22);
              ctx.closePath();
              ctx.fill();

              // Scalp Long + price label matching Image 2
              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('SCALP', x, y + 33);
              ctx.fillText('LONG', x, y + 43);

              ctx.font = '8px "JetBrains Mono", monospace';
              ctx.fillStyle = '#67e8f9';
              ctx.fillText('Scalp Long', x, y + 53);
            } else {
              const y = getY(candle.high);
              // Bold solid red downward arrow ▼
              ctx.beginPath();
              ctx.fillStyle = '#f43f5e';
              ctx.moveTo(x, y - 10);
              ctx.lineTo(x - 7, y - 22);
              ctx.lineTo(x + 7, y - 22);
              ctx.closePath();
              ctx.fill();

              // Scalp Short + label matching Image 2
              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('SCALP', x, y - 35);
              ctx.fillText('SHORT', x, y - 25);

              ctx.font = '8px "JetBrains Mono", monospace';
              ctx.fillStyle = '#fca5a5';
              ctx.fillText('Scalp Short', x, y - 13);
            }
          }

          // Exit Marker (Stylized magenta/pink crossbar arrow matching Image 2)
          const exitIdx = visibleCandles.findIndex((c) => c.time === trade.exitTime || Math.abs(c.time - trade.exitTime) < 10000);
          if (exitIdx !== -1) {
            const candle = visibleCandles[exitIdx];
            const x = getX(exitIdx);
            const isLong = trade.type === 'LONG';
            const isWin = trade.pnl > 0;
            const y = isLong ? getY(candle.high) - 8 : getY(candle.low) + 8;

            // Magenta crossbar arrow (↑ or ↓)
            ctx.strokeStyle = '#e879f9';
            ctx.fillStyle = '#e879f9';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            // Horizontal crossbar
            ctx.moveTo(x - 5, isLong ? y : y);
            ctx.lineTo(x + 5, isLong ? y : y);
            // Stem
            ctx.moveTo(x, y);
            ctx.lineTo(x, isLong ? y - 12 : y + 12);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            if (isLong) {
              ctx.moveTo(x, y - 16);
              ctx.lineTo(x - 4, y - 10);
              ctx.lineTo(x + 4, y - 10);
            } else {
              ctx.moveTo(x, y + 16);
              ctx.lineTo(x - 4, y + 10);
              ctx.lineTo(x + 4, y + 10);
            }
            ctx.closePath();
            ctx.fill();

            // Label matching Image 2: "TP/SL Exit" with PnL tag
            const pnlTag = `${isWin ? '+' : '-'}${Math.abs(trade.pnlPercent * 0.0001).toFixed(5)}`;
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.fillStyle = '#f5d0fe';
            ctx.textAlign = 'center';
            if (isLong) {
              ctx.fillText(pnlTag, x, y - 28);
              ctx.fillText('TP/SL Exit', x, y - 19);
            } else {
              ctx.fillText('TP/SL Exit', x, y + 26);
              ctx.fillText(pnlTag, x, y + 35);
            }
          }
        }
      }

      // Plot standalone Strategy Signals (e.g. from Pine Script / Scalper signals)
      if (result?.signals) {
        for (const sig of result.signals) {
          if (plottedEntryTimes.has(sig.time)) continue;
          const sigIdx = visibleCandles.findIndex((c) => c.time === sig.time || Math.abs(c.time - sig.time) < 10000);
          if (sigIdx !== -1) {
            const candle = visibleCandles[sigIdx];
            const x = getX(sigIdx);
            const isBuy = sig.type === 'BUY';

            if (isBuy) {
              const y = getY(candle.low);
              ctx.beginPath();
              ctx.fillStyle = '#00f2fe';
              ctx.moveTo(x, y + 10);
              ctx.lineTo(x - 6, y + 20);
              ctx.lineTo(x + 6, y + 20);
              ctx.closePath();
              ctx.fill();

              ctx.font = 'bold 8px "JetBrains Mono", monospace';
              ctx.fillStyle = '#67e8f9';
              ctx.textAlign = 'center';
              ctx.fillText(sig.label || 'LONG', x, y + 30);
            } else {
              const y = getY(candle.high);
              ctx.beginPath();
              ctx.fillStyle = '#f43f5e';
              ctx.moveTo(x, y - 10);
              ctx.lineTo(x - 6, y - 20);
              ctx.lineTo(x + 6, y - 20);
              ctx.closePath();
              ctx.fill();

              ctx.font = 'bold 8px "JetBrains Mono", monospace';
              ctx.fillStyle = '#fca5a5';
              ctx.textAlign = 'center';
              ctx.fillText(sig.label || 'SHORT', x, y - 24);
            }
          }
        }
      }
    }

    // Draw Support & Resistance Levels as Limited Dotted Shelves (Matching Image 2)
    if (showIndicators && indicatorToggles.srLevels) {
      // Gather shelves from result.indicators.srShelves or generate localized swing shelves
      interface DisplayShelf {
        price: number;
        type: 'SUPPORT' | 'RESISTANCE';
        startBarIndex: number;
        endBarIndex: number;
      }
      const shelvesToRender: DisplayShelf[] = [];

      if (result?.indicators?.srShelves && result.indicators.srShelves.length > 0) {
        for (const s of result.indicators.srShelves) {
          shelvesToRender.push(s);
        }
      } else {
        if (result?.indicators?.resistanceLevels) {
          for (const r of result.indicators.resistanceLevels) {
            const start = r.startBarIndex ?? Math.max(0, clampedStartIndex);
            const end = r.endBarIndex ?? Math.min(candles.length - 1, start + 24);
            shelvesToRender.push({ price: r.price, type: 'RESISTANCE', startBarIndex: start, endBarIndex: end });
          }
        }
        if (result?.indicators?.supportLevels) {
          for (const s of result.indicators.supportLevels) {
            const start = s.startBarIndex ?? Math.max(0, clampedStartIndex);
            const end = s.endBarIndex ?? Math.min(candles.length - 1, start + 24);
            shelvesToRender.push({ price: s.price, type: 'SUPPORT', startBarIndex: start, endBarIndex: end });
          }
        }
      }

      // If no pre-computed shelves, dynamically detect clean swing shelves on visible candles (5-bar lookback)
      if (shelvesToRender.length === 0 && visibleCandles.length >= 15) {
        const pLen = 5;
        for (let i = pLen; i < visibleCandles.length - pLen; i++) {
          const c = visibleCandles[i];
          let isH = true;
          let isL = true;
          for (let k = i - pLen; k <= i + pLen; k++) {
            if (k === i) continue;
            if (visibleCandles[k].high >= c.high) isH = false;
            if (visibleCandles[k].low <= c.low) isL = false;
          }
          if (isH) {
            const gIdx = clampedStartIndex + i;
            shelvesToRender.push({
              price: c.high,
              type: 'RESISTANCE',
              startBarIndex: gIdx,
              endBarIndex: Math.min(candles.length - 1, gIdx + 22),
            });
          }
          if (isL) {
            const gIdx = clampedStartIndex + i;
            shelvesToRender.push({
              price: c.low,
              type: 'SUPPORT',
              startBarIndex: gIdx,
              endBarIndex: Math.min(candles.length - 1, gIdx + 22),
            });
          }
        }
      }

      // Filter shelves to keep only clean, distinct shelves within visible range (preventing clutter)
      const visibleMinBar = clampedStartIndex;
      const visibleMaxBar = clampedStartIndex + visibleCandles.length - 1;

      // Filter and deduplicate active shelves
      const activeShelves: DisplayShelf[] = [];
      const sortedShelves = shelvesToRender.filter(s => 
        s.endBarIndex >= visibleMinBar && s.startBarIndex <= visibleMaxBar
      );

      for (const s of sortedShelves) {
        // Enforce minimum price separation to keep dots limited and neat
        const isDuplicate = activeShelves.some(existing => 
          existing.type === s.type && 
          Math.abs(existing.price - s.price) / s.price < 0.0035 &&
          Math.abs(existing.startBarIndex - s.startBarIndex) < 30
        );
        if (!isDuplicate) {
          activeShelves.push(s);
        }
      }

      // Render each shelf as discrete dots at candle X locations (Matching Image 2)
      for (const shelf of activeShelves) {
        const y = getY(shelf.price);
        if (y < 0 || y > priceChartHeight) continue;

        const isSupport = shelf.type === 'SUPPORT';
        const dotColor = isSupport ? '#00e676' : '#ff2d55'; // Vibrant green for support, red/crimson for resistance

        const startIdx = Math.max(visibleMinBar, shelf.startBarIndex);
        const endIdx = Math.min(visibleMaxBar, shelf.endBarIndex);

        ctx.fillStyle = dotColor;

        for (let b = startIdx; b <= endIdx; b++) {
          const candleIdx = b - clampedStartIndex;
          const x = getX(candleIdx);

          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw RSI Subplot if enabled
    if (showRsiSub) {
      const rsiStartY = priceChartHeight + volumeHeight;
      const rsiSubHeight = rsiHeight;

      // Divider line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rsiStartY);
      ctx.lineTo(chartWidth, rsiStartY);
      ctx.stroke();

      // RSI Level Lines (70 and 30)
      const getRsiY = (val: number) => {
        return rsiStartY + rsiSubHeight - (val / 100) * rsiSubHeight;
      };

      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'; // 70 Overbought
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, getRsiY(70));
      ctx.lineTo(chartWidth, getRsiY(70));
      ctx.stroke();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; // 30 Oversold
      ctx.beginPath();
      ctx.moveTo(0, getRsiY(30));
      ctx.lineTo(chartWidth, getRsiY(30));
      ctx.stroke();
      ctx.setLineDash([]);

      // RSI Line
      ctx.beginPath();
      ctx.strokeStyle = '#e879f9'; // Fuchsia/Purple
      ctx.lineWidth = 1.6;
      let rsiStarted = false;
      for (let i = 0; i < visibleCandles.length; i++) {
        const gIdx = clampedStartIndex + i;
        const val = computedRsi14[gIdx];
        if (val !== null) {
          const x = getX(i);
          const y = getRsiY(val);
          if (!rsiStarted) {
            ctx.moveTo(x, y);
            rsiStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // RSI Label in axis
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#c084fc';
      ctx.textAlign = 'left';
      ctx.fillText('RSI (14)', chartWidth + 6, rsiStartY + 14);
      ctx.fillText('70', chartWidth + 6, getRsiY(70));
      ctx.fillText('30', chartWidth + 6, getRsiY(30));
    }

    // Render User Drawings (Trend lines, Horizontal S/R lines, Ray lines, Fibonacci Retracements)
    renderDrawingsOnCanvas({
      ctx,
      drawings,
      activeDrawing,
      selectedDrawingId,
      startIndex,
      visibleCount,
      chartWidth,
      priceChartHeight,
      minPrice,
      priceRange,
      candles,
    });

    // Draw Crosshair if hovering (supports hovering over historical candles and future projection space)
    if (hoverPos && hoverPos.x >= 0 && hoverPos.x <= chartWidth && hoverPos.y >= 0 && hoverPos.y <= rect.height - timeAxisHeight) {
      const x = hoverPos.x;
      const y = Math.min(priceChartHeight, Math.max(0, hoverPos.y));

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;

      // Vertical crosshair line
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - timeAxisHeight);

      // Horizontal crosshair line
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight hovered price box on right axis
      const hoverPrice = maxPrice - (y / priceChartHeight) * priceRange;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(chartWidth + 1, y - 9, priceAxisWidth - 2, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(hoverPrice < 1 ? hoverPrice.toFixed(4) : hoverPrice.toFixed(2), chartWidth + 5, y);

      // Hovered time tag on bottom axis
      const hoveredBarIdx = Math.floor(startIndex + (x / candleWidth));
      let timeTagText = '';
      let isFutureBar = false;

      if (hoveredBarIdx >= 0 && hoveredBarIdx < candles.length) {
        const d = new Date(candles[hoveredBarIdx].time);
        timeTagText = timeframe.includes('m') || timeframe.includes('h')
          ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      } else if (hoveredBarIdx >= candles.length && candles.length > 0) {
        isFutureBar = true;
        const ahead = hoveredBarIdx - (candles.length - 1);
        const projTime = candles[candles.length - 1].time + ahead * intervalMs;
        const d = new Date(projTime);
        timeTagText = `+${ahead}b ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      if (timeTagText) {
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const tagW = ctx.measureText(timeTagText).width + 8;
        ctx.fillStyle = isFutureBar ? '#0284c7' : '#3b82f6';
        ctx.fillRect(Math.max(2, Math.min(chartWidth - tagW - 2, x - tagW / 2)), height - timeAxisHeight + 2, tagW, 16);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeTagText, Math.max(tagW / 2 + 2, Math.min(chartWidth - tagW / 2 - 2, x)), height - timeAxisHeight + 10);
      }
    } else {
      // Draw Active / Last Candle Price Tag on Right Axis (matching Image 2 turquoise highlight)
      const lastVisible = visibleCandles[visibleCandles.length - 1];
      if (lastVisible) {
        const lastY = getY(lastVisible.close);
        if (lastY >= 0 && lastY <= priceChartHeight) {
          ctx.strokeStyle = 'rgba(0, 192, 135, 0.35)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(getX(visibleCandles.length - 1), lastY);
          ctx.lineTo(chartWidth, lastY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#00c087';
          ctx.fillRect(chartWidth + 1, lastY - 9, priceAxisWidth - 2, 18);
          ctx.fillStyle = '#051914';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const formatted = lastVisible.close < 1 ? lastVisible.close.toFixed(4) : lastVisible.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          ctx.fillText(formatted, chartWidth + 5, lastY);
        }
      }
    }

    // Draw Auto Price Reset badge on the price axis if scale is manually adjusted
    if (priceZoom !== 1.0 || pricePanOffset !== 0) {
      const badgeW = 46;
      const badgeH = 16;
      const badgeX = chartWidth + (priceAxisWidth - badgeW) / 2;
      const badgeY = priceChartHeight - 20;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AUTO', badgeX + badgeW / 2, badgeY + badgeH / 2);
    }
  }, [
    candles,
    startIndex,
    visibleCount,
    futureMarginBars,
    drawings,
    activeDrawing,
    selectedDrawingId,
    priceZoom,
    pricePanOffset,
    chartHeight,
    isFullscreen,
    containerDimensions.width,
    containerDimensions.height,
    hoverPos,
    hoverIndex,
    showIndicators,
    indicatorToggles,
    result,
    strategy,
    timeframe,
    computedEma50,
    computedEma200,
    computedRsi14,
    computedExtrema,
  ]);

  // Handle Drag / Pan / Squeeze / Drawing via Pointer Events (supports Mouse, Touch, Pen)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const chartWidth = rect.width - 65;
    const timeAxisHeight = 24;

    // Check if clicked the "AUTO" badge on price axis
    if (
      (priceZoom !== 1.0 || pricePanOffset !== 0) &&
      x >= chartWidth &&
      y >= rect.height - timeAxisHeight - 28 &&
      y <= rect.height - timeAxisHeight
    ) {
      setPriceZoom(1.0);
      setPricePanOffset(0);
      return;
    }

    // DRAWING TOOL INTERACTIONS:
    if (activeDrawingTool !== 'select' && x >= 0 && x <= chartWidth && y >= 0 && y <= rect.height - timeAxisHeight) {
      const volumeH = indicatorToggles.volume ? Math.min(rect.height * 0.18, 65) : 0;
      const rsiH = indicatorToggles.rsi ? Math.min(rect.height * 0.2, 75) : 0;
      const priceChartHeight = rect.height - timeAxisHeight - volumeH - rsiH;

      const realCandleStart = Math.max(0, Math.min(candles.length - 1, startIndex));
      const realCandleEnd = Math.min(candles.length, Math.max(0, startIndex + visibleCount));
      const visibleCandles = candles.slice(realCandleStart, realCandleEnd);
      const minP = visibleCandles.length > 0 ? Math.min(...visibleCandles.map((c) => c.low)) : 100;
      const maxP = visibleCandles.length > 0 ? Math.max(...visibleCandles.map((c) => c.high)) : 200;
      const basePad = (maxP - minP) * 0.05 || maxP * 0.02 || 1;
      const baseRange = Math.max(1e-6, (maxP + basePad) - (minP - basePad));
      const baseMid = ((maxP + basePad) + (minP - basePad)) / 2 + pricePanOffset;
      const effRange = Math.max(1e-6, baseRange * priceZoom);
      const curMinPrice = baseMid - effRange / 2;
      const curPriceRange = effRange;

      let snappedCandleIndex: number;
      let snappedPrice: number;

      if (isMagnetEnabled) {
        const snap = snapToCandleOHLC(x, y, startIndex, visibleCount, chartWidth, priceChartHeight, curMinPrice, curPriceRange, candles);
        snappedCandleIndex = snap.candleIndex;
        snappedPrice = snap.price;
      } else {
        const barSlotWidth = chartWidth / visibleCount;
        snappedCandleIndex = Math.round(startIndex + (x - barSlotWidth / 2) / barSlotWidth);
        snappedPrice = curMinPrice + (1 - Math.max(0, Math.min(priceChartHeight, y)) / priceChartHeight) * curPriceRange;
      }

      const intervalMs = candles.length >= 2 ? (candles[candles.length - 1].time - candles[0].time) / (candles.length - 1) : 300000;
      const targetTime = snappedCandleIndex < candles.length && snappedCandleIndex >= 0
        ? candles[snappedCandleIndex].time
        : candles[candles.length - 1].time + (snappedCandleIndex - (candles.length - 1)) * intervalMs;

      if (activeDrawingTool === 'horizontal') {
        const newDrawing: ChartDrawing = {
          id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          type: 'horizontal',
          color: activeDrawingColor,
          points: [{ candleIndex: snappedCandleIndex, timestamp: targetTime, price: snappedPrice }],
          createdAt: Date.now(),
        };
        saveDrawings([...drawings, newDrawing]);
        setSelectedDrawingId(newDrawing.id);
        return;
      }

      if (activeDrawingTool === 'trendline' || activeDrawingTool === 'ray' || activeDrawingTool === 'fibonacci') {
        if (!activeDrawing) {
          setActiveDrawing({
            id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: activeDrawingTool,
            color: activeDrawingColor,
            points: [{ candleIndex: snappedCandleIndex, timestamp: targetTime, price: snappedPrice }],
            createdAt: Date.now(),
          });
        } else {
          const completedDrawing: ChartDrawing = {
            ...activeDrawing,
            points: [
              activeDrawing.points[0],
              { candleIndex: snappedCandleIndex, timestamp: targetTime, price: snappedPrice },
            ],
          };
          saveDrawings([...drawings, completedDrawing]);
          setActiveDrawing(null);
          setSelectedDrawingId(completedDrawing.id);
        }
        return;
      }
    }

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartIndex.current = startIndex;
    dragStartVisibleCount.current = visibleCount;
    dragStartPriceZoom.current = priceZoom;
    dragStartPriceOffset.current = pricePanOffset;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    if (x >= chartWidth) {
      // Squeeze / Expand Price level directly by dragging the price scale
      dragMode.current = 'SQUEEZE_PRICE';
    } else if (y >= rect.height - timeAxisHeight) {
      // Squeeze / Expand Data range directly by dragging the time scale
      dragMode.current = 'SQUEEZE_TIME';
    } else {
      // Standard full 2D chart pan: allows holding and moving left/right AND upside/down!
      dragMode.current = 'PAN_CHART';
      canvas.style.cursor = 'grabbing';
      setSelectedDrawingId(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const chartWidth = rect.width - 65;
    const timeAxisHeight = 24;

    // In-progress drawing preview update
    if (activeDrawing && activeDrawing.points.length >= 1 && x >= 0 && x <= chartWidth && y >= 0 && y <= rect.height - timeAxisHeight) {
      const volumeH = indicatorToggles.volume ? Math.min(rect.height * 0.18, 65) : 0;
      const rsiH = indicatorToggles.rsi ? Math.min(rect.height * 0.2, 75) : 0;
      const priceChartHeight = rect.height - timeAxisHeight - volumeH - rsiH;

      const realCandleStart = Math.max(0, Math.min(candles.length - 1, startIndex));
      const realCandleEnd = Math.min(candles.length, Math.max(0, startIndex + visibleCount));
      const visibleCandles = candles.slice(realCandleStart, realCandleEnd);
      const minP = visibleCandles.length > 0 ? Math.min(...visibleCandles.map((c) => c.low)) : 100;
      const maxP = visibleCandles.length > 0 ? Math.max(...visibleCandles.map((c) => c.high)) : 200;
      const basePad = (maxP - minP) * 0.05 || maxP * 0.02 || 1;
      const baseRange = Math.max(1e-6, (maxP + basePad) - (minP - basePad));
      const baseMid = ((maxP + basePad) + (minP - basePad)) / 2 + pricePanOffset;
      const effRange = Math.max(1e-6, baseRange * priceZoom);
      const curMinPrice = baseMid - effRange / 2;
      const curPriceRange = effRange;

      let previewIdx: number;
      let previewPrice: number;

      if (isMagnetEnabled) {
        const snap = snapToCandleOHLC(x, y, startIndex, visibleCount, chartWidth, priceChartHeight, curMinPrice, curPriceRange, candles);
        previewIdx = snap.candleIndex;
        previewPrice = snap.price;
      } else {
        const barSlotWidth = chartWidth / visibleCount;
        previewIdx = Math.round(startIndex + (x - barSlotWidth / 2) / barSlotWidth);
        previewPrice = curMinPrice + (1 - Math.max(0, Math.min(priceChartHeight, y)) / priceChartHeight) * curPriceRange;
      }

      const intervalMs = candles.length >= 2 ? (candles[candles.length - 1].time - candles[0].time) / (candles.length - 1) : 300000;
      const targetTime = previewIdx < candles.length && previewIdx >= 0
        ? candles[previewIdx].time
        : candles[candles.length - 1].time + (previewIdx - (candles.length - 1)) * intervalMs;

      setActiveDrawing({
        ...activeDrawing,
        points: [
          activeDrawing.points[0],
          { candleIndex: previewIdx, timestamp: targetTime, price: previewPrice },
        ],
      });
    }

    // Dynamic cursor feedback when not dragging
    if (!dragMode.current) {
      if (x >= chartWidth) {
        canvas.style.cursor = 'ns-resize';
      } else if (y >= rect.height - timeAxisHeight) {
        canvas.style.cursor = 'ew-resize';
      } else if (activeDrawingTool !== 'select') {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }

    if (x >= 0 && x <= chartWidth && y >= 0 && y <= rect.height - timeAxisHeight) {
      const candleWidth = chartWidth / visibleCount;
      const idx = Math.floor(x / candleWidth);
      setHoverIndex(Math.max(0, Math.min(visibleCount - 1, idx)));
      setHoverPos({ x, y });
    } else if (!dragMode.current) {
      setHoverIndex(null);
      setHoverPos(null);
    }

    if (!dragMode.current) return;

    if (dragMode.current === 'SQUEEZE_PRICE') {
      canvas.style.cursor = 'ns-resize';
      const deltaY = e.clientY - dragStartY.current;
      const factor = Math.exp(-deltaY * 0.008);
      const newZoom = Math.max(0.15, Math.min(8.0, dragStartPriceZoom.current * factor));
      setPriceZoom(newZoom);
    } else if (dragMode.current === 'SQUEEZE_TIME') {
      canvas.style.cursor = 'ew-resize';
      const deltaX = e.clientX - dragStartX.current;
      const shiftBars = Math.round(deltaX / 3.5);
      const newCount = Math.max(15, Math.min(candles.length, dragStartVisibleCount.current + shiftBars));
      setVisibleCount(newCount);
      setStartIndex((prev) => Math.max(0, Math.min(candles.length - newCount + futureMarginBars, prev)));
    } else if (dragMode.current === 'PAN_CHART') {
      canvas.style.cursor = 'grabbing';
      const deltaX = e.clientX - dragStartX.current;
      const deltaY = e.clientY - dragStartY.current;

      // 1. Horizontal Time Pan (Left to Right, including into future blank space)
      const candleWidth = chartWidth / visibleCount;
      const indexShift = Math.round(deltaX / candleWidth);
      const maxStart = Math.max(0, candles.length - 10 + Math.max(15, futureMarginBars));
      const newStart = Math.max(0, Math.min(maxStart, dragStartIndex.current - indexShift));
      setStartIndex(newStart);

      // 2. Vertical Price Pan (Hold upside and down!)
      const priceChartHeight = rect.height - timeAxisHeight;
      const realCandleStart = Math.max(0, Math.min(candles.length - 1, newStart));
      const realCandleEnd = Math.min(candles.length, Math.max(0, newStart + visibleCount));
      const visibleCandles = candles.slice(realCandleStart, realCandleEnd);
      const minP = visibleCandles.length > 0 ? Math.min(...visibleCandles.map((c) => c.low)) : 100;
      const maxP = visibleCandles.length > 0 ? Math.max(...visibleCandles.map((c) => c.high)) : 200;
      const priceRange = ((maxP - minP) || 1) * priceZoom;
      setPricePanOffset(dragStartPriceOffset.current + (deltaY / priceChartHeight) * priceRange);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
      canvas.style.cursor = 'crosshair';
    }
    dragMode.current = null;
  };

  const handlePointerLeave = () => {
    if (!dragMode.current) {
      setHoverIndex(null);
      setHoverPos(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const chartWidth = rect.width - 65;
    const timeAxisHeight = 24;

    if (x >= chartWidth) {
      // Double clicked price scale -> Reset Price scale to auto
      setPriceZoom(1.0);
      setPricePanOffset(0);
    } else if (y >= rect.height - timeAxisHeight) {
      // Double clicked time scale -> Reset Data Range with future space
      const count = Math.min(candles.length, 120);
      setVisibleCount(count);
      setStartIndex(Math.max(0, candles.length - count + futureMarginBars));
    } else {
      // Double clicked chart canvas -> Reset both!
      setPriceZoom(1.0);
      setPricePanOffset(0);
      const count = Math.min(candles.length, 120);
      setVisibleCount(count);
      setStartIndex(Math.max(0, candles.length - count + futureMarginBars));
    }
  };

  // Update tracking refs for wheel handler to avoid stale closures
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const startIndexRef = useRef(startIndex);
  startIndexRef.current = startIndex;
  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;
  const futureMarginBarsRef = useRef(futureMarginBars);
  futureMarginBarsRef.current = futureMarginBars;
  const priceZoomRef = useRef(priceZoom);
  priceZoomRef.current = priceZoom;
  const pricePanOffsetRef = useRef(pricePanOffset);
  pricePanOffsetRef.current = pricePanOffset;

  // Native Non-Passive Wheel Listener:
  // When mouse pointer is on the chart, mouse scroll takes exclusive control of the chart (zoom / pan)
  // and prevents the browser page from scrolling.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // 1. Completely prevent the outer browser window from scrolling
      e.preventDefault();
      e.stopPropagation();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartWidth = rect.width - 65;
      const allCandles = candlesRef.current;
      const totalCandles = allCandles.length;
      if (totalCandles === 0) return;

      const curCount = visibleCountRef.current;
      const curStart = startIndexRef.current;
      const curMargin = futureMarginBarsRef.current;
      const maxStart = Math.max(0, totalCandles - 10 + Math.max(15, curMargin));

      // 2. Trackpad / Horizontal wheel pan (two-finger horizontal swipe)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 1.5) {
        const shiftBars = Math.round(e.deltaX / 7);
        if (shiftBars !== 0) {
          setStartIndex((prev) => Math.max(0, Math.min(maxStart, prev + shiftBars)));
        }
        return;
      }

      // 3. Wheel over right price axis: squeeze / expand price scale
      if (x >= chartWidth) {
        const factor = e.deltaY < 0 ? 0.9 : 1.1;
        setPriceZoom((prev) => Math.max(0.15, Math.min(8.0, prev * factor)));
        return;
      }

      // 4. Shift + Wheel: scroll / pan vertically up and down
      if (e.shiftKey) {
        const realStart = Math.max(0, Math.min(totalCandles - 1, curStart));
        const realEnd = Math.min(totalCandles, Math.max(0, curStart + curCount));
        const visibleCandles = allCandles.slice(realStart, realEnd);
        const minP = visibleCandles.length > 0 ? Math.min(...visibleCandles.map((c) => c.low)) : 100;
        const maxP = visibleCandles.length > 0 ? Math.max(...visibleCandles.map((c) => c.high)) : 200;
        const priceRange = ((maxP - minP) || 1) * priceZoomRef.current;
        const shift = (e.deltaY < 0 ? -0.06 : 0.06) * priceRange;
        setPricePanOffset((prev) => prev + shift);
        return;
      }

      // 5. Default Wheel over chart: smooth candle zoom anchored to cursor position
      const mouseRatio = Math.max(0, Math.min(1, x / chartWidth));
      const normalizedDelta = Math.max(-120, Math.min(120, e.deltaY));
      const zoomFactor = Math.exp(normalizedDelta * 0.0016);
      const newCount = Math.max(15, Math.min(totalCandles + curMargin, Math.round(curCount * zoomFactor)));

      if (newCount !== curCount) {
        setVisibleCount(newCount);
        // Anchor the candle directly under the cursor so it remains steady during zoom
        const deltaCount = curCount - newCount;
        const shift = Math.round(mouseRatio * deltaCount);
        setStartIndex((prev) => Math.max(0, Math.min(maxStart, prev + shift)));
      }
    };

    // Attach non-passive listener to reliably capture and preventDefault browser scroll
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Quick Pan Actions (Up, Down, Left, Right)
  const handlePanVertical = (dir: 'up' | 'down') => {
    const visibleCandles = candles.slice(startIndex, startIndex + visibleCount);
    const minP = Math.min(...visibleCandles.map((c) => c.low));
    const maxP = Math.max(...visibleCandles.map((c) => c.high));
    const range = ((maxP - minP) || 1) * priceZoom;
    const shift = (dir === 'up' ? -0.12 : 0.12) * range;
    setPricePanOffset((prev) => prev + shift);
  };

  const handlePanHorizontal = (dir: 'left' | 'right') => {
    const shift = Math.round(visibleCount * 0.15);
    setStartIndex((prev) => Math.max(0, Math.min(candles.length - visibleCount, dir === 'left' ? prev - shift : prev + shift)));
  };

  // Interactive Bottom Drag-to-Resize Handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = chartHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - resizeStartY.current;
      const minHeight = 320;
      const maxHeight = Math.min(1200, window.innerHeight - 80);
      const newHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(resizeStartHeight.current + deltaY)));
      setChartHeight(newHeight);
      try {
        localStorage.setItem('trading_chart_custom_height', String(newHeight));
      } catch (err) {}
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsResizing(true);
    resizeStartY.current = e.touches[0].clientY;
    resizeStartHeight.current = chartHeight;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const deltaY = moveEvent.touches[0].clientY - resizeStartY.current;
      const minHeight = 320;
      const maxHeight = Math.min(1200, window.innerHeight - 80);
      const newHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(resizeStartHeight.current + deltaY)));
      setChartHeight(newHeight);
      try {
        localStorage.setItem('trading_chart_custom_height', String(newHeight));
      } catch (err) {}
    };

    const onTouchEnd = () => {
      setIsResizing(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleResizeDoubleClick = () => {
    setChartHeight((prev) => {
      let next = 560;
      if (prev < 480) next = 560;
      else if (prev < 650) next = 740;
      else next = 420;
      try {
        localStorage.setItem('trading_chart_custom_height', String(next));
      } catch (e) {}
      return next;
    });
  };

  const handleZoomIn = () => {
    const newCount = Math.max(15, Math.round(visibleCount * 0.75));
    setVisibleCount(newCount);
    setStartIndex((prev) => Math.min(candles.length - newCount, prev + Math.floor(visibleCount * 0.12)));
  };

  const handleZoomOut = () => {
    const newCount = Math.min(candles.length, Math.round(visibleCount * 1.35));
    setVisibleCount(newCount);
    setStartIndex((prev) => Math.max(0, prev - Math.floor((newCount - visibleCount) / 2)));
  };

  const handleSqueezePrice = () => {
    setPriceZoom((prev) => Math.min(8.0, prev * 1.25));
  };

  const handleExpandPrice = () => {
    setPriceZoom((prev) => Math.max(0.15, prev * 0.8));
  };

  const handleResetPrice = () => {
    setPriceZoom(1.0);
    setPricePanOffset(0);
  };

  const handleSqueezeTime = () => {
    const newCount = Math.min(candles.length, Math.round(visibleCount * 1.35));
    setVisibleCount(newCount);
    setStartIndex((prev) => Math.max(0, prev - Math.floor((newCount - visibleCount) / 2)));
  };

  const handleExpandTime = () => {
    const newCount = Math.max(15, Math.round(visibleCount * 0.75));
    setVisibleCount(newCount);
    setStartIndex((prev) => Math.min(candles.length - newCount, prev + Math.floor(visibleCount * 0.12)));
  };

  const handleSetTimeCount = (bars: number) => {
    const target = bars === -1 ? candles.length : Math.min(candles.length, bars);
    setVisibleCount(target);
    setStartIndex(Math.max(0, candles.length - target));
  };

  const handleResetView = () => {
    const count = Math.min(candles.length, 120);
    setVisibleCount(count);
    setStartIndex(Math.max(0, candles.length - count));
    setPriceZoom(1.0);
    setPricePanOffset(0);
  };

  // Hovered candle info for toolbar
  const activeCandle =
    hoverIndex !== null && startIndex + hoverIndex < candles.length
      ? candles[startIndex + hoverIndex]
      : candles.length > 0
      ? candles[candles.length - 1]
      : null;

  const candleChange = activeCandle ? ((activeCandle.close - activeCandle.open) / activeCandle.open) * 100 : 0;

  // Is current timeframe outside common 6?
  const isCustomTimeframeSelected = !COMMON_TIMEFRAMES.some(
    (t) => t.value === timeframe || formatTimeframeDisplay(t.value) === formatTimeframeDisplay(timeframe)
  );

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-none p-0 bg-slate-950 flex flex-col h-screen w-screen'
          : ''
      }`}
    >
      {/* Chart Topbar with Live OHLCV & Controls */}
      <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Side: Active Candle OHLCV Readout */}
        {activeCandle ? (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-xs">
            {/* Interactive Symbol & Pair Selector Dropdown on Chart */}
            <div className="relative" ref={symbolDropdownRef}>
              <button
                id="btn-chart-symbol-dropdown"
                type="button"
                onClick={() => {
                  setIsSymbolOpen(!isSymbolOpen);
                  setIsStrategyOpen(false);
                  setIsIndicatorsOpen(false);
                  setIsTimeframeExpanded(false);
                }}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 border font-mono text-xs cursor-pointer ${
                  isSymbolOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
                title="Change Market Crypto Asset & Quote Pair"
              >
                <span className="text-emerald-400 font-bold">{coin}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-300">{pair}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSymbolOpen ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>

              {/* Floating Symbol & Pair Selector Popover */}
              {isSymbolOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3 z-40 space-y-3 backdrop-blur-md animate-in fade-in duration-100 font-sans">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Select Asset & Market Pair</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      {coin}/{pair}
                    </span>
                  </div>

                  {/* Custom Coin Input */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Search className="w-3 h-3 text-slate-400" /> Custom Coin Search
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = customCoinQuery.trim().toUpperCase();
                        if (val && onCoinChange) {
                          onCoinChange(val);
                          setCustomCoinQuery('');
                          setIsSymbolOpen(false);
                        }
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        id="input-chart-custom-coin"
                        type="text"
                        placeholder="e.g. TIA, INJ, AAVE, KAS"
                        value={customCoinQuery}
                        onChange={(e) => setCustomCoinQuery(e.target.value.toUpperCase())}
                        className="flex-1 bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!customCoinQuery.trim()}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </form>
                  </div>

                  {/* Popular Crypto Assets Grid */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Popular Assets
                    </div>
                    <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto pr-0.5">
                      {SUPPORTED_COINS.map((c) => {
                        const isActive = c.symbol.toUpperCase() === coin.toUpperCase();
                        return (
                          <button
                            key={c.symbol}
                            id={`chart-coin-btn-${c.symbol}`}
                            type="button"
                            onClick={() => {
                              onCoinChange?.(c.symbol);
                              setIsSymbolOpen(false);
                            }}
                            className={`py-1 px-1 rounded text-xs font-mono font-bold text-center transition-all cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800/80 hover:text-white'
                            }`}
                            title={`${c.name} (${c.symbol})`}
                          >
                            {c.symbol}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quote Pair Selector */}
                  {onPairChange && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-cyan-400" /> Quote Currency
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {SUPPORTED_PAIRS.map((p) => {
                          const isActive = p === pair;
                          return (
                            <button
                              key={p}
                              id={`chart-pair-btn-${p}`}
                              type="button"
                              onClick={() => {
                                onPairChange(p);
                                setIsSymbolOpen(false);
                              }}
                              className={`py-1 px-1 rounded text-xs font-mono font-bold text-center transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                  : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800/80 hover:text-white'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-[11px]">
              <span>
                O: <strong className="text-slate-200">{activeCandle.open}</strong>
              </span>
              <span>
                H: <strong className="text-emerald-400">{activeCandle.high}</strong>
              </span>
              <span>
                L: <strong className="text-rose-400">{activeCandle.low}</strong>
              </span>
              <span>
                C:{' '}
                <strong className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                  {activeCandle.close}
                </strong>
              </span>
              <span className={candleChange >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {candleChange >= 0 ? '+' : ''}
                {candleChange.toFixed(2)}%
              </span>
              <span className="text-slate-500 hidden xl:inline">
                Vol: <strong className="text-slate-300">{activeCandle.volume.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-mono">Loading chart data...</div>
        )}

        {/* Right Side: Timeframe Selector, Indicators Dropdown & Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* TIMEFRAME CONTROLS */}
          <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shadow-inner" ref={tfDropdownRef}>
            <div className="flex items-center gap-0.5">
              {COMMON_TIMEFRAMES.map((tf) => {
                const isActive = timeframe === tf.value || formatTimeframeDisplay(timeframe) === tf.label;
                return (
                  <button
                    key={tf.value}
                    id={`chart-tf-${tf.value}`}
                    onClick={() => onTimeframeChange?.(tf.value)}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/20 font-bold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                    title={`Switch timeframe to ${tf.label}`}
                  >
                    {tf.label}
                  </button>
                );
              })}

              {/* Display active custom timeframe if not in the common 6 */}
              {isCustomTimeframeSelected && (
                <span className="px-2 py-1 rounded text-[11px] font-mono font-bold bg-amber-400 text-slate-950 shadow-sm">
                  {formatTimeframeDisplay(timeframe)}
                </span>
              )}
            </div>

            {/* Expand Panel Trigger at Right Corner */}
            <button
              id="btn-expand-timeframes"
              onClick={() => setIsTimeframeExpanded(!isTimeframeExpanded)}
              className={`p-1 rounded ml-0.5 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer ${
                isTimeframeExpanded ? 'bg-slate-800 text-amber-300' : 'hover:bg-slate-800/60'
              }`}
              title="Expand Timeframes & Intervals"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isTimeframeExpanded ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {/* FLOATING EXPAND PANEL */}
            {isTimeframeExpanded && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3 z-30 space-y-3 backdrop-blur-md animate-in fade-in duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Timeframe Intervals
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 font-bold">
                    Active: {formatTimeframeDisplay(timeframe)}
                  </span>
                </div>

                {TIMEFRAME_GROUPS.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                      {group.group}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {group.items.map((item) => {
                        const isActive = timeframe === item.value;
                        return (
                          <button
                            key={item.value}
                            id={`chart-expand-tf-${item.value}`}
                            onClick={() => {
                              onTimeframeChange?.(item.value);
                              setIsTimeframeExpanded(false);
                            }}
                            className={`py-1 px-1.5 rounded text-[11px] font-mono font-medium text-center transition-all ${
                              isActive
                                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Testing Period Selector Shortcut */}
                {onTimePeriodChange && timePeriod && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Testing Period:</span>
                    <select
                      id="chart-select-testing-period"
                      value={timePeriod.preset}
                      onChange={(e) => {
                        onTimePeriodChange({
                          ...timePeriod,
                          preset: e.target.value as TimePeriodPreset,
                        });
                        setIsTimeframeExpanded(false);
                      }}
                      className="bg-slate-950 border border-slate-700 text-emerald-300 font-semibold text-xs rounded px-2 py-0.5 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="1w">1 Week (1W)</option>
                      <option value="1M">1 Month (1M)</option>
                      <option value="2M">2 Months (2M)</option>
                      <option value="3M">3 Months (3M)</option>
                      <option value="6M">6 Months (6M)</option>
                      <option value="1Year">1 Year (1Year)</option>
                      <option value="CUSTOM">Custom Date Range</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

          {/* STRATEGIES DROPDOWN MENU (WITH CUSTOM STRATEGIES) */}
          {onStrategyChange && (
            <div className="relative" ref={stratDropdownRef}>
              <button
                id="btn-strategies-dropdown"
                onClick={() => {
                  setIsStrategyOpen(!isStrategyOpen);
                  setIsIndicatorsOpen(false);
                  setIsTimeframeExpanded(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isStrategyOpen
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/10'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
                title="Select Trading Strategy (Custom & Built-in)"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-400 hidden sm:inline">Strategy:</span>
                <span className="font-semibold text-white max-w-[130px] truncate">
                  {strategy?.name || 'Select Strategy'}
                </span>
                {strategy?.isCustom ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    CUSTOM
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    PRESET
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${isStrategyOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* FLOATING STRATEGIES DROPDOWN */}
              {isStrategyOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3 z-30 space-y-2.5 backdrop-blur-md animate-in fade-in duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span>Trading Strategies</span>
                    </div>
                    {onOpenCustomBuilder && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsStrategyOpen(false);
                          onOpenCustomBuilder();
                        }}
                        className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Studio</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {/* MY CUSTOM STRATEGIES */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-1 text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                        <span>⭐ My Custom Strategies</span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono">
                          {customStrategies.length}
                        </span>
                      </div>

                      {customStrategies.length > 0 ? (
                        customStrategies.map((cs) => {
                          const isActive = strategy?.id === cs.id;
                          const badge = cs.baseType === 'PINE_SCRIPT' ? 'Pine v5' : cs.baseType === 'CUSTOM_RULES' ? 'Rules' : 'JS';
                          return (
                            <button
                              key={cs.id}
                              id={`chart-dropdown-custom-${cs.id}`}
                              type="button"
                              onClick={() => {
                                onStrategyChange(cs);
                                setIndicatorToggles((prev) => ({ ...prev, signals: true }));
                                setAppliedToast(`Applied: ${cs.name}`);
                                setIsStrategyOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-cyan-500/20 text-white border border-cyan-500/40 shadow-sm'
                                  : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-slate-600'}`} />
                                <div className="min-w-0">
                                  <div className={`text-xs font-semibold truncate ${isActive ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
                                    {cs.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                                    {cs.description || 'Custom strategy algorithm'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-slate-950 border border-slate-700 text-cyan-300">
                                  {badge}
                                </span>
                                {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-2 py-2 text-center bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                          No custom strategies saved yet.
                        </div>
                      )}
                    </div>

                    {/* BUILT-IN PRESETS */}
                    <div className="space-y-1 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between px-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        <span>📈 Built-in Presets</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] font-mono">
                          {STRATEGY_PRESETS.length}
                        </span>
                      </div>

                      {STRATEGY_PRESETS.map((preset) => {
                        const isActive = strategy?.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            id={`chart-dropdown-preset-${preset.id}`}
                            type="button"
                            onClick={() => {
                              onStrategyChange(preset);
                              setIndicatorToggles((prev) => ({ ...prev, signals: true }));
                              setAppliedToast(`Applied: ${preset.name}`);
                              setIsStrategyOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-purple-500/20 text-white border border-purple-500/40 shadow-sm'
                                : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-purple-400 shadow-sm shadow-purple-400/50' : 'bg-slate-600'}`} />
                              <div className="min-w-0">
                                <div className={`text-xs font-semibold truncate ${isActive ? 'text-purple-300 font-bold' : 'text-slate-200'}`}>
                                  {preset.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                  {preset.description}
                                </div>
                              </div>
                            </div>

                            {isActive && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

          {/* INDICATORS DROPDOWN MENU */}
          <div className="relative" ref={indDropdownRef}>
            <button
              id="btn-indicators-dropdown"
              onClick={() => setIsIndicatorsOpen(!isIndicatorsOpen)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border ${
                isIndicatorsOpen || showIndicators
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Select & Toggle Chart Indicators"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Indicators</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-cyan-400/20 text-cyan-300">
                {activeIndicatorCount}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isIndicatorsOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* FLOATING INDICATORS DROPDOWN */}
            {isIndicatorsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3 z-30 space-y-2.5 backdrop-blur-md animate-in fade-in duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Technical Indicators</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      onClick={() =>
                        setIndicatorToggles({
                          emaFast: true,
                          emaSlow: true,
                          ema50: true,
                          ema200: true,
                          bollinger: true,
                          supertrend: true,
                          extrema: true,
                          volume: true,
                          signals: true,
                          rsi: true,
                          srLevels: true,
                        })
                      }
                      className="text-cyan-400 hover:underline"
                    >
                      All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      onClick={() =>
                        setIndicatorToggles({
                          emaFast: false,
                          emaSlow: false,
                          ema50: false,
                          ema200: false,
                          bollinger: false,
                          supertrend: false,
                          extrema: false,
                          volume: false,
                          signals: false,
                          rsi: false,
                          srLevels: false,
                        })
                      }
                      className="text-slate-400 hover:underline"
                    >
                      None
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      onClick={() =>
                        setIndicatorToggles({
                          emaFast: true,
                          emaSlow: true,
                          ema50: false,
                          ema200: false,
                          bollinger: true,
                          supertrend: true,
                          extrema: false,
                          volume: true,
                          signals: true,
                          rsi: false,
                          srLevels: true,
                        })
                      }
                      className="text-amber-400 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {/* Indicator Toggle Items */}
                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Fast EMA (9/12)</div>
                        <div className="text-[10px] text-slate-500">Short-term trend line</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.emaFast}
                      onChange={() => toggleIndicator('emaFast')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Slow EMA (21/26)</div>
                        <div className="text-[10px] text-slate-500">Trend baseline confirmation</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.emaSlow}
                      onChange={() => toggleIndicator('emaSlow')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block shadow-sm shadow-purple-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">EMA 50 (Trend Filter)</div>
                        <div className="text-[10px] text-slate-500">Macro dynamic support</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.ema50}
                      onChange={() => toggleIndicator('ema50')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block shadow-sm shadow-orange-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">EMA 200 (Long Term)</div>
                        <div className="text-[10px] text-slate-500">Bull / Bear benchmark</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.ema200}
                      onChange={() => toggleIndicator('ema200')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Bollinger Bands (20, 2)</div>
                        <div className="text-[10px] text-slate-500">Volatility envelope & cloud</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.bollinger}
                      onChange={() => toggleIndicator('bollinger')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Supertrend (10, 3)</div>
                        <div className="text-[10px] text-slate-500">ATR trailing stop band</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.supertrend}
                      onChange={() => toggleIndicator('supertrend')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block shadow-sm" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Price Extrema Channel</div>
                        <div className="text-[10px] text-slate-500">20-period High/Low bounds</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.extrema}
                      onChange={() => toggleIndicator('extrema')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-slate-400 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 inline-block shadow-sm shadow-fuchsia-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">RSI (14) Subplot</div>
                        <div className="text-[10px] text-slate-500">Oscillator with 70/30 bands</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.rsi}
                      onChange={() => toggleIndicator('rsi')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-fuchsia-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Volume Profile Bars</div>
                        <div className="text-[10px] text-slate-500">Trading activity histogram</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.volume}
                      onChange={() => toggleIndicator('volume')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Strategy Signals</div>
                        <div className="text-[10px] text-slate-500">Buy / Sell flags & PnL tags</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.signals}
                      onChange={() => toggleIndicator('signals')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block shadow-sm shadow-rose-400/50" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">Support & Resistance</div>
                        <div className="text-[10px] text-slate-500">Horizontal key shelves & touches</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicatorToggles.srLevels}
                      onChange={() => toggleIndicator('srLevels')}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>

                  {/* Custom Strategies in Indicators Dropdown */}
                  {customStrategies && customStrategies.length > 0 && onStrategyChange && (
                    <div className="pt-2 mt-1 border-t border-slate-800 space-y-1">
                      <div className="flex items-center justify-between px-1 text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                        <span>⭐ Custom Strategies</span>
                        <span className="text-[9px] text-cyan-300 font-mono">{customStrategies.length}</span>
                      </div>
                      {customStrategies.map((cs) => {
                        const isActive = strategy?.id === cs.id;
                        return (
                          <button
                            key={cs.id}
                            id={`ind-custom-strat-${cs.id}`}
                            type="button"
                            onClick={() => {
                              onStrategyChange(cs);
                              setIndicatorToggles((prev) => ({ ...prev, signals: true }));
                              setAppliedToast(`Applied: ${cs.name}`);
                              setIsIndicatorsOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isActive ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span className="truncate">⭐ {cs.name}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Signals Toggle */}
          <button
            id="btn-toggle-trades"
            onClick={() => toggleIndicator('signals')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 border ${
              indicatorToggles.signals
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle Strategy Buy/Sell Signals on Chart"
          >
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Signals</span>
          </button>

          {/* Master Indicator Visibility Toggle */}
          <button
            id="btn-toggle-indicators"
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 border ${
              showIndicators
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle All Chart Indicator Overlays"
          >
            {showIndicators ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-rose-400" />}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Interactive Squeeze & Scale Toolbars */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <MoveVertical className="w-3 h-3 text-cyan-400" /> Price:
            </span>
            <button
              id="btn-squeeze-price"
              onClick={handleSqueezePrice}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-[10px] transition-colors"
              title="Squeeze Price Axis vertically (compress price levels)"
            >
              - Squeeze
            </button>
            <button
              id="btn-expand-price"
              onClick={handleExpandPrice}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-[10px] transition-colors"
              title="Expand Price Axis vertically (stretch price levels)"
            >
              + Expand
            </button>
            <button
              id="btn-auto-price"
              onClick={handleResetPrice}
              className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-all ${
                priceZoom !== 1.0 || pricePanOffset !== 0
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
              title="Reset Price Scale to Auto-fit"
            >
              Auto
            </button>
          </div>

          {/* Data Range Squeeze / Presets */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <MoveHorizontal className="w-3 h-3 text-amber-400" /> Range:
            </span>
            <button
              id="btn-squeeze-time"
              onClick={handleSqueezeTime}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-[10px] transition-colors"
              title="Squeeze Data Range (zoom out to see more bars)"
            >
              - Range
            </button>
            <button
              id="btn-expand-time"
              onClick={handleExpandTime}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-[10px] transition-colors"
              title="Expand Data Range (zoom in to inspect bars)"
            >
              + Range
            </button>
            <div className="flex items-center gap-0.5 border-l border-slate-800 pl-1">
              <button
                id="btn-range-50"
                onClick={() => handleSetTimeCount(50)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  visibleCount <= 60 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View 50 candles"
              >
                50b
              </button>
              <button
                id="btn-range-120"
                onClick={() => handleSetTimeCount(120)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  visibleCount > 60 && visibleCount <= 160 ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View 120 candles"
              >
                120b
              </button>
              <button
                id="btn-range-300"
                onClick={() => handleSetTimeCount(300)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  visibleCount > 160 && visibleCount < candles.length ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View 300 candles"
              >
                300b
              </button>
              <button
                id="btn-range-all"
                onClick={() => handleSetTimeCount(-1)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  visibleCount >= candles.length ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View all loaded candles"
              >
                All
              </button>
            </div>
            <button
              id="btn-reset-view"
              onClick={handleResetView}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Reset both Price and Data Range scales"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chart Height Controls & Fullscreen */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 shadow-inner">
            <span className="text-[10px] text-slate-500 font-mono pl-1 hidden sm:inline">Height:</span>
            {[
              { label: '420', h: 420, title: 'Compact height (420px)' },
              { label: '560', h: 560, title: 'Medium height (560px)' },
              { label: '720', h: 720, title: 'Tall height (720px)' },
            ].map((preset) => (
              <button
                key={preset.h}
                onClick={() => {
                  setChartHeight(preset.h);
                  try {
                    localStorage.setItem('trading_chart_custom_height', String(preset.h));
                  } catch (e) {}
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  !isFullscreen && Math.abs(chartHeight - preset.h) < 30
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={preset.title}
              >
                {preset.label}
              </button>
            ))}

            <button
              id="btn-toggle-fullscreen"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1 rounded text-slate-300 transition-colors ml-0.5 ${
                isFullscreen
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Expand to Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Chart Area */}
      <div
        ref={containerRef}
        style={isFullscreen ? undefined : { height: `${chartHeight}px` }}
        className={`relative w-full ${
          isFullscreen ? 'flex-1 min-h-[400px]' : ''
        } bg-[#090d16] select-none overflow-hidden overscroll-contain touch-none`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          className="w-full h-full block touch-none"
        />

        {/* Left-Corner Vertical Drawing Toolbar */}
        <div className="absolute top-3 left-3 z-30">
          <ChartDrawingToolbar
            activeTool={activeDrawingTool}
            onSelectTool={(tool) => {
              setActiveDrawingTool(tool);
              setActiveDrawing(null);
            }}
            activeColor={activeDrawingColor}
            onSelectColor={setActiveDrawingColor}
            isMagnetEnabled={isMagnetEnabled}
            onToggleMagnet={() => setIsMagnetEnabled(!isMagnetEnabled)}
            futureMarginBars={futureMarginBars}
            onChangeFutureMargin={(margin) => {
              setFutureMarginBars(margin);
              try {
                localStorage.setItem('trading_chart_future_margin', String(margin));
              } catch (e) {}
            }}
            drawingsCount={drawings.length}
            selectedDrawingId={selectedDrawingId}
            onDeleteSelectedDrawing={handleDeleteSelectedDrawing}
            onClearDrawings={handleClearDrawings}
            onUndoDrawing={handleUndoDrawing}
          />
        </div>

        {/* Interactive Drawing Hint Toast when in Drawing Mode */}
        {activeDrawingTool !== 'select' && (
          <div className="absolute bottom-8 left-16 pointer-events-none z-20 flex items-center gap-2 bg-slate-950/90 border border-cyan-500/50 text-cyan-200 px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md text-[11px] font-mono animate-in fade-in duration-150">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold text-white">
              {activeDrawingTool === 'fibonacci'
                ? 'Fibonacci Retracement'
                : activeDrawingTool === 'horizontal'
                ? 'Horizontal S/R Line'
                : activeDrawingTool === 'ray'
                ? 'Ray Line'
                : 'Trendline'}
              :
            </span>
            <span className="text-slate-300">
              {activeDrawingTool === 'horizontal'
                ? 'Click on chart or price level to place line'
                : activeDrawing
                ? 'Click 2nd point to complete line • Press Esc to cancel'
                : 'Click 1st point to start (supports future blank space) • Magnet snaps to OHLC'}
            </span>
          </div>
        )}

        {/* Legend Overlay at top of chart (aligned cleanly to the right of vertical left toolbar) */}
        {showIndicators && (
          <div className="absolute top-3 left-16 pointer-events-none flex flex-wrap items-center gap-2 text-[10px] font-mono bg-slate-950/75 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800/80 z-10">
            {indicatorToggles.emaFast && result?.indicators?.emaFast && (
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                EMA Fast
              </span>
            )}
            {indicatorToggles.emaSlow && result?.indicators?.emaSlow && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                EMA Slow
              </span>
            )}
            {indicatorToggles.ema50 && (
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-2.5 h-0.5 bg-purple-400 inline-block" />
                EMA 50
              </span>
            )}
            {indicatorToggles.ema200 && (
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2.5 h-0.5 bg-orange-400 inline-block" />
                EMA 200
              </span>
            )}
            {indicatorToggles.bollinger && result?.indicators?.bollinger && (
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
                Bollinger (20, 2)
              </span>
            )}
            {indicatorToggles.supertrend && result?.indicators?.supertrend && (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                Supertrend
              </span>
            )}
            {indicatorToggles.extrema && (
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block border-b border-dashed" />
                Extrema (20)
              </span>
            )}
            {indicatorToggles.rsi && (
              <span className="flex items-center gap-1 text-fuchsia-400">
                <span className="w-2.5 h-0.5 bg-fuchsia-400 inline-block" />
                RSI (14)
              </span>
            )}
            {indicatorToggles.srLevels && Boolean((result?.indicators?.supportLevels && result.indicators.supportLevels.length > 0) || (result?.indicators?.resistanceLevels && result.indicators.resistanceLevels.length > 0)) && (
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-0.5 bg-rose-400 inline-block border-b border-dashed" />
                S/R Levels
              </span>
            )}
          </div>
        )}

        {/* Active Strategy Status Pill on Chart */}
        <div className="absolute top-3 right-4 pointer-events-none hidden sm:flex items-center gap-2 text-[11px] font-mono bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/70 shadow-lg z-10">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400 font-sans">Active:</span>
          <span className="text-cyan-300 font-bold max-w-[170px] truncate">{strategy?.name || 'Dual EMA Cross'}</span>
          <span className="px-1.5 py-0.2 rounded bg-cyan-950/90 border border-cyan-500/30 text-[10px] text-cyan-200">
            {strategy?.baseType === 'PINE_SCRIPT' ? 'Pine v5' : strategy?.baseType === 'CUSTOM_RULES' ? 'Rules' : strategy?.baseType === 'CUSTOM_SCRIPT' ? 'JS' : 'Preset'}
          </span>
          {result && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 font-semibold">{result.trades.length} trades</span>
              <span className={`font-bold ${result.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.winRate}% win
              </span>
            </>
          )}
        </div>

        {/* Real-time Applied Strategy Notification Toast */}
        {appliedToast && (
          <div className="absolute top-12 right-4 pointer-events-none z-20 flex items-center gap-2 bg-gradient-to-r from-emerald-950/95 to-slate-950/95 border border-emerald-500/50 text-emerald-200 px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-xs font-semibold">{appliedToast}</span>
            <span className="text-[10px] text-emerald-400/80 font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded">Active</span>
          </div>
        )}
      </div>

      {/* Draggable Height Resize Handle Bar */}
      {!isFullscreen && (
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeTouchStart}
          onDoubleClick={handleResizeDoubleClick}
          className={`w-full py-1.5 bg-slate-950/90 border-y border-slate-800/90 flex items-center justify-center cursor-row-resize select-none group hover:bg-cyan-950/40 hover:border-cyan-500/50 transition-all ${
            isResizing ? 'bg-cyan-950/80 border-cyan-500' : ''
          }`}
          title="Click and drag up/down to resize chart height • Double-click for preset heights"
        >
          <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-slate-900/90 group-hover:bg-cyan-950/80 border border-slate-800 group-hover:border-cyan-500/40 transition-all shadow-sm">
            <GripHorizontal className={`w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors ${isResizing ? 'text-cyan-300' : ''}`} />
            <span className="text-[10px] font-mono text-slate-400 group-hover:text-cyan-300 font-medium">
              {isResizing ? `Resizing: ${chartHeight}px` : 'Drag to resize chart height'}
            </span>
            <span className="text-[9px] text-slate-500 group-hover:text-slate-300 font-mono">
              ({chartHeight}px)
            </span>
          </div>
        </div>
      )}

      {/* Chart Footer with Interactive Controls & Pan Nudges */}
      <div className="px-3.5 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-400 font-sans font-semibold flex items-center gap-1">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            2D Pan & Hold:
          </span>
          <span className="hidden lg:inline text-slate-300">
            Click & drag chart in ANY direction (left/right & upside/down) • Shift+Wheel to scroll vertical
          </span>
          <span className="lg:hidden text-slate-300">
            Drag chart 2D (↔ ↕) • Drag bottom bar to resize
          </span>

          {/* Direct 4-Way Pan Nudge Buttons */}
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg px-1 py-0.5 ml-1">
            <button
              onClick={() => handlePanVertical('up')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Pan Price Up (Hold upward)"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => handlePanVertical('down')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Pan Price Down (Hold downward)"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => handlePanHorizontal('left')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Pan Time Left (Earlier candles)"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => handlePanHorizontal('right')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Pan Time Right (Recent candles)"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
            {(pricePanOffset !== 0 || priceZoom !== 1.0) && (
              <button
                onClick={handleResetPrice}
                className="px-1 py-0.5 rounded text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900 ml-0.5"
                title="Reset vertical pan & price zoom to auto"
              >
                Auto Y
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Bars: <strong className="text-slate-200">{visibleCount}</strong> / {candles.length}
          </span>
          <span className="text-slate-600">•</span>
          <span>
            Price Scale:{' '}
            <strong className={priceZoom !== 1.0 || pricePanOffset !== 0 ? 'text-cyan-400' : 'text-slate-200'}>
              {priceZoom === 1.0 && pricePanOffset === 0 ? 'Auto' : `${(1 / priceZoom).toFixed(2)}x`}
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            H: <strong className="text-slate-200">{chartHeight}px</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
