import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Phaser from "phaser";
import { ActivityJSONSchema, ConceptBriefSchema } from "../../shared/types.js";
import { getLayoutVariant } from "../../mechanics/loader.js";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { DragToTargetMechanic, type ItemConfig, type TargetConfig } from "../../runtime/src/mechanics/drag-to-target.js";

vi.mock("../../runtime/src/audio.js", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
  playCelebration: vi.fn(),
}));
vi.mock("phaser", () => ({
  default: { Input: { Events: { DRAG_START: "dragstart", DRAG: "drag", DRAG_END: "dragend" } } },
}));

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const conceptPath = join(root, "concepts/briefs/concept_kitchen_mixed_tray_scramble_v1.json");
const activityPath = join(root, "library/activities/act_kitchen_mixed_tray_scramble_v1.json");
const itemIds = ["apple-red", "apple-green", "banana", "grapes", "tomato", "broccoli"];
const itemSpriteRefs = itemIds.map((id) => `sprites/${id}-v1.png`);
const targetIds = ["tomato", "broccoli", "apple-red", "banana", "grapes", "apple-green"].map((id) => `${id}-target`);
const targetSpriteRefs = ["tomato", "broccoli", "apple-red", "banana", "grapes", "apple-green"].map((id) => `sprites/${id}-v1.png`);
const expectedTargetByItem: Record<string, string> = {
  "apple-red": "apple-red-target",
  "apple-green": "apple-green-target",
  banana: "banana-target",
  grapes: "grapes-target",
  tomato: "tomato-target",
  broccoli: "broccoli-target",
};

