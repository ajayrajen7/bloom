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
  const timers: Array<{ delay: number; callback: () => void }> = [];
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
  const startScene = vi.fn();
  let interactiveCount = 0;
  const visual = {
    setOrigin: () => visual,
    setScale: () => visual,
    setAlpha: () => visual,
    setInteractive: () => { interactiveCount++; return visual; },
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
    time: { delayedCall: (delay: number, callback: () => void) => { timers.push({ delay, callback }); } },
    scene: { start: startScene },
  });
  vi.stubGlobal("localStorage", storage);
  scene.init({ sessionId: "session_1", activityId: "act_1", startedAt: "2026-09-29T00:00:00.000Z", themeId } as any);
  scene.create();
  vi.unstubAllGlobals();
  return { rectangles, textColors, texts, starColors, timers, storage, startScene, interactiveCount };
}

describe("CompletionScene theme presentation", () => {
  it("shows a celebration, saves completion without a parent rating, and returns to the list", () => {
    const result = createCompletion("kitchen-v1");
    expect(result.rectangles[0]).toBe(0xF6F2E8);
    expect(result.rectangles).toHaveLength(1);
    expect(result.textColors).toEqual(["#26352A"]);
    expect(result.texts).toEqual(["Well done! 🎉"]);
    expect(result.interactiveCount).toBe(0);
    expect(result.timers.map(({ delay }) => delay)).toEqual([2000]);
    expect(result.starColors).toHaveLength(18);
    expect(result.starColors.every((color) => color === 0xDDE8D2 || color === 0x26352A)).toBe(true);

    expect(result.storage.setItem).toHaveBeenCalledOnce();
    const saved = JSON.parse(result.storage.setItem.mock.calls[0][1] as string) as Array<Record<string, unknown>>;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ activityId: "act_1", outcome: "completed" });
    expect(saved[0]).not.toHaveProperty("parentRating");

    const returnTimer = result.timers.find(({ delay }) => delay === 2000);
    expect(returnTimer).toBeDefined();
    returnTimer?.callback();
    expect(result.startScene).toHaveBeenCalledWith("SelectionScene", { scrollY: 0 });
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
