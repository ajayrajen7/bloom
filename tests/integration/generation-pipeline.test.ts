/**
 * Integration test: full generation pipeline with mocked LLM calls.
 *
 * Tests real validate + stage logic end-to-end.
 * No real API calls — safe to run in CI.
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import { validateActivity } from "../../generation/pipeline/validate.js";
import { buildApprovedIndex, regenerateActivityIndex } from "../../generation/pipeline/store.js";
import { stageActivity, STAGED_DIR, REVIEW_UI_DIR } from "../../generation/pipeline/stage.js";
import { assembleLLMOutput } from "../../generation/pipeline/prompt.js";
import { assembleTapToSelectOutput } from "../../generation/pipeline/prompt-tap-to-select.js";
import {
  ActivityJSONSchema,
  LLMGenerationOutputSchema,
  type ActivityJSON,
  type ConceptBrief,
  type LLMGenerationOutput,
} from "shared/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getLayoutVariant } from "../../mechanics/loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Concept fixture ───────────────────────────────────────────────────────────

const testConcept: ConceptBrief = {
  id: "concept_001",
  mechanicId: "drag-to-target",
  targetDivisionId: "fine_motor.pincer_grip",
  ageMonths: { min: 24, max: 36 },
  difficulty: "low",
  themeHint: "fruits and baskets",
  targetDurationSeconds: 40,
  itemSprites: ["apple-red-v1.png", "banana-v1.png", "orange-v1.png"],
  targetSprites: ["apple-green-v1.png", "carrot-v1.png", "broccoli-v1.png"],
};

// ── Fixture ───────────────────────────────────────────────────────────────────

const validActivity: ActivityJSON = ActivityJSONSchema.parse({
  id: "act_integration_test",
  conceptId: "concept_001",
  mechanicId: "drag-to-target",
  themeId: "kitchen-v1",
  generatedAt: "2026-05-08T10:00:00.000Z",
  filledSlots: {
    items: [
      { id: "apple_1",  targetId: "fruit_basket",  label: "Apple",  assetRef: "sprites/apple-red-v1.png" },
      { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange-v1.png" },
      { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana-v1.png" },
    ],
    targets: [
      { id: "fruit_basket",  label: "Fruit Basket",  assetRef: "sprites/broccoli-v1.png" },
      { id: "banana_basket", label: "Banana Basket", assetRef: "sprites/carrot-v1.png" },
    ],
    distractors: [],
  },
  parameters: { layoutId: "horizontal-standard", layout: getLayoutVariant("drag-to-target", "horizontal-standard"), itemCount: 3, distractorCount: 0, visualSimilarity: "low" },
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
  it("requires a theme from the known catalog", () => {
    const unknown = validateActivity({ ...validActivity, themeId: "garden-v1" });
    expect(unknown.passed).toBe(false);
    expect(unknown.errors.join(" ")).toContain("Unknown activity theme ID");
  });

  it("rejects an absent or mismatched inlined layout", () => {
    const missing = { ...validActivity, parameters: { ...validActivity.parameters, layout: undefined } };
    expect(validateActivity(missing, testConcept).errors.join(" ")).toContain("inlined layout");
    const otherLayout = getLayoutVariant("drag-to-target", "horizontal-reversed")!;
    const mismatched = { ...validActivity, parameters: { ...validActivity.parameters, layout: otherLayout } };
    expect(validateActivity(mismatched, testConcept).errors.join(" ")).toContain("inlined layout");
  });

  it("rejects an existing sprite file absent from the runtime registry", () => {
    const unregistered = {
      ...validActivity,
      filledSlots: { ...validActivity.filledSlots, items: [
        { id: "legacy", targetId: "fruit_basket", assetRef: "sprites/apple.png" },
        ...(validActivity.filledSlots.items as unknown[]).slice(1),
      ] },
    };
    const result = validateActivity(unregistered);
    expect(result.passed).toBe(false);
    expect(result.errors.join(" ")).toContain("Unsupported sprite assetRef");
  });

  it("rejects an unresolved item sprite slot before publication", () => {
    const unresolved = { ...validActivity, filledSlots: { ...validActivity.filledSlots, items: [
      { id: "apple_1", targetId: "fruit_basket", label: "Apple" },
      ...(validActivity.filledSlots.items as unknown[]).slice(1),
    ] } };
    const result = validateActivity(unresolved);
    expect(result.passed).toBe(false);
    expect(result.errors.join(" ")).toContain("missing sprite assetRef");
  });
  it("passes a valid activity", () => {
    const result = validateActivity(validActivity, testConcept);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when an item references a missing targetId", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",  targetId: "ghost_basket",  label: "Apple",  assetRef: "sprites/apple-red-v1.png" },
          { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange-v1.png" },
          { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("ghost_basket"))).toBe(true);
  });

  it("fails when item count does not match difficulty", () => {
    const broken = {
      ...validActivity,
      metadata: { ...validActivity.metadata, difficulty: "medium" as const },
    };
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("medium difficulty"))).toBe(true);
  });

  it("fails when same-type sprites share a target at low difficulty", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",     targetId: "apple_basket",  label: "Apple",    assetRef: "sprites/apple-red-v1.png" },
          { id: "redapple_1",  targetId: "apple_basket",  label: "Red Apple", assetRef: "sprites/apple-green-v1.png" },
          { id: "banana_1",    targetId: "banana_basket", label: "Banana",   assetRef: "sprites/banana-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, testConcept);
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
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("words"))).toBe(true);
  });

  it("fails schema validation for non-datetime generatedAt", () => {
    const result = validateActivity({ ...validActivity, generatedAt: "not-a-date" }, testConcept);
    expect(result.passed).toBe(false);
  });

  it("fails when referenced sprite asset does not exist", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "apple_1",  targetId: "fruit_basket",  label: "Apple",  assetRef: "sprites/nonexistent-fruit.png" },
          { id: "orange_1", targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange-v1.png" },
          { id: "banana_1", targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("nonexistent-fruit.png"))).toBe(true);
  });
});

// ── Sprite-scope validation ───────────────────────────────────────────────────

describe("validateActivity — sprite scope", () => {
  it("passes when all item and target sprites are within the concept's defined sets", () => {
    const result = validateActivity(validActivity, testConcept);
    expect(result.passed).toBe(true);
  });

  it("fails when an item uses a sprite outside itemSprites", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        items: [
          { id: "duck_1",    targetId: "fruit_basket",  label: "Duck",   assetRef: "sprites/grapes-v1.png" },
          { id: "orange_1",  targetId: "fruit_basket",  label: "Orange", assetRef: "sprites/orange-v1.png" },
          { id: "banana_1",  targetId: "banana_basket", label: "Banana", assetRef: "sprites/banana-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("grapes-v1.png") && e.includes("theme"))).toBe(true);
  });

  it("fails when a target uses a sprite outside targetSprites", () => {
    const broken = {
      ...validActivity,
      filledSlots: {
        ...validActivity.filledSlots,
        targets: [
          { id: "fruit_basket",   label: "Fruit Basket",  assetRef: "sprites/broccoli-v1.png" },
          { id: "animal_basket",  label: "Animal Basket", assetRef: "sprites/tomato-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, testConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("tomato-v1.png") && e.includes("theme"))).toBe(true);
  });

  it("allows the same sprite in both itemSprites and targetSprites — valid for shape-matching", () => {
    const shapeConcept: ConceptBrief = {
      id: "concept_005",
      mechanicId: "drag-to-target",
      targetDivisionId: "fine_motor.pincer_grip",
      ageMonths: { min: 24, max: 36 },
      difficulty: "low",
      themeHint: "shapes and outlines",
      targetDurationSeconds: 40,
      itemSprites: ["apple-red-v1.png", "banana-v1.png", "orange-v1.png"],
      targetSprites: ["apple-red-v1.png", "banana-v1.png", "orange-v1.png"],
    };
    const shapeActivity = {
      ...validActivity,
      metadata: { ...validActivity.metadata, difficulty: "low" as const },
      filledSlots: {
        items: [
          { id: "circle_1",   targetId: "circle_target",   label: "Circle",   assetRef: "sprites/apple-red-v1.png" },
          { id: "square_1",   targetId: "square_target",   label: "Square",   assetRef: "sprites/banana-v1.png" },
          { id: "triangle_1", targetId: "triangle_target", label: "Triangle", assetRef: "sprites/orange-v1.png" },
        ],
        targets: [
          { id: "circle_target",   label: "Circle outline",   assetRef: "sprites/apple-red-v1.png" },
          { id: "square_target",   label: "Square outline",   assetRef: "sprites/banana-v1.png" },
          { id: "triangle_target", label: "Triangle outline", assetRef: "sprites/orange-v1.png" },
        ],
        distractors: [],
      },
    };
    const result = validateActivity(shapeActivity, shapeConcept);
    expect(result.errors.some((e) => e.includes("theme"))).toBe(false);
  });
});

// ── Distractor validation ─────────────────────────────────────────────────────

const mediumConcept: ConceptBrief = {
  id: "concept_002",
  mechanicId: "drag-to-target",
  targetDivisionId: "fine_motor.pincer_grip",
  ageMonths: { min: 24, max: 36 },
  difficulty: "medium",
  themeHint: "farm animals and their homes",
  targetDurationSeconds: 55,
  itemSprites: ["grapes-v1.png", "carrot-v1.png", "apple-red-v1.png", "tomato-v1.png", "orange-v1.png", "banana-v1.png", "broccoli-v1.png", "cucumber-v1.png"],
  targetSprites: ["broccoli-v1.png", "tomato-v1.png", "apple-green-v1.png"],
};

const validMediumActivity: ActivityJSON = ActivityJSONSchema.parse({
  id: "act_medium_test",
  conceptId: "concept_002",
  mechanicId: "drag-to-target",
  themeId: "kitchen-v1",
  generatedAt: "2026-05-15T10:00:00.000Z",
  filledSlots: {
    items: [
      { id: "cow_1",     targetId: "barn",  label: "Cow",     assetRef: "sprites/apple-red-v1.png" },
      { id: "horse_1",   targetId: "barn",  label: "Horse",   assetRef: "sprites/banana-v1.png" },
      { id: "duck_1",    targetId: "pond",  label: "Duck",    assetRef: "sprites/grapes-v1.png" },
      { id: "chicken_1", targetId: "coop",  label: "Chicken", assetRef: "sprites/carrot-v1.png" },
      { id: "sheep_1",   targetId: "barn",  label: "Sheep",   assetRef: "sprites/cucumber-v1.png" },
    ],
    targets: [
      { id: "barn", label: "Barn", assetRef: "sprites/broccoli-v1.png" },
      { id: "coop", label: "Coop", assetRef: "sprites/tomato-v1.png" },
      { id: "pond", label: "Pond", assetRef: "sprites/apple-green-v1.png" },
    ],
    distractors: [
      { id: "cat_1", label: "Cat", assetRef: "sprites/grapes-v1.png" },
    ],
  },
  parameters: { layoutId: "horizontal-standard", layout: getLayoutVariant("drag-to-target", "horizontal-standard"), itemCount: 5, distractorCount: 1, visualSimilarity: "medium" },
  prompt: { text: "Help the animals find their homes!", audioRef: "audio/prompts/PLACEHOLDER.mp3" },
  audioRefs: {
    successSfx: "audio/sfx/success_bright.mp3",
    errorSfx: "audio/sfx/try_again.mp3",
    completionSfx: "audio/sfx/celebration.mp3",
  },
  metadata: {
    targetDivisionId: "fine_motor.pincer_grip",
    ageMonths: { min: 24, max: 36 },
    difficulty: "medium",
    targetDurationSeconds: 55,
    reviewScore: 0,
    reviewerNotes: "",
  },
});

describe("validateActivity — medium drag mappings", () => {
  const matching = {
    ...validMediumActivity,
    filledSlots: {
      items: ["apple-red", "banana", "grapes", "carrot", "cucumber"].map((name, index) => ({
        id: `item_${index}`, targetId: `target_${index}`, label: name, assetRef: `sprites/${name}-v1.png`,
      })),
      targets: ["apple-red", "banana", "grapes", "carrot", "cucumber"].map((name, index) => ({
        id: `target_${index}`, label: name, assetRef: `sprites/${name}-v1.png`,
      })),
      distractors: [],
    },
    parameters: { layoutId: "horizontal-six-pairs", layout: getLayoutVariant("drag-to-target", "horizontal-six-pairs"), itemCount: 5, distractorCount: 0 },
  };

  it("accepts five one-to-one pairs with no ignored distractor", () => {
    expect(validateActivity(matching, mediumConcept).errors).toEqual([]);
  });

  it("rejects a repeated matching target", () => {
    const items = structuredClone(matching.filledSlots.items);
    items[1]!.targetId = items[0]!.targetId;
    expect(validateActivity({ ...matching, filledSlots: { ...matching.filledSlots, items } }, mediumConcept).errors.join(" ")).toContain("one-to-one");
  });

  it("rejects duplicate pictures assigned to different matching pairs", () => {
    const duplicated = structuredClone(matching);
    duplicated.filledSlots.items[1]!.assetRef = duplicated.filledSlots.items[0]!.assetRef;
    duplicated.filledSlots.targets[1]!.assetRef = duplicated.filledSlots.targets[0]!.assetRef;
    expect(validateActivity(duplicated, mediumConcept).errors.join(" ")).toContain("duplicate matching picture");
  });

  it("rejects a medium distractor because the runtime does not render it", () => {
    expect(validateActivity(validMediumActivity, mediumConcept).errors.join(" ")).toContain("distractor");
  });

  it("accepts two capacity-three bins with exactly three mapped items each", () => {
    const sorted = {
      ...matching,
      filledSlots: {
        items: [
          ["apple-red", "fruit"], ["banana", "fruit"], ["grapes", "fruit"],
          ["carrot", "vegetables"], ["cucumber", "vegetables"], ["tomato", "vegetables"],
        ].map(([name, targetId], index) => ({ id: `item_${index}`, targetId, label: name, assetRef: `sprites/${name}-v1.png` })),
        targets: [
          { id: "fruit", label: "Fruit", assetRef: "sprites/apple-red-v1.png", capacity: 3 },
          { id: "vegetables", label: "Vegetables", assetRef: "sprites/carrot-v1.png", capacity: 3 },
        ], distractors: [],
      },
      parameters: { layoutId: "horizontal-category-sort", layout: getLayoutVariant("drag-to-target", "horizontal-category-sort"), itemCount: 6, distractorCount: 0 },
    };
    expect(validateActivity(sorted, mediumConcept).errors).toEqual([]);
    const fourFruit = structuredClone(sorted);
    fourFruit.filledSlots.items[5]!.targetId = "fruit";
    expect(validateActivity(fourFruit, mediumConcept).errors.join(" ")).toContain("exactly 3");
  });

  it("fails when a distractor uses a sprite outside the concept's itemSprites", () => {
    const broken = {
      ...validMediumActivity,
      filledSlots: {
        ...validMediumActivity.filledSlots,
        distractors: [
          { id: "apple_1", label: "Apple", assetRef: "sprites/apple-green-v1.png" },
        ],
      },
    };
    const result = validateActivity(broken, mediumConcept);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("apple-green-v1.png") && e.includes("theme"))).toBe(true);
  });
});

// ── LLM-pipeline boundary test ────────────────────────────────────────────────

describe("generation prompt boundary", () => {
  it("v10 template contains slim input placeholders and no raw-object placeholders", () => {
    const promptPath = join(__dirname, "../../generation/prompts/generate-drag-to-target.v10.txt");
    const template = readFileSync(promptPath, "utf-8");

    // Required slim placeholders
    expect(template).toContain("{{ITEM_COUNT}}");
    expect(template).toContain("{{TARGET_COUNT}}");
    expect(template).toContain("{{DISTRACTOR_COUNT}}");
    expect(template).toContain("{{THEME_HINT}}");
    expect(template).toContain("{{DIVISION_NAME}}");
    expect(template).toContain("{{SPRITE_TAXONOMY}}");
    expect(template).toContain("{{NOTES}}");

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
    mechanicId: "drag-to-target",
    targetDivisionId: "fine_motor.pincer_grip",
    ageMonths: { min: 24, max: 36 },
    difficulty: "low",
    themeHint: "fruits and baskets",
    targetDurationSeconds: 40,
    itemSprites: ["apple.png", "banana.png", "orange.png"],
    targetSprites: ["apple-basket.png", "banana-basket.png", "fruit-basket.png"],
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
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3, "kitchen-v1");
    expect(() => ActivityJSONSchema.parse(activity)).not.toThrow();
    expect((activity.parameters.layout as { id: string })?.id).toBe("horizontal-standard");
  });

  it("sets conceptId, mechanicId, and layoutId from pipeline — not from LLM output", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3, "kitchen-v1");
    expect(activity.conceptId).toBe("concept_001");
    expect(activity.mechanicId).toBe("drag-to-target");
    expect((activity.parameters as Record<string, unknown>)["layoutId"]).toBe("horizontal-standard");
  });

  it("carries LLM filledSlots and prompt.text through unchanged", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3, "kitchen-v1");
    const items = (activity.filledSlots as Record<string, unknown[]>)["items"] as Array<{ id: string }>;
    expect(items).toHaveLength(3);
    expect(items[0]!.id).toBe("apple_1");
    expect(activity.prompt.text).toBe("Put the fruits in the baskets!");
  });

  it("sets metadata from ConceptBrief, not from LLM output", () => {
    const activity = assembleLLMOutput(mockLLMOutput, mockConcept, 3, "kitchen-v1");
    expect(activity.metadata.difficulty).toBe("low");
    expect(activity.metadata.targetDivisionId).toBe("fine_motor.pincer_grip");
    expect(activity.metadata.targetDurationSeconds).toBe(40);
    expect(activity.metadata.reviewScore).toBe(0);
  });

  it("sets distractorCount in parameters from actual LLM output length, not hardcoded 0", () => {
    const withDistractor: LLMGenerationOutput = LLMGenerationOutputSchema.parse({
      ...mockLLMOutput,
      filledSlots: {
        ...mockLLMOutput.filledSlots,
        distractors: [{ id: "lemon_1", label: "Lemon", assetRef: "sprites/orange.png" }],
      },
    });
    const activity = assembleLLMOutput(withDistractor, mockConcept, 3, "kitchen-v1");
    expect((activity.parameters as Record<string, unknown>)["distractorCount"]).toBe(1);
  });

  it("uses explicit theme selection even when content hints and LLM data differ", () => {
    const llmOutput = LLMGenerationOutputSchema.parse({ ...mockLLMOutput, themeId: "garden-v1" });
    const activity = assembleLLMOutput(llmOutput, { ...mockConcept, themeHint: "garden" }, 3, "kitchen-v1");
    expect(activity.themeId).toBe("kitchen-v1");
  });

  it("rejects an unknown explicit theme at composition", () => {
    expect(() => assembleLLMOutput(mockLLMOutput, mockConcept, 3, "garden-v1"))
      .toThrow("Unknown activity theme ID");
  });
});

describe("assembleTapToSelectOutput", () => {
  it("rejects an unknown explicit theme at composition", () => {
    const llmOutput = { filledSlots: { correctItems: [], distractors: [] }, prompt: { text: "Find it!" } };
    expect(() => assembleTapToSelectOutput(llmOutput, { ...testConcept, mechanicId: "tap-to-select" }, 1, 3, "garden-v1"))
      .toThrow("Unknown activity theme ID");
  });
  it("uses the caller's explicit theme ID", () => {
    const llmOutput = {
      filledSlots: {
        correctItems: [{ id: "apple", label: "Apple", assetRef: "sprites/apple-red-v1.png" }],
        distractors: [{ id: "banana", label: "Banana", assetRef: "sprites/banana-v1.png" }],
      },
      prompt: { text: "Find the apple!" },
    };
    const activity = assembleTapToSelectOutput(llmOutput, { ...testConcept, mechanicId: "tap-to-select", themeHint: "picnic" }, 1, 1, "kitchen-v1");
    expect(activity.themeId).toBe("kitchen-v1");
    expect(ActivityJSONSchema.parse(activity).themeId).toBe("kitchen-v1");
  });
});

describe("generation CLI arguments", () => {
  it("rejects an unknown explicit theme before loading the concept or provider", () => {
    const result = spawnSync(process.execPath,
      ["--import", "tsx/esm", "generation/generate-cli.ts", "missing-concept", "--theme-id", "garden-v1"],
      { cwd: join(__dirname, "../.."), encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "test" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown activity theme ID");
  });
  it("requires --theme-id before loading a concept or calling the provider", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx/esm", "generation/generate-cli.ts", "missing-concept"],
      { cwd: join(__dirname, "../.."), encoding: "utf-8", env: { ...process.env, ANTHROPIC_API_KEY: "test" } }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--theme-id");
  });
});

describe("active index", () => {
  it("enforces the stored concept's sprite scope", () => {
    const human = { ...validActivity, metadata: { ...validActivity.metadata, humanApprovedAt: "2026-09-29T00:00:00.000Z", humanApprover: "ajay" } };
    expect(buildApprovedIndex([human]).activities).toEqual([]);
  });
  it("includes only valid explicit human approvals", () => {
    const human = { ...validActivity, metadata: { ...validActivity.metadata, humanApprovedAt: "2026-09-29T00:00:00.000Z", humanApprover: "ajay" } };
    const automatic = { ...human, metadata: { ...human.metadata, humanApprover: "pipeline-auto" } };
    const unknownTheme = { ...human, themeId: "garden-v1" };
    const unknownConcept = { ...human, id: "unknown_concept", conceptId: "missing_concept" };
    const index = buildApprovedIndex([validActivity, automatic, unknownTheme, unknownConcept, human],
      (id) => id === testConcept.id ? testConcept : undefined);
    expect(index.activities.map((entry) => entry.id)).toEqual([validActivity.id]);
    expect(index.activities[0].themeId).toBe(validActivity.themeId);
  });

  it("regenerates an index without legacy, staged, or automatic candidates", () => {
    const directory = mkdtempSync(join(tmpdir(), "bloom-index-test-"));
    try {
      const human = { ...validActivity, metadata: { ...validActivity.metadata, humanApprovedAt: "2026-09-29T00:00:00.000Z", humanApprover: "ajay" } };
      const legacy = { ...human, id: "legacy", themeId: undefined };
      const staged = { ...validActivity, id: "staged" };
      const automatic = { ...human, id: "automatic", metadata: { ...human.metadata, humanApprover: "pipeline-auto" } };
      for (const candidate of [human, legacy, staged, automatic]) {
        writeFileSync(join(directory, `${candidate.id}.json`), JSON.stringify(candidate));
      }
      regenerateActivityIndex(directory, (id) => id === testConcept.id ? testConcept : undefined);
      const index = JSON.parse(readFileSync(join(directory, "index.json"), "utf8"));
      expect(index.activities.map((entry: { id: string }) => entry.id)).toEqual([human.id]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
