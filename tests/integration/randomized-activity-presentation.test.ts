/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ActivityJSONSchema, LayoutVariantSchema, type ActivityJSON } from "../../shared/types.js";
import { computeZonePositions, getZone, type Position } from "../../shared/layout-engine.js";
import { ActivityScene } from "../../runtime/src/scenes/activity.js";

vi.mock("phaser", () => ({ default: { Scene: class Scene {} } }));

const captured = vi.hoisted(() => ({ tapConfigs: [] as unknown[], dragConfigs: [] as unknown[] }));

vi.mock("../../runtime/src/mechanics/tap-to-select.js", () => ({
  TapToSelectMechanic: class {
    constructor(_scene: unknown, items: unknown[]) {
      captured.tapConfigs.push(items);
    }
    destroy() {}
  },
}));

vi.mock("../../runtime/src/mechanics/drag-to-target.js", () => ({
  DragToTargetMechanic: class {
    constructor(_scene: unknown, items: unknown[], targets: unknown[]) {
      captured.dragConfigs.push({ items, targets });
    }
    destroy() {}
  },
}));

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

type PresentedTapItem = {
  id: string;
  isCorrect: boolean;
  x: number;
  y: number;
  label: string;
  assetRef: string;
};

function createRuntimeHarness(activity: unknown): ActivityScene {
  const scene = Object.create(ActivityScene.prototype) as ActivityScene;
  Object.assign(scene, {
    cache: { json: { get: () => activity } },
    textures: { exists: () => true },
    scale: { width: 1024, height: 768 },
    add: {
      rectangle: () => undefined,
      text: () => ({ setOrigin: () => undefined }),
      graphics: () => ({ lineStyle: () => undefined, lineBetween: () => undefined }),
      circle: () => ({ setFillStyle: () => undefined }),
    },
    children: { getFirst: () => null },
  });
  return scene;
}

