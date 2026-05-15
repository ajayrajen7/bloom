import { describe, it, expect } from "vitest";
import { computeZonePositions, type PlayArea } from "./layout-engine.js";
import type { ZoneSpec } from "./types.js";

const PLAY_AREA: PlayArea = { x: 0, y: 115, width: 1024, height: 538 };

function linearZone(
  axis: "horizontal" | "vertical",
  direction: string,
  overrides: Partial<ZoneSpec> = {}
): ZoneSpec {
  return {
    arrangement: { type: "linear", axis, direction } as ZoneSpec["arrangement"],
    elementCount: { min: 2, max: 5 },
    elementSize: { min: 80, max: 115 },
    yFraction: 0.80,
    xFraction: 0.50,
    xPadFraction: 0.10,
    yPadFraction: 0.10,
    ...overrides,
  };
}

// ── Linear horizontal ─────────────────────────────────────────────────────────

describe("linear / horizontal", () => {
  it("returns correct count", () => {
    const positions = computeZonePositions(linearZone("horizontal", "left-to-right"), 4, PLAY_AREA);
    expect(positions).toHaveLength(4);
  });

  it("all positions share the same Y", () => {
    const positions = computeZonePositions(linearZone("horizontal", "left-to-right"), 4, PLAY_AREA);
    const ys = positions.map((p) => p.y);
    expect(new Set(ys).size).toBe(1);
  });

  it("X positions are strictly ascending for left-to-right", () => {
    const positions = computeZonePositions(linearZone("horizontal", "left-to-right"), 4, PLAY_AREA);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].x).toBeGreaterThan(positions[i - 1].x);
    }
  });

  it("X positions are strictly descending for right-to-left", () => {
    const positions = computeZonePositions(linearZone("horizontal", "right-to-left"), 4, PLAY_AREA);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].x).toBeLessThan(positions[i - 1].x);
    }
  });

  it("single item is centred horizontally", () => {
    const positions = computeZonePositions(linearZone("horizontal", "left-to-right"), 1, PLAY_AREA);
    expect(positions[0].x).toBeCloseTo(PLAY_AREA.width / 2);
  });

  it("positions respect xPad boundaries", () => {
    const padX = 0.10 * PLAY_AREA.width;
    const positions = computeZonePositions(linearZone("horizontal", "left-to-right"), 4, PLAY_AREA);
    positions.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(padX - 1);
      expect(p.x).toBeLessThanOrEqual(PLAY_AREA.width - padX + 1);
    });
  });
});

// ── Linear vertical ───────────────────────────────────────────────────────────

describe("linear / vertical", () => {
  it("returns correct count", () => {
    const positions = computeZonePositions(linearZone("vertical", "top-to-bottom"), 3, PLAY_AREA);
    expect(positions).toHaveLength(3);
  });

  it("all positions share the same X", () => {
    const positions = computeZonePositions(linearZone("vertical", "top-to-bottom"), 3, PLAY_AREA);
    const xs = positions.map((p) => p.x);
    expect(new Set(xs).size).toBe(1);
  });

  it("Y positions are ascending for top-to-bottom", () => {
    const positions = computeZonePositions(linearZone("vertical", "top-to-bottom"), 3, PLAY_AREA);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].y).toBeGreaterThan(positions[i - 1].y);
    }
  });

  it("Y positions are descending for bottom-to-top", () => {
    const positions = computeZonePositions(linearZone("vertical", "bottom-to-top"), 3, PLAY_AREA);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].y).toBeLessThan(positions[i - 1].y);
    }
  });
});

// ── Grid ──────────────────────────────────────────────────────────────────────

describe("grid", () => {
  const gridZone: ZoneSpec = {
    arrangement: { type: "grid", columns: 2, rows: 2 },
    elementCount: { min: 4, max: 4 },
    elementSize: { min: 140, max: 180 },
    centerFraction: { x: 0.5, y: 0.5 },
    gapFraction: 0.08,
  };

  it("returns correct count", () => {
    const positions = computeZonePositions(gridZone, 4, PLAY_AREA);
    expect(positions).toHaveLength(4);
  });

  it("does not exceed count even if grid has more cells", () => {
    const positions = computeZonePositions(gridZone, 3, PLAY_AREA);
    expect(positions).toHaveLength(3);
  });

  it("produces two distinct X values for 2-column grid", () => {
    const positions = computeZonePositions(gridZone, 4, PLAY_AREA);
    const xs = new Set(positions.map((p) => Math.round(p.x)));
    expect(xs.size).toBe(2);
  });

  it("produces two distinct Y values for 2-row grid", () => {
    const positions = computeZonePositions(gridZone, 4, PLAY_AREA);
    const ys = new Set(positions.map((p) => Math.round(p.y)));
    expect(ys.size).toBe(2);
  });
});

// ── Circular ──────────────────────────────────────────────────────────────────

describe("circular", () => {
  const circZone: ZoneSpec = {
    arrangement: { type: "circular", radiusFraction: 0.30, startAngle: 0 },
    elementCount: { min: 3, max: 6 },
    elementSize: { min: 110, max: 150 },
    centerFraction: { x: 0.5, y: 0.5 },
  };

  it("returns correct count", () => {
    const positions = computeZonePositions(circZone, 5, PLAY_AREA);
    expect(positions).toHaveLength(5);
  });

  it("all positions are equidistant from the centre", () => {
    const cx = PLAY_AREA.x + 0.5 * PLAY_AREA.width;
    const cy = PLAY_AREA.y + 0.5 * PLAY_AREA.height;
    const positions = computeZonePositions(circZone, 5, PLAY_AREA);
    const distances = positions.map((p) =>
      Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
    );
    distances.forEach((d) => expect(d).toBeCloseTo(distances[0], 1));
  });
});

// ── Random ────────────────────────────────────────────────────────────────────

describe("random", () => {
  const randZone: ZoneSpec = {
    arrangement: { type: "random", minSpacing: 140 },
    elementCount: { min: 3, max: 5 },
    elementSize: { min: 110, max: 140 },
    bounds: { xPadFraction: 0.10, yPadFraction: 0.08 },
  };

  it("returns correct count", () => {
    const positions = computeZonePositions(randZone, 4, PLAY_AREA);
    expect(positions).toHaveLength(4);
  });

  it("all pairs respect minSpacing", () => {
    const positions = computeZonePositions(randZone, 4, PLAY_AREA);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(140);
      }
    }
  });
});
