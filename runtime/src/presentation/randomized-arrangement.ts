import type { Position } from "shared/layout-engine.js";

type Positioned<T> = T & { position: Position };

const MAX_CONSTRAINED_SHUFFLES = 256;

export function arrangeTapChoices<T extends { id: string; isCorrect: boolean }>(
  items: readonly T[],
  positions: readonly Position[],
  seed: string,
): Array<Positioned<T>> {
  assertMatchingCounts("items", items.length, "positions", positions.length);

  const random = seededRandom(`${seed}:tap-choices`);
  const correctCount = items.filter((item) => item.isCorrect).length;
  const hasDistractors = correctCount < items.length;
  const rowCount = uniqueCount(positions.map(({ y }) => y));
  const columnCount = uniqueCount(positions.map(({ x }) => x));
  const maxSpread = Math.min(correctCount, rowCount) + Math.min(correctCount, columnCount);

  let bestOrder: T[] | undefined;
  let bestSpread = -1;

  for (let attempt = 0; attempt < MAX_CONSTRAINED_SHUFFLES; attempt++) {
    const candidate = shuffled(items, random);
    const correctPositions = candidate.flatMap((item, index) => item.isCorrect ? [positions[index]!] : []);
    const keepsCorrectOutOfLeadingPrefix = !hasDistractors
      || candidate.slice(0, correctCount).some((item) => !item.isCorrect);
    if (!keepsCorrectOutOfLeadingPrefix) continue;

    const spread = uniqueCount(correctPositions.map(({ y }) => y))
      + uniqueCount(correctPositions.map(({ x }) => x));
    if (spread > bestSpread) {
      bestOrder = candidate;
      bestSpread = spread;
    }
    if (spread === maxSpread) break;
  }

  const order = bestOrder ?? shuffled(items, random);
  return order.map((item, index) => ({ ...item, position: positions[index]! }));
}

export function arrangeDragRows<
  Target extends { id: string },
  Item extends { id: string; targetId: string },
>(
  targets: readonly Target[],
  targetPositions: readonly Position[],
  items: readonly Item[],
  itemPositions: readonly Position[],
  seed: string,
): { targets: Array<Positioned<Target>>; items: Array<Positioned<Item>> } {
  assertMatchingCounts("targets", targets.length, "positions", targetPositions.length);
  assertMatchingCounts("items", items.length, "positions", itemPositions.length);

  const arrangedTargets = shuffled(targets, seededRandom(`${seed}:target-row`))
    .map((target, index) => ({ ...target, position: targetPositions[index]! }));
  const itemRandom = seededRandom(`${seed}:item-row`);
  let itemOrder: Item[];

  if (isOneToOne(targets, items)) {
    const targetSlots = horizontalSlotRanks(targetPositions);
    const itemSlots = horizontalSlotRanks(itemPositions);
    const targetSlotById = new Map(
      arrangedTargets.map((target, index) => [target.id, targetSlots[index]!]),
    );
    itemOrder = shuffled(items, itemRandom);

    for (let attempt = 0; attempt < MAX_CONSTRAINED_SHUFFLES; attempt++) {
      const candidate = shuffled(items, itemRandom);
      if (candidate.every((item, index) => targetSlotById.get(item.targetId) !== itemSlots[index])) {
        itemOrder = candidate;
        break;
      }
    }
  } else {
    itemOrder = shuffled(items, itemRandom);
  }

  return {
    targets: arrangedTargets,
    items: itemOrder.map((item, index) => ({ ...item, position: itemPositions[index]! })),
  };
}

function isOneToOne<Target extends { id: string }, Item extends { targetId: string }>(
  targets: readonly Target[],
  items: readonly Item[],
): boolean {
  if (targets.length !== items.length || new Set(targets.map(({ id }) => id)).size !== targets.length) {
    return false;
  }

  const references = new Map(targets.map(({ id }) => [id, 0]));
  for (const item of items) {
    const count = references.get(item.targetId);
    if (count === undefined) return false;
    references.set(item.targetId, count + 1);
  }
  return [...references.values()].every((count) => count === 1);
}

function horizontalSlotRanks(positions: readonly Position[]): number[] {
  const slots = [...new Set(positions.map(({ x }) => x))].sort((a, b) => a - b);
  const rankByX = new Map(slots.map((x, rank) => [x, rank]));
  return positions.map(({ x }) => rankByX.get(x)!);
}

function assertMatchingCounts(
  firstLabel: string,
  firstCount: number,
  secondLabel: string,
  secondCount: number,
): void {
  if (firstCount !== secondCount) {
    throw new Error(`Cannot arrange ${firstCount} ${firstLabel} across ${secondCount} ${secondLabel}`);
  }
}

function uniqueCount(values: readonly number[]): number {
  return new Set(values).size;
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}
