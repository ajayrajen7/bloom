import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Scene: class {},
    Math: { Between: (min: number) => min },
  },
}));

import { CompletionScene } from "../../runtime/src/scenes/completion.js";

function createCompletion(themeId?: string) {
  const rectangles: number[] = [];
  const textColors: string[] = [];
  const texts: string[] = [];
  const starColors: number[] = [];
  const visual = {
    setOrigin: () => visual,
    setScale: () => visual,
    setAlpha: () => visual,
    setInteractive: () => visual,
    setStrokeStyle: () => visual,
    on: () => visual,
  };
  const scene = new CompletionScene();
  Object.assign(scene, {
    scale: { width: 1024, height: 768 },
    add: {
      rectangle: (_x: number, _y: number, _w: number, _h: number, color: number) => {
        rectangles.push(color);
        return visual;
      },
      text: (_x: number, _y: number, value: string, style: { color: string }) => {
        texts.push(value);
        textColors.push(style.color);
        return visual;
      },
      star: (_x: number, _y: number, _p: number, _inner: number, _outer: number, color: number) => {
        starColors.push(color);
        return visual;
      },
    },
    tweens: { add: () => undefined },
    time: { delayedCall: (delay: number, callback: () => void) => { if (delay === 700) callback(); } },
  });
  scene.init({ sessionId: "session_1", activityId: "act_1", startedAt: "2026-09-29T00:00:00.000Z", themeId } as any);
  scene.create();
  return { rectangles, textColors, texts, starColors };
}

describe("CompletionScene theme presentation", () => {
  it("uses the selected Kitchen colors for background, ratings, text, and celebration", () => {
    const result = createCompletion("kitchen-v1");
    expect(result.rectangles[0]).toBe(0xF6F2E8);
    expect(result.rectangles.slice(1)).toEqual([0xDDE8D2, 0xDDE8D2, 0xDDE8D2]);
    expect(result.textColors).toEqual(Array(5).fill("#26352A"));
    expect(result.starColors).toHaveLength(18);
    expect(result.starColors.every((color) => color === 0xDDE8D2 || color === 0x26352A)).toBe(true);
  });

  it("shows an error for an unknown theme instead of rendering completion content", () => {
    const result = createCompletion("picnic-v1");
    expect(result.texts.some((text) => /unknown.*picnic-v1/i.test(text))).toBe(true);
    expect(result.texts).not.toContain("Well done! 🎉");
  });

  it("shows an error when the completion transition omits themeId", () => {
    const result = createCompletion();
    expect(result.texts.some((text) => /missing.*theme/i.test(text))).toBe(true);
    expect(result.texts).not.toContain("Well done! 🎉");
  });
});
