import { z } from 'zod';

const GenerationSchema = z.object({
  surface: z.literal('chatgpt'),
  model: z.string().min(1),
  modelVersion: z.string().min(1).default('unknown'),
  promptVersion: z.string().min(1),
  styleReferenceVersion: z.string().min(1).optional(),
  referenceCondition: z.enum(['text-only', 'style-anchor', 'identity-reference']).optional(),
  batchId: z.string().min(1),
});

const ManualReviewSchema = z.object({
  decision: z.enum(['pending', 'approved', 'rejected']),
  reviewedAt: z.string().datetime().optional(),
  reviewerNotes: z.string().optional(),
});

const AssetMetricsSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hasAlpha: z.boolean().optional(),
  transparentCorners: z.array(z.boolean()).optional(),
  subjectBounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  centerOffset: z.object({ x: z.number(), y: z.number() }).optional(),
  occupancy: z.number().min(0).max(1).optional(),
  issues: z.array(z.string()).optional(),
});

const CommonAssetFields = {
  id: z.string().min(1),
  displayName: z.string().min(1),
  category: z.enum(['fruit', 'vegetable']),
  file: z.string().min(1),
  generation: GenerationSchema,
  metrics: AssetMetricsSchema.optional(),
  manualReview: ManualReviewSchema,
};

export const AssetEntrySchema = z.union([
  z.object({ ...CommonAssetFields, kind: z.literal('canonical') }),
  z.object({
    ...CommonAssetFields,
    kind: z.literal('variant'),
    canonicalId: z.string().min(1),
    attributes: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0),
  }),
]).superRefine((entry, context) => {
  if (entry.kind === 'variant' && entry.id === entry.canonicalId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A variant must reference a different canonical asset ID',
      path: ['canonicalId'],
    });
  }
});

export const AssetManifestSchema = z.array(AssetEntrySchema).superRefine((entries, context) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate asset ID: ${entry.id}`,
        path: [index, 'id'],
      });
    }
    seen.add(entry.id);
  });
});

export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
