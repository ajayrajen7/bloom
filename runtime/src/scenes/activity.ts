/// <reference types="vite/client" />
import Phaser from "phaser";
import { ActivityJSONSchema, LayoutVariantSchema } from "shared/types.js";
import { computeZonePositions, getZone, type PlayArea } from "shared/layout-engine.js";
import {
  DragToTargetMechanic,
  type ItemConfig,
  type TargetConfig,
} from "../mechanics/drag-to-target.js";
import {
  TapToSelectMechanic,
  type TapItemConfig,
} from "../mechanics/tap-to-select.js";
import { queueApprovedSpriteLoads, requireActivitySpriteTextures } from "../assets/sprite-registry.js";
import {
  resolveTheme,
  resolvePresentationColors,
  createMechanicVisualConfig,
  type PresentationColors,
} from "../themes/theme-resolver.js";
import { arrangeDragRows, arrangeTapChoices } from "../presentation/randomized-arrangement.js";
import { activityJsonCacheKey } from "./activity-cache-key.js";
import { promptAudioUrl, type RuntimeVoiceoverConfig } from "../voiceover.js";

const PROMPT_H   = 0.15;
const PROGRESS_H = 0.15;

export class ActivityScene extends Phaser.Scene {
  private activityId = "";
  private sessionId  = "";
  private startedAt  = "";

  private mechanic?: DragToTargetMechanic | TapToSelectMechanic;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private placedCount = 0;
  private presentationColors?: PresentationColors;
  private review = false;
  private activity?: import("shared/types.js").ActivityJSON;
  private voiceover?: RuntimeVoiceoverConfig;
  private promptLoadFailed = false;
  private activityDataReady = false;
  private boardAssetsReady = false;
  private promptAudioReady = false;
  private promptPlaybackStarted = false;
  private promptPlaybackFinished = false;
  private startWhenAssetsReady = false;
  private boardBuilt = false;
  private boardObjects: Array<Phaser.GameObjects.GameObject & { setVisible(visible: boolean): unknown }> = [];
  private instructionObjects: Phaser.GameObjects.GameObject[] = [];
  private promptSound?: Phaser.Sound.BaseSound;
  private instructionCaption = "";
  private selectionScrollY = 0;
  private themeId = "";

  constructor() {
    super({ key: "ActivityScene" });
  }

  init(data: { activityId: string; themeId?: string; review?: boolean; voiceover?: RuntimeVoiceoverConfig; selectionScrollY?: number }) {
    this.activityId  = data.activityId ?? "act_dev_001";
    this.sessionId   = crypto.randomUUID();
    this.startedAt   = new Date().toISOString();
    this.placedCount = 0;
    this.progressDots = [];
    this.presentationColors = undefined;
    this.review = Boolean(data.review) && import.meta.env.DEV;
    this.voiceover = data.voiceover;
    this.selectionScrollY = data.selectionScrollY ?? 0;
    this.themeId = data.themeId ?? "";
    this.activity = undefined;
    this.promptLoadFailed = false;
    this.activityDataReady = false;
    this.boardAssetsReady = false;
    this.promptAudioReady = false;
    this.promptPlaybackStarted = false;
    this.promptPlaybackFinished = false;
    this.startWhenAssetsReady = false;
    this.boardBuilt = false;
    this.boardObjects = [];
    this.instructionObjects = [];
    this.promptSound = undefined;
  }

  preload() {
    // Review scenes keep the traditional eager loader. The child flow loads
    // after create() so its instruction view can render during the load.
    if (!this.review) return;
    this.load.json(activityJsonCacheKey(this.activityId), `/staged/${this.activityId}.json`);
    queueApprovedSpriteLoads((key) => this.textures.exists(key), (key, url) => this.load.image(key, url));
  }

