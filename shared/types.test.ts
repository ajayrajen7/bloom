import { describe, it, expect } from "vitest";
import {
  DivisionSchema,
  ConceptBriefSchema,
  MechanicSpecSchema,
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