describe("approved Mixed-Tray Scramble activity", () => {
  it("uses six approved pairs with exact item and scrambled target orders in the medium Kitchen layout", () => {
    expect(existsSync(conceptPath)).toBe(true);
    expect(existsSync(activityPath)).toBe(true);

    const concept = ConceptBriefSchema.parse(JSON.parse(readFileSync(conceptPath, "utf8")));
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const items = activity.filledSlots.items as Array<{ id: string; targetId: string; label: string; assetRef: string }>;
    const targets = activity.filledSlots.targets as Array<{ id: string; label: string; assetRef: string }>;

    expect(concept.id).toBe("concept_kitchen_mixed_tray_scramble_v1");
    expect(concept.mechanicId).toBe("drag-to-target");
    expect(concept.difficulty).toBe("medium");
    expect(concept.ageMonths).toEqual({ min: 24, max: 36 });
    expect(concept.itemSprites).toEqual(["apple-red-v1.png", "apple-green-v1.png", "banana-v1.png", "grapes-v1.png", "tomato-v1.png", "broccoli-v1.png"]);
    expect(concept.targetSprites).toEqual(["tomato-v1.png", "broccoli-v1.png", "apple-red-v1.png", "banana-v1.png", "grapes-v1.png", "apple-green-v1.png"]);

    expect(activity.id).toBe("act_kitchen_mixed_tray_scramble_v1");
    expect(activity.conceptId).toBe(concept.id);
    expect(activity.mechanicId).toBe(concept.mechanicId);
    expect(activity.themeId).toBe("kitchen-v1");
    expect(activity.prompt.text).toBe("Match each food to its picture.");
    expect(activity.metadata.difficulty).toBe("medium");
    expect(activity.metadata.ageMonths).toEqual({ min: 24, max: 36 });
    expect(activity.parameters.layoutId).toBe("horizontal-six-pairs");
    expect(activity.parameters.layout).toEqual(getLayoutVariant("drag-to-target", "horizontal-six-pairs"));
    expect(activity.parameters.itemCount).toBe(6);
    expect(activity.parameters.distractorCount).toBe(0);
    expect(items.map((item) => item.id)).toEqual(itemIds);
    expect(items.map((item) => item.assetRef)).toEqual(itemSpriteRefs);
    expect(items.map((item) => item.targetId)).toEqual(itemIds.map((id) => expectedTargetByItem[id]));
    expect(targets.map((target) => target.id)).toEqual(targetIds);
    expect(targets.map((target) => target.assetRef)).toEqual(targetSpriteRefs);
    expect(new Set(items.map((item) => item.targetId)).size).toBe(6);
    for (const item of items) {
      const target = targets.find((entry) => entry.id === expectedTargetByItem[item.id]);
      expect(target?.assetRef).toBe(item.assetRef);
    }
    expect(activity.filledSlots.distractors).toEqual([]);
    expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
    expect(activity.metadata.humanApprovedAt).toMatch(/^2026-09-30T/);
    expect(activity.metadata.humanApprover).toBe("ajay");

    const activeIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
    expect(activeIndex.activities.some((entry: { id: string }) => entry.id === activity.id)).toBe(true);
  });

  it("accepts only the targetId mapping once and completes after all six pairs", () => {
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const rawItems = activity.filledSlots.items as Array<{ id: string; targetId: string; label: string; assetRef: string }>;
    const rawTargets = activity.filledSlots.targets as Array<{ id: string; label: string; assetRef: string }>;
    const items: ItemConfig[] = rawItems.map((item, i) => ({ ...item, color: 0x26352a, x: 100 + i * 100, y: 600 }));
    const targets: TargetConfig[] = rawTargets.map((target, i) => ({ ...target, color: 0x26352a, x: 100 + i * 140, y: 250 }));
    const itemObjects = new Map<string, FakeContainer>();
    const handlers = new Map<string, (...args: any[]) => void>();
    const pendingTimers: Array<() => void> = [];
    const onItemPlaced = vi.fn();
    const onItemError = vi.fn();
    const onComplete = vi.fn();
    FakeContainer.created = [];

    const scene = {
      textures: { exists: () => true },
      add: {
        container: () => new FakeContainer(),
        graphics: () => ({ clear() { return this; }, lineStyle() { return this; }, fillStyle() { return this; }, fillRoundedRect() { return this; }, strokeRoundedRect() { return this; }, strokeCircle() { return this; }, fillCircle() { return this; } }),
        image: () => ({ setDisplaySize() { return this; }, setAlpha() { return this; } }),
        text: () => ({ visible: true, setOrigin() { return this; }, setAlpha() { return this; }, setVisible(visible: boolean) { this.visible = visible; return this; } }),
        circle: () => ({ setStrokeStyle() { return this; } }),
      },
      input: {
        on: (event: string, handler: (...args: any[]) => void) => { handlers.set(event, handler); },
        off: () => undefined,
        setDraggable: () => undefined,
      },
      children: { bringToTop: () => undefined },
      tweens: { add: (config: { targets: FakeContainer; x?: number; y?: number; onComplete?: () => void }) => {
        if (typeof config.x === "number" && typeof config.y === "number") config.targets.setPosition(config.x, config.y);
        config.onComplete?.();
      } },
      time: { delayedCall: (_ms: number, callback: () => void) => pendingTimers.push(callback) },
    } as unknown as ConstructorParameters<typeof DragToTargetMechanic>[0];

    const mechanic = new DragToTargetMechanic(scene, items, targets, { onItemPlaced, onItemError, onComplete }, {
      labelColor: "#26352A",
      feedbackColor: 0x26352a,
    });
    for (const item of items) {
      const object = FakeContainer.created.find((candidate) => candidate.getData("itemId") === item.id);
      expect(object).toBeDefined();
      itemObjects.set(item.id, object!);
    }

    const drop = (item: ItemConfig, target: TargetConfig) => {
      const object = itemObjects.get(item.id)!;
      handlers.get(Phaser.Input.Events.DRAG)?.({}, object, target.x, target.y);
      handlers.get(Phaser.Input.Events.DRAG_END)?.({}, object);
    };
    const targetById = new Map(targets.map((target) => [target.id, target]));
    const tomato = rawItems.find((item) => item.id === "tomato")!;
    const wrongTarget = targetById.get("apple-red-target")!;
    drop(items.find((item) => item.id === tomato.id)!, wrongTarget);
    expect(onItemError.mock.calls.map(([id]) => id)).toEqual(["tomato"]);
    expect(onItemPlaced).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    for (const item of items) {
      const target = targetById.get(expectedTargetByItem[item.id])!;
      drop(item, target);
      expect(onItemPlaced).toHaveBeenCalledTimes(items.indexOf(item) + 1);
      expect(onItemPlaced.mock.calls.at(-1)).toEqual([item.id, target.id]);
      expect(onComplete).not.toHaveBeenCalled();
      if (item.id === "apple-red") {
        drop(item, target);
        expect(onItemPlaced).toHaveBeenCalledTimes(1);
      }
    }
    expect(new Set(onItemPlaced.mock.calls.map(([itemId]) => itemId)).size).toBe(6);
    expect(pendingTimers).toHaveLength(1);
    pendingTimers[0]!();
    expect(onComplete).toHaveBeenCalledTimes(1);
    mechanic.destroy();
  });
});

class FakeContainer {
  static created: FakeContainer[] = [];
  x = 0;
  y = 0;
  private data = new Map<string, unknown>();
  private children: unknown[] = [];

  constructor() { FakeContainer.created.push(this); }
  add(children: unknown | unknown[]) {
    this.children.push(...(Array.isArray(children) ? children : [children]));
    return this;
  }
  getAt(index: number) { return this.children[index]; }
  setData(key: string, value: unknown) { this.data.set(key, value); return this; }
  getData(key: string) { return this.data.get(key); }
  setSize() { return this; }
  setInteractive() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  destroy() { return this; }
}
