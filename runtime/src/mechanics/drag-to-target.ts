import Phaser from "phaser";
import { playSuccess, playError, playCelebration } from "../audio.js";
import {
  isNearTarget,
  findMatchingTarget,
  SNAP_DISTANCE,
  ITEM_RADIUS,
  TARGET_RADIUS,
  type ItemConfig,
  type TargetConfig,
} from "./drag-to-target-logic.js";

export type { ItemConfig, TargetConfig };
export { SNAP_DISTANCE, ITEM_RADIUS, TARGET_RADIUS };

export interface DragToTargetCallbacks {
  onItemPlaced: (itemId: string, targetId: string) => void;
  onItemError: (itemId: string) => void;
  onComplete: () => void;
}

function assetKey(assetRef: string | undefined): string | null {
  if (!assetRef) return null;
  return (assetRef.split("/").pop() ?? "").replace(".png", "");
}

// ── Phaser mechanic class ─────────────────────────────────────────────────────

export class DragToTargetMechanic {
  private scene: Phaser.Scene;
  private items: ItemConfig[];
  private targets: TargetConfig[];
  private callbacks: DragToTargetCallbacks;

  private itemObjects = new Map<string, Phaser.GameObjects.Container>();
  private targetObjects = new Map<string, Phaser.GameObjects.Container>();
  private placedItems = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    items: ItemConfig[],
    targets: TargetConfig[],
    callbacks: DragToTargetCallbacks
  ) {
    this.scene = scene;
    this.items = items;
    this.targets = targets;
    this.callbacks = callbacks;

    this.buildTargets();
    this.buildItems();
    this.bindDragEvents();
  }

  // ── Build targets ───────────────────────────────────────────────────────────

  private buildTargets() {
    this.targets.forEach((cfg) => {
      const container = this.scene.add.container(cfg.x, cfg.y);

      // Drop zone ring
      const ring = this.scene.add.graphics();
      ring.lineStyle(4, cfg.color, 0.5);
      ring.strokeCircle(0, 0, TARGET_RADIUS);
      ring.fillStyle(cfg.color, 0.12);
      ring.fillCircle(0, 0, TARGET_RADIUS);

      const key = assetKey(cfg.assetRef);
      const children: Phaser.GameObjects.GameObject[] = [ring];

      if (key && this.scene.textures.exists(key)) {
        const ghost = this.scene.add
          .image(0, 0, key)
          .setDisplaySize(TARGET_RADIUS * 1.6, TARGET_RADIUS * 1.6)
          .setAlpha(0.35);
        children.push(ghost);
      }

      const label = this.scene.add.text(0, TARGET_RADIUS + 20, cfg.label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
        alpha: 0.7,
      }).setOrigin(0.5, 0);
      children.push(label);

      container.add(children);
      container.setData("ring", ring);
      this.targetObjects.set(cfg.id, container);
    });
  }

  // ── Build items ─────────────────────────────────────────────────────────────

  private buildItems() {
    this.items.forEach((cfg) => {
      const container = this.scene.add.container(cfg.x, cfg.y);

      const key = assetKey(cfg.assetRef);
      let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (key && this.scene.textures.exists(key)) {
        visual = this.scene.add
          .image(0, 0, key)
          .setDisplaySize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);
      } else {
        const g = this.scene.add.graphics();
        g.fillStyle(cfg.color, 1);
        g.fillCircle(0, 0, ITEM_RADIUS);
        g.fillStyle(0xffffff, 0.15);
        g.fillCircle(-12, -14, 18);
        visual = g;
      }

      const label = this.scene.add.text(0, ITEM_RADIUS + 14, cfg.label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
      }).setOrigin(0.5, 0);

      container.add([visual, label]);
      container.setData("itemId", cfg.id);
      container.setData("startX", cfg.x);
      container.setData("startY", cfg.y);

      // Hit area = circle
      container.setSize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);
      container.setInteractive();
      this.scene.input.setDraggable(container);

      this.itemObjects.set(cfg.id, container);
    });
  }

  // ── Drag events ─────────────────────────────────────────────────────────────

  private bindDragEvents() {
    this.scene.input.on(
      Phaser.Input.Events.DRAG_START,
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        const itemId = obj.getData("itemId") as string | undefined;
        if (!itemId || this.placedItems.has(itemId)) return;

        this.scene.children.bringToTop(obj);
        this.scene.tweens.add({
          targets: obj,
          scaleX: 1.12,
          scaleY: 1.12,
          duration: 80,
          ease: "Sine.Out",
        });
      }
    );

    this.scene.input.on(
      Phaser.Input.Events.DRAG,
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.Container,
        dragX: number,
        dragY: number
      ) => {
        const itemId = obj.getData("itemId") as string | undefined;
        if (!itemId || this.placedItems.has(itemId)) return;

        obj.setPosition(dragX, dragY);
        this.updateTargetHighlights(itemId, dragX, dragY);
      }
    );

    this.scene.input.on(
      Phaser.Input.Events.DRAG_END,
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        const itemId = obj.getData("itemId") as string | undefined;
        if (!itemId || this.placedItems.has(itemId)) return;

        this.scene.tweens.add({
          targets: obj,
          scaleX: 1,
          scaleY: 1,
          duration: 80,
        });

        this.clearTargetHighlights();
        this.resolveItemDrop(itemId, obj);
      }
    );
  }

  // ── Drop resolution ──────────────────────────────────────────────────────────

  private resolveItemDrop(itemId: string, obj: Phaser.GameObjects.Container) {
    const correctTarget = findMatchingTarget(itemId, this.items, this.targets);
    if (!correctTarget) return;

    const targetObj = this.targetObjects.get(correctTarget.id);
    if (!targetObj) return;

    const nearCorrect = isNearTarget(obj.x, obj.y, correctTarget.x, correctTarget.y);

    if (nearCorrect) {
      this.snapToTarget(itemId, obj, targetObj, correctTarget);
    } else {
      this.bounceBack(obj);
      this.callbacks.onItemError(itemId);
      playError();
    }
  }

  private snapToTarget(
    itemId: string,
    obj: Phaser.GameObjects.Container,
    targetObj: Phaser.GameObjects.Container,
    target: TargetConfig
  ) {
    this.scene.input.setDraggable(obj, false);
    this.placedItems.add(itemId);

    this.scene.tweens.add({
      targets: obj,
      x: target.x,
      y: target.y,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 180,
      ease: "Back.Out",
      onComplete: () => {
        this.pulseSuccess(obj, targetObj);
        playSuccess();
        this.callbacks.onItemPlaced(itemId, target.id);

        if (this.placedItems.size === this.items.length) {
          this.scene.time.delayedCall(400, () => {
            playCelebration();
            this.callbacks.onComplete();
          });
        }
      },
    });
  }

  private bounceBack(obj: Phaser.GameObjects.Container) {
    const startX = obj.getData("startX") as number;
    const startY = obj.getData("startY") as number;

    this.scene.tweens.add({
      targets: obj,
      x: startX,
      y: startY,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: "Back.Out",
    });
  }

  // ── Visual feedback ──────────────────────────────────────────────────────────

  private updateTargetHighlights(itemId: string, dragX: number, dragY: number) {
    const correctTarget = findMatchingTarget(itemId, this.items, this.targets);

    this.targets.forEach((t) => {
      const obj = this.targetObjects.get(t.id);
      if (!obj) return;
      const ring = obj.getData("ring") as Phaser.GameObjects.Graphics;
      const isCorrect = correctTarget && t.id === correctTarget.id;
      const isNear = isCorrect && isNearTarget(dragX, dragY, t.x, t.y);

      // Highlight correct target when near; dim everything else
      if (isNear) {
        ring.clear();
        ring.lineStyle(5, t.color, 0.95);
        ring.strokeCircle(0, 0, TARGET_RADIUS);
        ring.fillStyle(t.color, 0.28);
        ring.fillCircle(0, 0, TARGET_RADIUS);
      } else {
        ring.clear();
        ring.lineStyle(4, t.color, 0.5);
        ring.strokeCircle(0, 0, TARGET_RADIUS);
        ring.fillStyle(t.color, 0.12);
        ring.fillCircle(0, 0, TARGET_RADIUS);
      }
    });
  }

  private clearTargetHighlights() {
    this.targets.forEach((t) => {
      const obj = this.targetObjects.get(t.id);
      if (!obj) return;
      const ring = obj.getData("ring") as Phaser.GameObjects.Graphics;
      ring.clear();
      ring.lineStyle(4, t.color, 0.5);
      ring.strokeCircle(0, 0, TARGET_RADIUS);
      ring.fillStyle(t.color, 0.12);
      ring.fillCircle(0, 0, TARGET_RADIUS);
    });
  }

  private pulseSuccess(
    item: Phaser.GameObjects.Container,
    _target: Phaser.GameObjects.Container
  ) {
    this.scene.tweens.add({
      targets: item,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 120,
      yoyo: true,
      repeat: 1,
    });
  }

  destroy() {
    this.scene.input.off(Phaser.Input.Events.DRAG_START);
    this.scene.input.off(Phaser.Input.Events.DRAG);
    this.scene.input.off(Phaser.Input.Events.DRAG_END);
    this.itemObjects.forEach((obj) => obj.destroy());
    this.targetObjects.forEach((obj) => obj.destroy());
  }
}
