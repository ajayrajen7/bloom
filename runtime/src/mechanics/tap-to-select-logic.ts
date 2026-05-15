export const ITEM_RADIUS = 55;

export interface TapItemConfig {
  id: string;
  label: string;
  assetRef: string;
  x: number;
  y: number;
  isCorrect: boolean;
}

export function isTapCorrect(itemId: string, items: TapItemConfig[]): boolean {
  const item = items.find((i) => i.id === itemId);
  return item?.isCorrect ?? false;
}

export function isActivityComplete(
  tappedCorrectIds: Set<string>,
  items: TapItemConfig[]
): boolean {
  const correctItems = getCorrectItems(items);
  return correctItems.length > 0 && correctItems.every((i) => tappedCorrectIds.has(i.id));
}

export function getCorrectItems(items: TapItemConfig[]): TapItemConfig[] {
  return items.filter((i) => i.isCorrect);
}