  create() {
    if (!this.review) {
      let colors: PresentationColors;
      try {
        if (!this.themeId) throw new Error("Activity is missing a valid theme ID");
        colors = resolvePresentationColors(resolveTheme(this.themeId).presentation);
      } catch (error) {
        this.showError(error instanceof Error ? error.message : "Could not load activity theme");
        return;
      }
      this.presentationColors = colors;
      this.instructionCaption = this.voiceover?.promptScripts[this.activityId] ?? "Let's get ready!";
      this.showInstructionScreen(colors, false, false);
      this.load.json(activityJsonCacheKey(this.activityId), `/activities/${this.activityId}.json`);
      if (this.voiceover?.promptScripts[this.activityId]) {
        this.load.audio(this.promptSoundKey(), promptAudioUrl(this.voiceover.activePackId, this.activityId));
      } else {
        this.promptLoadFailed = true;
      }
      this.load.on("loaderror", (file: { key?: string }) => this.onPromptLoadError(file));
      this.load.once(`filecomplete-json-${activityJsonCacheKey(this.activityId)}`, () => this.onActivityDataLoaded());
      if (this.voiceover?.promptScripts[this.activityId]) {
        this.load.once(`filecomplete-audio-${this.promptSoundKey()}`, () => {
          this.promptAudioReady = true;
          this.maybeStartPrompt();
        });
      }
      this.load.once("complete", () => this.onActivityAssetsLoaded());
      queueApprovedSpriteLoads((key) => this.textures.exists(key), (key, url) => this.load.image(key, url));
      this.load.start();
      return;
    }
    this.onActivityDataLoaded();
  }

  private onActivityAssetsLoaded() {
    this.boardAssetsReady = true;
    this.promptAudioReady = this.promptAudioReady || this.cache.audio.exists(this.promptSoundKey());
    if (!this.activityDataReady) this.onActivityDataLoaded();
    if (!this.activity) return;
    try {
      requireActivitySpriteTextures(this.activity, (key) => this.textures.exists(key));
    } catch (error) {
      this.clearInstructionScreen();
      this.showError(error instanceof Error ? error.message : "Could not load activity sprites");
      return;
    }
    if (this.review) {
      this.buildBoard(this.activity, this.presentationColors!);
      return;
    }
    if (this.startWhenAssetsReady || this.promptPlaybackFinished) {
      this.startActivity();
      return;
    }
    if (this.promptLoadFailed || !this.voiceover?.promptScripts[this.activityId]) {
      this.showInstructionScreen(this.presentationColors!, false, true);
      return;
    }
    this.maybeStartPrompt();
  }

  private onActivityDataLoaded() {
    const raw = this.cache.json.get(activityJsonCacheKey(this.activityId)) as unknown;
    const parsedActivity = ActivityJSONSchema.safeParse(raw);
    if (!parsedActivity.success) {
      const themeIssue = parsedActivity.error.issues.some((issue) => issue.path[0] === "themeId");
      this.clearInstructionScreen();
      this.showError(themeIssue ? "Activity is missing a valid theme ID" : undefined);
      return;
    }
    const activity = parsedActivity.data;

    let colors: PresentationColors;
    try {
      colors = resolvePresentationColors(resolveTheme(activity.themeId).presentation);
    } catch (error) {
      this.clearInstructionScreen();
      this.showError(error instanceof Error ? error.message : "Could not load activity theme");
      return;
    }
    this.presentationColors = colors;
    this.activity = activity;
    this.activityDataReady = true;
    const authoredCaption = this.voiceover?.promptScripts[this.activityId] ?? activity.prompt.text;
    const captionChanged = this.instructionCaption !== authoredCaption;
    this.instructionCaption = authoredCaption;
    if ((this.themeId !== activity.themeId || captionChanged) && !this.review) {
      this.themeId = activity.themeId;
      this.showInstructionScreen(colors, false, false);
    }

    if (this.review) {
      try {
        requireActivitySpriteTextures(activity, (key) => this.textures.exists(key));
        this.boardAssetsReady = true;
        this.buildBoard(activity, colors);
      } catch (error) {
        this.clearInstructionScreen();
        this.showError(error instanceof Error ? error.message : "Could not load activity sprites");
      }
      return;
    }
    if (this.promptLoadFailed || !this.voiceover?.promptScripts[this.activityId]) this.showInstructionScreen(colors, false, true);
    else this.maybeStartPrompt();
  }

  private maybeStartPrompt() {
    if (!this.activityDataReady || !this.promptAudioReady || this.promptPlaybackStarted || this.promptLoadFailed || !this.presentationColors) return;
    this.promptPlaybackStarted = true;
    this.showInstructionScreen(this.presentationColors, false, false, false, true);
    this.playPrompt(() => {
      this.promptPlaybackFinished = true;
      if (this.boardAssetsReady) this.startActivity();
      else this.showInstructionScreen(this.presentationColors!, false, false, true);
    }, () => this.showInstructionScreen(this.presentationColors!, false, true));
  }

  private buildBoard(activity: import("shared/types.js").ActivityJSON, colors: PresentationColors) {
    if (this.boardBuilt) return;
    this.boardBuilt = true;
    const mechanicVisuals = createMechanicVisualConfig(colors);
    const { width, height } = this.scale;
    const playAreaY = height * PROMPT_H;
    const playAreaH = height * (1 - PROMPT_H - PROGRESS_H);

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, colors.backgroundFill);

