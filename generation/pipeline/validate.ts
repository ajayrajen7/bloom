import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema, LayoutVariantSchema, type ActivityJSON, type ConceptBrief } from "../../shared/types.js";
import { resolveThemeSpec, requireSupportedThemeArtwork } from "../../shared/theme-catalog.js";
import { approvedRuntimeVisualRefs } from "../assets/approved-runtime.js";
import { getMechanicSpec } from "../../mechanics/loader.js";
import { resolveSpriteRef } from "../../runtime/src/assets/sprite-registry.js";
import { sameType } from "../taxonomy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "../../library/assets");

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export function validateActivity(raw: unknown, concept?: ConceptBrief, assetsDir = ASSETS_DIR): ValidationResult {
  const errors: string[] = [];

  // ── Schema validation ──────────────────────────────────────────────────────
  const parsed = ActivityJSONSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      passed: false,
      errors: parsed.error.errors.map((e) => `schema: ${e.path.join(".")} — ${e.message}`),
    };
  }

  const activity = parsed.data;

  try {
    requireSupportedThemeArtwork(resolveThemeSpec(activity.themeId));
  } catch (error) {
    errors.push(`theme: ${(error as Error).message}`);
  }

  const slotKeys = activity.mechanicId === "drag-to-target"
    ? ["items", "targets", "distractors"]
    : activity.mechanicId === "tap-to-select"
    ? ["correctItems", "distractors"]
    : [];
  for (const key of slotKeys) {
    const slots = activity.filledSlots[key];
    if (!Array.isArray(slots) || slots.some((slot) => !slot || typeof slot !== "object" || Array.isArray(slot))) {
      errors.push(`slot: ${key} must be an array of filled slot objects`);
    }
  }
  if (errors.some((error) => error.startsWith("slot: "))) return { passed: false, errors };
  for (const key of slotKeys.filter((key) => key !== "targets")) {
    for (const slot of activity.filledSlots[key] as Array<{ id?: string; assetRef?: string }>) {
      if (!slot.assetRef) errors.push(`slot: ${key} "${slot.id ?? "?"}" is missing sprite assetRef`);
    }
  }

  // ── Layout ID ──────────────────────────────────────────────────────────────
  const layoutId = activity.parameters["layoutId"] as string | undefined;
  if (!layoutId) {
    errors.push("params: missing layoutId — must select a layout variant from the mechanic spec");
  } else {
    const spec = getMechanicSpec(activity.mechanicId);
    if (!spec) {
      errors.push(`params: unknown mechanicId "${activity.mechanicId}"`);
    } else {
      const expectedLayout = spec.layouts.find((l) => l.id === layoutId);
      if (!expectedLayout) {
        const valid = spec.layouts.map((l) => l.id).join(", ");
        errors.push(`params: layoutId "${layoutId}" is not defined in mechanic spec — valid: ${valid}`);
      } else {
        const inline = LayoutVariantSchema.safeParse(activity.parameters["layout"]);
        if (!inline.success || JSON.stringify(inline.data) !== JSON.stringify(expectedLayout)) {
          errors.push(`params: inlined layout must match mechanic spec layoutId "${layoutId}"`);
        }
      }
    }
  }

  // ── Mechanic-specific validation ──────────────────────────────────────────
  if (activity.mechanicId === "drag-to-target") {
    validateDragToTarget(activity, concept, errors);
  } else if (activity.mechanicId === "tap-to-select") {
    validateTapToSelect(activity, concept, errors);
  }

  // ── Prompt text length ─────────────────────────────────────────────────────
  const wordCount = activity.prompt.text.trim().split(/\s+/).length;
  if (wordCount > 12) {
    errors.push(`prompt: text is ${wordCount} words — must be under 12`);
  }

  // ── Approved sprite references and file presence ──────────────────────────
  let approvedRefs: Set<string>;
  try {
    approvedRefs = approvedRuntimeVisualRefs(assetsDir);
  } catch (error) {
    errors.push(`asset: manifest unavailable or invalid: ${(error as Error).message}`);
    return { passed: false, errors };
  }
  const allAssetRefs = collectAssetRefs(activity);
  for (const ref of allAssetRefs) {
    try {
      resolveSpriteRef(ref);
    } catch (error) {
      errors.push(`asset: ${(error as Error).message}`);
      continue;
    }

    if (!approvedRefs.has(ref)) {
      errors.push(`asset: ${ref} lacks an approved canonical manifest record`);
    }
    const fullPath = join(assetsDir, ref);
    if (!existsSync(fullPath)) {
      errors.push(`asset: referenced file not found: library/assets/${ref}`);
    }
  }

  return { passed: errors.length === 0, errors };
}

