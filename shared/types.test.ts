import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import {
  DivisionSchema,
  ConceptBriefSchema,
  MechanicSpecSchema,
  ThemeSpecSchema,
  ActivityJSONSchema,
  SessionRecordSchema,
  RejectionReasonSchema,
} from "./types.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validDivision = {
  id: "fine_motor.pincer_grip",
  name: "Pincer Grip / Finger Isolation",
  domain: "fine_motor",
  ageRangeMonths: [18, 48] as [number, number],
  description: "The ability to use thumb and forefinger together to pick up small objects.",
  relatedMilestones: ["stacks_4_6_blocks", "uses_spoon_with_accuracy"],
  designPrinciples: ["Targets must be large (min 80pt on iPad)"],
};

const validConceptBrief = {
  id: "concept_001",
  mechanicId: "drag-to-target" as const,
  targetDivisionId: "fine_motor.pincer_grip",
  ageMonths: { min: 24, max: 36 },
  difficulty: "low" as const,
  themeHint: "fruits and baskets",
  targetDurationSeconds: 45,
  itemSprites: ["apple.png", "banana.png", "orange.png"],
  targetSprites: ["apple-basket.png", "banana-basket.png", "fruit-basket.png"],
};

const validMechanicSpec = {
  id: "drag-to-target",
  name: "Drag to Target",
  description: "Child drags items to the correct target zones.",
  deviceCompatibility: ["ipad"] as ["ipad"],
  slotSchema: { items: { type: "array" } },
  parameterSchema: { itemCount: { type: "number" } },
  layouts: [
    {
      id: "horizontal-standard",
      description: "Items in a row at bottom, targets above.",
      zones: {
        item_zone: {
          arrangement: { type: "linear", axis: "horizontal", direction: "left-to-right" },
          elementCount: { min: 3, max: 5 },
          elementSize: { min: 80, max: 115 },
          yFraction: 0.80,
          xPadFraction: 0.10,
        },
        target_zone: {
          arrangement: { type: "linear", axis: "horizontal", direction: "left-to-right" },
          elementCount: { min: 2, max: 4 },
          elementSize: { min: 100, max: 140 },
          yFraction: 0.28,
          xPadFraction: 0.10,
        },
      },
    },
  ],
};

const validActivityJSON = {
  id: "act_001",
  conceptId: "concept_001",
  mechanicId: "drag-to-target",
  themeId: "kitchen-v1",
  generatedAt: "2026-05-08T10:00:00.000Z",
  filledSlots: { items: [], targets: [] },
  parameters: { itemCount: 3 },
  prompt: {
    text: "Help the apples find their basket!",
    audioRef: "audio/prompts/act_001.mp3",
  },
  audioRefs: {
    successSfx: "audio/sfx/success_bright.mp3",
    errorSfx: "audio/sfx/try_again.mp3",
    completionSfx: "audio/sfx/celebration.mp3",
  },
  metadata: {
    targetDivisionId: "fine_motor.pincer_grip",
    ageMonths: { min: 24, max: 36 },
    difficulty: "low" as const,
    targetDurationSeconds: 45,
    reviewScore: 0.92,
    reviewerNotes: "Age-appropriate, clear prompt, good contrast.",
  },
};

const validThemeSpec = {
  id: "kitchen-v1",
  version: "1.0.0",
  name: "Kitchen",
  setting: "A calm home kitchen",
  visualTreatment: "Simple, warm surfaces with clear contrast for produce sprites",
  presentation: {
    backgroundColor: "#F6F2E8",
    promptPanelColor: "#DDE8D2",
    foregroundColor: "#26352A",
  },
};

const validSessionRecord = {
  sessionId: "session_001",
  activityId: "act_001",
  startedAt: "2026-05-08T10:00:00.000Z",
  endedAt: "2026-05-08T10:01:00.000Z",
  outcome: "completed" as const,
  durationSeconds: 60,
  events: [{ timestamp: 1000, type: "drag_start" }],
};

const validRejectionReason = {
  stage: "validate" as const,
  reason: "Missing required asset reference: audio/prompts/act_001.mp3",
  rejectedAt: "2026-05-08T10:00:00.000Z",
};

// ── Division ─────────────────────────────────────────────────────────────────

