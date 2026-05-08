import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, "Bloom", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "96px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 80, "Loading…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#888888",
      })
      .setOrigin(0.5);
  }
}
