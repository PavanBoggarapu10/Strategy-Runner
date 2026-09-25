export type DrawingToolType = 'select' | 'trendline' | 'horizontal' | 'ray' | 'fibonacci';

export interface ChartPoint {
  candleIndex: number; // Bar index (can be >= candles.length into the future blank space!)
  timestamp: number;   // Timestamp (for alignment)
  price: number;       // Price level
}

export interface ChartDrawing {
  id: string;
  type: DrawingToolType;
  color: string;
  points: ChartPoint[]; // 1 point for horizontal line, 2 points for trendline/ray/fibonacci
  lineWidth?: number;
  label?: string;
  createdAt: number;
}

export interface FibonacciLevelConfig {
  ratio: number;
  label: string;
  name: string;
  color: string;
  bg?: string;
  isGolden?: boolean;
}

export const FIBONACCI_LEVELS: FibonacciLevelConfig[] = [
  { ratio: 0.0, label: '0.0%', name: 'Base / Low', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.05)' },
  { ratio: 0.236, label: '23.6%', name: 'Pullback', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)' },
  { ratio: 0.382, label: '38.2%', name: 'Shallow Retrace', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.10)' },
  { ratio: 0.5, label: '50.0%', name: 'Equilibrium (Halfway)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  { ratio: 0.618, label: '61.8%', name: 'Golden Ratio (Phi)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)', isGolden: true },
  { ratio: 0.786, label: '78.6%', name: 'Deep Retracement', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.10)' },
  { ratio: 1.0, label: '100.0%', name: 'Full Range / High', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.05)' },
  { ratio: 1.618, label: '161.8%', name: 'Golden Extension Target', color: '#eab308', bg: 'rgba(234, 179, 8, 0.10)', isGolden: true },
  { ratio: 2.618, label: '261.8%', name: 'Macro Extension 2', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)' },
];

export const DRAWING_COLORS = [
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'White', value: '#f8fafc' },
];
