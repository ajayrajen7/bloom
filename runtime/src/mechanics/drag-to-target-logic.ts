// Pure logic for the drag-to-target mechanic.
// No Phaser dependency — fully unit-testable in Node.

export const SNAP_DISTANCE = 80;
export const ITEM_RADIUS = 55;
export const TARGET_RADIUS = 70;
export const BIN_WIDTH = 420;
export const BIN_HEIGHT = 230;

export interface ItemConfig {
  id: string;
  targetId: string;
  label: string;
  color: number;
  x: number;
  y: number;
  assetRef?: string;
}

export interface TargetConfig {
  id: string;
  label: string;
  color: number;
  x: number;
  y: number;
  assetRef?: string;
  capacity?: number;
}

export interface DropPlan {
  targetId: string;
  position: { x: number; y: number };
  scale: number;
}

export function getTargetParkingPositions(target: TargetConfig): Array<{ x: number; y: number }> {
  if (target.capacity === 3) {
    return [-115, 0, 115].map((offset) => ({ x: target.x + offset, y: target.y + 48 }));
  }
  return [{ x: target.x, y: target.y }];
}

export function isInsideTarget(x: number, y: number, target: TargetConfig): boolean {
  return target.capacity === 3
    ? Math.abs(x - target.x) <= BIN_WIDTH / 2 && Math.abs(y - target.y) <= BIN_HEIGHT / 2
    : isNearTarget(x, y, target.x, target.y);
}

export function planItemDrop(
  itemId: string,
  x: number,
  y: number,
  items: ItemConfig[],
  targets: TargetConfig[],
  placed: ReadonlyMap<string, string>
): DropPlan | undefined {
  if (placed.has(itemId)) return undefined;
  const target = findMatchingTarget(itemId, items, targets);
  if (!target || !isInsideTarget(x, y, target)) return undefined;
  const occupied = [...placed.values()].filter((id) => id === target.id).length;
  const position = getTargetParkingPositions(target)[occupied];
  if (!position) return undefined;
  return { targetId: target.id, position, scale: target.capacity === 3 ? 0.56 : 0.85 };
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
