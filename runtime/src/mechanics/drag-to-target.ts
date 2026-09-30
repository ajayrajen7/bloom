import Phaser from "phaser";
import { playSuccess, playError, playCelebration } from "../audio.js";
import { requireLoadedSpriteTexture } from "../assets/sprite-registry.js";
import type { MechanicVisualConfig } from "./visual-config.js";
import {
  findMatchingTarget,
  isInsideTarget,
  planItemDrop,
  BIN_WIDTH,
  BIN_HEIGHT,
  type DropPlan,
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

// ── Phaser mechanic class ─────────────────────────────────────────────────────

export class DragToTargetMechanic {
  private scene: Phaser.Scene;
  private items: ItemConfig[];
  private targets: TargetConfig[];
  private callbacks: DragToTargetCallbacks;
  private visuals: MechanicVisualConfig;

  private itemObjects = new Map<string, Phaser.GameObjects.Container>();
  private targetObjects = new Map<string, Phaser.GameObjects.Container>();
  private placedItems = new Set<string>();
  private placedTargets = new Map<string, string>();

  constructor(
    scene: Phaser.Scene,
    items: ItemConfig[],
    targets: TargetConfig[],
    callbacks: DragToTargetCallbacks,
    visuals: MechanicVisualConfig
  ) {
    this.scene = scene;
    this.items = items;
    this.targets = targets;
    this.callbacks = callbacks;
    this.visuals = visuals;

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
      this.drawTarget(ring, cfg, false);

      const children: Phaser.GameObjects.GameObject[] = [ring];

      if (cfg.assetRef) {
        const key = requireLoadedSpriteTexture(cfg.assetRef, (textureKey) => this.scene.textures.exists(textureKey));
        const ghost = this.scene.add
          .image(0, cfg.capacity === 3 ? -58 : 0, key)
          .setDisplaySize(cfg.capacity === 3 ? 70 : TARGET_RADIUS * 1.6, cfg.capacity === 3 ? 70 : TARGET_RADIUS * 1.6)
          .setAlpha(cfg.capacity === 3 ? 0.9 : 0.35);
        children.push(ghost);
      }

      const label = this.scene.add.text(0, cfg.capacity === 3 ? -12 : TARGET_RADIUS + 20, cfg.label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: this.visuals.labelColor,
      }).setOrigin(0.5, 0).setAlpha(cfg.capacity === 3 ? 1 : 0.7);
      children.push(label);

      if (cfg.capacity === 3) {
        for (const offset of [-115, 0, 115]) {
          const parking = this.scene.add.circle(offset, 48, 34, cfg.color, 0.15);
          parking.setStrokeStyle(2, cfg.color, 0.45);
          children.push(parking);
        }
      }

      container.add(children);
      container.setData("ring", ring);
      this.targetObjects.set(cfg.id, container);
    });
  }

  // ── Build items ─────────────────────────────────────────────────────────────

  private buildItems() {
    this.items.forEach((cfg) => {
      const container = this.scene.add.container(cfg.x, cfg.y);

      const key = requireLoadedSpriteTexture(cfg.assetRef, (textureKey) => this.scene.textures.exists(textureKey));
      const visual = this.scene.add
        .image(0, 0, key)
        .setDisplaySize(ITEM_RADIUS * 2, ITEM_RADIUS * 2);

      const label = this.scene.add.text(0, ITEM_RADIUS + 14, cfg.label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: this.visuals.labelColor,
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

        this.clearTargetHighlights();
        this.resolveItemDrop(itemId, obj);
      }
    );
  }

  // ── Drop resolution ──────────────────────────────────────────────────────────

  private resolveItemDrop(itemId: string, obj: Phaser.GameObjects.Container) {
    const plan = planItemDrop(itemId, obj.x, obj.y, this.items, this.targets, this.placedTargets);
    const targetObj = plan && this.targetObjects.get(plan.targetId);
    if (plan && targetObj) {
      this.snapToTarget(itemId, obj, targetObj, plan);
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
    plan: DropPlan
  ) {
    this.scene.input.setDraggable(obj, false);
    this.placedItems.add(itemId);
    this.placedTargets.set(itemId, plan.targetId);
    const matchedTarget = this.targets.find((target) => target.id === plan.targetId);
    if (!matchedTarget?.capacity) {
      // The target already carries the matching label. Hide the item label once
      // the item is parked so the two labels do not overlap in the target row.
      (obj.getAt(1) as Phaser.GameObjects.Text | undefined)?.setVisible(false);
    }

    this.scene.tweens.add({
      targets: obj,
      x: plan.position.x,
      y: plan.position.y,
      scaleX: plan.scale,
      scaleY: plan.scale,
      duration: 180,
      ease: "Back.Out",
      onComplete: () => {
        this.pulseSuccess(obj, targetObj);
        playSuccess();
        this.callbacks.onItemPlaced(itemId, plan.targetId);

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
      const isNear = isCorrect && isInsideTarget(dragX, dragY, t);

      // Highlight correct target when near; dim everything else
      this.drawTarget(ring, t, Boolean(isNear));
    });
  }

  private clearTargetHighlights() {
    this.targets.forEach((t) => {
      const obj = this.targetObjects.get(t.id);
      if (!obj) return;
      const ring = obj.getData("ring") as Phaser.GameObjects.Graphics;
      this.drawTarget(ring, t, false);
    });
  }

  private drawTarget(graphics: Phaser.GameObjects.Graphics, target: TargetConfig, highlighted: boolean) {
    graphics.clear();
    graphics.lineStyle(highlighted ? 5 : 4, target.color, highlighted ? 0.95 : 0.5);
    graphics.fillStyle(target.color, highlighted ? 0.28 : 0.12);
    if (target.capacity === 3) {
      graphics.fillRoundedRect(-BIN_WIDTH / 2, -BIN_HEIGHT / 2, BIN_WIDTH, BIN_HEIGHT, 24);
      graphics.strokeRoundedRect(-BIN_WIDTH / 2, -BIN_HEIGHT / 2, BIN_WIDTH, BIN_HEIGHT, 24);
    } else {
      graphics.strokeCircle(0, 0, TARGET_RADIUS);
      graphics.fillCircle(0, 0, TARGET_RADIUS);
    }
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
