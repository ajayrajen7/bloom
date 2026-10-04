import { describe, expect, it, vi } from "vitest";
import {
  completionAudioUrl,
  loadRuntimeVoiceoverConfig,
  promptAudioUrl,
  type RuntimeVoiceoverConfig,
} from "../../runtime/src/voiceover.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const mechanics = vi.hoisted(() => ({
  drag: vi.fn().mockImplementation(() => ({ destroy: vi.fn() })),
  tap: vi.fn().mockImplementation(() => ({ destroy: vi.fn() })),
}));

vi.mock("phaser", () => ({ default: { Scene: class {}, Math: {
  Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)),
  Between: (min: number) => min,
} } }));
vi.mock("../../runtime/src/mechanics/drag-to-target.js", () => ({ DragToTargetMechanic: mechanics.drag }));
vi.mock("../../runtime/src/mechanics/tap-to-select.js", () => ({ TapToSelectMechanic: mechanics.tap }));
vi.mock("../../runtime/src/assets/sprite-registry.js", () => ({
  queueApprovedSpriteLoads: vi.fn(),
  requireActivitySpriteTextures: vi.fn(),
}));

import { activityJsonCacheKey } from "../../runtime/src/scenes/activity-cache-key.js";
import { ActivityScene } from "../../runtime/src/scenes/activity.js";
import { CompletionScene } from "../../runtime/src/scenes/completion.js";
import { SelectionScene } from "../../runtime/src/scenes/selection.js";

const config: RuntimeVoiceoverConfig = {
  activePackId: "pilot-v1",
  promptScripts: { find_three: "Find three apples." },
  promptPathPattern: "/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a",
  completionPathPattern: "/assets/audio/voice-packs/{packId}/well-done.m4a",
};

describe("runtime voiceover config", () => {
  it("resolves pre-generated prompt and completion paths", () => {
    expect(promptAudioUrl("pilot-v1", "find_three")).toBe(
      "/assets/audio/voice-packs/pilot-v1/prompts/find_three.m4a"
    );
    expect(completionAudioUrl("pilot-v1")).toBe(
      "/assets/audio/voice-packs/pilot-v1/well-done.m4a"
    );
  });

  it("loads the authored config from the runtime publication endpoint", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => config }));
    await expect(loadRuntimeVoiceoverConfig(fetcher as unknown as typeof fetch)).resolves.toEqual(config);
    expect(fetcher).toHaveBeenCalledWith("/voiceover.json");
  });

  it("rejects unavailable or unsafe runtime config", async () => {
    await expect(loadRuntimeVoiceoverConfig(async () => ({ ok: false } as Response))).rejects.toThrow();
    await expect(loadRuntimeVoiceoverConfig(async () => ({ ok: true, json: async () => ({
      ...config,
      activePackId: "../bad",
    }) } as Response))).rejects.toThrow();
  });
});

const root = join(fileURLToPath(new URL("../..", import.meta.url)));

