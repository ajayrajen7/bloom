import Phaser from "phaser";
import { SelectionScene } from "./scenes/selection.js";
import { ActivityScene } from "./scenes/activity.js";
import { CompletionScene } from "./scenes/completion.js";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: "#12122a",
  scene: [SelectionScene, ActivityScene, CompletionScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    // Phaser captures touch events through its own system, preventing
    // the DOM scroll-during-drag bug that broke the prior prototype.
    activePointers: 1,
  },
  parent: document.body,
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) {
  const reviewId = new URLSearchParams(window.location.search).get("reviewActivity");
  if (reviewId && /^[A-Za-z0-9_-]+$/.test(reviewId)) {
    game.events.once(Phaser.Core.Events.READY, () => {
      game.scene.stop("SelectionScene");
      game.scene.start("ActivityScene", { activityId: reviewId, review: true });
    });
  }
}