    // ── Prompt area ─────────────────────────────────────────────────────────
    const promptY = playAreaY / 2;
    this.add.rectangle(width / 2, promptY, width, height * PROMPT_H, colors.promptPanelFill);
    this.add.rectangle(width / 2, height * (1 - PROGRESS_H / 2), width, height * PROGRESS_H, colors.promptPanelFill);
    this.add
      .text(width / 2, promptY, activity.prompt.text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "30px",
        color: colors.foregroundText,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // ── Dividers ────────────────────────────────────────────────────────────
    const g = this.add.graphics();
    g.lineStyle(1, colors.foregroundFill, 0.2);
    g.lineBetween(0, playAreaY, width, playAreaY);
    g.lineBetween(0, playAreaY + playAreaH, width, playAreaY + playAreaH);

    // ── Layout ───────────────────────────────────────────────────────────────
    const layoutRaw = activity.parameters["layout"] as unknown;
    let layout;
    try {
      layout = LayoutVariantSchema.parse(layoutRaw);
    } catch {
      this.showError("Activity is missing layout data");
      return;
    }

    const playArea: PlayArea = { x: 0, y: playAreaY, width, height: playAreaH };

    // ── Mechanic routing ──────────────────────────────────────────────────────
    if (activity.mechanicId === "drag-to-target") {
      const rawTargets = (activity.filledSlots["targets"] ?? []) as Array<{
        id: string; label: string; assetRef?: string; capacity?: number;
      }>;
      const rawItems = (activity.filledSlots["items"] ?? []) as Array<{
        id: string; targetId: string; label: string; assetRef?: string;
      }>;

      const targetZone = getZone(layout, "target_zone");
      const itemZone   = getZone(layout, "item_zone");

      const targetPositions = computeZonePositions(targetZone, rawTargets.length, playArea);
      const itemPositions   = computeZonePositions(itemZone,   rawItems.length,   playArea);
      const arrangedRows = arrangeDragRows(
        rawTargets,
        targetPositions,
        rawItems,
        itemPositions,
        this.sessionId,
      );

      const targets: TargetConfig[] = arrangedRows.targets.map((target) => ({
        id:       target.id,
        label:    target.label,
        color:    colors.foregroundFill,
        x:        target.position.x,
        y:        target.position.y,
        assetRef: target.assetRef,
        capacity: target.capacity,
      }));

      const items: ItemConfig[] = arrangedRows.items.map((item) => ({
        id:       item.id,
        targetId: item.targetId,
        label:    item.label,
        color:    colors.foregroundFill,
        x:        item.position.x,
        y:        item.position.y,
        assetRef: item.assetRef,
      }));

      this.buildProgressDots(width, height, items.length, colors.foregroundFill);

      this.mechanic = new DragToTargetMechanic(this, items, targets, {
        onItemPlaced: () => {
          this.placedCount++;
          this.updateProgressDots(colors.foregroundFill);
        },
        onItemError: () => this.flashPrompt(),
        onComplete:  () => {
          this.time.delayedCall(900, () => {
            this.scene.start("CompletionScene", {
              sessionId:  this.sessionId,
              activityId: this.activityId,
              startedAt:  this.startedAt,
              themeId:    activity.themeId,
              voiceover: this.voiceover,
              selectionScrollY: this.selectionScrollY,
            });
          });
        },
      }, mechanicVisuals);
    } else if (activity.mechanicId === "tap-to-select") {
      const correctItems = (activity.filledSlots["correctItems"] ?? []) as Array<{
        id: string; label: string; assetRef: string;
      }>;
      const distractors = (activity.filledSlots["distractors"] ?? []) as Array<{
        id: string; label: string; assetRef: string;
      }>;

      const itemZone = getZone(layout, "item_zone");
      const allItems = [
        ...correctItems.map((c) => ({ ...c, isCorrect: true as const })),
        ...distractors.map((d) => ({ ...d, isCorrect: false as const })),
      ];
      const itemPositions = computeZonePositions(itemZone, allItems.length, playArea);
      const arrangedItems = arrangeTapChoices(allItems, itemPositions, this.sessionId);

      const tapItems: TapItemConfig[] = arrangedItems.map((item) => ({
        id:        item.id,
        label:     item.label,
        assetRef:  item.assetRef,
        x:         item.position.x,
        y:         item.position.y,
        isCorrect: item.isCorrect,
      }));

      this.buildProgressDots(width, height, correctItems.length, colors.foregroundFill);

      this.mechanic = new TapToSelectMechanic(this, tapItems, {
        onCorrectTap: () => {
          this.placedCount++;
          this.updateProgressDots(colors.foregroundFill);
        },
        onIncorrectTap: () => this.flashPrompt(),
        onComplete: () => {
          this.time.delayedCall(900, () => {
            this.scene.start("CompletionScene", {
              sessionId:  this.sessionId,
              activityId: this.activityId,
              startedAt:  this.startedAt,
              themeId:    activity.themeId,
              voiceover: this.voiceover,
              selectionScrollY: this.selectionScrollY,
            });
          });
        },
      }, mechanicVisuals);
    } else {
      this.showError(`Unknown mechanic: ${activity.mechanicId}`);
    }

    this.boardObjects = [...this.children.list] as typeof this.boardObjects;
    this.addReplayControl(colors);
  }

