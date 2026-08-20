#!/usr/bin/env tsx
/**
 * Deterministically expands concepts/settings.yaml into the 30 V1.1
 * ConceptBriefs (BLOOM_V1.1_MVP_SPEC.md §2, §8 step 1). Per setting: 3
 * tap-one briefs (low/medium/high) + 2 find-all briefs (low/medium).
 *
 * Usage: pnpm expand-settings [--out <dir>]
 *
 * Writes to concepts/briefs-v1.1/ by default — deliberately NOT
 * concepts/briefs/, which concepts/loader.ts reads at runtime. Cutover
 * (archiving the V1 hand-authored briefs and promoting these into
 * concepts/briefs/) happens once the M7 asset manifest exists to fill in
 * real itemSprites values — see BLOOM_V1_IMPLEMENTATION.md M7/M8. Until
 * then, itemSprites here are placeholder filenames following the manifest
 * naming convention (`{setting}_{object}.png`) and do not resolve on disk;
 * that's expected — nothing runs these through the generation pipeline yet.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { ConceptBriefSchema, type ConceptBrief } from "shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, "settings.yaml");
const DEFAULT_OUT_DIR = join(__dirname, "briefs-v1.1");

interface SettingDef {
  introLine: string;
  objects: string[];
}

interface SettingsFile {
  settings: Record<string, SettingDef>;
}

// V1.1 spec §3, difficulty parameter table — used only to write a human-readable
// note onto each brief (design content for the M8 prompt work, not consumed by
// the pipeline). itemCount/targetCount here mirror the spec table for reference.
const TAP_ONE_NOTES: Record<string, string> = {
  low: "tap-one, low: 3 items, 1 target, distractors from a different category, min element size 120pt.",
  medium: "tap-one, medium: 5 items, 1 target, distractors from the same category, min element size 100pt.",
  high: "tap-one, high: 7 items, 1 target, distractors = same object/different attribute, min element size 90pt.",
};

const FIND_ALL_NOTES: Record<string, string> = {
  low: "find-all, low: 5 items, 2 targets, attribute = color (obvious), min element size 110pt.",
  medium: "find-all, medium: 7 items, 3 targets, attribute = color or size (closer), min element size 95pt.",
};

export function loadSettings(settingsPath: string = SETTINGS_FILE): SettingsFile {
  const raw = readFileSync(settingsPath, "utf-8");
  return yaml.load(raw) as SettingsFile;
}

export function expandSettings(settingsPath: string = SETTINGS_FILE): ConceptBrief[] {
  const { settings } = loadSettings(settingsPath);
  const briefs: ConceptBrief[] = [];

  for (const [setting, def] of Object.entries(settings)) {
    const itemSprites = def.objects.map((o) => `${setting}_${o}.png`);

    for (const difficulty of ["low", "medium", "high"] as const) {
      briefs.push(
        ConceptBriefSchema.parse({
          id: `concept_${setting}_tap_${difficulty}`,
          mechanicId: "tap-to-select",
          ageMonths: { min: 24, max: 36 },
          difficulty,
          themeHint: setting,
          targetDurationSeconds: 40,
          notes: TAP_ONE_NOTES[difficulty],
          itemSprites,
          targetSprites: [],
          setting,
        })
      );
    }

    for (const difficulty of ["low", "medium"] as const) {
      briefs.push(
        ConceptBriefSchema.parse({
          id: `concept_${setting}_findall_${difficulty}`,
          mechanicId: "find-all",
          ageMonths: { min: 24, max: 36 },
          difficulty,
          themeHint: setting,
          targetDurationSeconds: 40,
          notes: FIND_ALL_NOTES[difficulty],
          itemSprites,
          targetSprites: [],
          setting,
        })
      );
    }
  }

  return briefs;
}

function main() {
  const outArgIndex = process.argv.indexOf("--out");
  const outDir = outArgIndex !== -1 ? process.argv[outArgIndex + 1]! : DEFAULT_OUT_DIR;

  const briefs = expandSettings();
  mkdirSync(outDir, { recursive: true });

  for (const brief of briefs) {
    writeFileSync(join(outDir, `${brief.id}.json`), JSON.stringify(brief, null, 2) + "\n");
  }

  console.log(`✓ Wrote ${briefs.length} briefs to ${outDir}`);
  console.log(`  (${Object.keys(loadSettings().settings).length} settings × 5 briefs: 3 tap-one + 2 find-all)`);
}

// Only run when invoked directly (`pnpm expand-settings`), not when imported by tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
