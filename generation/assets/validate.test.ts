import { describe, expect, it } from 'vitest';
import { validateAsset } from './validate.js';

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

describe('PNG asset validation', () => {
  it('accepts a transparent RGBA sprite with clear corners and safe framing', async () => {
    const result = await validateAsset(fixture('transparent-centered.png'));

    expect(result.valid).toBe(true);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.hasAlpha).toBe(true);
    expect(result.transparentCorners).toEqual([true, true, true, true]);
    expect(result.subjectBounds).toEqual({ x: 3, y: 2, width: 4, height: 6 });
  });

  it('rejects an RGB image without an alpha channel', async () => {
    const result = await validateAsset(fixture('opaque-rgb.png'));

    expect(result.hasAlpha).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('missing-alpha-channel');
  });

  it('flags an opaque checkerboard-like corner', async () => {
    const result = await validateAsset(fixture('opaque-corner.png'));

    expect(result.transparentCorners[0]).toBe(false);
    expect(result.issues).toContain('non-transparent-corners');
  });

  it('flags a subject touching the image frame', async () => {
    const result = await validateAsset(fixture('touching-edge.png'));

    expect(result.subjectBounds?.x).toBe(0);
    expect(result.issues).toContain('subject-too-close-to-edge');
  });

  it('reports a centered subject inside the centering tolerance', async () => {
    const result = await validateAsset(fixture('transparent-centered.png'));

    expect(result.centerOffset).toEqual({ x: 0, y: 0 });
    expect(result.issues).not.toContain('subject-off-center');
  });

  it('accepts the approved style anchor as the calibration baseline', async () => {
    const result = await validateAsset(new URL('../../library/assets/style/style-anchor-v1.png', import.meta.url).pathname);

    expect(result.valid).toBe(true);
  });
});