  private promptSoundKey() { return `voiceover-prompt-${this.activityId}`; }

  private onPromptLoadError(file: { key?: string }) {
    if (file?.key !== this.promptSoundKey()) return;
    this.promptLoadFailed = true;
    if (this.activityDataReady && this.presentationColors) {
      this.showInstructionScreen(this.presentationColors, false, true);
    }
  }

  private playPrompt(onComplete: () => void, onFailure: () => void) {
    if (!this.cache.audio.exists(this.promptSoundKey())) {
      onFailure();
      return;
    }
    try {
      const sound = this.sound.add(this.promptSoundKey());
      this.promptSound = sound;
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        sound.destroy();
        if (this.promptSound === sound) this.promptSound = undefined;
        callback();
      };
      sound.once("complete", () => finish(onComplete));
      sound.once("playerror", () => finish(onFailure));
      sound.once("error", () => finish(onFailure));
      if (!sound.play()) finish(onFailure);
    } catch {
      onFailure();
    }
  }

  private trackInstructionObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.instructionObjects.push(object);
    return object;
  }

  private clearInstructionScreen() {
    for (const object of this.instructionObjects) object.destroy();
    this.instructionObjects = [];
  }

  private showInstructionScreen(colors: PresentationColors, replay: boolean, failed: boolean, loading = true, speaking = false) {
    this.clearInstructionScreen();
    const { width, height } = this.scale;
    const depth = 1000;
    this.trackInstructionObject(this.add.rectangle(width / 2, height / 2, width, height, colors.backgroundFill).setDepth(depth));
    this.trackInstructionObject(this.add.text(width / 2, height * 0.32, this.instructionCaption, {
      fontFamily: "system-ui, sans-serif", fontSize: "32px", color: colors.foregroundText,
      fontStyle: "bold", align: "center", wordWrap: { width: width * 0.8 },
    }).setOrigin(0.5).setDepth(depth + 1));

    if (failed) {
      this.trackInstructionObject(this.add.text(width / 2, height * 0.53, "Voice isn’t ready yet", {
        fontFamily: "system-ui, sans-serif", fontSize: "24px", color: colors.foregroundText, align: "center",
      }).setOrigin(0.5).setDepth(depth + 1));
      this.addInstructionButton(width / 2, height * 0.68, "Try voice again", colors, () => {
        this.retryPrompt(colors);
      });
      this.addInstructionButton(width / 2, height * 0.82, "Start activity", colors, () => this.startActivity());
    } else {
      const speaker = this.trackInstructionObject(this.add.text(width / 2, height * 0.57, "🔊", {
        fontFamily: "system-ui, sans-serif", fontSize: "96px", color: colors.foregroundText,
      }).setOrigin(0.5).setDepth(depth + 1));
      if (speaking) this.tweens.add({ targets: speaker, scaleX: 1.06, scaleY: 1.06, duration: 750, yoyo: true, repeat: -1 });
      this.trackInstructionObject(this.add.text(width / 2, height * 0.73, loading ? "Getting ready…" : replay ? "Listening again…" : "Listening…", {
        fontFamily: "system-ui, sans-serif", fontSize: "24px", color: colors.foregroundText,
      }).setOrigin(0.5).setDepth(depth + 1));
      if (loading) {
        const spinner = this.trackInstructionObject(this.add.text(width / 2, height * 0.82, "⟳", {
          fontFamily: "system-ui, sans-serif", fontSize: "28px", color: colors.foregroundText,
        }).setOrigin(0.5).setDepth(depth + 1));
        this.tweens.add({ targets: spinner, angle: 360, duration: 900, repeat: -1 });
      }
      if (replay) {
        this.trackInstructionObject(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
          .setInteractive().setDepth(depth - 1));
      }
    }
  }

  private addInstructionButton(x: number, y: number, label: string, colors: PresentationColors, callback: () => void) {
    const button = this.trackInstructionObject(this.add.rectangle(x, y, 360, 82, colors.promptPanelFill)
      .setStrokeStyle(2, colors.foregroundFill).setInteractive().setDepth(1002));
    button.on("pointerup", callback);
    this.trackInstructionObject(this.add.text(x, y, label, {
      fontFamily: "system-ui, sans-serif", fontSize: "26px", color: colors.foregroundText, fontStyle: "bold",
    }).setOrigin(0.5).setDepth(1003));
  }

  private startActivity() {
    if (!this.activity || !this.presentationColors) return;
    if (!this.boardAssetsReady && !this.review) {
      this.startWhenAssetsReady = true;
      this.showInstructionScreen(this.presentationColors, false, false, true);
      return;
    }
    this.clearInstructionScreen();
    this.buildBoard(this.activity, this.presentationColors);
  }

  private retryPrompt(colors: PresentationColors) {
    if (!this.voiceover?.promptScripts[this.activityId]) {
      this.showInstructionScreen(colors, false, true);
      return;
    }
    if (this.cache.audio.exists(this.promptSoundKey())) {
      this.showInstructionScreen(colors, false, false, false, true);
      this.playPrompt(() => this.startActivity(), () => this.showInstructionScreen(colors, false, true));
      return;
    }
    this.showInstructionScreen(colors, false, false, true);
    this.load.audio(this.promptSoundKey(), promptAudioUrl(this.voiceover.activePackId, this.activityId));
    this.load.once(`filecomplete-audio-${this.promptSoundKey()}`, () => {
      this.showInstructionScreen(colors, false, false, false, true);
      this.playPrompt(() => this.startActivity(), () => this.showInstructionScreen(colors, false, true));
    });
    this.load.once("loaderror", (file: { key?: string }) => {
      if (file?.key === this.promptSoundKey()) this.showInstructionScreen(colors, false, true);
    });
    this.load.start();
  }

  private addReplayControl(colors: PresentationColors) {
    const { width } = this.scale;
    const button = this.add.rectangle(width - 54, 54, 76, 76, colors.promptPanelFill)
      .setStrokeStyle(2, colors.foregroundFill).setDepth(100).setInteractive();
    this.add.text(width - 54, 54, "🔊", { fontFamily: "system-ui, sans-serif", fontSize: "38px", color: colors.foregroundText })
      .setOrigin(0.5).setDepth(101);
    button.on("pointerup", () => {
      if (!this.voiceover || !this.activity) return;
      this.boardObjects.forEach((object) => object.setVisible(false));
      this.showInstructionScreen(colors, true, false, false, true);
      this.playPrompt(() => this.finishReplay(), () => this.finishReplay());
    });
  }

  private finishReplay() {
    this.clearInstructionScreen();
    this.boardObjects.forEach((object) => object.setVisible(true));
  }

  // ── Progress dots ───────────────────────────────────────────────────────────

  private buildProgressDots(width: number, height: number, count: number, foregroundFill: number) {
    const r = 10;
    const gap = 32;
    const totalW = (count - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const dotY   = height * (1 - PROGRESS_H / 2);
    for (let i = 0; i < count; i++) {
      this.progressDots.push(this.add.circle(startX + i * gap, dotY, r, foregroundFill, 0.2));
    }
  }

  private updateProgressDots(foregroundFill: number) {
    for (let i = 0; i < this.placedCount; i++) {
      this.progressDots[i]?.setFillStyle(foregroundFill, 1);
    }
  }

  // ── Prompt flash on error ───────────────────────────────────────────────────

  private flashPrompt() {
    const text = this.children.getFirst("type", "Text") as Phaser.GameObjects.Text | null;
    if (!text) return;
    this.tweens.add({ targets: text, alpha: 0.3, duration: 80, yoyo: true, repeat: 1 });
  }

  // ── Load error fallback ─────────────────────────────────────────────────────

  private showError(msg = "Could not load activity\nTap to go back") {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, this.presentationColors?.backgroundFill ?? 0x12122a);
    this.add
      .text(width / 2, height / 2, msg, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: this.presentationColors?.foregroundText ?? "#ef4444",
        align: "center",
      })
      .setOrigin(0.5)
      .setInteractive()
      .once("pointerup", () => this.scene.start("SelectionScene"));
  }

  shutdown() {
    this.mechanic?.destroy();
  }
}
