import { describe, expect, it } from 'vitest';
import { AssetEntrySchema, AssetManifestSchema } from './manifest.js';

const canonical = {
  id: 'apple-red-v1',
  displayName: 'Red apple',
  category: 'fruit',
  kind: 'canonical',
  file: 'sprites/apple-red-v1.png',
  generation: {
    surface: 'chatgpt',
    model: 'unknown',
    promptVersion: 'object-sprite.v1',
    styleReferenceVersion: 'style-anchor-v1',
    batchId: 'chatgpt-pilot-001',
  },
  manualReview: { decision: 'pending' },
};

describe('asset manifest schema', () => {
  it('accepts a canonical fruit entry', () => {
    expect(AssetEntrySchema.safeParse(canonical).success).toBe(true);
  });

  it('accepts a color variant linked to its canonical asset', () => {
    expect(AssetEntrySchema.safeParse({
      ...canonical,
      id: 'apple-green-v1',
      displayName: 'Green apple',
      kind: 'variant',
      canonicalId: 'apple-red-v1',
      attributes: { color: 'green' },
    }).success).toBe(true);
  });

  it('rejects a category outside fruit and vegetable', () => {
    expect(AssetEntrySchema.safeParse({ ...canonical, category: 'animal' }).success).toBe(false);
  });

  it('rejects duplicate asset IDs in the manifest', () => {
    const variant = {
      ...canonical,
      kind: 'variant',
      canonicalId: 'apple-red-v1',
      attributes: { color: 'green' },
    };
    expect(AssetManifestSchema.safeParse([canonical, variant]).success).toBe(false);
  });

  it('rejects an unsupported manual review decision', () => {
    expect(AssetEntrySchema.safeParse({
      ...canonical,
      manualReview: { decision: 'auto-approved' },
    }).success).toBe(false);
  });
});
