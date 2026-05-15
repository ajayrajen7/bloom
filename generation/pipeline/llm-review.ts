import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ActivityJSON, ConceptBrief, Division } from "shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REVIEW_VERSION = "v2";
const REVIEW_FILE = join(__dirname, "../prompts", `review.${REVIEW_VERSION}.txt`);

export const REVIEW_PASS_THRESHOLD = 0.85;

const ReviewResponseSchema = z.object({
  score: z.number().min(0).max(1),
  dimensionScores: z.object({
    ageAppropriateness: z.number().min(0).max(25),
    onBrief: z.number().min(0).max(25),
    safetyAndQuality: z.number().min(0).max(25),
    engagement: z.number().min(0).max(25),
  }),
  passed: z.boolean(),
  notes: z.string(),
  rejectReason: z.string().nullable(),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

export interface LLMReviewResult {
  response: ReviewResponse;
  reviewVersion: string;
  tokensUsed: { input: number; output: number };
}

export async function runLLMReview(
  activity: ActivityJSON,
  concept: ConceptBrief,
  division: Division,
  client: Anthropic
): Promise<LLMReviewResult> {
  const template = readFileSync(REVIEW_FILE, "utf-8");

  const filled = template
    .replace("{{ACTIVITY_JSON}}", JSON.stringify(activity, null, 2))
    .replace("{{CONCEPT_BRIEF}}", JSON.stringify(concept, null, 2))
    .replace("{{DIVISION}}", JSON.stringify(division, null, 2));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: filled }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonStr = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`LLM review returned non-JSON output:\n${raw}`);
  }

  const reviewResponse = ReviewResponseSchema.parse(parsed);

  // Enforce threshold consistency — don't trust the model's own passed field
  reviewResponse.passed = reviewResponse.score >= REVIEW_PASS_THRESHOLD;

  return {
    response: reviewResponse,
    reviewVersion: REVIEW_VERSION,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}