function validateDragToTarget(
  activity: ActivityJSON,
  concept: ConceptBrief | undefined,
  errors: string[]
) {
  const rawTargets = (activity.filledSlots["targets"] ?? []) as Array<{ id: string; capacity?: number; assetRef?: string }>;
  const targetIds  = new Set(rawTargets.map((t) => t.id));
  const items      = (activity.filledSlots["items"] ?? []) as Array<{ id: string; targetId: string }>;
  const distractors = (activity.filledSlots["distractors"] ?? []) as Array<{ id: string; assetRef?: string }>;

  for (const item of items) {
    if (!targetIds.has(item.targetId)) {
      errors.push(`slot: item "${item.id}" has targetId "${item.targetId}" which does not exist in targets`);
    }
  }

  const layoutId = activity.parameters["layoutId"];
  if (layoutId === "horizontal-six-pairs") {
    if (rawTargets.length !== items.length || rawTargets.some((target) => target.capacity !== undefined) ||
        new Set(items.map((item) => item.targetId)).size !== items.length) {
      errors.push("slot: one-to-one matching requires one unique target per item with no capacity");
    }
    const pictureRefs = (items as Array<{ assetRef?: string }>).map((item) => item.assetRef).filter(Boolean);
    if (new Set(pictureRefs).size !== pictureRefs.length) {
      errors.push("slot: duplicate matching picture across separate pairs");
    }
    const targetById = new Map(rawTargets.map((target) => [target.id, target]));
    for (const item of items as Array<{ id: string; targetId: string; assetRef?: string }>) {
      const target = targetById.get(item.targetId);
      if (target && target.assetRef !== item.assetRef) errors.push(`slot: item "${item.id}" must match its target picture`);
    }
  }
  if (layoutId === "horizontal-category-sort") {
    if (rawTargets.length !== 2 || rawTargets.some((target) => target.capacity !== 3)) {
      errors.push("slot: category sort requires exactly two bins with capacity 3");
    }
    for (const target of rawTargets) {
      if (items.filter((item) => item.targetId === target.id).length !== 3) {
        errors.push(`slot: bin "${target.id}" requires exactly 3 mapped items`);
      }
    }
  }

  if (concept) {
    const allowedItems   = new Set(concept.itemSprites.map((s) => `sprites/${s}`));
    const allowedTargets = new Set(concept.targetSprites.map((s) => `sprites/${s}`));
    const allowedAll     = new Set([...allowedItems, ...allowedTargets]);

    for (const item of items as Array<{ id: string; assetRef?: string }>) {
      if (item.assetRef && !allowedAll.has(item.assetRef)) {
        errors.push(`theme: item "${item.id}" uses sprite "${item.assetRef}" which is outside the concept's itemSprites`);
      }
    }
    for (const target of rawTargets as Array<{ id: string; assetRef?: string }>) {
      if (target.assetRef && !allowedAll.has(target.assetRef)) {
        errors.push(`theme: target "${target.id}" uses sprite "${target.assetRef}" which is outside the concept's targetSprites`);
      }
    }
    for (const distractor of distractors) {
      if (distractor.assetRef && !allowedItems.has(distractor.assetRef)) {
        errors.push(`theme: distractor "${distractor.id}" uses sprite "${distractor.assetRef}" which is outside the concept's itemSprites`);
      }
    }
  }

  const difficulty = activity.metadata.difficulty;
  if (difficulty === "low" || difficulty === "medium") {
    const itemsByTarget = new Map<string, Array<{ id: string; assetRef: string }>>();
    for (const item of items as Array<{ id: string; targetId: string; assetRef?: string }>) {
      const group = itemsByTarget.get(item.targetId) ?? [];
      group.push({ id: item.id, assetRef: item.assetRef ?? "" });
      itemsByTarget.set(item.targetId, group);
    }
    for (const [targetId, group] of itemsByTarget) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (sameType(group[i]!.assetRef, group[j]!.assetRef)) {
            errors.push(
              `taxonomy: items "${group[i]!.id}" and "${group[j]!.id}" share target "${targetId}" ` +
              `but are the same sprite type — use different objects at ${difficulty} difficulty`
            );
          }
        }
      }
    }
  }

  const itemCount = items.length;
  if (difficulty === "low"    && (itemCount < 3 || itemCount > 4)) errors.push(`params: low difficulty expects 3–4 items, got ${itemCount}`);
  if (difficulty === "medium" && (itemCount < 5 || itemCount > 6)) errors.push(`params: medium difficulty expects 5–6 items, got ${itemCount}`);
  if (difficulty === "high"   && (itemCount < 6 || itemCount > 7)) errors.push(`params: high difficulty expects 6–7 items, got ${itemCount}`);

  const distractorCount = distractors.length;
  if (difficulty === "low"    && distractorCount !== 0) errors.push(`params: low difficulty expects 0 distractors, got ${distractorCount}`);
  if (difficulty === "medium" && distractorCount !== 0) errors.push(`params: medium difficulty expects 0 distractors, got ${distractorCount}`);
  if (difficulty === "high"   && distractorCount !== 2) errors.push(`params: high difficulty expects 2 distractors, got ${distractorCount}`);
}

