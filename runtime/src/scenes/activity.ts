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

  constructor() {
    super({ key: "ActivityScene" });
  }

  init(data: { activityId: string; review?: boolean }) {
    this.activityId  = data.activityId ?? "act_dev_001";
    this.sessionId   = crypto.randomUUID();
    this.startedAt   = new Date().toISOString();
    this.placedCount = 0;
    this.progressDots = [];
    this.presentationColors = undefined;
    this.review = Boolean(data.review) && import.meta.env.DEV;
  }

  preload() {
    this.load.json("activity", this.review ? `/staged/${this.activityId}.json` : `/activities/${this.activityId}.json`);
    queueApprovedSpriteLoads(
      (key) => this.textures.exists(key),
      (key, url) => this.load.image(key, url)
    );
  }

  create() {
    const raw = this.cache.json.get("activity") as unknown;

    const parsedActivity = ActivityJSONSchema.safeParse(raw);
    if (!parsedActivity.success) {
      const themeIssue = parsedActivity.error.issues.some((issue) => issue.path[0] === "themeId");
      this.showError(themeIssue ? "Activity is missing a valid theme ID" : undefined);
      return;
    }
    const activity = parsedActivity.data;

    let colors: PresentationColors;
    try {
      colors = resolvePresentationColors(resolveTheme(activity.themeId).presentation);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Could not load activity theme");
      return;
    }
    this.presentationColors = colors;
    const mechanicVisuals = createMechanicVisualConfig(colors);

    try {
      requireActivitySpriteTextures(activity, (key) => this.textures.exists(key));
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Could not load activity sprites");
      return;
    }

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

      const targets: TargetConfig[] = rawTargets.map((t, i) => ({
        id:       t.id,
        label:    t.label,
        color:    colors.foregroundFill,
        x:        targetPositions[i].x,
        y:        targetPositions[i].y,
        assetRef: t.assetRef,
        capacity: t.capacity,
      }));

      const items: ItemConfig[] = rawItems.map((item, i) => ({
        id:       item.id,
        targetId: item.targetId,
        label:    item.label,
        color:    colors.foregroundFill,
        x:        itemPositions[i].x,
        y:        itemPositions[i].y,
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

      const tapItems: TapItemConfig[] = allItems.map((item, i) => ({
        id:        item.id,
        label:     item.label,
        assetRef:  item.assetRef,
        x:         itemPositions[i].x,
        y:         itemPositions[i].y,
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
            });
          });
        },
      }, mechanicVisuals);
    } else {
      this.showError(`Unknown mechanic: ${activity.mechanicId}`);
    }
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