describe("DivisionSchema", () => {
  it("parses a valid division", () => {
    const result = DivisionSchema.parse(validDivision);
    expect(result.id).toBe("fine_motor.pincer_grip");
    expect(result.ageRangeMonths).toEqual([18, 48]);
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = DivisionSchema.parse(JSON.parse(JSON.stringify(validDivision)));
    expect(parsed).toEqual(validDivision);
  });

  it("rejects missing required fields", () => {
    expect(() => DivisionSchema.parse({ id: "x" })).toThrow();
  });
});

// ── ConceptBrief ─────────────────────────────────────────────────────────────

describe("ConceptBriefSchema", () => {
  it("parses a valid concept brief", () => {
    const result = ConceptBriefSchema.parse(validConceptBrief);
    expect(result.difficulty).toBe("low");
  });

  it("accepts optional fields when present", () => {
    const withOptionals = {
      ...validConceptBrief,
      secondaryDivisionId: "cognitive.visual_discrimination",
      notes: "Use bright colours.",
    };
    const result = ConceptBriefSchema.parse(withOptionals);
    expect(result.secondaryDivisionId).toBe("cognitive.visual_discrimination");
  });

  it("accepts a concept without a content theme hint", () => {
    const { themeHint: _, ...withoutHint } = validConceptBrief;
    expect(ConceptBriefSchema.parse(withoutHint).themeHint).toBeUndefined();
  });

  it("rejects invalid difficulty value", () => {
    expect(() =>
      ConceptBriefSchema.parse({ ...validConceptBrief, difficulty: "extreme" })
    ).toThrow();
  });

  it("requires itemSprites", () => {
    const { itemSprites: _, ...without } = validConceptBrief;
    expect(() => ConceptBriefSchema.parse(without)).toThrow();
  });

  it("requires targetSprites", () => {
    const { targetSprites: _, ...without } = validConceptBrief;
    expect(() => ConceptBriefSchema.parse(without)).toThrow();
  });

  it("rejects empty itemSprites — must have at least one sprite", () => {
    expect(() =>
      ConceptBriefSchema.parse({ ...validConceptBrief, itemSprites: [] })
    ).toThrow();
  });

  it("accepts empty targetSprites — valid for tap-to-select mechanics", () => {
    const result = ConceptBriefSchema.parse({ ...validConceptBrief, targetSprites: [] });
    expect(result.targetSprites).toEqual([]);
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = ConceptBriefSchema.parse(JSON.parse(JSON.stringify(validConceptBrief)));
    expect(parsed).toEqual(validConceptBrief);
  });
});

describe("ThemeSpecSchema", () => {
  it("loads the selected Kitchen pilot theme with its approved palette", () => {
    const path = fileURLToPath(new URL("../library/themes/kitchen-v1.json", import.meta.url));
    const theme = ThemeSpecSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
    expect(theme.id).toBe("kitchen-v1");
    expect(theme.presentation).toEqual({
      backgroundColor: "#F6F2E8",
      promptPanelColor: "#DDE8D2",
      foregroundColor: "#26352A",
    });
    expect(theme.backgroundAssetRefs).toBeUndefined();
  });

  it("parses a versioned theme with structured presentation colors", () => {
    expect(ThemeSpecSchema.parse(validThemeSpec)).toEqual(validThemeSpec);
  });

  it("allows safe versioned artwork references", () => {
    const theme = ThemeSpecSchema.parse({
      ...validThemeSpec,
      backgroundAssetRefs: ["backgrounds/kitchen-wall-v1.png"],
      decorationAssetRefs: ["decorations/kitchen-shelf-v1.png"],
    });
    expect(theme.backgroundAssetRefs).toEqual(["backgrounds/kitchen-wall-v1.png"]);
    expect(theme.decorationAssetRefs).toEqual(["decorations/kitchen-shelf-v1.png"]);
  });

  it.each([
    "../staging/kitchen-v1.png",
    "/assets/backgrounds/kitchen-v1.png",
    "backgrounds/../staging/kitchen-v1.png",
    "staging/kitchen-v1.png",
    "backgrounds/kitchen.png",
    "backgrounds/kitchen-v1.jpg",
    "backgrounds\\kitchen-v1.png",
  ])("rejects unsafe or malformed artwork reference %s", (ref) => {
    expect(ThemeSpecSchema.safeParse({ ...validThemeSpec, backgroundAssetRefs: [ref] }).success).toBe(false);
  });

  it("rejects blank identifiers, descriptions, and invalid colors", () => {
    expect(ThemeSpecSchema.safeParse({ ...validThemeSpec, id: " " }).success).toBe(false);
    expect(ThemeSpecSchema.safeParse({ ...validThemeSpec, setting: " " }).success).toBe(false);
    expect(ThemeSpecSchema.safeParse({ ...validThemeSpec, visualTreatment: " " }).success).toBe(false);
    expect(ThemeSpecSchema.safeParse({ ...validThemeSpec, presentation: { ...validThemeSpec.presentation, foregroundColor: "green" } }).success).toBe(false);
  });
});