describe("randomized activity presentation", () => {
  it("presents every indexed tap activity with all choices and unchanged correctness", () => {
    const index = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8")) as {
      activities: Array<{ id: string }>;
    };
    const tapActivityIds: string[] = [];

    for (const entry of index.activities) {
      const activityPath = join(root, "library/activities", `${entry.id}.json`);
      const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
      if (activity.mechanicId !== "tap-to-select") continue;
      tapActivityIds.push(activity.id);

      const correctItems = activity.filledSlots.correctItems as Array<{ id: string; label: string; assetRef: string }>;
      const distractors = activity.filledSlots.distractors as Array<{ id: string; label: string; assetRef: string }>;
      const expectedById = new Map<string, { id: string; label: string; assetRef: string; isCorrect: boolean }>([
        ...correctItems.map((item) => [item.id, { ...item, isCorrect: true }] as const),
        ...distractors.map((item) => [item.id, { ...item, isCorrect: false }] as const),
      ]);
      const layout = LayoutVariantSchema.parse(activity.parameters.layout);
      const positions: Position[] = computeZonePositions(
        getZone(layout, "item_zone"),
        expectedById.size,
        { x: 0, y: 768 * 0.15, width: 1024, height: 768 * 0.70 },
      );

      captured.tapConfigs.length = 0;
      const scene = createRuntimeHarness(activity);
      scene.init({ activityId: activity.id });
      scene.create();

      expect(captured.tapConfigs, activity.id).toHaveLength(1);
      const presented = captured.tapConfigs[0] as PresentedTapItem[];
      expect(presented.map(({ id }) => id).sort(), activity.id)
        .toEqual([...expectedById.keys()].sort());
      expect(presented.map(({ id, isCorrect }) => [id, isCorrect]).sort(), activity.id)
        .toEqual([...expectedById].map(([id, item]) => [id, item.isCorrect]).sort());
      expect(new Set(presented.map(({ x, y }) => `${x},${y}`)).size, activity.id)
        .toBe(expectedById.size);
      expect(presented.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
        .toEqual(positions.map(({ x, y }) => `${x},${y}`).sort());

      if (correctItems.length > 0 && distractors.length > 0) {
        expect(presented.slice(0, correctItems.length).some(({ isCorrect }) => !isCorrect), activity.id)
          .toBe(true);
      }
      for (const item of presented) {
        expect(item.isCorrect, `${activity.id}: correctness for ${item.id}`)
          .toBe(expectedById.get(item.id)?.isCorrect);
      }
    }

    expect(tapActivityIds.length).toBeGreaterThan(0);
  });

  it("presents every indexed one-to-one match in separate horizontal slots", () => {
    const index = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8")) as {
      activities: Array<{ id: string }>;
    };
    const matchingActivityIds: string[] = [];

    for (const entry of index.activities) {
      const activity = ActivityJSONSchema.parse(JSON.parse(
        readFileSync(join(root, "library/activities", `${entry.id}.json`), "utf8"),
      ));
      if (activity.mechanicId !== "drag-to-target") continue;

      const rawTargets = (activity.filledSlots.targets ?? []) as Array<{ id: string }>;
      const rawItems = (activity.filledSlots.items ?? []) as Array<{ id: string; targetId: string }>;
      const referencesPerTarget = rawTargets.map((target) => rawItems.filter((item) => item.targetId === target.id).length);
      const isOneToOne = rawTargets.length === rawItems.length
        && new Set(rawItems.map(({ targetId }) => targetId)).size === rawItems.length
        && referencesPerTarget.every((count) => count === 1);
      if (!isOneToOne) continue;
      matchingActivityIds.push(activity.id);

      const layout = LayoutVariantSchema.parse(activity.parameters.layout);
      const playArea = { x: 0, y: 768 * 0.15, width: 1024, height: 768 * 0.70 };
      const expectedTargetPositions = computeZonePositions(getZone(layout, "target_zone"), rawTargets.length, playArea);
      const expectedItemPositions = computeZonePositions(getZone(layout, "item_zone"), rawItems.length, playArea);
      captured.dragConfigs.length = 0;
      const scene = createRuntimeHarness(activity);
      scene.init({ activityId: activity.id });
      scene.create();

      expect(captured.dragConfigs, activity.id).toHaveLength(1);
      const { items, targets } = captured.dragConfigs[0] as {
        items: Array<{ id: string; targetId: string; x: number; y: number }>;
        targets: Array<{ id: string; x: number; y: number }>;
      };
      expect(targets.map(({ id }) => id).sort(), activity.id)
        .toEqual(rawTargets.map(({ id }) => id).sort());
      expect(items.map(({ id, targetId }) => [id, targetId]).sort(), activity.id)
        .toEqual(rawItems.map(({ id, targetId }) => [id, targetId]).sort());
      expect(new Set(targets.map(({ x, y }) => `${x},${y}`)).size, activity.id).toBe(rawTargets.length);
      expect(new Set(items.map(({ x, y }) => `${x},${y}`)).size, activity.id).toBe(rawItems.length);
      expect(targets.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
        .toEqual(expectedTargetPositions.map(({ x, y }) => `${x},${y}`).sort());
      expect(items.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
        .toEqual(expectedItemPositions.map(({ x, y }) => `${x},${y}`).sort());

      const targetRanks = horizontalRanks(targets);
      const itemRanks = horizontalRanks(items);
      const targetSlotById = new Map(targets.map((target, slot) => [target.id, targetRanks[slot]!]));
      items.forEach((item, slot) => {
        expect(itemRanks[slot], `${activity.id}: ${item.id} start slot`)
          .not.toBe(targetSlotById.get(item.targetId));
      });
    }

    expect(matchingActivityIds.length).toBeGreaterThan(0);
  });

  it("preserves many-to-one category mappings and unique starts", () => {
    const index = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8")) as {
      activities: Array<{ id: string }>;
    };
    const categoryActivities: string[] = [];

    for (const entry of index.activities) {
      const activity = ActivityJSONSchema.parse(JSON.parse(
        readFileSync(join(root, "library/activities", `${entry.id}.json`), "utf8"),
      ));
      if (activity.mechanicId !== "drag-to-target") continue;

      const rawTargets = (activity.filledSlots.targets ?? []) as Array<{ id: string }>;
      const rawItems = (activity.filledSlots.items ?? []) as Array<{ id: string; targetId: string }>;
      if (rawItems.length === rawTargets.length) continue;
      categoryActivities.push(activity.id);

      captured.dragConfigs.length = 0;
      const scene = createRuntimeHarness(activity);
      scene.init({ activityId: activity.id });
      scene.create();
      expect(captured.dragConfigs, activity.id).toHaveLength(1);
      const { items } = captured.dragConfigs[0] as {
        items: Array<{ id: string; targetId: string; x: number; y: number }>;
      };
      expect(items.map(({ id, targetId }) => [id, targetId]).sort(), activity.id)
        .toEqual(rawItems.map(({ id, targetId }) => [id, targetId]).sort());
      expect(new Set(items.map(({ x, y }) => `${x},${y}`)).size, activity.id).toBe(rawItems.length);
    }

    expect(categoryActivities.length).toBeGreaterThan(0);
  });

  it("reproduces valid boards across a seed sweep for every indexed activity", () => {
    const index = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8")) as {
      activities: Array<{ id: string }>;
    };
    const seeds = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ] as const;

    for (const entry of index.activities) {
      const activity = ActivityJSONSchema.parse(JSON.parse(
        readFileSync(join(root, "library/activities", `${entry.id}.json`), "utf8"),
      ));
      const layout = LayoutVariantSchema.parse(activity.parameters.layout);
      const playArea = { x: 0, y: 768 * 0.15, width: 1024, height: 768 * 0.70 };
      const expectedItems = activity.mechanicId === "tap-to-select"
        ? [
            ...(activity.filledSlots.correctItems as Array<{ id: string }>),
            ...(activity.filledSlots.distractors as Array<{ id: string }>),
          ]
        : activity.filledSlots.items as Array<{ id: string; targetId: string }>;
      const expectedItemPositions = computeZonePositions(
        getZone(layout, "item_zone"), expectedItems.length, playArea,
      );
      expect(new Set(expectedItemPositions.map(({ x, y }) => `${x},${y}`)).size, activity.id)
        .toBe(expectedItems.length);
      for (const position of expectedItemPositions) {
        expect(position.x, `${activity.id}: item horizontal bounds`).toBeGreaterThanOrEqual(0);
        expect(position.x, `${activity.id}: item horizontal bounds`).toBeLessThanOrEqual(1024);
        expect(position.y, `${activity.id}: item vertical bounds`).toBeGreaterThanOrEqual(playArea.y);
        expect(position.y, `${activity.id}: item vertical bounds`).toBeLessThanOrEqual(playArea.y + playArea.height);
      }

      const boards = seeds.map((seed) => presentWithSeed(activity, seed));
      expect(presentWithSeed(activity, seeds[0]), `${activity.id}: same-seed replay`)
        .toEqual(boards[0]);
      expect(new Set(boards.map((board) => JSON.stringify(board))).size, activity.id)
        .toBeGreaterThan(1);

      for (const board of boards) {
        if (activity.mechanicId === "tap-to-select") {
          const correctItems = activity.filledSlots.correctItems as Array<{ id: string }>;
          const distractors = activity.filledSlots.distractors as Array<{ id: string }>;
          const presented = board.tap!;
          const expectedCorrect = new Map([
            ...correctItems.map(({ id }) => [id, true] as const),
            ...distractors.map(({ id }) => [id, false] as const),
          ]);
          expect(presented.map(({ id }) => id).sort(), activity.id)
            .toEqual([...expectedCorrect.keys()].sort());
          expect(presented.map(({ id, isCorrect }) => [id, isCorrect]).sort(), activity.id)
            .toEqual([...expectedCorrect].map(([id, isCorrect]) => [id, isCorrect]).sort());
          expect(new Set(presented.map(({ x, y }) => `${x},${y}`)).size, activity.id)
            .toBe(expectedItems.length);
          expect(presented.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
            .toEqual(expectedItemPositions.map(({ x, y }) => `${x},${y}`).sort());
          if (correctItems.length > 0 && distractors.length > 0) {
            expect(presented.slice(0, correctItems.length).some(({ isCorrect }) => !isCorrect), activity.id)
              .toBe(true);
          }
        } else {
          const rawTargets = (activity.filledSlots.targets ?? []) as Array<{ id: string }>;
          const rawItems = activity.filledSlots.items as Array<{ id: string; targetId: string }>;
          const targetZonePositions = computeZonePositions(
            getZone(layout, "target_zone"), rawTargets.length, playArea,
          );
          const expectedTargetPositions = targetZonePositions.map(({ x, y }) => `${x},${y}`).sort();
          for (const position of targetZonePositions) {
            expect(position.x, `${activity.id}: target horizontal bounds`).toBeGreaterThanOrEqual(0);
            expect(position.x, `${activity.id}: target horizontal bounds`).toBeLessThanOrEqual(1024);
            expect(position.y, `${activity.id}: target vertical bounds`).toBeGreaterThanOrEqual(playArea.y);
            expect(position.y, `${activity.id}: target vertical bounds`).toBeLessThanOrEqual(playArea.y + playArea.height);
          }
          const { items, targets } = board.drag!;
          expect(targets.map(({ id }) => id).sort(), activity.id)
            .toEqual(rawTargets.map(({ id }) => id).sort());
          expect(items.map(({ id, targetId }) => [id, targetId]).sort(), activity.id)
            .toEqual(rawItems.map(({ id, targetId }) => [id, targetId]).sort());
          expect(new Set(items.map(({ x, y }) => `${x},${y}`)).size, activity.id)
            .toBe(rawItems.length);
          expect(items.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
            .toEqual(expectedItemPositions.map(({ x, y }) => `${x},${y}`).sort());
          expect(new Set(targets.map(({ x, y }) => `${x},${y}`)).size, activity.id)
            .toBe(rawTargets.length);
          expect(targets.map(({ x, y }) => `${x},${y}`).sort(), activity.id)
            .toEqual(expectedTargetPositions);

          const oneToOne = rawTargets.length === rawItems.length
            && new Set(rawItems.map(({ targetId }) => targetId)).size === rawItems.length
            && rawTargets.every((target) => rawItems.filter((item) => item.targetId === target.id).length === 1);
          if (oneToOne) {
            const targetRanks = horizontalRanks(targets);
            const itemRanks = horizontalRanks(items);
            const targetSlotById = new Map(targets.map((target, slot) => [target.id, targetRanks[slot]!]));
            items.forEach((item, slot) => {
              expect(itemRanks[slot], `${activity.id}: ${item.id} start slot`).not.toBe(targetSlotById.get(item.targetId));
            });
          }
        }
      }
    }
  });
});

