// Runtime allowlist for the approved pilot assets. Authoring provenance stays in
// library/assets/manifest.json and is deliberately absent from this module.
export const APPROVED_SPRITE_REFS = [
  "sprites/apple-red-v1.png",
  "sprites/apple-green-v1.png",
  "sprites/banana-v1.png",
  "sprites/broccoli-v1.png",
  "sprites/carrot-v1.png",
  "sprites/cucumber-v1.png",
  "sprites/grapes-v1.png",
  "sprites/orange-v1.png",
  "sprites/tomato-v1.png",
] as const;

const approvedRefs = new Set<string>(APPROVED_SPRITE_REFS);

export interface ResolvedSprite {
  key: string;
  url: string;
}

export function resolveSpriteRef(assetRef: string): ResolvedSprite {
  if (!approvedRefs.has(assetRef)) {
    throw new Error(`Unsupported sprite assetRef: ${assetRef}`);
  }

  const name = assetRef.slice("sprites/".length, -".png".length);
  return { key: `sprite-${name}`, url: `/assets/${assetRef}` };
}

export function queueApprovedSpriteLoads(
  hasTexture: (key: string) => boolean,
  loadImage: (key: string, url: string) => void
): void {
  for (const ref of APPROVED_SPRITE_REFS) {
    const { key, url } = resolveSpriteRef(ref);
    if (!hasTexture(key)) loadImage(key, url);
  }
}

export function requireLoadedSpriteTexture(
  assetRef: string | undefined,
  hasTexture: (key: string) => boolean
): string {
  if (!assetRef) throw new Error("Missing sprite assetRef");
  const { key } = resolveSpriteRef(assetRef);
  if (!hasTexture(key)) throw new Error(`Missing approved sprite texture: ${assetRef} (${key})`);
  return key;
}

export function requireActivitySpriteTextures(
  activity: { mechanicId: string; filledSlots: Record<string, unknown> },
  hasTexture: (key: string) => boolean
): void {
  const requiredSlotKeys = activity.mechanicId === "drag-to-target"
    ? ["items", "distractors"]
    : ["correctItems", "distractors"];

  for (const key of requiredSlotKeys) {
    const slots = activity.filledSlots[key];
    if (!Array.isArray(slots)) continue;
    for (const slot of slots) {
      requireLoadedSpriteTexture(slot?.assetRef, hasTexture);
    }
  }

  if (activity.mechanicId === "drag-to-target") {
    const targets = activity.filledSlots["targets"];
    if (Array.isArray(targets)) {
      for (const target of targets) {
        if (target?.assetRef) requireLoadedSpriteTexture(target.assetRef, hasTexture);
      }
    }
  }
}
