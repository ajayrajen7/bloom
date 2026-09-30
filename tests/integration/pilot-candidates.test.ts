import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema, ConceptBriefSchema } from "../../shared/types.js";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { getConceptBrief } from "../../concepts/loader.js";
import { getLayoutVariant } from "../../mechanics/loader.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const activities = join(root, "library/activities");
const activityIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));

const candidates = [
  { id: "act_pilot_kitchen_tap_v1", conceptId: "concept_pilot_kitchen_tap_v1", mechanic: "tap-to-select", layoutId: "grid-2x2" },
  { id: "act_pilot_kitchen_drag_v1", conceptId: "concept_pilot_kitchen_drag_v1", mechanic: "drag-to-target", layoutId: "horizontal-standard" },
] as const;

describe("approved Kitchen pilot activities", () => {
  for (const candidate of candidates) {
    it(`${candidate.mechanic} is an approved activity with scoped sprites`, () => {
      const concept = ConceptBriefSchema.parse(getConceptBrief(candidate.conceptId));
      const activityPath = join(activities, `${candidate.id}.json`);
      expect(existsSync(activityPath)).toBe(true);
      if (!existsSync(activityPath)) return;
      const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
      expect(activity.id).toBe(candidate.id);
      expect(activity.conceptId).toBe(concept.id);
      expect(activity.mechanicId).toBe(concept.mechanicId);
      expect(activity.themeId).toBe("kitchen-v1");
      expect(activity.metadata.difficulty).toBe("low");
      expect(activity.parameters.layout).toEqual(getLayoutVariant(candidate.mechanic, candidate.layoutId));
      expect(validateActivity(activity, concept)).toEqual({ passed: true, errors: [] });
      expect(activity.metadata.humanApprovedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(activity.metadata.humanApprover).toBe("ajay");
      expect(activity.metadata.reviewerNotes).toContain("Visual review approved by Ajay");
      expect(activityIndex.activities.some((entry: { id: string }) => entry.id === activity.id)).toBe(true);
    });

    it(`${candidate.mechanic} has a tablet-size visual review preview`, () => {
      const path = join(root, "library/assets/reviews/activities", `${candidate.id}.html`);
      const html = readFileSync(path, "utf8");
      expect(html).toContain('data-width="1024" data-height="768"');
      expect(html).toContain("Manual review pending");
      const activity = JSON.parse(readFileSync(join(activities, `${candidate.id}.json`), "utf8"));
      expect(html).toContain(activity.prompt.text);
      for (const item of Object.values(activity.filledSlots).flat() as Array<{ assetRef?: string }>) {
        if (item.assetRef) expect(html).toContain(item.assetRef.replace("sprites/", ""));
      }
    });
  }

  it("tap asks for the red apple among banana, orange, and carrot", () => {
    const activity = JSON.parse(readFileSync(join(activities, "act_pilot_kitchen_tap_v1.json"), "utf8"));
    expect(activity.prompt.text).toBe("Find the apple.");
    expect(activity.filledSlots.correctItems.map((item: { assetRef: string }) => item.assetRef))
      .toEqual(["sprites/apple-red-v1.png"]);
    expect(activity.filledSlots.distractors.map((item: { assetRef: string }) => item.assetRef))
      .toEqual(["sprites/banana-v1.png", "sprites/orange-v1.png", "sprites/carrot-v1.png"]);
  });

  it("drag maps each fruit to a target showing the matching picture", () => {
    const activity = JSON.parse(readFileSync(join(activities, "act_pilot_kitchen_drag_v1.json"), "utf8"));
    const targets = new Map(activity.filledSlots.targets.map((target: { id: string; assetRef: string }) => [target.id, target.assetRef]));
    expect(activity.filledSlots.items.map((item: { assetRef: string; targetId: string }) => [item.assetRef, targets.get(item.targetId)]))
      .toEqual([
        ["sprites/apple-red-v1.png", "sprites/apple-red-v1.png"],
        ["sprites/banana-v1.png", "sprites/banana-v1.png"],
        ["sprites/orange-v1.png", "sprites/orange-v1.png"],
      ]);
  });

  it("previews anchor sprite and ring centers at runtime coordinates with labels below", () => {
    const generator = readFileSync(join(root, "scripts/render-pilot-previews.ts"), "utf8");
    expect(generator).toContain("left:${px(x - radius)};top:${px(y - radius)}");
    expect(generator).toContain("left:${px(x)};top:${px(y + radius + 14)}");
    expect(generator).toContain("left:${px(x - TARGET_RADIUS)};top:${px(y - TARGET_RADIUS)}");
    expect(generator).toContain("left:${px(x)};top:${px(y + TARGET_RADIUS + 20)}");

    const previews = join(root, "library/assets/reviews/activities");
    const tap = readFileSync(join(previews, "act_pilot_kitchen_tap_v1.html"), "utf8");
    expect(tap).toContain('class="item-sprite" style="left:326.04px;top:198.04px"');
    expect(tap).toContain('class="item-label" style="left:381.04px;top:322.04px"');

    const drag = readFileSync(join(previews, "act_pilot_kitchen_drag_v1.html"), "utf8");
    expect(drag).toContain('class="target-ring" style="left:32.4px;top:195.728px"');
    expect(drag).toContain('class="target-label" style="left:102.4px;top:355.728px"');
    expect(drag).toContain('class="item-sprite" style="left:47.4px;top:490.28px"');
    expect(drag).toContain('class="item-label" style="left:102.4px;top:614.28px"');
  });
});
