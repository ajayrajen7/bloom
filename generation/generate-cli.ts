#!/usr/bin/env tsx
/**
 * Generation pipeline CLI.
 * Usage: pnpm generate <concept-id> --theme-id <theme-id>
 *
 * Runs: prompt → validate → LLM review → stage → print preview path.
 * Manual review happens separately via: pnpm review
 */

import Anthropic from "@anthropic-ai/sdk";
import { getConceptBrief } from "../concepts/loader.js";
import { getDivisionById } from "../framework/loader.js";
import { getMechanicSpec } from "../mechanics/loader.js";
import { runGenerationPrompt } from "./pipeline/prompt.js";
import { runTapToSelectPrompt } from "./pipeline/prompt-tap-to-select.js";
import { validateActivity } from "./pipeline/validate.js";
import { runLLMReview } from "./pipeline/llm-review.js";
import { stageActivity } from "./pipeline/stage.js";
import { ActivityJSONSchema, ThemeSpecSchema } from "shared/types.js";
import { resolveThemeSpec } from "shared/theme-catalog.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --env-file doesn't override existing env vars (Claude Code sets ANTHROPIC_API_KEY to a proxy).
// Read .env.local explicitly and apply it.
function loadEnvLocal() {
  const envPath = join(__dirname, "../.env.local");
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch {
    // .env.local is optional
  }
}
loadEnvLocal();

const args = process.argv.slice(2);
const themeFlagIndex = args.indexOf("--theme-id");
const themeId = themeFlagIndex >= 0 ? args[themeFlagIndex + 1] : undefined;
const positionals = args.filter((_, index) =>
  themeFlagIndex < 0 || (index !== themeFlagIndex && index !== themeFlagIndex + 1)
);
const conceptId = positionals[0];
if (
  positionals.length !== 1 || !conceptId || conceptId.startsWith("--") ||
  !themeId || !ThemeSpecSchema.shape.id.safeParse(themeId).success
) {
  console.error("Usage: pnpm generate <concept-id> --theme-id <theme-id>");
  process.exit(1);
}
const selectedThemeId = ThemeSpecSchema.shape.id.parse(themeId);
try {
  resolveThemeSpec(selectedThemeId);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const client = new Anthropic();

async function main() {
  console.log(`\n── Generating activity for concept: ${conceptId} ──\n`);

  // ── Load inputs ─────────────────────────────────────────────────────────────
  const concept = getConceptBrief(conceptId);
  if (!concept) {
    console.error(`Concept not found: ${conceptId}`);
    process.exit(1);
  }

  const division = getDivisionById(concept.targetDivisionId);
  if (!division) {
    console.error(`Division not found: ${concept.targetDivisionId}`);
    process.exit(1);
  }

  const mechanic = getMechanicSpec(concept.mechanicId);
  if (!mechanic) {
    console.error(`Mechanic not found: ${concept.mechanicId}`);
    process.exit(1);
  }

  // ── Stage 1: Prompt ──────────────────────────────────────────────────────────
  console.log("1/4  Calling Claude (generation)…");
  const promptResult = concept.mechanicId === "tap-to-select"
    ? await runTapToSelectPrompt(concept, division, client, selectedThemeId)
    : await runGenerationPrompt(concept, division, mechanic, client, selectedThemeId);
  console.log(`     tokens: ${promptResult.tokensUsed.input} in / ${promptResult.tokensUsed.output} out`);

  // ── Stage 2: Validate ────────────────────────────────────────────────────────
  console.log("2/4  Validating…");
  const validation = validateActivity(promptResult.activity, concept);
  if (!validation.passed) {
    console.error("     Validation failed:");
    validation.errors.forEach((e) => console.error(`     • ${e}`));
    process.exit(1);
  }
  console.log("     Passed.");

  const activity = ActivityJSONSchema.parse(promptResult.activity);

  // ── Stage 3: LLM Review ──────────────────────────────────────────────────────
  console.log("3/4  Calling Claude (review)…");
  const review = await runLLMReview(activity, concept, division, client);
  const score = (review.response.score * 100).toFixed(0);
  console.log(`     Score: ${score}/100  (threshold: 85)`);
  console.log(`     Notes: ${review.response.notes}`);

  if (!review.response.passed) {
    console.error(`     LLM review failed: ${review.response.rejectReason}`);
    process.exit(1);
  }

  // Attach review results to activity
  const reviewed = {
    ...activity,
    metadata: {
      ...activity.metadata,
      reviewScore: review.response.score,
      reviewerNotes: review.response.notes,
    },
  };

  // ── Stage 4: Human review candidate ───────────────────────────────────────
  console.log("4/4  Staging for human review…");
  const staged = stageActivity(ActivityJSONSchema.parse(reviewed), review);
  console.log(`\n✓ Candidate staged: ${staged.activityPath}\n   Preview: ${staged.previewPath}\n`);
}

main().catch((err) => {
  console.error("\nGeneration failed:", err.message);
  process.exit(1);
});
