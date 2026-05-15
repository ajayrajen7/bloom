#!/usr/bin/env tsx
/**
 * CLI for authoring a new ConceptBrief.
 * Usage: pnpm new-concept
 *
 * Walks through prompts, validates the result, writes to concepts/briefs/<id>.json.
 */

import { createInterface } from "readline";
import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ConceptBriefSchema, type ConceptBrief } from "shared/types.js";
import { listDivisions } from "../framework/loader.js";
import { listMechanicSpecs } from "../mechanics/loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function askRequired(question: string): Promise<string> {
  return new Promise((resolve) => {
    const retry = () => {
      rl.question(question, (answer) => {
        if (answer.trim()) resolve(answer.trim());
        else { console.log("  (required)"); retry(); }
      });
    };
    retry();
  });
}

async function main() {
  console.log("\n── New Concept Brief ──────────────────────────────────\n");

  // Show available divisions
  const divisions = listDivisions();
  console.log("Available divisions:");
  divisions.forEach((d) => console.log(`  ${d.id}  —  ${d.name}`));
  console.log();

  // Show available mechanics
  const mechanics = listMechanicSpecs();
  console.log("Available mechanics:");
  mechanics.forEach((m) => console.log(`  ${m.id}  —  ${m.name}`));
  console.log();

  // Collect fields
  const targetDivisionId = await askRequired("Target division id: ");
  if (!divisions.find((d) => d.id === targetDivisionId)) {
    console.error(`Unknown division: ${targetDivisionId}`);
    process.exit(1);
  }

  const secondaryRaw = await ask("Secondary division id (optional, press Enter to skip): ");
  const secondaryDivisionId = secondaryRaw || undefined;

  const difficulty = await askRequired("Difficulty (low / medium / high): ") as ConceptBrief["difficulty"];
  if (!["low", "medium", "high"].includes(difficulty)) {
    console.error("Difficulty must be low, medium, or high.");
    process.exit(1);
  }

  const themeHint = await askRequired("Theme hint (e.g. 'fruits and baskets'): ");
  const targetDurationStr = await askRequired("Target duration in seconds (e.g. 45): ");
  const targetDurationSeconds = parseInt(targetDurationStr, 10);
  if (isNaN(targetDurationSeconds) || targetDurationSeconds <= 0) {
    console.error("Duration must be a positive number.");
    process.exit(1);
  }

  const notes = await ask("Notes for generation (optional): ");

  // Generate id
  const timestamp = Date.now();
  const id = `concept_${timestamp}`;

  const brief: ConceptBrief = ConceptBriefSchema.parse({
    id,
    targetDivisionId,
    ...(secondaryDivisionId ? { secondaryDivisionId } : {}),
    ageMonths: { min: 24, max: 36 },
    difficulty,
    themeHint,
    targetDurationSeconds,
    ...(notes ? { notes } : {}),
  });

  const outPath = join(__dirname, "briefs", `${id}.json`);
  if (existsSync(outPath)) {
    console.error(`File already exists: ${outPath}`);
    process.exit(1);
  }

  writeFileSync(outPath, JSON.stringify(brief, null, 2) + "\n");

  console.log(`\n✓ Saved: concepts/briefs/${id}.json`);
  console.log("\nPreview:");
  console.log(JSON.stringify(brief, null, 2));
  console.log("\nRun  pnpm generate", id, " to generate an activity from this brief.\n");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