// ── MechanicSpec ─────────────────────────────────────────────────────────────

describe("MechanicSpecSchema", () => {
  it("parses a valid mechanic spec", () => {
    const result = MechanicSpecSchema.parse(validMechanicSpec);
    expect(result.id).toBe("drag-to-target");
  });

  it("rejects unknown device compatibility values", () => {
    expect(() =>
      MechanicSpecSchema.parse({ ...validMechanicSpec, deviceCompatibility: ["tv"] })
    ).toThrow();
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = MechanicSpecSchema.parse(JSON.parse(JSON.stringify(validMechanicSpec)));
    expect(parsed).toEqual(validMechanicSpec);
  });
});

// ── ActivityJSON ─────────────────────────────────────────────────────────────

describe("ActivityJSONSchema", () => {
  it("parses a valid activity", () => {
    const result = ActivityJSONSchema.parse(validActivityJSON);
    expect(result.id).toBe("act_001");
    expect(result.metadata.reviewScore).toBe(0.92);
  });

  it("requires an explicit non-empty themeId", () => {
    const { themeId: _, ...withoutTheme } = validActivityJSON;
    expect(ActivityJSONSchema.safeParse(withoutTheme).success).toBe(false);
    expect(ActivityJSONSchema.safeParse({ ...validActivityJSON, themeId: "" }).success).toBe(false);
    expect(ActivityJSONSchema.safeParse({ ...validActivityJSON, themeId: " " }).success).toBe(false);
  });

  it("rejects non-datetime generatedAt", () => {
    expect(() =>
      ActivityJSONSchema.parse({ ...validActivityJSON, generatedAt: "not-a-date" })
    ).toThrow();
  });

  it("accepts optional humanApprovedAt", () => {
    const approved = {
      ...validActivityJSON,
      metadata: {
        ...validActivityJSON.metadata,
        humanApprovedAt: "2026-05-08T11:00:00.000Z",
        humanApprover: "ajay",
      },
    };
    const result = ActivityJSONSchema.parse(approved);
    expect(result.metadata.humanApprover).toBe("ajay");
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = ActivityJSONSchema.parse(JSON.parse(JSON.stringify(validActivityJSON)));
    expect(parsed).toEqual(validActivityJSON);
  });
});

// ── SessionRecord ─────────────────────────────────────────────────────────────

describe("SessionRecordSchema", () => {
  it("parses a valid session record", () => {
    const result = SessionRecordSchema.parse(validSessionRecord);
    expect(result.outcome).toBe("completed");
  });

  it("accepts optional parentRating", () => {
    const rated = { ...validSessionRecord, parentRating: "loved" as const };
    const result = SessionRecordSchema.parse(rated);
    expect(result.parentRating).toBe("loved");
  });

  it("rejects invalid outcome value", () => {
    expect(() =>
      SessionRecordSchema.parse({ ...validSessionRecord, outcome: "quit" })
    ).toThrow();
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = SessionRecordSchema.parse(JSON.parse(JSON.stringify(validSessionRecord)));
    expect(parsed).toEqual(validSessionRecord);
  });
});

// ── RejectionReason ───────────────────────────────────────────────────────────

describe("RejectionReasonSchema", () => {
  it("parses a valid rejection reason", () => {
    const result = RejectionReasonSchema.parse(validRejectionReason);
    expect(result.stage).toBe("validate");
  });

  it("rejects unknown stage values", () => {
    expect(() =>
      RejectionReasonSchema.parse({ ...validRejectionReason, stage: "unknown_stage" })
    ).toThrow();
  });

  it("round-trips through JSON serialisation", () => {
    const parsed = RejectionReasonSchema.parse(JSON.parse(JSON.stringify(validRejectionReason)));
    expect(parsed).toEqual(validRejectionReason);
  });
});
