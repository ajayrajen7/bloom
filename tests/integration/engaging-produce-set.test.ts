import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema, ConceptBriefSchema } from "../../shared/types.js";
import { getConceptBrief } from "../../concepts/loader.js";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { APPROVED_SPRITE_REFS, resolveSpriteRef } from "../../runtime/src/assets/sprite-registry.js";
import { BIN_HEIGHT, BIN_WIDTH } from "../../runtime/src/mechanics/drag-to-target-logic.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const stagedDir = join(root, "library/staged");
const activitiesDir = join(root, "library/activities");
const previewDir = join(root, "library/assets/reviews/activities");
const activeIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "library/assets/manifest.json"), "utf8")) as Array<{
  file: string;
  manualReview?: { decision?: string };
}>;

type TapExpected = {
  id: string; mechanic: "tap-to-select"; prompt: string; difficulty: string; layout: string;
  correct: string[]; distractors: string[];
};
type MatchExpected = {
  id: string; mechanic: "drag-to-target"; prompt: string; difficulty: string; layout: string;
  pairs: string[]; targetOrder?: string[];
};
type CategoryExpected = {
  id: string; mechanic: "drag-to-target"; prompt: string; difficulty: string; layout: string;
  categories: { fruit: { target: string; items: string[] }; vegetables: { target: string; items: string[] } };
};
type ExpectedCandidate = TapExpected | MatchExpected | CategoryExpected;

