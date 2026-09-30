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
const conceptPath = join(root, "concepts/briefs/concept_kitchen_garden_basket_v1.json");
const activityPath = join(root, "library/activities/act_kitchen_garden_basket_v1.json");
const correctRefs = ["sprites/carrot-v1.png", "sprites/broccoli-v1.png", "sprites/cucumber-v1.png"];
const distractorRefs = ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png"];

describe("approved Garden Basket activity", () => {
  it("uses the exact six approved choices in the high difficulty Kitchen layout", () => {
    expect(existsSync(conceptPath)).toBe(true);
    expect(existsSync(activityPath)).toBe(true);

    const concept = ConceptBriefSchema.parse(JSON.parse(readFileSync(conceptPath, "utf8")));
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const correct = activity.filledSlots.correctItems as Array<{ id: string; label: string; assetRef: string }>;
    const distractors = activity.filledSlots.distractors as Array<{ id: string; label: string; assetRef: string }>;
    const refs = [...correctRefs, ...distractorRefs];
    const assetManifest = JSON.parse(readFileSync(join(root, "library/assets/manifest.json"), "utf8")) as Array<{
      file: string;
      manualReview?: { decision?: string };
    }>;

    expect(concept.id).toBe("concept_kitchen_garden_basket_v1");
    expect(concept.mechanicId).toBe("tap-to-select");
    expect(concept.difficulty).toBe("high");
    expect(concept.ageMonths).toEqual({ min: 24, max: 36 });
    expect(concept.itemSprites).toEqual(refs.map((ref) => ref.slice("sprites/".length)));
    expect(concept.targetSprites).toEqual([]);

    expect(activity.id).toBe("act_kitchen_garden_basket_v1");
    expect(activity.conceptId).toBe(concept.id);
    expect(activity.mechanicId).toBe(concept.mechanicId);
    expect(activity.themeId).toBe("kitchen-v1");
    expect(activity.prompt.text).toBe("Find the carrot, broccoli, and cucumber.");
    expect(activity.metadata.difficulty).toBe("high");
    expect(activity.metadata.ageMonths).toEqual({ min: 24, max: 36 });
    expect(activity.parameters.layoutId).toBe("grid-2x3");
    expect(activity.parameters.layout).toEqual(getLayoutVariant("tap-to-select", "grid-2x3"));
    expect(activity.parameters.correctCount).toBe(3);
    expect(activity.parameters.distractorCount).toBe(3);
    expect(correct.map((item) => item.assetRef)).toEqual(correctRefs);
    expect(correct.map((item) => item.label)).toEqual(["Carrot", "Broccoli", "Cucumber"]);
    expect(distractors.map((item) => item.assetRef)).toEqual(distractorRefs);
    expect(distractors.map((item) => item.label)).toEqual(["Red apple", "Banana", "Orange"]);
    expect(new Set([...correct, ...distractors].map((item) => item.assetRef)).size).toBe(6);
    expect(refs.every((ref) => assetManifest.some((asset) => asset.file === ref && asset.manualReview?.decision === "approved"))).toBe(true);
    expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
    expect(activity.metadata.humanApprovedAt).toMatch(/^2026-09-30T/);
    expect(activity.metadata.humanApprover).toBe("ajay");

    const activeIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
    expect(activeIndex.activities.some((entry: { id: string }) => entry.id === activity.id)).toBe(true);
  });

  it("advances progress once per unique correct pointer tap and completes after the third", () => {
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
    let progress = 0;
    const onCorrectTap = vi.fn((_itemId: string) => { progress += 1; });
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
      expect(progress).toBe(0);
      expect(onComplete).toHaveBeenCalledTimes(0);
    }
    expect(onIncorrectTap.mock.calls.map(([id]) => id)).toEqual(distractors.map((item) => item.id));

    tap(correct[0]!.id);
    expect(progress).toBe(1);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual([correct[0]!.id]);
    expect(onComplete).toHaveBeenCalledTimes(0);
    tap(correct[0]!.id);
    expect(progress).toBe(1);
    expect(onCorrectTap).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(0);

    tap(correct[1]!.id);
    expect(progress).toBe(2);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual([correct[0]!.id, correct[1]!.id]);
    expect(onComplete).toHaveBeenCalledTimes(0);
    tap(correct[2]!.id);
    expect(progress).toBe(3);
    expect(onCorrectTap.mock.calls.map(([id]) => id)).toEqual(correct.map((item) => item.id));
    expect(pendingTimers).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledTimes(0);
    pendingTimers[0]!();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(mechanic.getTappedCount()).toBe(3);
  });
});
