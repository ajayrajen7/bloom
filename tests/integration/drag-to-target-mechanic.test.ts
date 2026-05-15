import { describe, it, expect } from "vitest";
import {
  isNearTarget,
  findMatchingTarget,
  SNAP_DISTANCE,
  ITEM_RADIUS,
  TARGET_RADIUS,
  type ItemConfig,
  type TargetConfig,
} from "../../runtime/src/mechanics/drag-to-target-logic.js";

const items: ItemConfig[] = [
  { id: "apple_1",  targetId: "apple_basket",  label: "Apple",  color: 0xe84040, x: 200, y: 560 },
  { id: "apple_2",  targetId: "apple_basket",  label: "Apple",  color: 0xe84040, x: 380, y: 540 },
  { id: "banana_1", targetId: "banana_basket", label: "Banana", color: 0xf5c842, x: 640, y: 555 },
];

const targets: TargetConfig[] = [
  { id: "apple_basket",  label: "Apple Basket",  color: 0xe84040, x: 280, y: 270 },
  { id: "banana_basket", label: "Banana Basket", color: 0xf5c842, x: 744, y: 270 },
];

describe("isNearTarget", () => {
  it("returns true when item is within snap distance", () => {
    expect(isNearTarget(280, 270, 280, 270)).toBe(true);       // exactly on target
    expect(isNearTarget(280 + SNAP_DISTANCE - 1, 270, 280, 270)).toBe(true); // just inside
  });

  it("returns false when item is outside snap distance", () => {
    expect(isNearTarget(280 + SNAP_DISTANCE + 1, 270, 280, 270)).toBe(false);
    expect(isNearTarget(0, 0, 744, 270)).toBe(false);
  });

  it("snap distance is large enough for a 2-year-old hand (≥60pt)", () => {
    expect(SNAP_DISTANCE).toBeGreaterThanOrEqual(60);
  });
});

describe("findMatchingTarget", () => {
  it("returns the correct target for an item", () => {
    const result = findMatchingTarget("apple_1", items, targets);
    expect(result?.id).toBe("apple_basket");
  });

  it("does not return the wrong target", () => {
    const result = findMatchingTarget("banana_1", items, targets);
    expect(result?.id).toBe("banana_basket");
    expect(result?.id).not.toBe("apple_basket");
  });

  it("returns undefined for an unknown item id", () => {
    const result = findMatchingTarget("ghost_item", items, targets);
    expect(result).toBeUndefined();
  });
});

describe("design constants", () => {
  it("item radius meets minimum touch target size (≥48pt)", () => {
    expect(ITEM_RADIUS).toBeGreaterThanOrEqual(48);
  });

  it("target radius is larger than item radius for easy landing", () => {
    expect(TARGET_RADIUS).toBeGreaterThan(ITEM_RADIUS);
  });
});
