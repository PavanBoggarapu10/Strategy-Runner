import { ChartDrawing, FIBONACCI_LEVELS } from '../types/drawings';
import { Candle } from '../types/trading';

interface RenderDrawingsParams {
  ctx: CanvasRenderingContext2D;
  drawings: ChartDrawing[];
  activeDrawing: ChartDrawing | null;
  selectedDrawingId: string | null;
  startIndex: number;
  visibleCount: number;
  chartWidth: number;
  priceChartHeight: number;
  minPrice: number;
  priceRange: number;
  candles: Candle[];
}

export function renderDrawingsOnCanvas({
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
}: RenderDrawingsParams) {
  const barSlotWidth = chartWidth / visibleCount;

  const getX = (candleIndex: number) => {
    return (candleIndex - startIndex) * barSlotWidth + barSlotWidth / 2;
  };

  const getY = (price: number) => {
    return priceChartHeight - ((price - minPrice) / priceRange) * priceChartHeight;
  };

  const allDrawings = activeDrawing ? [...drawings, activeDrawing] : drawings;

  for (const drawing of allDrawings) {
    const isSelected = drawing.id === selectedDrawingId;
    const isTemp = drawing.id === activeDrawing?.id;

    ctx.save();

    if (drawing.type === 'horizontal') {
      const p1 = drawing.points[0];
      if (!p1) {
        ctx.restore();
        continue;
      }
      const y = getY(p1.price);

      // Horizontal Line across entire chart
      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      if (isTemp) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([6, 3]);
      }
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price Tag Label on left/right
      const priceText = p1.price < 1 ? p1.price.toFixed(4) : p1.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const labelText = `H-Line: $${priceText}`;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = drawing.color;
      ctx.beginPath();
      ctx.roundRect(10, y - 9, textWidth + 12, 18, 4);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 16, y);

      // Selection circles
      if (isSelected) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = drawing.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(chartWidth / 2, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (drawing.type === 'trendline') {
      const p1 = drawing.points[0];
      const p2 = drawing.points[1];
      if (!p1) {
        ctx.restore();
        continue;
      }

      const x1 = getX(p1.candleIndex);
      const y1 = getY(p1.price);

      if (!p2) {
        // Only 1 point placed so far: render start anchor
        ctx.fillStyle = drawing.color;
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      const x2 = getX(p2.candleIndex);
      const y2 = getY(p2.price);

      // Draw line segment
      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.8;
      if (isTemp) {
        ctx.setLineDash([4, 4]);
      }
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Endpoint anchors
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x1, y1, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Trendline Stats Badge (Middle of line)
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const barDiff = p2.candleIndex - p1.candleIndex;
      const priceDiff = p2.price - p1.price;
      const percentChange = p1.price !== 0 ? ((priceDiff / p1.price) * 100) : 0;
      const statsText = `${barDiff >= 0 ? '+' : ''}${barDiff}b | ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`;

      ctx.font = '9px "JetBrains Mono", monospace';
      const badgeW = ctx.measureText(statsText).width + 10;
      const badgeH = 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - badgeW / 2, midY - badgeH - 4, badgeW, badgeH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = percentChange >= 0 ? '#34d399' : '#fb7185';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(statsText, midX, midY - badgeH / 2 - 4);
    } else if (drawing.type === 'ray') {
      const p1 = drawing.points[0];
      const p2 = drawing.points[1];
      if (!p1) {
        ctx.restore();
        continue;
      }

      const x1 = getX(p1.candleIndex);
      const y1 = getY(p1.price);

      if (!p2) {
        ctx.fillStyle = drawing.color;
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      const x2 = getX(p2.candleIndex);
      const y2 = getY(p2.price);

      // Project ray into future to the right edge
      const dx = x2 - x1;
      const dy = y2 - y1;
      let targetX = x2;
      let targetY = y2;

      if (Math.abs(dx) > 0.001) {
        const slope = dy / dx;
        targetX = chartWidth + 50;
        targetY = y1 + slope * (targetX - x1);
      }

      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.8;
      if (isTemp) ctx.setLineDash([4, 4]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchors
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x1, y1, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (drawing.type === 'fibonacci') {
      const p1 = drawing.points[0];
      const p2 = drawing.points[1];
      if (!p1) {
        ctx.restore();
        continue;
      }

      const x1 = getX(p1.candleIndex);
      const y1 = getY(p1.price);

      if (!p2) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x1, y1, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      const x2 = getX(p2.candleIndex);
      const startX = Math.min(x1, x2);
      // Extend Fib levels horizontally past Point 2 into the future space!
      const endX = Math.max(chartWidth, Math.max(x1, x2) + barSlotWidth * 20);

      // Trend baseline between Swing 1 and Swing 2
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, getY(p2.price));
      ctx.stroke();
      ctx.setLineDash([]);

      // Calculate each Fibonacci Price Level
      // Direction: from p1 to p2
      // Level price = p1 + (p2 - p1) * ratio
      // Or Retracement from swing high/low:
      // When user drags Swing 1 (e.g. Low) to Swing 2 (e.g. High):
      // 0.0 is at Swing 2 (p2), 1.0 is at Swing 1 (p1), and 0.618 is 61.8% retrace of that move!
      const isRetracement = true;
      const fibLevelsWithY = FIBONACCI_LEVELS.map((fib) => {
        let levelPrice: number;
        if (isRetracement) {
          // Standard TradingView Retracement: 0% at Point 2, 100% at Point 1
          levelPrice = p2.price - (p2.price - p1.price) * fib.ratio;
        } else {
          levelPrice = p1.price + (p2.price - p1.price) * fib.ratio;
        }
        const y = getY(levelPrice);
        return { ...fib, levelPrice, y };
      });

      // Draw Shaded Bands between consecutive levels
      for (let i = 0; i < fibLevelsWithY.length - 1; i++) {
        const cur = fibLevelsWithY[i];
        const next = fibLevelsWithY[i + 1];
        if (cur.bg) {
          ctx.fillStyle = cur.bg;
          const topY = Math.min(cur.y, next.y);
          const bandHeight = Math.abs(next.y - cur.y);
          if (bandHeight > 0 && topY < priceChartHeight && topY + bandHeight > 0) {
            ctx.fillRect(startX, Math.max(0, topY), endX - startX, Math.min(priceChartHeight - Math.max(0, topY), bandHeight));
          }
        }
      }

      // Draw Individual Fibonacci Level Lines & Price Tags
      for (const fib of fibLevelsWithY) {
        if (fib.y < -20 || fib.y > priceChartHeight + 20) continue;

        ctx.beginPath();
        ctx.strokeStyle = fib.color;
        ctx.lineWidth = fib.isGolden ? (isSelected ? 2.5 : 1.8) : (isSelected ? 1.5 : 1.0);
        if (fib.isGolden) {
          ctx.setLineDash([]);
        } else {
          ctx.setLineDash([4, 2]);
        }

        ctx.moveTo(startX, fib.y);
        ctx.lineTo(endX, fib.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Text Badge (Percentage + Price)
        const priceStr = fib.levelPrice < 1
          ? fib.levelPrice.toFixed(4)
          : fib.levelPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const labelText = `${fib.label} (${priceStr})${fib.isGolden ? ' ★ Golden' : ''}`;

        ctx.font = fib.isGolden ? 'bold 10px "JetBrains Mono", monospace' : '9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(labelText).width;
        const badgeX = Math.max(10, startX + 8);
        const badgeY = fib.y - 8;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = fib.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth + 10, 16, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = fib.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, badgeX + 5, badgeY + 8);
      }

      // Anchors at Swing 1 and Swing 2
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x1, y1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(x2, getY(p2.price), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Magnet Snap: Snaps coordinate to nearest candle OHLC if within snap threshold (14px)
 */
export function snapToCandleOHLC(
  x: number,
  y: number,
  startIndex: number,
  visibleCount: number,
  chartWidth: number,
  priceChartHeight: number,
  minPrice: number,
  priceRange: number,
  candles: Candle[],
  thresholdPx: number = 18
): { candleIndex: number; price: number; snapped: boolean } {
  const barSlotWidth = chartWidth / visibleCount;
  const candleIndex = Math.round(startIndex + (x - barSlotWidth / 2) / barSlotWidth);

  // If outside actual candles (in future blank bars), can't snap to OHLC, return raw price
  if (candleIndex < 0 || candleIndex >= candles.length) {
    const rawPrice = minPrice + (1 - y / priceChartHeight) * priceRange;
    return { candleIndex, price: rawPrice, snapped: false };
  }

  const c = candles[candleIndex];
  const getY = (price: number) => priceChartHeight - ((price - minPrice) / priceRange) * priceChartHeight;

  const points = [
    { name: 'close', price: c.close, y: getY(c.close) },
    { name: 'open', price: c.open, y: getY(c.open) },
    { name: 'high', price: c.high, y: getY(c.high) },
    { name: 'low', price: c.low, y: getY(c.low) },
  ];

  let nearest = points[0];
  let minDist = Math.abs(y - nearest.y);

  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(y - points[i].y);
    if (dist < minDist) {
      minDist = dist;
      nearest = points[i];
    }
  }

  if (minDist <= thresholdPx) {
    return { candleIndex, price: nearest.price, snapped: true };
  }

  const rawPrice = minPrice + (1 - y / priceChartHeight) * priceRange;
  return { candleIndex, price: rawPrice, snapped: false };
}