function createActivityScene(activityId: string) {
  const activity = JSON.parse(readFileSync(join(root, "library/activities", `${activityId}.json`), "utf8"));
  const children: any[] = [];
  const audioCache = { available: true };
  const events = new Map<string, (...args: any[]) => void>();
  let pointerupCount = 0;
  const labels: string[] = [];
  const soundEvents = new Map<string, (...args: any[]) => void>();
  const loaderEvents = new Map<string, (...args: any[]) => void>();
  let preloadErrorHandler: ((file: { key?: string }) => void) | undefined;
  const sound = {
    once: (event: string, callback: (...args: any[]) => void) => soundEvents.set(event, callback),
    play: vi.fn(() => true), destroy: vi.fn(),
  };
  const object = (label?: string) => {
    const item: any = {
      visible: true, destroyed: false,
      setOrigin() { return this; }, setDepth() { return this; }, setStrokeStyle() { return this; },
      setInteractive() { return this; }, setFillStyle() { return this; }, setVisible(value: boolean) { this.visible = value; return this; },
      setScale() { return this; }, setAlpha() { return this; }, setPosition() { return this; },
      setDisplaySize() { return this; }, on(event: string, callback: (...args: any[]) => void) {
        events.set(label ?? `${event}-${pointerupCount++}`, callback); return this;
      },
      destroy() { this.destroyed = true; const i = children.indexOf(this); if (i >= 0) children.splice(i, 1); },
      lineStyle() { return this; }, lineBetween() { return this; },
    };
    if (label) labels.push(label);
    children.push(item);
    return item;
  };
  const scene = new ActivityScene();
  Object.assign(scene, {
    scale: { width: 1024, height: 768 },
    children: { list: children },
    cache: {
      json: { get: (key: string) => key === activityJsonCacheKey(activityId) ? activity : undefined },
      audio: { exists: () => audioCache.available },
    },
    textures: { exists: () => true },
    add: {
      rectangle: () => object(), text: (_x: number, _y: number, value: string) => object(value),
      circle: () => object(), graphics: () => object(),
    },
    load: {
      json: vi.fn(), image: vi.fn(), audio: vi.fn(),
      on: (_event: string, callback: (file: { key?: string }) => void) => { preloadErrorHandler = callback; },
      once: (event: string, callback: (...args: any[]) => void) => loaderEvents.set(event, callback),
      start: vi.fn(),
    },
    sound: { add: () => sound },
    tweens: { add: vi.fn() },
    time: { delayedCall: vi.fn() },
    scene: { start: vi.fn() },
  });
  const config: RuntimeVoiceoverConfig = {
    activePackId: "pilot-v1",
    promptScripts: { [activityId]: "Find the matching things." },
    promptPathPattern: configPathPattern,
    completionPathPattern: completionPathPattern,
  };
  scene.init({ activityId, voiceover: config });
  scene.preload();
  return { scene, labels, events, children, soundEvents, loaderEvents, sound, audioCache, load: (scene as any).load, preloadError: (key: string) => preloadErrorHandler?.call(scene, { key }) };
}

const configPathPattern = "/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a";
const completionPathPattern = "/assets/audio/voice-packs/{packId}/well-done.m4a";

