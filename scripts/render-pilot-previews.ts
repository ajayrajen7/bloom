/** Static 1024×768 review captures of approved activity data using runtime layout math. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema, type ActivityJSON } from "../shared/types.js";
import { computeZonePositions, getZone, type PlayArea } from "../shared/layout-engine.js";
import { getConceptBrief } from "../concepts/loader.js";
import { validateActivity } from "../generation/pipeline/validate.js";
import { resolveThemeSpec } from "../shared/theme-catalog.js";
import { APPROVED_SPRITE_REFS, resolveSpriteRef } from "../runtime/src/assets/sprite-registry.js";
import { ITEM_RADIUS as TAP_ITEM_RADIUS } from "../runtime/src/mechanics/tap-to-select-logic.js";
import { BIN_HEIGHT, BIN_WIDTH, ITEM_RADIUS as DRAG_ITEM_RADIUS, TARGET_RADIUS } from "../runtime/src/mechanics/drag-to-target-logic.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "library/assets/reviews/activities");
const playArea: PlayArea = { x: 0, y: 115.2, width: 1024, height: 537.6 };
const candidateIds = [
  "act_kitchen_picnic_pack_v1",
  "act_kitchen_garden_basket_v1",
  "act_kitchen_apple_twins_v1",
  "act_kitchen_green_team_v1",
  "act_kitchen_orange_team_v1",
  "act_kitchen_soup_chef_v1",
  "act_kitchen_smoothie_mix_v1",
  "act_kitchen_long_shape_hunt_v1",
  "act_kitchen_round_food_hunt_v1",
  "act_kitchen_red_kitchen_hunt_v1",
  "act_kitchen_market_match_v1",
  "act_kitchen_garden_harvest_match_v1",
  "act_kitchen_fruit_stand_match_v1",
  "act_kitchen_mixed_tray_scramble_v1",
  "act_kitchen_fruit_or_vegetable_sort_v1",
] as const;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const px = (value: number) => `${Math.round(value * 1000) / 1000}px`;

interface AssetManifestEntry {
  file: string;
  manualReview?: { decision?: string };
}
const assetManifest = JSON.parse(readFileSync(join(root, "library/assets/manifest.json"), "utf8")) as AssetManifestEntry[];

function approvedSprite(ref: string): string {
  resolveSpriteRef(ref);
  if (!APPROVED_SPRITE_REFS.includes(ref as (typeof APPROVED_SPRITE_REFS)[number])) {
    throw new Error(`Sprite is not on the runtime allowlist: ${ref}`);
  }
  if (!assetManifest.some((entry) => entry.file === ref && entry.manualReview?.decision === "approved")) {
    throw new Error(`Sprite does not have approved asset provenance: ${ref}`);
  }
  if (!existsSync(join(root, "library/assets", ref))) throw new Error(`Approved sprite file is missing: ${ref}`);
  return `../../${escape(ref)}`;
}

function itemHtml(x: number, y: number, label: string, assetRef: string, radius: number): string {
  return `<img class="item-sprite" style="left:${px(x - radius)};top:${px(y - radius)}" src="${approvedSprite(assetRef)}" alt="${escape(label)}" />
    <span class="item-label" style="left:${px(x)};top:${px(y + radius + 14)}">${escape(label)}</span>`;
}

function renderTap(activity: ActivityJSON): string {
  const correct = activity.filledSlots.correctItems as Array<{ id: string; label: string; assetRef: string }>;
  const distractors = activity.filledSlots.distractors as Array<{ id: string; label: string; assetRef: string }>;
  const items = [...correct, ...distractors];
  const positions = computeZonePositions(getZone(activity.parameters.layout as never, "item_zone"), items.length, playArea);
  return items.map((item, index) =>
    itemHtml(positions[index]!.x, positions[index]!.y, item.label, item.assetRef, TAP_ITEM_RADIUS)
  ).join("\n");
}

function renderMatchingTargets(activity: ActivityJSON, targets: Array<{ id: string; label: string; assetRef: string }>): string {
  const positions = computeZonePositions(getZone(activity.parameters.layout as never, "target_zone"), targets.length, playArea);
  return targets.map((target, index) => {
    const { x, y } = positions[index]!;
    return `<div class="target-ring" style="left:${px(x - TARGET_RADIUS)};top:${px(y - TARGET_RADIUS)}"><img src="${approvedSprite(target.assetRef)}" alt="${escape(target.label)} picture target" /></div>
    <span class="target-label" style="left:${px(x)};top:${px(y + TARGET_RADIUS + 20)}">${escape(target.label)}</span>`;
  }).join("\n");
}

function renderCategoryTargets(activity: ActivityJSON, targets: Array<{ id: string; label: string; assetRef: string; capacity?: number }>): string {
  const positions = computeZonePositions(getZone(activity.parameters.layout as never, "target_zone"), targets.length, playArea);
  return targets.map((target, index) => {
    if (target.capacity !== 3) throw new Error(`${activity.id}: category target ${target.id} must have capacity 3`);
    const { x, y } = positions[index]!;
    const parking = [-115, 0, 115].map((offset) =>
      `<span class="parking-slot" style="left:${px(BIN_WIDTH / 2 + offset)};top:${px(BIN_HEIGHT / 2 + 48)}" aria-hidden="true"></span>`
    ).join("\n");
    return `<section class="category-bin" data-target-id="${escape(target.id)}" style="left:${px(x - BIN_WIDTH / 2)};top:${px(y - BIN_HEIGHT / 2)};width:${px(BIN_WIDTH)};height:${px(BIN_HEIGHT)}" aria-label="${escape(target.label)} category bin">
      ${parking}
      <img class="category-picture" style="left:${px(BIN_WIDTH / 2)};top:${px(BIN_HEIGHT / 2 - 58)}" src="${approvedSprite(target.assetRef)}" alt="${escape(target.label)} category picture" />
      <span class="category-label" style="left:${px(BIN_WIDTH / 2)};top:${px(BIN_HEIGHT / 2 - 12)}">${escape(target.label)}</span>
    </section>`;
  }).join("\n");
}

function renderDrag(activity: ActivityJSON): string {
  const items = activity.filledSlots.items as Array<{ id: string; label: string; assetRef: string }>;
  const targets = activity.filledSlots.targets as Array<{ id: string; label: string; assetRef: string; capacity?: number }>;
  const categorySort = activity.parameters.layoutId === "horizontal-category-sort";
  const itemPositions = computeZonePositions(getZone(activity.parameters.layout as never, "item_zone"), items.length, playArea);
  const targetHtml = categorySort
    ? renderCategoryTargets(activity, targets)
    : renderMatchingTargets(activity, targets);
  const itemsHtml = items.map((item, index) =>
    itemHtml(itemPositions[index]!.x, itemPositions[index]!.y, item.label, item.assetRef, DRAG_ITEM_RADIUS)
  ).join("\n");
  return `${targetHtml}\n${itemsHtml}`;
}

function render(activity: ActivityJSON): string {
  const theme = resolveThemeSpec(activity.themeId);
  const progressCount = activity.mechanicId === "tap-to-select"
    ? (activity.filledSlots.correctItems as unknown[]).length
    : (activity.filledSlots.items as unknown[]).length;
  const dots = Array.from({ length: progressCount }, (_, index) =>
    `<span class="dot" style="left:${512 - (progressCount - 1) * 16 + index * 32}px"></span>`).join("");
  const objects = activity.mechanicId === "tap-to-select" ? renderTap(activity) : renderDrag(activity);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bloom review · ${escape(activity.id)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#777;font-family:system-ui,sans-serif}
.scene{position:relative;width:1024px;height:768px;overflow:hidden;background:${theme.presentation.backgroundColor};color:${theme.presentation.foregroundColor}}
.prompt,.progress{position:absolute;left:0;width:1024px;height:115.2px;background:${theme.presentation.promptPanelColor}}
.prompt{top:0;border-bottom:1px solid #26352a33;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700}
.progress{top:652.8px;border-top:1px solid #26352a33}.dot{position:absolute;top:48px;width:20px;height:20px;border-radius:50%;background:${theme.presentation.foregroundColor};opacity:.2;transform:translateX(-50%)}
.item-sprite,.item-label,.target-ring,.target-label,.category-bin,.category-picture,.category-label,.parking-slot{position:absolute}
.item-sprite{width:${DRAG_ITEM_RADIUS * 2}px;height:${DRAG_ITEM_RADIUS * 2}px;object-fit:contain}
.item-label,.target-label,.category-label{font-size:22px;white-space:nowrap;transform:translateX(-50%)}
.target-ring{width:${TARGET_RADIUS * 2}px;height:${TARGET_RADIUS * 2}px;border:4px solid #26352a80;border-radius:50%;background:#26352a1f;display:grid;place-items:center}
.target-ring img{width:${TARGET_RADIUS * 1.6}px;height:${TARGET_RADIUS * 1.6}px;object-fit:contain;opacity:.35}.target-label{opacity:.7}
.category-bin{border:4px solid ${theme.presentation.foregroundColor}80;border-radius:24px;background:${theme.presentation.foregroundColor}1f}
.category-picture{width:70px;height:70px;object-fit:contain;transform:translate(-50%,-50%);opacity:.9}
.category-label{top:0;transform:translate(-50%,0)}
.parking-slot{width:68px;height:68px;border-radius:50%;transform:translate(-50%,-50%);background:${theme.presentation.foregroundColor}26;border:2px solid ${theme.presentation.foregroundColor}73}
.pending{position:absolute;right:14px;bottom:8px;font-size:12px;opacity:.65}
</style></head><body>
<main class="scene" data-width="1024" data-height="768" aria-label="Tablet activity review">
<div class="prompt">${escape(activity.prompt.text)}</div>
${objects}
<div class="progress">${dots}<span class="pending">Approved for iPad testing</span></div>
</main></body></html>\n`;
}

mkdirSync(outputDir, { recursive: true });
for (const id of candidateIds) {
  const activityPath = join(root, "library/activities", `${id}.json`);
  if (!existsSync(activityPath)) throw new Error(`Missing approved activity: ${id}`);
  const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
  if (activity.id !== id) throw new Error(`${id}: activity id does not match its filename`);
  const concept = getConceptBrief(activity.conceptId);
  if (!concept || concept.id !== activity.conceptId || concept.mechanicId !== activity.mechanicId) {
    throw new Error(`${id}: missing or mismatched concept/activity pair (${activity.conceptId})`);
  }
  const validation = validateActivity(activity, concept);
  if (!validation.passed) throw new Error(`${id}: ${validation.errors.join("; ")}`);
  const path = join(outputDir, `${id}.html`);
  writeFileSync(path, render(activity));
  process.stdout.write(`${path}\n`);
}
