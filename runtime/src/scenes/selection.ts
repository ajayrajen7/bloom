import Phaser from "phaser";
import { ActivityIndexSchema } from "shared/types.js";
import { playTap } from "../audio.js";

const CARD_W = 760;
const CARD_H = 130;
const CARD_GAP = 20;

const DIFF_COLOR: Record<string, number> = {
  low: 0x22c55e,
  medium: 0xf59e0b,
  high: 0xef4444,
};

export class SelectionScene extends Phaser.Scene {
  constructor() {
    super({ key: "SelectionScene" });
  }

  preload() {
    this.load.json("activity-index", "/activities/index.json");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.add
      .text(width / 2, 70, "Bloom", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let entries: Array<{ id: string; prompt: string; difficulty: string }> = [];

    try {
      const raw = this.cache.json.get("activity-index") as unknown;
      entries = ActivityIndexSchema.parse(raw).activities;
    } catch {
      // index missing or malformed — empty state
    }

    if (entries.length === 0) {
      this.showEmptyState(width, height);
      return;
    }

    const totalH = entries.length * CARD_H + (entries.length - 1) * CARD_GAP;
    const listTop = (height - totalH) / 2 + 40; // nudge down slightly for title

    entries.forEach((entry, i) => {
      const cardY = listTop + CARD_H / 2 + i * (CARD_H + CARD_GAP);
      this.buildCard(width / 2, cardY, entry);
    });
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

    // Difficulty badge
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

    // Play arrow
    this.add
      .text(cx + CARD_W / 2 - 32, cy, "▶", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#4a90d9",
      })
      .setOrigin(0.5);

    // Hover / press
    bg.on("pointerover", () => bg.setFillStyle(0x2a3a4a));
    bg.on("pointerout",  () => bg.setFillStyle(0x1e2a3a));
    bg.on("pointerdown", () => bg.setFillStyle(0x162030));
    bg.on("pointerup",   () => {
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
