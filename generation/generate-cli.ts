#!/usr/bin/env tsx
/**
 * Generation pipeline CLI.
 * Usage: pnpm generate <concept-id>
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
import { approveActivityDirect } from "./pipeline/store.js";
import { ActivityJSONSchema } from "shared/types.js";
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

const conceptId = process.argv[2];
if (!conceptId) {
  console.error("Usage: pnpm generate <concept-id>");
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
    ? await runTapToSelectPrompt(concept, division, client)
    : await runGenerationPrompt(concept, division, mechanic, client);
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

  // ── Stage 4: Auto-approve ────────────────────────────────────────────────────
  console.log("4/4  Approving…");
  const approved = approveActivityDirect(ActivityJSONSchema.parse(reviewed));
  console.log(`\n✓ Done. Activity live: library/activities/${approved.id}.json\n`);
}

main().catch((err) => {
  console.error("\nGeneration failed:", err.message);
  process.exit(1);
});
