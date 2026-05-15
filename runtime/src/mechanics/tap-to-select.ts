import Phaser from "phaser";
import { playSuccess, playError, playCelebration } from "../audio.js";
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

function assetKey(assetRef: string | undefined): string | null {
  if (!assetRef) return null;
  return (assetRef.split("/").pop() ?? "").replace(".png", "");
}

export class TapToSelectMechanic {
  private scene: Phaser.Scene;
  private items: TapItemConfig[];
  private callbacks: TapToSelectCallbacks;

  private itemObjects = new Map<string, Phaser.GameObjects.Container>();
  private tappedCorrect = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    items: TapItemConfig[],
    callbacks: TapToSelectCallbacks
  ) {
    this.scene = scene;
    this.items = items;
    this.callbacks = callbacks;

    this.buildItems();
  }

  private buildItems() {
    this.items.forEach((cfg) => {
      const container = this.scene.add.container(cfg.x, cfg.y);

      const key = assetKey(cfg.assetRef);
      let img: Phaser.GameObjects.Image | null = null;

      if (key && this.scene.textures.exists(key)) {
        img = this.scene.add
          .image(0, 0, key)
          .setDisplaySize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);
        container.add(img);
      } else {
        const circle = this.scene.add.graphics();
        circle.fillStyle(0x4a90d9, 1);
        circle.fillCircle(0, 0, ITEM_RADIUS);
        circle.fillStyle(0xffffff, 0.15);
        circle.fillCircle(-12, -14, 18);
        container.add(circle);
      }

      const label = this.scene.add
        .text(0, ITEM_RADIUS + 14, cfg.label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "22px",
          color: "#ffffff",
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
          playCelebration();
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
    if (img) img.setTint(0x50c878);

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
