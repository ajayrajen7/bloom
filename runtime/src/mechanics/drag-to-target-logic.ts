// Pure logic for the drag-to-target mechanic.
// No Phaser dependency — fully unit-testable in Node.

export const SNAP_DISTANCE = 80;
export const ITEM_RADIUS = 55;
export const TARGET_RADIUS = 70;

export interface ItemConfig {
  id: string;
  targetId: string;
  label: string;
  color: number;
  x: number;
  y: number;
}

export interface TargetConfig {
  id: string;
  label: string;
  color: number;
  x: number;
  y: number;
}

export function isNearTarget(
  itemX: number,
  itemY: number,
  targetX: number,
  targetY: number
): boolean {
  const dx = itemX - targetX;
  const dy = itemY - targetY;
  return Math.sqrt(dx * dx + dy * dy) < SNAP_DISTANCE;
}

export function findMatchingTarget(
  itemId: string,
  items: ItemConfig[],
  targets: TargetConfig[]
): TargetConfig | undefined {
  const item = items.find((i) => i.id === itemId);
  if (!item) return undefined;
  return targets.find((t) => t.id === item.targetId);
}
