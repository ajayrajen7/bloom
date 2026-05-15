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

const PROMPT_H   = 0.15;
const PROGRESS_H = 0.15;

const PALETTE = [0xe84040, 0xf5c842, 0x4a90d9, 0x50c878, 0xff8c00, 0xda70d6];

export class ActivityScene extends Phaser.Scene {
  private activityId = "";
  private sessionId  = "";
  private startedAt  = "";

  private mechanic?: DragToTargetMechanic | TapToSelectMechanic;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private placedCount = 0;

  constructor() {
    super({ key: "ActivityScene" });
  }

  init(data: { activityId: string }) {
    this.activityId  = data.activityId ?? "act_dev_001";
    this.sessionId   = crypto.randomUUID();
    this.startedAt   = new Date().toISOString();
    this.placedCount = 0;
    this.progressDots = [];
  }

  preload() {
    this.load.json("activity", `/activities/${this.activityId}.json`);
  }

  create() {
    const raw = this.cache.json.get("activity") as unknown;

    let activity;
    try {
      activity = ActivityJSONSchema.parse(raw);
    } catch {
      this.showError();
      return;
    }

    const { width, height } = this.scale;
    const playAreaY = height * PROMPT_H;
    const playAreaH = height * (1 - PROMPT_H - PROGRESS_H);

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x12122a);

    // ── Prompt area ─────────────────────────────────────────────────────────
    const promptY = playAreaY / 2;
    this.add.rectangle(width / 2, promptY, width, height * PROMPT_H, 0x1e1e3a);
    this.add
      .text(width / 2, promptY, activity.prompt.text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "30px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // ── Dividers ────────────────────────────────────────────────────────────
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.1);
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
        id: string; label: string;
      }>;
      const rawItems = (activity.filledSlots["items"] ?? []) as Array<{
        id: string; targetId: string; label: string;
      }>;

      const targetZone = getZone(layout, "target_zone");
      const itemZone   = getZone(layout, "item_zone");

      const targetPositions = computeZonePositions(targetZone, rawTargets.length, playArea);
      const itemPositions   = computeZonePositions(itemZone,   rawItems.length,   playArea);

      const targetColorMap = new Map<string, number>();
      rawTargets.forEach((t, i) => targetColorMap.set(t.id, PALETTE[i % PALETTE.length]));

      const targets: TargetConfig[] = rawTargets.map((t, i) => ({
        id:    t.id,
        label: t.label,
        color: PALETTE[i % PALETTE.length],
        x:     targetPositions[i].x,
        y:     targetPositions[i].y,
      }));

      const items: ItemConfig[] = rawItems.map((item, i) => ({
        id:       item.id,
        targetId: item.targetId,
        label:    item.label,
        color:    targetColorMap.get(item.targetId) ?? 0xffffff,
        x:        itemPositions[i].x,
        y:        itemPositions[i].y,
      }));

      this.buildProgressDots(width, height, items.length);

      this.mechanic = new DragToTargetMechanic(this, items, targets, {
        onItemPlaced: () => {
          this.placedCount++;
          this.updateProgressDots();
        },
        onItemError: () => this.flashPrompt(),
        onComplete:  () => {
          this.time.delayedCall(900, () => {
            this.scene.start("CompletionScene", {
              sessionId:  this.sessionId,
              activityId: this.activityId,
              startedAt:  this.startedAt,
            });
          });
        },
      });
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

      this.buildProgressDots(width, height, correctItems.length);

      this.mechanic = new TapToSelectMechanic(this, tapItems, {
        onCorrectTap: () => {
          this.placedCount++;
          this.updateProgressDots();
        },
        onIncorrectTap: () => this.flashPrompt(),
        onComplete: () => {
          this.time.delayedCall(900, () => {
            this.scene.start("CompletionScene", {
              sessionId:  this.sessionId,
              activityId: this.activityId,
              startedAt:  this.startedAt,
            });
          });
        },
      });
    } else {
      this.showError(`Unknown mechanic: ${activity.mechanicId}`);
    }
  }

  // ── Progress dots ───────────────────────────────────────────────────────────

  private buildProgressDots(width: number, height: number, count: number) {
    const r = 10;
    const gap = 32;
    const totalW = (count - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const dotY   = height * (1 - PROGRESS_H / 2);
    for (let i = 0; i < count; i++) {
      this.progressDots.push(this.add.circle(startX + i * gap, dotY, r, 0x444466));
    }
  }

  private updateProgressDots() {
    for (let i = 0; i < this.placedCount; i++) {
      this.progressDots[i]?.setFillStyle(0x4a90d9);
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
    this.add.rectangle(width / 2, height / 2, width, height, 0x12122a);
    this.add
      .text(width / 2, height / 2, msg, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#ef4444",
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
