import Phaser from "phaser";
import { BootScene } from "./scenes/boot.js";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: "#1a1a2e",
  scene: [BootScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  parent: document.body,
};

new Phaser.Game(config);
