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

// ── Mechanics Layer ──────────────────────────────────────────────────────────

export const MechanicSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  deviceCompatibility: z.array(z.enum(["ipad", "phone", "desktop"])),
  slotSchema: z.record(z.unknown()),
  parameterSchema: z.record(z.unknown()),
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

// ── Generation pipeline failures ─────────────────────────────────────────────

export const RejectionReasonSchema = z.object({
  stage: z.enum(["validate", "llm_review", "manual_review"]),
  reason: z.string(),
  details: z.record(z.unknown()).optional(),
  rejectedAt: z.string().datetime(),
});
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
