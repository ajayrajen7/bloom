import Phaser from "phaser";
import { buildSessionRecord, appendSession } from "../telemetry.js";
import { resolveTheme, resolvePresentationColors, type PresentationColors } from "../themes/theme-resolver.js";

interface CompletionData {
  sessionId: string;
  activityId: string;
  startedAt: string;
  themeId: string;
}

export class CompletionScene extends Phaser.Scene {
  private completionData: CompletionData = { sessionId: "", activityId: "", startedAt: "", themeId: "" };

  constructor() {
    super({ key: "CompletionScene" });
  }

  init(data: CompletionData) {
    this.completionData = data;
  }

  create() {
    const { width, height } = this.scale;
    let colors: PresentationColors;
    try {
      colors = resolvePresentationColors(resolveTheme(this.completionData.themeId).presentation);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Could not load activity theme");
      return;
    }

    const { sessionId, activityId, startedAt } = this.completionData;
    if (sessionId) {
      appendSession(buildSessionRecord(sessionId, activityId, startedAt, "completed"), localStorage);
    }

    this.add.rectangle(width / 2, height / 2, width, height, colors.backgroundFill);

    this.spawnStars(width, height, colors);

    const msg = this.add
      .text(width / 2, height * 0.38, "Well done! 🎉", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: colors.foregroundText,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScale(0);

    this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 400, ease: "Back.Out" });

    this.time.delayedCall(2000, () => this.scene.start("SelectionScene"));
  }

  private spawnStars(width: number, height: number, presentation: PresentationColors) {
    const colors = [presentation.promptPanelFill, presentation.foregroundFill];
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

  private showError(message: string) {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x12122a);
    this.add.text(width / 2, height / 2, message, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "28px",
      color: "#ef4444",
      align: "center",
    }).setOrigin(0.5);
  }
}
