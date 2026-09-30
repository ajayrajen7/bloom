import { describe, expect, it } from "vitest";
import * as registry from "../../runtime/src/assets/sprite-registry.js";

const approved = [
  "apple-red-v1",
  "apple-green-v1",
  "banana-v1",
  "broccoli-v1",
  "carrot-v1",
  "cucumber-v1",
  "grapes-v1",
  "orange-v1",
  "tomato-v1",
];

describe("approved runtime sprite registry", () => {
  it("resolves exactly the nine approved versioned pilot sprites to safe keys and URLs", () => {
    expect(registry.APPROVED_SPRITE_REFS).toEqual(approved.map((name) => `sprites/${name}.png`));
    for (const name of approved) {
      expect(registry.resolveSpriteRef(`sprites/${name}.png`)).toEqual({
        key: `sprite-${name}`,
        url: `/assets/sprites/${name}.png`,
      });
    }
  });

  it.each([
    "sprites/apple.png",
    "sprites/unapproved-v1.png",
    "../sprites/apple-red-v1.png",
    "/assets/sprites/apple-red-v1.png",
    "sprites/../staging/apple-red-v1.png",
    "backgrounds/apple-red-v1.png",
    "staging/chatgpt-pilot-001/banana-text-only.png",
    "staging/chatgpt-pilot-001/carrot-text-only.png",
    "sprites/banana-v1.jpg",
    "sprites/banana-v1.png/extra",
  ])("rejects unsupported or unsafe reference %s", (ref) => {
    expect(() => registry.resolveSpriteRef(ref)).toThrow(/sprite/i);
  });

  it("queues each approved sprite once with the registry key and URL", () => {
    const loads: Array<{ key: string; url: string }> = [];
    registry.queueApprovedSpriteLoads(
      (key) => key === "sprite-apple-red-v1",
      (key, url) => loads.push({ key, url })
    );
    expect(loads).toHaveLength(8);
    expect(loads).not.toContainEqual({ key: "sprite-apple-red-v1", url: "/assets/sprites/apple-red-v1.png" });
    expect(loads).toContainEqual({ key: "sprite-banana-v1", url: "/assets/sprites/banana-v1.png" });
  });

  it("reports a missing approved texture instead of a fallback visual", () => {
    expect(registry.requireLoadedSpriteTexture("sprites/banana-v1.png", () => true)).toBe("sprite-banana-v1");
    expect(() => registry.requireLoadedSpriteTexture("sprites/banana-v1.png", () => false)).toThrow(/missing.*banana-v1/i);
    expect(() => registry.requireLoadedSpriteTexture(undefined, () => false)).toThrow(/missing.*assetRef/i);
  });

  it("checks referenced activity sprites before mechanic construction", () => {
    const activity = {
      mechanicId: "tap-to-select",
      filledSlots: {
        correctItems: [{ assetRef: "sprites/apple-red-v1.png" }],
        distractors: [{ assetRef: "sprites/banana-v1.png" }],
      },
    };
    expect(() => registry.requireActivitySpriteTextures(activity, () => true)).not.toThrow();
    expect(() => registry.requireActivitySpriteTextures(activity, (key) => key !== "sprite-banana-v1")).toThrow(/missing.*banana-v1/i);
    expect(() => registry.requireActivitySpriteTextures({
      ...activity,
      filledSlots: { ...activity.filledSlots, distractors: [{ assetRef: "sprites/apple.png" }] },
    }, () => true)).toThrow(/unsupported.*sprite/i);
  });

  it("requires drag item textures and checks optional target art when supplied", () => {
    const activity = {
      mechanicId: "drag-to-target",
      filledSlots: {
        items: [{ assetRef: "sprites/carrot-v1.png" }],
        targets: [{ assetRef: "sprites/broccoli-v1.png" }, {}],
      },
    };
    expect(() => registry.requireActivitySpriteTextures(activity, () => true)).not.toThrow();
    expect(() => registry.requireActivitySpriteTextures(activity, (key) => key !== "sprite-carrot-v1")).toThrow(/missing.*carrot-v1/i);
    expect(() => registry.requireActivitySpriteTextures({
      ...activity,
      filledSlots: { ...activity.filledSlots, items: [{}] },
    }, () => true)).toThrow(/missing.*assetRef/i);
  });
});
