import { describe, it, expect } from "vitest";
import {
  isTapCorrect,
  isActivityComplete,
  getCorrectItems,
  TapItemConfig,
} from "./tap-to-select-logic";

const items: TapItemConfig[] = [
  { id: "cat", label: "Cat", assetRef: "cat.png", x: 100, y: 100, isCorrect: true },
  { id: "dog", label: "Dog", assetRef: "dog.png", x: 200, y: 100, isCorrect: true },
  { id: "car", label: "Car", assetRef: "car.png", x: 300, y: 100, isCorrect: false },
];

describe("isTapCorrect", () => {
  it("returns true for a correct item", () => {
    expect(isTapCorrect("cat", items)).toBe(true);
  });

  it("returns false for a distractor item", () => {
    expect(isTapCorrect("car", items)).toBe(false);
  });

  it("returns false for an unknown id", () => {
    expect(isTapCorrect("unknown", items)).toBe(false);
  });
});

describe("isActivityComplete", () => {
  it("returns false when nothing has been tapped", () => {
    expect(isActivityComplete(new Set(), items)).toBe(false);
  });

  it("returns false when only some correct items have been tapped", () => {
    expect(isActivityComplete(new Set(["cat"]), items)).toBe(false);
  });

  it("returns true when all correct items have been tapped", () => {
    expect(isActivityComplete(new Set(["cat", "dog"]), items)).toBe(true);
  });

  it("returns true when all correct items are tapped even if distractor ids are in the set", () => {
    expect(isActivityComplete(new Set(["cat", "dog", "car"]), items)).toBe(true);
  });
});

describe("getCorrectItems", () => {
  it("returns only items with isCorrect true", () => {
    const correct = getCorrectItems(items);
    expect(correct).toHaveLength(2);
    expect(correct.every((i) => i.isCorrect)).toBe(true);
  });

  it("returns empty array when no items are correct", () => {
    const noCorrect: TapItemConfig[] = [
      { id: "car", label: "Car", assetRef: "car.png", x: 100, y: 100, isCorrect: false },
    ];
    expect(getCorrectItems(noCorrect)).toHaveLength(0);
  });
});
