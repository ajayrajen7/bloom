import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema, ConceptBriefSchema } from "../../shared/types.js";
import { getLayoutVariant } from "../../mechanics/loader.js";
import { validateActivity } from "../../generation/pipeline/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const conceptPath = join(root, "concepts/briefs/concept_kitchen_fruit_or_vegetable_sort_v1.json");
const activityPath = join(root, "library/activities/act_kitchen_fruit_or_vegetable_sort_v1.json");
const itemIds = ["apple-green", "banana", "grapes", "cucumber", "tomato", "broccoli"];
const itemSpriteRefs = itemIds.map((id) => `sprites/${id}-v1.png`);
const targetIds = ["fruit", "vegetables"];
const targetSpriteRefs = ["sprites/apple-red-v1.png", "sprites/carrot-v1.png"];
const expectedTargetByItem: Record<string, string> = {
  "apple-green": "fruit",
  banana: "fruit",
  grapes: "fruit",
  cucumber: "vegetables",
  tomato: "vegetables",
  broccoli: "vegetables",
};

describe("approved Fruit-or-Vegetable Sort activity", () => {
  it("sorts the six approved foods into the two capacity-three Kitchen bins", () => {
    expect(existsSync(conceptPath)).toBe(true);
    expect(existsSync(activityPath)).toBe(true);

    const concept = ConceptBriefSchema.parse(JSON.parse(readFileSync(conceptPath, "utf8")));
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    const items = activity.filledSlots.items as Array<{ id: string; targetId: string; label: string; assetRef: string }>;
    const targets = activity.filledSlots.targets as Array<{ id: string; label: string; assetRef: string; capacity?: number }>;

    expect(concept.id).toBe("concept_kitchen_fruit_or_vegetable_sort_v1");
    expect(concept.mechanicId).toBe("drag-to-target");
    expect(concept.difficulty).toBe("medium");
    expect(concept.ageMonths).toEqual({ min: 24, max: 36 });
    expect(concept.itemSprites).toEqual(itemIds.map((id) => `${id}-v1.png`));
    expect(concept.targetSprites).toEqual(["apple-red-v1.png", "carrot-v1.png"]);

    expect(activity.id).toBe("act_kitchen_fruit_or_vegetable_sort_v1");
    expect(activity.conceptId).toBe(concept.id);
    expect(activity.mechanicId).toBe(concept.mechanicId);
    expect(activity.themeId).toBe("kitchen-v1");
    expect(activity.prompt.text).toBe("Put fruit with fruit and vegetables with vegetables.");
    expect(activity.metadata.difficulty).toBe("medium");
    expect(activity.metadata.ageMonths).toEqual({ min: 24, max: 36 });
    expect(activity.parameters.layoutId).toBe("horizontal-category-sort");
    expect(activity.parameters.layout).toEqual(getLayoutVariant("drag-to-target", "horizontal-category-sort"));
    expect(activity.parameters.itemCount).toBe(6);
    expect(activity.parameters.distractorCount).toBe(0);
    expect(items.map((item) => item.id)).toEqual(itemIds);
    expect(items.map((item) => item.assetRef)).toEqual(itemSpriteRefs);
    expect(items.map((item) => item.targetId)).toEqual(itemIds.map((id) => expectedTargetByItem[id]));
    expect(targets.map((target) => target.id)).toEqual(targetIds);
    expect(targets.map((target) => target.label)).toEqual(["Fruit", "Vegetables"]);
    expect(targets.map((target) => target.assetRef)).toEqual(targetSpriteRefs);
    expect(targets.map((target) => target.capacity)).toEqual([3, 3]);
    expect(targets.map((target) => items.filter((item) => item.targetId === target.id).length)).toEqual([3, 3]);
    expect(activity.filledSlots.distractors).toEqual([]);
    expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
    expect(activity.metadata.humanApprovedAt).toMatch(/^2026-09-30T/);
    expect(activity.metadata.humanApprover).toBe("ajay");

    const activeIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
    expect(activeIndex.activities.some((entry: { id: string }) => entry.id === activity.id)).toBe(true);
  });
});