describe("activity instruction and replay states", () => {
  it("keeps the board hidden until narration ends, then replays without rebuilding mechanic state", () => {
    mechanics.drag.mockClear();
    const activityId = "act_pilot_kitchen_drag_v1";
    const { scene, labels, events, children, soundEvents } = createActivityScene(activityId);
    scene.create();

    expect(labels).toContain("Find the matching things.");
    expect(labels).toContain("Getting ready…");
    expect(mechanics.drag).not.toHaveBeenCalled();
    soundEvents.get("complete")?.();
    expect(mechanics.drag).toHaveBeenCalledOnce();

    const originalSessionId = (scene as any).sessionId;
    (scene as any).placedCount = 1;
    const boardObjects = [...(scene as any).boardObjects];
    const replayButton = events.get("pointerup-0");
    expect(replayButton).toBeDefined();
    replayButton?.();
    expect(boardObjects.every((item) => item.visible === false)).toBe(true);
    expect(mechanics.drag).toHaveBeenCalledOnce();
    expect((scene as any).sessionId).toBe(originalSessionId);
    expect((scene as any).placedCount).toBe(1);
    soundEvents.get("complete")?.();
    expect(boardObjects.every((item) => item.visible === true)).toBe(true);
    expect(children.length).toBeGreaterThan(0);
  });

  it("provides retry and adult-led start when prompt audio cannot be loaded", () => {
    mechanics.tap.mockClear();
    const activityId = "act_pilot_kitchen_tap_v1";
    const harness = createActivityScene(activityId);
    harness.preloadError(`voiceover-prompt-${activityId}`);
    harness.scene.create();

    expect(harness.labels).toContain("Try voice again");
    expect(harness.labels).toContain("Start activity");
    expect(mechanics.tap).not.toHaveBeenCalled();
    harness.events.get("pointerup-1")?.();
    expect(mechanics.tap).toHaveBeenCalledOnce();
  });

  it("retries the same prompt asset after an initial load failure", () => {
    mechanics.drag.mockClear();
    const activityId = "act_pilot_kitchen_drag_v1";
    const harness = createActivityScene(activityId);
    harness.audioCache.available = false;
    harness.preloadError(`voiceover-prompt-${activityId}`);
    harness.scene.create();
    harness.events.get("pointerup-0")?.();
    expect(harness.load.audio).toHaveBeenCalledTimes(2);
    expect(harness.load.audio.mock.calls[0]).toEqual(harness.load.audio.mock.calls[1]);
    harness.audioCache.available = true;
    harness.loaderEvents.get(`filecomplete-audio-voiceover-prompt-${activityId}`)?.();
    harness.soundEvents.get("complete")?.();
    expect(mechanics.drag).toHaveBeenCalledOnce();
  });

  it("replays the tap activity without reconstructing it and recovers from playback failure", () => {
    mechanics.tap.mockClear();
    const harness = createActivityScene("act_pilot_kitchen_tap_v1");
    harness.scene.create();
    harness.soundEvents.get("complete")?.();
    const boardObjects = [...(harness.scene as any).boardObjects];
    const sessionId = (harness.scene as any).sessionId;
    harness.events.get("pointerup-0")?.();
    harness.soundEvents.get("playerror")?.();
    expect(mechanics.tap).toHaveBeenCalledOnce();
    expect((harness.scene as any).sessionId).toBe(sessionId);
    expect(boardObjects.every((item) => item.visible === true)).toBe(true);
  });

  it("returns to the board if replay playback fails", () => {
    mechanics.drag.mockClear();
    const harness = createActivityScene("act_pilot_kitchen_drag_v1");
    harness.scene.create();
    harness.soundEvents.get("complete")?.();
    const boardObjects = [...(harness.scene as any).boardObjects];
    harness.events.get("pointerup-0")?.();
    harness.soundEvents.get("playerror")?.();
    expect(boardObjects.every((item) => item.visible === true)).toBe(true);
    expect(mechanics.drag).toHaveBeenCalledOnce();
  });
});

function createCompletionScene(audioExists = true) {
  const labels: string[] = [];
  const timers: Array<{ delay: number; callback: () => void }> = [];
  const soundEvents = new Map<string, (...args: any[]) => void>();
  const startScene = vi.fn();
  const rendered: string[] = [];
  const sound = {
    once: (event: string, callback: (...args: any[]) => void) => soundEvents.set(event, callback),
    play: vi.fn(() => true), destroy: vi.fn(),
  };
  const soundManager = { add: vi.fn(() => { rendered.push("sound:add"); return sound; }) };
  const visual = {
    setOrigin: () => visual, setScale: () => visual, setAlpha: () => visual,
    setDepth: () => visual, setInteractive: () => visual, setStrokeStyle: () => visual,
    on: () => visual,
  };
  const scene = new CompletionScene();
  Object.assign(scene, {
    scale: { width: 1024, height: 768 },
    add: {
      rectangle: () => visual,
      text: (_x: number, _y: number, value: string) => { labels.push(value); rendered.push(`text:${value}`); return visual; },
      star: () => visual,
    },
    load: { json: vi.fn(), audio: vi.fn(), on: vi.fn() },
    cache: { audio: { exists: () => audioExists } },
    sound: soundManager,
    tweens: { add: vi.fn() },
    time: { delayedCall: (delay: number, callback: () => void) => { timers.push({ delay, callback }); } },
    scene: { start: startScene },
  });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  const voiceover: RuntimeVoiceoverConfig = {
    activePackId: "pilot-v1", promptScripts: {},
    promptPathPattern: configPathPattern, completionPathPattern,
  };
  scene.init({ sessionId: "session_1", activityId: "act_1", startedAt: "2026-10-04T00:00:00.000Z", themeId: "kitchen-v1", voiceover, selectionScrollY: 420 } as any);
  scene.preload();
  scene.create();
  vi.unstubAllGlobals();
  return { scene, labels, timers, startScene, soundEvents, sound: soundManager, rendered, load: (scene as any).load };
}