const candidateMatrix: ExpectedCandidate[] = [
  { id: "act_kitchen_picnic_pack_v1", mechanic: "tap-to-select", prompt: "Find the red apple, banana, and orange.", difficulty: "high", layout: "grid-3x2", correct: ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png"], distractors: ["sprites/carrot-v1.png", "sprites/broccoli-v1.png", "sprites/cucumber-v1.png"] },
  { id: "act_kitchen_garden_basket_v1", mechanic: "tap-to-select", prompt: "Find the carrot, broccoli, and cucumber.", difficulty: "high", layout: "grid-2x3", correct: ["sprites/carrot-v1.png", "sprites/broccoli-v1.png", "sprites/cucumber-v1.png"], distractors: ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png"] },
  { id: "act_kitchen_apple_twins_v1", mechanic: "tap-to-select", prompt: "Find both apples.", difficulty: "medium", layout: "grid-3x2", correct: ["sprites/apple-red-v1.png", "sprites/apple-green-v1.png"], distractors: ["sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/grapes-v1.png", "sprites/carrot-v1.png"] },
  { id: "act_kitchen_green_team_v1", mechanic: "tap-to-select", prompt: "Find the green apple, cucumber, and broccoli.", difficulty: "high", layout: "grid-2x3", correct: ["sprites/apple-green-v1.png", "sprites/cucumber-v1.png", "sprites/broccoli-v1.png"], distractors: ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/carrot-v1.png"] },
  { id: "act_kitchen_orange_team_v1", mechanic: "tap-to-select", prompt: "Find the orange and carrot.", difficulty: "medium", layout: "grid-3x2", correct: ["sprites/orange-v1.png", "sprites/carrot-v1.png"], distractors: ["sprites/apple-red-v1.png", "sprites/apple-green-v1.png", "sprites/cucumber-v1.png", "sprites/broccoli-v1.png"] },
  { id: "act_kitchen_soup_chef_v1", mechanic: "tap-to-select", prompt: "Find the carrot, tomato, and broccoli.", difficulty: "high", layout: "grid-2x3", correct: ["sprites/carrot-v1.png", "sprites/tomato-v1.png", "sprites/broccoli-v1.png"], distractors: ["sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/grapes-v1.png"] },
  { id: "act_kitchen_smoothie_mix_v1", mechanic: "tap-to-select", prompt: "Find the red apple, banana, and grapes.", difficulty: "high", layout: "grid-3x2", correct: ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/grapes-v1.png"], distractors: ["sprites/cucumber-v1.png", "sprites/carrot-v1.png", "sprites/broccoli-v1.png"] },
  { id: "act_kitchen_long_shape_hunt_v1", mechanic: "tap-to-select", prompt: "Find the banana, carrot, and cucumber.", difficulty: "high", layout: "grid-2x3", correct: ["sprites/banana-v1.png", "sprites/carrot-v1.png", "sprites/cucumber-v1.png"], distractors: ["sprites/apple-red-v1.png", "sprites/orange-v1.png", "sprites/broccoli-v1.png"] },
  { id: "act_kitchen_round_food_hunt_v1", mechanic: "tap-to-select", prompt: "Find the red apple, orange, and tomato.", difficulty: "high", layout: "grid-3x2", correct: ["sprites/apple-red-v1.png", "sprites/orange-v1.png", "sprites/tomato-v1.png"], distractors: ["sprites/banana-v1.png", "sprites/carrot-v1.png", "sprites/cucumber-v1.png"] },
  { id: "act_kitchen_red_kitchen_hunt_v1", mechanic: "tap-to-select", prompt: "Find the red apple and tomato.", difficulty: "medium", layout: "grid-2x3", correct: ["sprites/apple-red-v1.png", "sprites/tomato-v1.png"], distractors: ["sprites/apple-green-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/carrot-v1.png"] },
  { id: "act_kitchen_market_match_v1", mechanic: "drag-to-target", prompt: "Put each food on its matching picture.", difficulty: "medium", layout: "horizontal-six-pairs", pairs: ["sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/grapes-v1.png", "sprites/carrot-v1.png", "sprites/cucumber-v1.png"] },
  { id: "act_kitchen_garden_harvest_match_v1", mechanic: "drag-to-target", prompt: "Match each harvest to its picture.", difficulty: "medium", layout: "horizontal-six-pairs", pairs: ["sprites/apple-green-v1.png", "sprites/tomato-v1.png", "sprites/broccoli-v1.png", "sprites/carrot-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png"] },
  { id: "act_kitchen_fruit_stand_match_v1", mechanic: "drag-to-target", prompt: "Put each fruit on its matching picture.", difficulty: "medium", layout: "horizontal-six-pairs", pairs: ["sprites/apple-red-v1.png", "sprites/apple-green-v1.png", "sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/grapes-v1.png"] },
  { id: "act_kitchen_mixed_tray_scramble_v1", mechanic: "drag-to-target", prompt: "Match each food to its picture.", difficulty: "medium", layout: "horizontal-six-pairs", pairs: ["sprites/apple-red-v1.png", "sprites/apple-green-v1.png", "sprites/banana-v1.png", "sprites/grapes-v1.png", "sprites/tomato-v1.png", "sprites/broccoli-v1.png"], targetOrder: ["sprites/tomato-v1.png", "sprites/broccoli-v1.png", "sprites/apple-red-v1.png", "sprites/banana-v1.png", "sprites/grapes-v1.png", "sprites/apple-green-v1.png"] },
  { id: "act_kitchen_fruit_or_vegetable_sort_v1", mechanic: "drag-to-target", prompt: "Put fruit with fruit and vegetables with vegetables.", difficulty: "medium", layout: "horizontal-category-sort", categories: { fruit: { target: "sprites/apple-red-v1.png", items: ["sprites/apple-green-v1.png", "sprites/banana-v1.png", "sprites/grapes-v1.png"] }, vegetables: { target: "sprites/carrot-v1.png", items: ["sprites/cucumber-v1.png", "sprites/tomato-v1.png", "sprites/broccoli-v1.png"] } } },
];

type Item = { id: string; label: string; assetRef: string; targetId?: string };
type Target = { id: string; label: string; assetRef: string; capacity?: number };

function expectedAssets(slots: Record<string, unknown>): string[] {
  const items = Object.values(slots).flatMap((value) => Array.isArray(value) ? value as Item[] : []) as Item[];
  return items.map((item) => item.assetRef);
}

function matrixItemAssets(expected: ExpectedCandidate): string[] {
  if (expected.mechanic === "tap-to-select") return [...expected.correct, ...expected.distractors];
  if ("pairs" in expected) return expected.pairs;
  return [...expected.categories.fruit.items, ...expected.categories.vegetables.items];
}

function matrixTargetAssets(expected: ExpectedCandidate): string[] {
  if (expected.mechanic === "tap-to-select") return [];
  if ("pairs" in expected) return expected.targetOrder ?? expected.pairs;
  return [expected.categories.fruit.target, expected.categories.vegetables.target];
}

function approvedAsset(assetRef: string): boolean {
  resolveSpriteRef(assetRef);
  return APPROVED_SPRITE_REFS.includes(assetRef as (typeof APPROVED_SPRITE_REFS)[number])
    && manifest.some((asset) => asset.file === assetRef && asset.manualReview?.decision === "approved")
    && existsSync(join(root, "library/assets", assetRef));
}

describe("engaging Kitchen produce candidate set", () => {
  it("contains exactly the 15 design-matrix candidates and publishes them alongside the two pilots", () => {
    const ids = candidateMatrix.map(({ id }) => id);
    expect(new Set(ids).size).toBe(15);
    const stagedCandidates = existsSync(stagedDir) ? readdirSync(stagedDir).filter((name) => /^act_kitchen_.*\.json$/.test(name)) : [];
    expect(stagedCandidates).toEqual([]);
    expect(readdirSync(activitiesDir).filter((name) => /^act_kitchen_.*\.json$/.test(name)).sort())
      .toEqual(ids.map((id) => `${id}.json`).sort());
    expect(readdirSync(previewDir).filter((name) => /^act_kitchen_.*\.html$/.test(name)).sort())
      .toEqual(ids.map((id) => `${id}.html`).sort());
    const indexIds = activeIndex.activities.map((entry: { id: string }) => entry.id);
    expect(indexIds.slice().sort()).toEqual([...ids, "act_pilot_kitchen_drag_v1", "act_pilot_kitchen_tap_v1"].sort());
  });

  for (const expected of candidateMatrix) {
    it(`${expected.id} matches its design-matrix contract and has an accurate review preview`, () => {
      const candidatePath = join(activitiesDir, `${expected.id}.json`);
      expect(existsSync(candidatePath)).toBe(true);
      const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(candidatePath, "utf8")));
      expect(activity.metadata.humanApprovedAt).toMatch(/^2026-09-30T/);
      expect(activity.metadata.humanApprover).toBe("ajay");
      expect(activity.metadata.reviewerNotes).toContain("approved this activity for the one-child iPad pilot");
      const concept = ConceptBriefSchema.parse(getConceptBrief(activity.conceptId));
      expect(activity.id).toBe(expected.id);
      expect(activity.conceptId).toBe(concept.id);
      expect(activity.mechanicId).toBe(expected.mechanic);
      expect(concept.mechanicId).toBe(expected.mechanic);
      expect(activity.themeId).toBe("kitchen-v1");
      expect(activity.prompt.text).toBe(expected.prompt);
      expect(activity.metadata.difficulty).toBe(expected.difficulty);
      expect(activity.parameters.layoutId).toBe(expected.layout);
      expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
      expect(idsFromConcept(concept.itemSprites.map((ref) => `sprites/${ref}`))).toEqual(new Set(matrixItemAssets(expected)));
      expect(idsFromConcept(concept.targetSprites.map((ref) => `sprites/${ref}`))).toEqual(new Set(matrixTargetAssets(expected)));

      const previewPath = join(previewDir, `${expected.id}.html`);
      expect(existsSync(previewPath)).toBe(true);
      const html = readFileSync(previewPath, "utf8");
      expect(html).toContain('data-width="1024" data-height="768"');
      expect(html).toContain("Approved for iPad testing");
      expect(html).toContain(expected.prompt);
      for (const ref of expectedAssets(activity.filledSlots)) {
        expect(approvedAsset(ref)).toBe(true);
        expect(html).toContain(ref.replace("sprites/", ""));
      }
      const allSlots = Object.values(activity.filledSlots).flatMap((value) => Array.isArray(value) ? value as Item[] : []) as Item[];
      for (const slot of allSlots) expect(html).toContain(slot.label);
      const progressCount = activity.mechanicId === "tap-to-select"
        ? (activity.filledSlots.correctItems as Item[]).length
        : (activity.filledSlots.items as Item[]).length;
      expect(html.match(/class="dot"/g)).toHaveLength(progressCount);

      if (expected.mechanic === "tap-to-select") {
        const correct = activity.filledSlots.correctItems as Item[];
        const distractors = activity.filledSlots.distractors as Item[];
        expect(correct.map((item) => item.assetRef)).toEqual(expected.correct);
        expect(distractors.map((item) => item.assetRef)).toEqual(expected.distractors);
        expect(correct).toHaveLength(expected.correct.length);
        expect(distractors).toHaveLength(expected.distractors.length);
        expect(new Set([...correct, ...distractors].map((item) => item.assetRef)).size).toBe(6);
        expect(html.match(/class="item-sprite"/g)).toHaveLength(6);
        expect(html.match(/class="item-label"/g)).toHaveLength(6);
      } else {
        const items = activity.filledSlots.items as Item[];
        const targets = activity.filledSlots.targets as Target[];
        expect(items.map((item) => item.assetRef)).toEqual("pairs" in expected ? expected.pairs : [...expected.categories.fruit.items, ...expected.categories.vegetables.items]);
        expect(items).toHaveLength("pairs" in expected ? expected.pairs.length : 6);
        expect(items.every((item) => item.targetId && targets.some((target) => target.id === item.targetId))).toBe(true);
        if ("pairs" in expected) {
          expect(items.map((item) => targets.find((target) => target.id === item.targetId)?.assetRef)).toEqual(items.map((item) => item.assetRef));
          expect(targets.map((target) => target.assetRef)).toEqual(expected.targetOrder ?? expected.pairs);
          expect(new Set(items.map((item) => item.targetId)).size).toBe(items.length);
          expect(html.match(/class="target-ring"/g)).toHaveLength(items.length);
          expect(html.match(/class="target-label"/g)).toHaveLength(items.length);
        } else {
          expect(targets.map((target) => [target.label, target.assetRef, target.capacity])).toEqual([
            ["Fruit", expected.categories.fruit.target, 3],
            ["Vegetables", expected.categories.vegetables.target, 3],
          ]);
          expect(items.filter((item) => item.targetId === "fruit").map((item) => item.assetRef)).toEqual(expected.categories.fruit.items);
          expect(items.filter((item) => item.targetId === "vegetables").map((item) => item.assetRef)).toEqual(expected.categories.vegetables.items);
          expect(html.match(/class="category-bin"/g)).toHaveLength(2);
          expect(html.match(/class="parking-slot"/g)).toHaveLength(6);
          expect(html).toContain(`width:${BIN_WIDTH}px;height:${BIN_HEIGHT}px`);
          for (const offset of [-115, 0, 115]) {
            expect(html).toContain(`class="parking-slot" style="left:${BIN_WIDTH / 2 + offset}px;top:${BIN_HEIGHT / 2 + 48}px"`);
          }
        }
        expect(html.match(/class="item-sprite"/g)).toHaveLength(items.length);
        expect(html.match(/class="item-label"/g)).toHaveLength(items.length);
      }
    });
  }
});

function idsFromConcept(refs: string[]): Set<string> {
  return new Set(refs);
}
