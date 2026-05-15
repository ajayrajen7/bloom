import Phaser from "phaser";
import { ActivityIndexSchema } from "shared/types.js";
import { playTap } from "../audio.js";

const CARD_W = 760;
const CARD_H = 130;
const CARD_GAP = 20;
const TITLE_H = 120;
const LIST_TOP = TITLE_H + 20;
const PAD_BOTTOM = 60;

const DIFF_COLOR: Record<string, number> = {
  low: 0x22c55e,
  medium: 0xf59e0b,
  high: 0xef4444,
};

export class SelectionScene extends Phaser.Scene {
  private scrollBar?: Phaser.GameObjects.Rectangle;
  private scrollTrack?: Phaser.GameObjects.Rectangle;
  private worldH = 0;

  constructor() {
    super({ key: "SelectionScene" });
  }

  preload() {
    this.load.json("activity-index", "/activities/index.json");
  }

  create() {
    const { width, height } = this.scale;

    let entries: Array<{ id: string; prompt: string; difficulty: string }> = [];
    try {
      const raw = this.cache.json.get("activity-index") as unknown;
      entries = ActivityIndexSchema.parse(raw).activities;
    } catch {
      // index missing or malformed — empty state
    }

    const totalCardsH = entries.length * (CARD_H + CARD_GAP) - CARD_GAP;
    this.worldH = Math.max(height, LIST_TOP + totalCardsH + PAD_BOTTOM);

    this.cameras.main.setBounds(0, 0, width, this.worldH);

    // Background covers full world height
    this.add.rectangle(width / 2, this.worldH / 2, width, this.worldH, 0x1a1a2e);

    this.add
      .text(width / 2, 70, "Bloom", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0); // pin title to camera

    if (entries.length === 0) {
      this.showEmptyState(width, height);
      return;
    }

    entries.forEach((entry, i) => {
      const cardY = LIST_TOP + CARD_H / 2 + i * (CARD_H + CARD_GAP);
      this.buildCard(width / 2, cardY, entry);
    });

    this.setupScroll(width, height);
    if (this.worldH > height) {
      this.buildScrollBar(width, height);
    }
  }

  // Set to true while a drag scroll is in progress so card taps don't fire.
  scrolling = false;

  private setupScroll(width: number, height: number) {
    let dragStartY = 0;
    let camStartY = 0;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      dragStartY = p.y;
      camStartY = this.cameras.main.scrollY;
      this.scrolling = false;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const delta = dragStartY - p.y;
      if (!this.scrolling && Math.abs(delta) < 8) return; // dead zone
      this.scrolling = true;
      const maxScroll = this.worldH - height;
      this.cameras.main.scrollY = Phaser.Math.Clamp(camStartY + delta, 0, maxScroll);
      this.updateScrollBar(height);
    });

    this.input.on("pointerup", () => { this.scrolling = false; });
    this.input.on("pointerupoutside", () => { this.scrolling = false; });

    // Mouse wheel support for desktop testing
    this.input.on("wheel", (_p: unknown, _objs: unknown, _dx: unknown, dy: number) => {
      const maxScroll = this.worldH - height;
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY + dy * 0.8,
        0,
        maxScroll
      );
      this.updateScrollBar(height);
    });
  }

  private buildScrollBar(width: number, height: number) {
    const TRACK_W = 6;
    const TRACK_X = width - 16;
    const TRACK_H = height - 40;
    const TRACK_Y = height / 2;

    this.scrollTrack = this.add
      .rectangle(TRACK_X, TRACK_Y, TRACK_W, TRACK_H, 0x334155, 0.5)
      .setScrollFactor(0)
      .setDepth(10);

    const thumbH = Math.max(40, (height / this.worldH) * TRACK_H);
    this.scrollBar = this.add
      .rectangle(TRACK_X, 20 + thumbH / 2, TRACK_W, thumbH, 0x4a90d9, 0.8)
      .setScrollFactor(0)
      .setDepth(11);
  }

  private updateScrollBar(height: number) {
    if (!this.scrollBar || !this.scrollTrack) return;
    const TRACK_H = height - 40;
    const thumbH = Math.max(40, (height / this.worldH) * TRACK_H);
    const maxScroll = this.worldH - height;
    const scrollRatio = this.cameras.main.scrollY / maxScroll;
    const trackTop = 20;
    const trackBottom = trackTop + TRACK_H;
    const thumbY = trackTop + thumbH / 2 + scrollRatio * (TRACK_H - thumbH);
    this.scrollBar.setY(Phaser.Math.Clamp(thumbY, trackTop + thumbH / 2, trackBottom - thumbH / 2));
  }

  private buildCard(
    cx: number,
    cy: number,
    entry: { id: string; prompt: string; difficulty: string }
  ) {
    const bg = this.add
      .rectangle(cx, cy, CARD_W, CARD_H, 0x1e2a3a, 1)
      .setStrokeStyle(2, 0x334155)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx - CARD_W / 2 + 28, cy - 22, entry.prompt, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#f1f5f9",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    const diffColor = DIFF_COLOR[entry.difficulty] ?? 0x94a3b8;
    const badgeX = cx - CARD_W / 2 + 28;
    const badgeY = cy + 20;
    this.add.rectangle(badgeX + 36, badgeY, 72, 26, diffColor, 0.25).setStrokeStyle(1, diffColor);
    this.add
      .text(badgeX + 36, badgeY, entry.difficulty, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx + CARD_W / 2 - 32, cy, "▶", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#4a90d9",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x2a3a4a));
    bg.on("pointerout",  () => bg.setFillStyle(0x1e2a3a));
    bg.on("pointerdown", () => bg.setFillStyle(0x162030));
    bg.on("pointerup",   () => {
      if (this.scrolling) return;
      playTap();
      this.scene.start("ActivityScene", { activityId: entry.id });
    });
  }

  private showEmptyState(width: number, height: number) {
    this.add
      .text(
        width / 2,
        height / 2,
        "No activities yet.\nRun: pnpm generate concept_001",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "24px",
          color: "#64748b",
          align: "center",
        }
      )
      .setOrigin(0.5);
  }
}
