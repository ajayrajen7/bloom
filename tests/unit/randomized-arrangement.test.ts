import { describe, expect, it } from "vitest";
import type { Position } from "../../shared/layout-engine.js";
import { arrangeDragRows, arrangeTapChoices } from "../../runtime/src/presentation/randomized-arrangement.js";

const gridPositions: Position[] = [
  { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 },
  { x: 100, y: 300 }, { x: 300, y: 300 }, { x: 500, y: 300 },
];
const rowPositions: Position[] = [
  { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }, { x: 700, y: 100 },
];
const tapChoices = [
  { id: "apple", isCorrect: true, label: "Apple" },
  { id: "banana", isCorrect: true, label: "Banana" },
  { id: "orange", isCorrect: true, label: "Orange" },
  { id: "carrot", isCorrect: false, label: "Carrot" },
  { id: "grapes", isCorrect: false, label: "Grapes" },
  { id: "cucumber", isCorrect: false, label: "Cucumber" },
] as const;

function tapSignature(seed: string) {
  return arrangeTapChoices(tapChoices, gridPositions, seed).map((choice) => choice.id).join(",");
}

describe("seeded activity presentation", () => {
  it("reproduces an arrangement from the same seed", () => {
    expect(tapSignature("attempt-42")).toBe(tapSignature("attempt-42"));

    const targets = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const items = targets.map((target) => ({ id: `item-${target.id}`, targetId: target.id }));
    expect(arrangeDragRows(targets, rowPositions, items, rowPositions, "attempt-42"))
      .toEqual(arrangeDragRows(targets, rowPositions, items, rowPositions, "attempt-42"));
  });

  it("varies arrangements across distinct seeds", () => {
    const tapBoards = new Set(["seed-a", "seed-b", "seed-c", "seed-d"].map(tapSignature));
    expect(tapBoards.size).toBeGreaterThan(1);

    const targets = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const items = targets.map((target) => ({ id: `item-${target.id}`, targetId: target.id }));
    const dragBoards = new Set(["seed-a", "seed-b", "seed-c", "seed-d"].map((seed) => {
      const result = arrangeDragRows(targets, rowPositions, items, rowPositions, seed);
      return `${result.targets.map(({ id }) => id).join(",")}|${result.items.map(({ id }) => id).join(",")}`;
    }));
    expect(dragBoards.size).toBeGreaterThan(1);
  });

  it("keeps every choice exactly once with its correctness", () => {
    const result = arrangeTapChoices(tapChoices, gridPositions, "answer-map");
    expect(result.map(({ id }) => id).sort()).toEqual(tapChoices.map(({ id }) => id).sort());
    expect(result.map(({ id, isCorrect }) => [id, isCorrect]).sort())
      .toEqual(tapChoices.map(({ id, isCorrect }) => [id, isCorrect]).sort());
    expect(result.map(({ position }) => position)).toEqual(gridPositions);
    expect(result.find(({ id }) => id === "apple")?.label).toBe("Apple");
  });

  it("does not put all correct choices in the leading slots", () => {
    const result = arrangeTapChoices(tapChoices, gridPositions, "leading-prefix");
    expect(result.slice(0, 3).some(({ isCorrect }) => !isCorrect)).toBe(true);
  });

  it("distributes correct choices across available rows and columns", () => {
    const result = arrangeTapChoices(tapChoices, gridPositions, "spatial-spread");
    const correct = result.filter(({ isCorrect }) => isCorrect);
    expect(new Set(correct.map(({ position }) => position.y)).size).toBe(2);
    expect(new Set(correct.map(({ position }) => position.x)).size).toBe(3);
  });

  it("places every one-to-one match in a different horizontal slot", () => {
    const targets = [{ id: "target-a" }, { id: "target-b" }, { id: "target-c" }, { id: "target-d" }];
    const items = targets.map((target, index) => ({ id: `item-${index}`, targetId: target.id }));
    const result = arrangeDragRows(targets, rowPositions, items, rowPositions, "derange-pairs");
    const targetById = new Map(result.targets.map((target) => [target.id, target.position.x]));

    for (const item of result.items) {
      expect(item.position.x).not.toBe(targetById.get(item.targetId));
    }
    expect(result.targets.map(({ id }) => id).sort()).toEqual(targets.map(({ id }) => id).sort());
    expect(result.items.map(({ id }) => id).sort()).toEqual(items.map(({ id }) => id).sort());
  });

  it("preserves many-to-one category mappings", () => {
    const targets = [{ id: "fruit" }, { id: "vegetables" }];
    const targetPositions = [{ x: 250, y: 150 }, { x: 750, y: 150 }];
    const items = [
      { id: "green-apple", targetId: "fruit" },
      { id: "banana", targetId: "fruit" },
      { id: "grapes", targetId: "fruit" },
      { id: "cucumber", targetId: "vegetables" },
      { id: "tomato", targetId: "vegetables" },
      { id: "broccoli", targetId: "vegetables" },
    ];
    const itemPositions = gridPositions;
    const result = arrangeDragRows(targets, targetPositions, items, itemPositions, "category-sort");

    expect(result.targets.map(({ id }) => id).sort()).toEqual(["fruit", "vegetables"]);
    expect(result.items.map(({ id }) => id).sort()).toEqual(items.map(({ id }) => id).sort());
    expect(result.items.map(({ id, targetId }) => [id, targetId]).sort())
      .toEqual(items.map(({ id, targetId }) => [id, targetId]).sort());
    expect(new Set(result.items.map(({ position }) => `${position.x},${position.y}`)).size).toBe(6);
  });

  it("rejects mismatched position counts with a descriptive error", () => {
    expect(() => arrangeTapChoices(tapChoices, gridPositions.slice(0, 5), "bad-count"))
      .toThrow(/6 items.*5 positions/i);

    expect(() => arrangeDragRows([{ id: "target" }], [], [{ id: "item", targetId: "target" }], [{ x: 1, y: 1 }], "bad-count"))
      .toThrow(/1 target.*0 positions/i);
  });

  it("allows a matching pair to stay aligned when only one horizontal slot exists", () => {
    const target = [{ id: "target" }];
    const item = [{ id: "item", targetId: "target" }];
    const position = [{ x: 100, y: 100 }];
    const result = arrangeDragRows(target, position, item, position, "single-slot");
    expect(result.items[0]?.targetId).toBe("target");
    expect(result.items[0]?.position).toEqual(position[0]);
  });
});
