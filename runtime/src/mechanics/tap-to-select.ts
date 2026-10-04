import Phaser from "phaser";
import { playSuccess, playError } from "../audio.js";
import { requireLoadedSpriteTexture } from "../assets/sprite-registry.js";
import type { MechanicVisualConfig } from "./visual-config.js";
import {
  isTapCorrect,
  isActivityComplete,
  getCorrectItems,
  ITEM_RADIUS,
  type TapItemConfig,
} from "./tap-to-select-logic.js";

export type { TapItemConfig };
export { ITEM_RADIUS };

export interface TapToSelectCallbacks {
  onCorrectTap: (itemId: string) => void;
  onIncorrectTap: (itemId: string) => void;
  onComplete: () => void;
}

export class TapToSelectMechanic {
  private scene: Phaser.Scene;
  private items: TapItemConfig[];
  private callbacks: TapToSelectCallbacks;
  private visuals: MechanicVisualConfig;

  private itemObjects = new Map<string, Phaser.GameObjects.Container>();
  private tappedCorrect = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    items: TapItemConfig[],
    callbacks: TapToSelectCallbacks,
    visuals: MechanicVisualConfig
  ) {
    this.scene = scene;
    this.items = items;
    this.callbacks = callbacks;
    this.visuals = visuals;

    this.buildItems();
  }

  private buildItems() {
    this.items.forEach((cfg) => {
      const container = this.scene.add.container(cfg.x, cfg.y);

      const key = requireLoadedSpriteTexture(cfg.assetRef, (textureKey) => this.scene.textures.exists(textureKey));
      const img = this.scene.add
        .image(0, 0, key)
        .setDisplaySize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);
      container.add(img);

      const label = this.scene.add
        .text(0, ITEM_RADIUS + 14, cfg.label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "22px",
          color: this.visuals.labelColor,
        })
        .setOrigin(0.5, 0);

      container.add(label);
      container.setData("itemId", cfg.id);
      container.setData("img", img);
      container.setSize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);
      container.setInteractive();

      container.on("pointerdown", () => this.handleTap(cfg.id, container));

      this.itemObjects.set(cfg.id, container);
    });
  }

  private handleTap(
    itemId: string,
    container: Phaser.GameObjects.Container,
  ) {
    if (this.tappedCorrect.has(itemId)) return;

    if (isTapCorrect(itemId, this.items)) {
      this.tappedCorrect.add(itemId);
      container.disableInteractive();
      this.pulseCorrect(container);
      playSuccess();
      this.callbacks.onCorrectTap(itemId);

      if (isActivityComplete(this.tappedCorrect, this.items)) {
        this.scene.time.delayedCall(400, () => {
          this.callbacks.onComplete();
        });
      }
    } else {
      this.shakeIncorrect(container);
      playError();
      this.callbacks.onIncorrectTap(itemId);
    }
  }

  private pulseCorrect(container: Phaser.GameObjects.Container) {
    const img = container.getData("img") as Phaser.GameObjects.Image | null;
    if (img) img.setTint(this.visuals.feedbackColor);

    this.scene.tweens.add({
      targets: container,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: "Sine.InOut",
    });
  }

  private shakeIncorrect(container: Phaser.GameObjects.Container) {
    this.scene.tweens.add({
      targets: container,
      x: container.x + 10,
      duration: 40,
      yoyo: true,
      repeat: 3,
      ease: "Sine.InOut",
      onComplete: () => container.setPosition(container.x, container.y),
    });
  }

  getTappedCount(): number {
    return this.tappedCorrect.size;
  }

  getCorrectCount(): number {
    return getCorrectItems(this.items).length;
  }

  destroy() {
    this.itemObjects.forEach((obj) => obj.destroy());
  }
}