function presentWithSeed(activity: ActivityJSON, seed: ReturnType<Crypto["randomUUID"]>): {
  tap?: PresentedTapItem[];
  drag?: {
    items: Array<{ id: string; targetId: string; x: number; y: number }>;
    targets: Array<{ id: string; x: number; y: number }>;
  };
} {
  const uuid = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(seed);
  captured.tapConfigs.length = 0;
  captured.dragConfigs.length = 0;
  try {
    const scene = createRuntimeHarness(activity);
    scene.init({ activityId: activity.id });
    scene.create();
    if (activity.mechanicId === "tap-to-select") {
      return structuredClone({ tap: captured.tapConfigs.at(-1) as PresentedTapItem[] });
    }
    return structuredClone({
      drag: captured.dragConfigs.at(-1) as {
        items: Array<{ id: string; targetId: string; x: number; y: number }>;
        targets: Array<{ id: string; x: number; y: number }>;
      },
    });
  } finally {
    uuid.mockRestore();
  }
}

function horizontalRanks(points: Array<{ x: number }>): number[] {
  const columns = [...new Set(points.map(({ x }) => x))].sort((a, b) => a - b);
  const rankByX = new Map(columns.map((x, rank) => [x, rank]));
  return points.map(({ x }) => rankByX.get(x)!);
}
