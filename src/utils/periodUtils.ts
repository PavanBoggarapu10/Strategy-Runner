import { Timeframe, TimePeriodPreset, BacktestTimePeriod } from '../types/trading';
import { TIMEFRAMES } from './dataService';

export interface TimePeriodOptionConfig {
  value: TimePeriodPreset;
  label: string;
  description: string;
  days: number;
}

export const TIME_PERIOD_OPTIONS: TimePeriodOptionConfig[] = [
  { value: '1w', label: '1 Week (1W)', description: 'Past 1 week execution cycle (7 days)', days: 7 },
  { value: '1M', label: '1 Month (1M)', description: 'Past 1 month execution cycle (30 days)', days: 30 },
  { value: '2M', label: '2 Months (2M)', description: 'Past 2 months execution cycle (60 days)', days: 60 },
  { value: '3M', label: '3 Months (3M)', description: 'Past 3 months execution cycle (90 days)', days: 90 },
  { value: '6M', label: '6 Months (6M)', description: 'Past 6 months execution cycle (180 days)', days: 180 },
  { value: '1Year', label: '1 Year (1Year)', description: 'Full 365-day annual execution cycle', days: 365 },
  { value: 'CUSTOM', label: 'Custom Date Range', description: 'User-specified calendar start and end dates', days: 0 },
];

export function getDefaultCustomDates(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function formatPeriodDate(timestampMs: number): string {
  if (!timestampMs || isNaN(timestampMs)) return '';
  return new Date(timestampMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function resolvePeriodToRange(
  period: BacktestTimePeriod,
  timeframe: Timeframe
): {
  startTimeMs: number;
  endTimeMs: number;
  candleLimit: number;
  periodLabel: string;
  daysCount: number;
  isCapped: boolean;
} {
  const now = Date.now();
  let startTimeMs = now;
  let endTimeMs = now;
  let daysCount = 30;
  let periodLabel = '1 Month (1M)';

  if (period.preset === 'CUSTOM') {
    const defaults = getDefaultCustomDates();
    const startStr = period.startDate || defaults.startDate;
    const endStr = period.endDate || defaults.endDate;

    const parsedStart = new Date(`${startStr}T00:00:00`).getTime();
    const parsedEnd = new Date(`${endStr}T23:59:59`).getTime();

    startTimeMs = isNaN(parsedStart) ? now - 30 * 24 * 60 * 60 * 1000 : parsedStart;
    endTimeMs = isNaN(parsedEnd) ? now : Math.min(now, parsedEnd);

    if (startTimeMs >= endTimeMs) {
      startTimeMs = endTimeMs - 7 * 24 * 60 * 60 * 1000;
    }

    daysCount = Math.max(1, Math.round((endTimeMs - startTimeMs) / (24 * 60 * 60 * 1000)));
    periodLabel = `Custom (${daysCount}d)`;
  } else {
    let opt = TIME_PERIOD_OPTIONS.find((o) => o.value === period.preset);
    if (!opt) {
      if ((period.preset as string) === '30d') opt = TIME_PERIOD_OPTIONS[1];
      else if ((period.preset as string) === '60d') opt = TIME_PERIOD_OPTIONS[2];
      else if ((period.preset as string) === '90d') opt = TIME_PERIOD_OPTIONS[3];
      else if ((period.preset as string) === '6m') opt = TIME_PERIOD_OPTIONS[4];
      else if ((period.preset as string) === '1y') opt = TIME_PERIOD_OPTIONS[5];
      else opt = TIME_PERIOD_OPTIONS[1]; // Default 1M
    }
    daysCount = opt.days;
    periodLabel = opt.label;
    startTimeMs = now - daysCount * 24 * 60 * 60 * 1000;
    endTimeMs = now;
  }

  const tfConfig = TIMEFRAMES.find((t) => t.value === timeframe) || TIMEFRAMES[13]; // 1w fallback
  const stepMs = tfConfig.ms;
  const spanMs = Math.max(stepMs * 30, endTimeMs - startTimeMs);
  const rawCandleCount = Math.round(spanMs / stepMs);

  // Keep candle count reasonable for browser execution (30 to 2500 candles)
  const maxAllowed = 2500;
  const minAllowed = 30;
  const candleLimit = Math.max(minAllowed, Math.min(maxAllowed, rawCandleCount));
  const isCapped = rawCandleCount > maxAllowed;

  return {
    startTimeMs,
    endTimeMs,
    candleLimit,
    periodLabel,
    daysCount,
    isCapped,
  };
}