describe("completion narration timing", () => {
  it("waits for both the two-second minimum and short narration to end", () => {
    const result = createCompletionScene();
    expect(result.labels).toContain("Well done! 🎉");
    expect(result.rendered.indexOf("text:Well done! 🎉")).toBeLessThan(result.rendered.indexOf("sound:add"));
    expect(result.load.audio).toHaveBeenCalledWith("voiceover-completion", "/assets/audio/voice-packs/pilot-v1/well-done.m4a");
    result.soundEvents.get("complete")?.();
    expect(result.startScene).not.toHaveBeenCalled();
    result.timers.find(({ delay }) => delay === 2000)?.callback();
    expect(result.startScene).toHaveBeenCalledWith("SelectionScene", { scrollY: 420 });
  });

  it("waits for long narration after the minimum time has elapsed", () => {
    const result = createCompletionScene();
    result.timers.find(({ delay }) => delay === 2000)?.callback();
    expect(result.startScene).not.toHaveBeenCalled();
    result.soundEvents.get("complete")?.();
    expect(result.startScene).toHaveBeenCalledOnce();
  });

  it("returns after the minimum time when loading or playback fails and narrates only once", () => {
    const missing = createCompletionScene(false);
    missing.scene.create();
    expect(missing.sound.add).not.toHaveBeenCalled();
    missing.timers.find(({ delay }) => delay === 2000)?.callback();
    expect(missing.startScene).toHaveBeenCalledOnce();

    const rejected = createCompletionScene();
    rejected.scene.create();
    expect(rejected.sound.add).toHaveBeenCalledOnce();
    rejected.soundEvents.get("playerror")?.();
    rejected.timers.find(({ delay }) => delay === 2000)?.callback();
    expect(rejected.startScene).toHaveBeenCalledOnce();
  });
});

describe("selection scroll restoration", () => {
  it("restores the saved list position and carries it into the next activity", () => {
    const entries = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
    const pointerUpHandlers: Array<() => void> = [];
    const startScene = vi.fn();
    const camera = { scrollY: 0, setBounds: vi.fn() };
    const visual: any = {
      setOrigin() { return this; }, setScrollFactor() { return this; }, setDepth() { return this; },
      setStrokeStyle() { return this; }, setInteractive() { return this; }, setFillStyle() { return this; }, setY() { return this; },
      on(event: string, callback: () => void) { if (event === "pointerup") pointerUpHandlers.push(callback); return this; },
    };
    const scene = new SelectionScene();
    const voiceover = { activePackId: "pilot-v1", promptScripts: {}, promptPathPattern: configPathPattern, completionPathPattern };
    const unlock = vi.fn();
    Object.assign(scene, {
      scale: { width: 1024, height: 768 },
      cameras: { main: camera },
      cache: { json: { get: (key: string) => key === "activity-index" ? entries : voiceover } },
      add: { rectangle: () => visual, text: () => visual },
      input: { on: vi.fn() },
      sound: { unlock },
      scene: { start: startScene },
    });
    scene.create({ scrollY: 420 });
    expect(camera.scrollY).toBe(420);
    pointerUpHandlers[0]?.();
    expect(unlock).toHaveBeenCalledOnce();
    expect(startScene).toHaveBeenCalledWith("ActivityScene", expect.objectContaining({
      activityId: entries.activities[0].id,
      selectionScrollY: 420,
      voiceover,
    }));
  });
});
