import Phaser from "phaser";
import { buildSessionRecord, appendSession } from "../telemetry.js";
import { resolveTheme, resolvePresentationColors, type PresentationColors } from "../themes/theme-resolver.js";
import { completionAudioUrl, type RuntimeVoiceoverConfig } from "../voiceover.js";

interface CompletionData {
  sessionId: string;
  activityId: string;
  startedAt: string;
  themeId: string;
  voiceover?: RuntimeVoiceoverConfig;
  selectionScrollY?: number;
}

export class CompletionScene extends Phaser.Scene {
  private completionData: CompletionData = { sessionId: "", activityId: "", startedAt: "", themeId: "" };
  private audioLoadFailed = false;
  private audioSettled = true;
  private minimumTimeElapsed = false;
  private returnedToSelection = false;
  private completionStarted = false;
  private completionSound?: Phaser.Sound.BaseSound;

  constructor() {
    super({ key: "CompletionScene" });
  }

  init(data: CompletionData) {
    this.completionData = data;
    this.audioLoadFailed = false;
    this.audioSettled = true;
    this.minimumTimeElapsed = false;
    this.returnedToSelection = false;
    this.completionStarted = false;
    this.completionSound = undefined;
  }

  preload() {
    this.load.json("completion-voiceover-config", "/voiceover.json");
    if (!this.completionData.voiceover) return;
    const key = this.completionSoundKey();
    this.audioSettled = false;
    this.load.audio(key, completionAudioUrl(this.completionData.voiceover.activePackId));
    this.load.on("loaderror", (file: { key?: string }) => {
      if (file?.key === key) this.audioLoadFailed = true;
    });
  }

  create() {
    if (this.completionStarted) return;
    this.completionStarted = true;
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

    if (!this.completionData.voiceover || this.audioLoadFailed || !this.cache?.audio?.exists(this.completionSoundKey())) {
      this.audioSettled = true;
    } else {
      this.playCompletionNarration();
    }
    this.time.delayedCall(2000, () => {
      this.minimumTimeElapsed = true;
      this.returnIfReady();
    });
  }

  private completionSoundKey() { return "voiceover-completion"; }

  private playCompletionNarration() {
    try {
      const sound = this.sound.add(this.completionSoundKey());
      this.completionSound = sound;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.audioSettled = true;
        sound.destroy();
        if (this.completionSound === sound) this.completionSound = undefined;
        this.returnIfReady();
      };
      sound.once("complete", finish);
      sound.once("playerror", finish);
      sound.once("error", finish);
      if (!sound.play()) finish();
    } catch {
      this.audioSettled = true;
    }
  }

  private returnIfReady() {
    if (!this.minimumTimeElapsed || !this.audioSettled || this.returnedToSelection) return;
    this.returnedToSelection = true;
    this.scene.start("SelectionScene", { scrollY: this.completionData.selectionScrollY ?? 0 });
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
