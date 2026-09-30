import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

export interface AssetValidationResult {
  valid: boolean;
  width: number;
  height: number;
  hasAlpha: boolean;
  transparentCorners: [boolean, boolean, boolean, boolean];
  subjectBounds: { x: number; y: number; width: number; height: number } | null;
  centerOffset: { x: number; y: number } | null;
  occupancy: number;
  issues: string[];
}

const CORNER_POINTS = [
  [0, 0],
  [-1, 0],
  [0, -1],
  [-1, -1],
] as const;
const SAFE_MARGIN_RATIO = 0.01;
const CENTER_TOLERANCE_RATIO = 0.08;

export async function validateAsset(filePath: string): Promise<AssetValidationResult> {
  const buffer = await readFile(filePath);
  const image = PNG.sync.read(buffer);
  const { width, height, data } = image;
  const colorType = buffer[25];
  const hasAlpha = colorType === 4 || colorType === 6;
  const pixelAlpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const transparentCorners = CORNER_POINTS.map(([x, y]) =>
    pixelAlpha(x < 0 ? width + x : x, y < 0 ? height + y : y) === 0,
  ) as [boolean, boolean, boolean, boolean];
  const issues: string[] = [];

  if (!hasAlpha) issues.push('missing-alpha-channel');
  if (transparentCorners.some((transparent) => !transparent)) issues.push('non-transparent-corners');
  if (width !== height) issues.push('non-square-canvas');

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixelAlpha(x, y) > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    issues.push('no-visible-subject');
    return {
      valid: false,
      width,
      height,
      hasAlpha,
      transparentCorners,
      subjectBounds: null,
      centerOffset: null,
      occupancy: 0,
      issues,
    };
  }

  const subjectBounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  const centerOffset = {
    x: minX + subjectBounds.width / 2 - width / 2,
    y: minY + subjectBounds.height / 2 - height / 2,
  };
  const occupancy = (subjectBounds.width * subjectBounds.height) / (width * height);
  const safeMargin = Math.min(width, height) * SAFE_MARGIN_RATIO;
  const rightMargin = width - (minX + subjectBounds.width);
  const bottomMargin = height - (minY + subjectBounds.height);
  if (minX < safeMargin || minY < safeMargin || rightMargin < safeMargin || bottomMargin < safeMargin) {
    issues.push('subject-too-close-to-edge');
  }
  if (
    Math.abs(centerOffset.x) > width * CENTER_TOLERANCE_RATIO
    || Math.abs(centerOffset.y) > height * CENTER_TOLERANCE_RATIO
  ) {
    issues.push('subject-off-center');
  }

  return {
    valid: issues.length === 0,
    width,
    height,
    hasAlpha,
    transparentCorners,
    subjectBounds,
    centerOffset,
    occupancy,
    issues,
  };
}