function validateTapToSelect(
  activity: ActivityJSON,
  concept: ConceptBrief | undefined,
  errors: string[]
) {
  const correctItems = (activity.filledSlots["correctItems"] ?? []) as Array<{ id: string; assetRef?: string }>;
  const distractors  = (activity.filledSlots["distractors"]  ?? []) as Array<{ id: string; assetRef?: string }>;
  const difficulty   = activity.metadata.difficulty;

  if (concept) {
    const allowedItems = new Set(concept.itemSprites.map((s) => `sprites/${s}`));
    for (const item of [...correctItems, ...distractors]) {
      if (item.assetRef && !allowedItems.has(item.assetRef)) {
        errors.push(`theme: "${item.id}" uses sprite "${item.assetRef}" which is outside the concept's itemSprites`);
      }
    }
  }

  // No duplicate assetRefs
  const refs = [...correctItems, ...distractors].map((i) => i.assetRef).filter(Boolean);
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref!)) errors.push(`slot: assetRef "${ref}" appears more than once across correctItems and distractors`);
    seen.add(ref!);
  }

  const correctCount    = correctItems.length;
  const distractorCount = distractors.length;

  if (difficulty === "low"    && correctCount !== 1) errors.push(`params: low difficulty expects 1 correct item, got ${correctCount}`);
  if (difficulty === "medium" && correctCount !== 2) errors.push(`params: medium difficulty expects 2 correct items, got ${correctCount}`);
  if (difficulty === "high"   && correctCount !== 3) errors.push(`params: high difficulty expects 3 correct items, got ${correctCount}`);

  if (difficulty === "low"    && distractorCount !== 3) errors.push(`params: low difficulty expects 3 distractors, got ${distractorCount}`);
  if (difficulty === "medium" && distractorCount !== 4) errors.push(`params: medium difficulty expects 4 distractors, got ${distractorCount}`);
  if (difficulty === "high"   && distractorCount !== 3) errors.push(`params: high difficulty expects 3 distractors, got ${distractorCount}`);
}

function collectAssetRefs(activity: ActivityJSON): string[] {
  const refs: string[] = [];

  const slotKeys = ["items", "targets", "distractors", "correctItems"];
  for (const key of slotKeys) {
    const slots = Array.isArray(activity.filledSlots[key])
      ? activity.filledSlots[key] as Array<{ assetRef?: string }>
      : [];
    for (const slot of slots) {
      if (slot.assetRef) refs.push(slot.assetRef);
    }
  }

  return refs;
}
