/**
 * Integration test: full generation pipeline with mocked LLM calls.
 *
 * Tests real validate + stage logic end-to-end.
 * No real API calls — safe to run in CI.
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "fs";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { stageActivity, STAGED_DIR, REVIEW_UI_DIR } from "../../generation/pipeline/stage.js";
import { assembleLLMOutput } from "../../generation/pipeline/prompt.js";
import {
  ActivityJSONSchema,
  LLMGenerationOutputSchema,
  type ActivityJSON,
  type ConceptBrief,
  type LLMGenerationOutput,
} from "shared/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixture ───────────────────────────────────────────────────────────────────

const validActivity: ActivityJSON = ActivityJSONSchema.parse({
  id: "act_integration_test",
  conceptId: "concept_001",
  mechanicId: "drag-to-target",
  generatedAt: "2026-05-08T10:00:00.000Z",
  filledSlots: {
    items: [
      { id: "apple_1",  targetId: "fruit_basket",  label: "Apple",  assetRef: "sprites/apple.png" },
      { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange.png" },
      { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana.png" },
    ],
    targets: [
      { id: "fruit_basket",  label: "Fruit Basket",  assetRef: "sprites/fruit-basket.png" },
      { id: "banana_basket", label: "Banana Basket", assetRef: "sprites/banana-basket.png" },
    ],
    distractors: [],
  },
  parameters: { layoutId: "horizontal-standard", itemCount: 3, distractorCount: 0, visualSimilarity: "low" },
  prompt: { text: "Put the fruits in the baskets!", audioRef: "audio/prompts/PLACEHOLDER.mp3" },
  audioRefs: {
    successSfx: "audio/sfx/success_bright.mp3",
    errorSfx: "audio/sfx/try_again.mp3",
    completionSfx: "audio/sfx/celebration.mp3",
  },
  metadata: {
    targetDivisionId: "fine_motor.pincer_grip",
    ageMonths: { min: 24, max: 36 },
    difficulty: "low",
    targetDurationSeconds: 40,
    reviewScore: 0.92,
    reviewerNotes: "Clear, familiar objects. Good prompt.",
  },
});

const mockReviewResult = {
  response: {
    score: 0.92,
    dimensionScores: { ageAppropriateness: 24, onBrief: 23, safetyAndQuality: 23, engagement: 22 },
    passed: true,
    notes: "Clear familiar objects. Good prompt length.",
    rejectReason: null,
  },
  reviewVersion: "v1",
  tokensUsed: { input: 500, output: 200 },
};

// ── Cleanup test artifacts ────────────────────────────────────────────────────

afterEach(() => {
  const stagedJson = join(STAGED_DIR, "act_integration_test.json");
  const previewHtml = join(REVIEW_UI_DIR, "act_integration_test.html");
  if (existsSync(stagedJson))  rmSync(stagedJson);
  if (existsSync(previewHtml)) rmSync(previewHtml);
});

// ── validateActivity ──────────────────────────────────────────────────────────

describe("validateActivity", () => {
  it("passes a valid activity", () => {
    const result = validateActivity(validActivity);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when an item references a missing targetId", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",  targetId: "ghost_basket",  label: "Apple",  assetRef: "sprites/apple.png" },
          { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange.png" },
          { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana.png" },
        ],
      },
    };
    const result = validateActivity(broken);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("ghost_basket"))).toBe(true);
  });

  it("fails when item count does not match difficulty", () => {
    const broken = {
      ...validActivity,
      metadata: { ...validActivity.metadata, difficulty: "medium" as const },
    };
    const result = validateActivity(broken);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("medium difficulty"))).toBe(true);
  });

  it("fails when same-type sprites share a target at low difficulty", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",     targetId: "apple_basket",  label: "Apple",    assetRef: "sprites/apple.png" },
          { id: "redapple_1",  targetId: "apple_basket",  label: "Red Apple", assetRef: "sprites/red-apple.png" },
          { id: "banana_1",    targetId: "banana_basket", label: "Banana",   assetRef: "sprites/banana.png" },
        ],
      },
    };
    const result = validateActivity(broken);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("taxonomy"))).toBe(true);
  });

  it("fails when prompt text is too long", () => {
    const broken = {
      ...validActivity,
      prompt: {
        ...validActivity.prompt,
        text: "Can you carefully put all of the fruits into the correct baskets right now please?",
      },
    };
    const result = validateActivity(broken);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("words"))).toBe(true);
  });

  it("fails schema validation for non-datetime generatedAt", () => {
    const result = validateActivity({ ...validActivity, generatedAt: "not-a-date" });
    expect(result.passed).toBe(false);
  });

  it("fails when referenced sprite asset does not exist", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",  targetId: "fruit_basket",  label: "Apple",  assetRef: "sprites/nonexistent-fruit.png" },
          { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange.png" },
          { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana.png" },
        ],
      },
    };
    const result = validateActivity(broken);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("nonexistent-fruit.png"))).toBe(true);
  });
});

// ── LLM-pipeline boundary test ────────────────────────────────────────────────

describe("generation prompt boundary", () => {
  it("v3 template contains slim input placeholders and no raw-object placeholders", () => {
    const promptPath = join(__dirname, "../../generation/prompts/generate-drag-to-target.v5.txt");
    const template = readFileSync(promptPath, "utf-8");

    // Required slim placeholders
    expect(template).toContain("{{ITEM_COUNT}}");
    expect(template).toContain("{{TARGET_COUNT}}");
    expect(template).toContain("{{THEME_HINT}}");
    expect(template).toContain("{{DIVISION_NAME}}");
    expect(template).toContain("{{SPRITE_TAXONOMY}}");

    // Banned raw-object injection — these belong in the pipeline, not the prompt
    expect(template).not.toContain("{{CONCEPT_BRIEF}}");
    expect(template).not.toContain("{{DIVISION}}");
    expect(template).not.toContain("{{MECHANIC_SPEC}}");
  });
});

// ── Assembly correctness test ─────────────────────────────────────────────────

describe("assembleLLMOutput", () => {
  const mockConcept: ConceptBrief = {
    id: "concept_001",
    targetDivisionId: "fine_motor.pincer_grip",
    ageMonths: { min: 24, max: 36 },
    difficulty: "low",
    themeHint: "fruits and baskets",
    targetDurationSeconds: 40,
  };

  const mockLLMOutput: LLMGenerationOutput = LLMGenerationOutputSchema.parse({
    filledSlots: {
      items: [
        { id: "apple_1",     targetId: "red_basket",    label: "Apple",  assetRef: "sprites/apple.png" },
        { id: "redapple_1",  targetId: "red_basket",    label: "Apple",  assetRef: "sprites/red-apple.png" },
        { id: "banana_1",    targetId: "yellow_basket", label: "Banana", assetRef: "sprites/banana.png" },
      ],
      targets: [
        { id: "red_basket",    label: "Red Basket",    assetRef: "sprites/fruit-basket.png" },
        { id: "yellow_basket", label: "Yellow Basket", assetRef: "sprites/wicker-basket.png" },
      ],
      distractors: [],
    },
    prompt: { text: "Put the fruits in the baskets!" },
  });

  it("produces a valid ActivityJSON with all deterministic fields set by the pipeline", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3);
    expect(() => ActivityJSONSchema.parse(activity)).not.toThrow();
  });

  it("sets conceptId, mechanicId, and layoutId from pipeline — not from LLM output", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3);
    expect(activity.conceptId).toBe("concept_001");
    expect(activity.mechanicId).toBe("drag-to-target");
    expect((activity.parameters as Record<string, unknown>)["layoutId"]).toBe("horizontal-standard");
  });

  it("carries LLM filledSlots and prompt.text through unchanged", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3);
    const items = (activity.filledSlots as Record<string, unknown[]>)["items"] as Array<{ id: string }>;
    expect(items).toHaveLength(3);
    expect(items[0]!.id).toBe("apple_1");
    expect(activity.prompt.text).toBe("Put the fruits in the baskets!");
  });

  it("sets metadata from ConceptBrief, not from LLM output", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3);
    expect(activity.metadata.difficulty).toBe("low");
    expect(activity.metadata.targetDivisionId).toBe("fine_motor.pincer_grip");
    expect(activity.metadata.targetDurationSeconds).toBe(40);
    expect(activity.metadata.reviewScore).toBe(0);
  });
});

// ── stageActivity ─────────────────────────────────────────────────────────────

describe("stageActivity", () => {
  it("writes staged JSON and HTML preview files", () => {
    const { activityPath, previewPath } = stageActivity(validActivity, mockReviewResult);
    expect(existsSync(activityPath)).toBe(true);
    expect(existsSync(previewPath)).toBe(true);
  });

  it("staged JSON parses back to a valid ActivityJSON", () => {
    const { activityPath } = stageActivity(validActivity, mockReviewResult);
    const { readFileSync } = require("fs");
    const parsed = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf-8")));
    expect(parsed.id).toBe("act_integration_test");
    expect(parsed.metadata.reviewScore).toBe(0.92);
  });

  it("preview HTML contains score and activity id", () => {
    const { previewPath } = stageActivity(validActivity, mockReviewResult);
    const { readFileSync } = require("fs");
    const html = readFileSync(previewPath, "utf-8") as string;
    expect(html).toContain("act_integration_test");
    expect(html).toContain("92");
    expect(html).toContain("Put the fruits in the baskets!");
  });
});
