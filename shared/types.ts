import { z } from "zod";

// ── Framework Layer ──────────────────────────────────────────────────────────

export const DivisionSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  ageRangeMonths: z.tuple([z.number(), z.number()]),
  description: z.string(),
  relatedMilestones: z.array(z.string()),
  designPrinciples: z.array(z.string()),
});
export type Division = z.infer<typeof DivisionSchema>;

// ── Concept Layer ────────────────────────────────────────────────────────────

export const ConceptBriefSchema = z.object({
  id: z.string(),
  targetDivisionId: z.string(),
  secondaryDivisionId: z.string().optional(),
  ageMonths: z.object({
    min: z.number(),
    max: z.number(),
  }),
  difficulty: z.enum(["low", "medium", "high"]),
  themeHint: z.string(),
  targetDurationSeconds: z.number(),
  notes: z.string().optional(),
});
export type ConceptBrief = z.infer<typeof ConceptBriefSchema>;

// ── Layout system ────────────────────────────────────────────────────────────

const LinearArrangementSchema = z.object({
  type: z.literal("linear"),
  axis: z.enum(["horizontal", "vertical"]),
  direction: z.enum(["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"]),
});

const GridArrangementSchema = z.object({
  type: z.literal("grid"),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
});

const CircularArrangementSchema = z.object({
  type: z.literal("circular"),
  radiusFraction: z.number(),
  startAngle: z.number(),
});

const RandomArrangementSchema = z.object({
  type: z.literal("random"),
  minSpacing: z.number(),
});

export const LayoutArrangementSchema = z.discriminatedUnion("type", [
  LinearArrangementSchema,
  GridArrangementSchema,
  CircularArrangementSchema,
  RandomArrangementSchema,
]);
export type LayoutArrangement = z.infer<typeof LayoutArrangementSchema>;

export const ZoneSpecSchema = z.object({
  arrangement: LayoutArrangementSchema,
  elementCount: z.object({ min: z.number(), max: z.number() }),
  elementSize: z.object({ min: z.number(), max: z.number() }),
  // Linear horizontal
  yFraction: z.number().optional(),
  xPadFraction: z.number().optional(),
  // Linear vertical
  xFraction: z.number().optional(),
  yPadFraction: z.number().optional(),
  // Grid + circular
  centerFraction: z.object({ x: z.number(), y: z.number() }).optional(),
  // Grid
  gapFraction: z.number().optional(),
  // Random
  bounds: z.object({ xPadFraction: z.number(), yPadFraction: z.number() }).optional(),
});
export type ZoneSpec = z.infer<typeof ZoneSpecSchema>;

export const LayoutVariantSchema = z.object({
  id: z.string(),
  description: z.string(),
  zones: z.record(ZoneSpecSchema),
});
export type LayoutVariant = z.infer<typeof LayoutVariantSchema>;

// ── Mechanics Layer ──────────────────────────────────────────────────────────

export const MechanicSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  deviceCompatibility: z.array(z.enum(["ipad", "phone", "desktop"])),
  slotSchema: z.record(z.unknown()),
  parameterSchema: z.record(z.unknown()),
  layouts: z.array(LayoutVariantSchema),
});
export type MechanicSpec = z.infer<typeof MechanicSpecSchema>;

// ── Generation Layer output / Runtime Layer input ────────────────────────────

export const ActivityJSONSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  mechanicId: z.string(),
  generatedAt: z.string().datetime(),
  filledSlots: z.record(z.unknown()),
  parameters: z.record(z.unknown()),
  prompt: z.object({
    text: z.string(),
    audioRef: z.string(),
  }),
  audioRefs: z.object({
    successSfx: z.string(),
    errorSfx: z.string(),
    completionSfx: z.string(),
  }),
  metadata: z.object({
    targetDivisionId: z.string(),
    secondaryDivisionId: z.string().optional(),
    ageMonths: z.object({ min: z.number(), max: z.number() }),
    difficulty: z.enum(["low", "medium", "high"]),
    targetDurationSeconds: z.number(),
    reviewScore: z.number(),
    reviewerNotes: z.string(),
    humanApprovedAt: z.string().datetime().optional(),
    humanApprover: z.string().optional(),
  }),
});
export type ActivityJSON = z.infer<typeof ActivityJSONSchema>;

// ── Generation Layer — LLM response schema ───────────────────────────────────
// Validates only the fields the LLM is responsible for.
// Pipeline code assembles the full ActivityJSON from this + deterministic fields.

export const LLMGenerationOutputSchema = z.object({
  _reasoning: z.string().optional(),
  filledSlots: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        targetId: z.string(),
        label: z.string(),
        assetRef: z.string(),
      })
    ),
    targets: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        assetRef: z.string(),
      })
    ),
    distractors: z.array(z.unknown()),
  }),
  prompt: z.object({
    text: z.string(),
  }),
});
export type LLMGenerationOutput = z.infer<typeof LLMGenerationOutputSchema>;

// ── Runtime Layer output ─────────────────────────────────────────────────────

export const SessionRecordSchema = z.object({
  sessionId: z.string(),
  activityId: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  outcome: z.enum(["completed", "abandoned"]),
  durationSeconds: z.number(),
  parentRating: z.enum(["loved", "fine", "bailed"]).optional(),
  events: z.array(
    z.object({
      timestamp: z.number(),
      type: z.string(),
      payload: z.record(z.unknown()).optional(),
    })
  ),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

// ── Activity library index ───────────────────────────────────────────────────
// Written by store.ts on every approve; read by SelectionScene at startup.

export const ActivityIndexEntrySchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  mechanicId: z.string(),
  prompt: z.string(),
  difficulty: z.enum(["low", "medium", "high"]),
});
export type ActivityIndexEntry = z.infer<typeof ActivityIndexEntrySchema>;

export const ActivityIndexSchema = z.object({
  activities: z.array(ActivityIndexEntrySchema),
});
export type ActivityIndex = z.infer<typeof ActivityIndexSchema>;

// ── Generation pipeline failures ─────────────────────────────────────────────

export const RejectionReasonSchema = z.object({
  stage: z.enum(["validate", "llm_review", "manual_review"]),
  reason: z.string(),
  details: z.record(z.unknown()).optional(),
  rejectedAt: z.string().datetime(),
});
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
