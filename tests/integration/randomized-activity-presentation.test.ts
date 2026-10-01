import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ActivityJSONSchema, LayoutVariantSchema } from "../../shared/types.js";
import { computeZonePositions, getZone, type Position } from "../../shared/layout-engine.js";
import { ActivityScene } from "../../runtime/src/scenes/activity.js";

vi.mock("phaser", () => ({ default: { Scene: class Scene {} } }));

const captured = vi.hoisted(() => ({ tapConfigs: [] as unknown[] }));

vi.mock("../../runtime/src/mechanics/tap-to-select.js", () => ({
  TapToSelectMechanic: class {
    constructor(_scene: unknown, items: unknown[]) {
      captured.tapConfigs.push(items);
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
      const expectedById = new Map([
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
});
