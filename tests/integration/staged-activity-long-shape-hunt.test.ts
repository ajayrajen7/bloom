import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConceptBriefSchema, ActivityJSONSchema } from "../../shared/types.js";
import { getLayoutVariant } from "../../mechanics/loader.js";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { TapToSelectMechanic, type TapItemConfig } from "../../runtime/src/mechanics/tap-to-select.js";

vi.mock("../../runtime/src/audio.js", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
  playCelebration: vi.fn(),
}));

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const conceptPath = join(root, "concepts/briefs/concept_kitchen_long_shape_hunt_v1.json");
const activityPath = join(root, "library/activities/act_kitchen_long_shape_hunt_v1.json");

describe("approved Long-Shape Hunt activity", () => {
  it("keeps the exact six approved choices in the high-difficulty Kitchen layout", () => {
    expect(existsSync(conceptPath)).toBe(true);
    expect(existsSync(activityPath)).toBe(true);

    const concept = ConceptBriefSchema.parse(JSON.parse(readFileSync(conceptPath, "utf8")));
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const correct = activity.filledSlots.correctItems as Array<{ id: string; assetRef: string }>;
    const distractors = activity.filledSlots.distractors as Array<{ id: string; assetRef: string }>;
    const correctRefs = ["sprites/banana-v1.png", "sprites/carrot-v1.png", "sprites/cucumber-v1.png"];
    const distractorRefs = ["sprites/apple-red-v1.png", "sprites/orange-v1.png", "sprites/broccoli-v1.png"];

    expect(concept.id).toBe("concept_kitchen_long_shape_hunt_v1");
    expect(concept.mechanicId).toBe("tap-to-select");
    expect(concept.difficulty).toBe("high");
    expect(concept.ageMonths).toEqual({ min: 24, max: 36 });
    expect(concept.itemSprites).toEqual([...correctRefs, ...distractorRefs].map((ref) => ref.slice("sprites/".length)));
    expect(new Set(concept.itemSprites).size).toBe(6);
    expect(concept.targetSprites).toEqual([]);

    expect(activity.id).toBe("act_kitchen_long_shape_hunt_v1");
    expect(activity.conceptId).toBe(concept.id);
    expect(activity.mechanicId).toBe(concept.mechanicId);
    expect(activity.themeId).toBe("kitchen-v1");
    expect(activity.prompt.text).toBe("Find the banana, carrot, and cucumber.");
    expect(activity.metadata.difficulty).toBe("high");
    expect(activity.metadata.ageMonths).toEqual({ min: 24, max: 36 });
    expect(activity.parameters.layoutId).toBe("grid-2x3");
    expect(activity.parameters.layout).toEqual(getLayoutVariant("tap-to-select", "grid-2x3"));
    expect(activity.parameters.correctCount).toBe(3);
    expect(activity.parameters.distractorCount).toBe(3);
    expect(correct.map((item) => item.id)).toEqual(["banana", "carrot", "cucumber"]);
    expect(correct.map((item) => item.assetRef)).toEqual(correctRefs);
    expect(distractors.map((item) => item.id)).toEqual(["apple-red", "orange", "broccoli"]);
    expect(distractors.map((item) => item.assetRef)).toEqual(distractorRefs);
    expect(new Set([...correct, ...distractors].map((item) => item.assetRef)).size).toBe(6);
    expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
    expect(activity.metadata.humanApprovedAt).toMatch(/^2026-09-30T/);
    expect(activity.metadata.humanApprover).toBe("ajay");

    const activeIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
    expect(activeIndex.activities.some((entry: { id: string }) => entry.id === activity.id)).toBe(true);
  });

  it("advances only for unique correct pointer taps and completes on the third", () => {
    expect(existsSync(activityPath)).toBe(true);
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const correct = activity.filledSlots.correctItems as Array<{ id: string; label: string; assetRef: string }>;
    const distractors = activity.filledSlots.distractors as Array<{ id: string; label: string; assetRef: string }>;
    const items: TapItemConfig[] = [
      ...correct.map((item) => ({ ...item, x: 0, y: 0, isCorrect: true })),
      ...distractors.map((item) => ({ ...item, x: 0, y: 0, isCorrect: false })),
    ];
    const pointerHandlers = new Map<string, () => void>();
    const pendingTimers: Array<() => void> = [];
    const scene = {
      textures: { exists: () => true },
      add: {
        container: () => {
          const data = new Map<string, unknown>();
          return {
            x: 0,
            y: 0,
            add: () => undefined,
            setData(key: string, value: unknown) { data.set(key, value); return this; },
            getData(key: string) { return data.get(key); },
            setSize() { return this; },
            setInteractive() { return this; },
            disableInteractive() { return this; },
            on(event: string, handler: () => void) {
              if (event === "pointerdown") pointerHandlers.set(data.get("itemId") as string, handler);
              return this;
            },
          };
        },
        image: () => ({ setDisplaySize() { return this; }, setTint() { return this; } }),
        text: () => ({ setOrigin() { return this; } }),
      },
      tweens: { add: () => undefined },
      time: { delayedCall: (_ms: number, callback: () => void) => pendingTimers.push(callback) },
    } as unknown as ConstructorParameters<typeof TapToSelectMechanic>[0];
    const onCorrectTap = vi.fn();
    const onIncorrectTap = vi.fn();
    const onComplete = vi.fn();
    const mechanic = new TapToSelectMechanic(scene, items, { onCorrectTap, onIncorrectTap, onComplete }, {
      labelColor: "#26352A",
      feedbackColor: 0x26352a,
    });
    const tap = (id: string) => {
      const handler = pointerHandlers.get(id);
      expect(handler).toBeDefined();
      handler!();
    };

    for (const distractor of distractors) {
      tap(distractor.id);
      expect(mechanic.getTappedCount()).toBe(0);
      expect(onCorrectTap).toHaveBeenCalledTimes(0);
      expect(onComplete).toHaveBeenCalledTimes(0);
    }
    expect(onIncorrectTap.mock.calls.map(([id]) => id)).toEqual(distractors.map((item) => item.id));

    tap(correct[0]!.id);
    expect(mechanic.getTappedCount()).toBe(1);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual([correct[0]!.id]);
    expect(onComplete).toHaveBeenCalledTimes(0);
    tap(correct[0]!.id);
    expect(mechanic.getTappedCount()).toBe(1);
    expect(onCorrectTap).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(0);

    tap(correct[1]!.id);
    expect(mechanic.getTappedCount()).toBe(2);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual([correct[0]!.id, correct[1]!.id]);
    expect(onComplete).toHaveBeenCalledTimes(0);
    tap(correct[2]!.id);
    expect(mechanic.getTappedCount()).toBe(3);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual(correct.map((item) => item.id));
    expect(pendingTimers).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledTimes(0);
    pendingTimers[0]!();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
