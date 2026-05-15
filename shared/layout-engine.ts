import type { ZoneSpec, LayoutVariant } from "./types.js";

export interface Position {
  x: number;
  y: number;
}

export interface PlayArea {
  x: number;       // left edge in canvas coords
  y: number;       // top edge in canvas coords
  width: number;
  height: number;
}

export function getZone(layout: LayoutVariant, zoneName: string): ZoneSpec {
  const zone = layout.zones[zoneName];
  if (!zone) throw new Error(`Layout "${layout.id}" has no zone "${zoneName}"`);
  return zone;
}

export function computeZonePositions(
  zone: ZoneSpec,
  count: number,
  playArea: PlayArea
): Position[] {
  const { arrangement } = zone;

  switch (arrangement.type) {
    case "linear":    return computeLinear(zone, arrangement.axis, arrangement.direction, count, playArea);
    case "grid":      return computeGrid(zone, arrangement.columns, arrangement.rows, count, playArea);
    case "circular":  return computeCircular(zone, arrangement.radiusFraction, arrangement.startAngle, count, playArea);
    case "random":    return computeRandom(zone, arrangement.minSpacing, count, playArea);
  }
}

function computeLinear(
  zone: ZoneSpec,
  axis: "horizontal" | "vertical",
  direction: string,
  count: number,
  { x: areaX, y: areaY, width, height }: PlayArea
): Position[] {
  if (axis === "horizontal") {
    const padX = (zone.xPadFraction ?? 0.10) * width;
    const cy   = areaY + (zone.yFraction ?? 0.50) * height;
    const usableW = width - padX * 2;

    const positions: Position[] =
      count === 1
        ? [{ x: areaX + width / 2, y: cy }]
        : Array.from({ length: count }, (_, i) => ({
            x: areaX + padX + (usableW / (count - 1)) * i,
            y: cy,
          }));

    return direction === "right-to-left" ? positions.reverse() : positions;
  }

  // vertical
  const padY = (zone.yPadFraction ?? 0.10) * height;
  const cx   = areaX + (zone.xFraction ?? 0.50) * width;
  const usableH = height - padY * 2;

  const positions: Position[] =
    count === 1
      ? [{ x: cx, y: areaY + height / 2 }]
      : Array.from({ length: count }, (_, i) => ({
          x: cx,
          y: areaY + padY + (usableH / (count - 1)) * i,
        }));

  return direction === "bottom-to-top" ? positions.reverse() : positions;
}

function computeGrid(
  zone: ZoneSpec,
  columns: number,
  rows: number,
  count: number,
  { x: areaX, y: areaY, width, height }: PlayArea
): Position[] {
  const cx      = areaX + (zone.centerFraction?.x ?? 0.5) * width;
  const cy      = areaY + (zone.centerFraction?.y ?? 0.5) * height;
  const gap     = (zone.gapFraction ?? 0.06) * width;
  const cell    = zone.elementSize.max;

  const totalW  = columns * cell + (columns - 1) * gap;
  const totalH  = rows    * cell + (rows    - 1) * gap;
  const startX  = cx - totalW / 2 + cell / 2;
  const startY  = cy - totalH / 2 + cell / 2;

  const positions: Position[] = [];
  for (let r = 0; r < rows && positions.length < count; r++) {
    for (let c = 0; c < columns && positions.length < count; c++) {
      positions.push({
        x: startX + c * (cell + gap),
        y: startY + r * (cell + gap),
      });
    }
  }
  return positions;
}

function computeCircular(
  zone: ZoneSpec,
  radiusFraction: number,
  startAngleDeg: number,
  count: number,
  { x: areaX, y: areaY, width, height }: PlayArea
): Position[] {
  const cx     = areaX + (zone.centerFraction?.x ?? 0.5) * width;
  const cy     = areaY + (zone.centerFraction?.y ?? 0.5) * height;
  const radius = radiusFraction * width;

  return Array.from({ length: count }, (_, i) => {
    const angle = (startAngleDeg + (360 / count) * i) * (Math.PI / 180);
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

function computeRandom(
  zone: ZoneSpec,
  minSpacing: number,
  count: number,
  { x: areaX, y: areaY, width, height }: PlayArea
): Position[] {
  const xPad = (zone.bounds?.xPadFraction ?? 0.10) * width;
  const yPad = (zone.bounds?.yPadFraction ?? 0.08) * height;

  const positions: Position[] = [];
  let attempts = 0;

  while (positions.length < count && attempts < 2000) {
    attempts++;
    const x = areaX + xPad + Math.random() * (width  - xPad * 2);
    const y = areaY + yPad + Math.random() * (height - yPad * 2);

    const tooClose = positions.some((p) => {
      const dx = p.x - x;
      const dy = p.y - y;
      return Math.sqrt(dx * dx + dy * dy) < minSpacing;
    });

    if (!tooClose) positions.push({ x, y });
  }

  return positions;
}
