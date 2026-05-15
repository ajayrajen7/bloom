import Phaser from "phaser";
import { playTap } from "../audio.js";
import { buildSessionRecord, appendSession } from "../telemetry.js";

interface CompletionData {
  sessionId: string;
  activityId: string;
  startedAt: string;
}

export class CompletionScene extends Phaser.Scene {
  private completionData: CompletionData = { sessionId: "", activityId: "", startedAt: "" };
  private rated = false;

  constructor() {
    super({ key: "CompletionScene" });
  }

  init(data: CompletionData) {
    this.completionData = data;
    this.rated = false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x12122a);

    this.spawnStars(width, height);

    const msg = this.add
      .text(width / 2, height * 0.38, "Well done! 🎉", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScale(0);

    this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 400, ease: "Back.Out" });

    this.time.delayedCall(700, () => {
      this.add
        .text(width / 2, height * 0.56, "How did it go?", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#aaaacc",
        })
        .setOrigin(0.5);
      this.buildRatingButtons(width, height);
    });
  }

  private buildRatingButtons(width: number, height: number) {
    const ratings: Array<{ label: string; color: number; y: number; value: "loved" | "fine" | "bailed" }> = [
      { label: "😍  Loved it",    color: 0x4caf50, y: height * 0.70, value: "loved"  },
      { label: "😐  It was fine", color: 0x2196f3, y: height * 0.82, value: "fine"   },
      { label: "🚶  We bailed",   color: 0x9e9e9e, y: height * 0.94, value: "bailed" },
    ];

    ratings.forEach(({ label, color, y, value }) => {
      const bg = this.add
        .rectangle(width / 2, y, 320, 56, color, 0.85)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(width / 2, y, label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      bg.on("pointerup", () => {
        if (this.rated) return;
        this.rated = true;

        playTap();
        this.persistRating(value);
        this.time.delayedCall(200, () => this.scene.start("SelectionScene"));
      });
    });
  }

  private persistRating(rating: "loved" | "fine" | "bailed") {
    const { sessionId, activityId, startedAt } = this.completionData;
    if (!sessionId) return;

    const record = buildSessionRecord(sessionId, activityId, startedAt, "completed", rating);
    appendSession(record, localStorage);
  }

  private spawnStars(width: number, height: number) {
    const colors = [0xffd700, 0xff69b4, 0x00cfff, 0xff8c00, 0xadffd4];
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(60, width - 60);
      const y = Phaser.Math.Between(60, height - 60);
      const star = this.add.star(x, y, 5, 8, 18, colors[i % colors.length]).setAlpha(0).setScale(0);
      this.tweens.add({
        targets: star,
        alpha: 1, scaleX: 1, scaleY: 1,
        duration: 300, delay: Phaser.Math.Between(0, 500), ease: "Back.Out",
        onComplete: () => {
          this.tweens.add({ targets: star, alpha: 0, y: y - 60, duration: 800, delay: 600, ease: "Sine.In" });
        },
      });
    }
  }
}
