import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildContactSheet, writeContactSheetReview } from './contact-sheet.js';

const scratchDirs: string[] = [];
const makeWorkspace = async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'bloom-contact-sheet-'));
  scratchDirs.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(scratchDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const entry = (id: string, displayName: string, file: string) => ({
  id,
  displayName,
  category: 'fruit' as const,
  kind: 'canonical' as const,
  file,
  generation: {
    surface: 'chatgpt' as const,
    model: 'unknown',
    modelVersion: 'unknown',
    promptVersion: 'object-sprite.v1',
    styleReferenceVersion: 'style-anchor-v1',
    referenceCondition: 'style-anchor' as const,
    batchId: 'chatgpt-pilot-001',
  },
  manualReview: { decision: 'pending' as const },
});

describe('asset contact sheet', () => {
  it('labels each candidate and flags missing files', async () => {
    const root = await makeWorkspace();
    await copyFile(
      new URL('./fixtures/transparent-centered.png', import.meta.url),
      resolve(root, 'apple.png'),
    );

    const result = await buildContactSheet(
      [entry('apple-v1', 'Red apple', 'apple.png'), entry('banana-v1', 'Banana', 'missing.png')],
      root,
      resolve(root, 'reviews'),
    );

    expect(result.html).toContain('apple-v1');
    expect(result.html).toContain('Red apple');
    expect(result.html).toContain('banana-v1');
    expect(result.missingFiles).toEqual(['banana-v1']);
  });

  it('includes full-size and approximate play-size image views', async () => {
    const root = await makeWorkspace();
    await copyFile(
      new URL('./fixtures/transparent-centered.png', import.meta.url),
      resolve(root, 'apple.png'),
    );

    const result = await buildContactSheet(
      [entry('apple-v1', 'Red apple', 'apple.png')],
      root,
      resolve(root, 'reviews'),
    );

    expect(result.html).toContain('class="full-size"');
    expect(result.html).toContain('class="play-size"');
    expect(result.reviewTemplate.candidates[0].decision).toBe('pending');
  });

  it('preserves prior decisions and lists only pending candidates in the review template', async () => {
    const root = await makeWorkspace();
    await copyFile(
      new URL('./fixtures/transparent-centered.png', import.meta.url),
      resolve(root, 'apple.png'),
    );
    const approved = {
      ...entry('anchor-apple', 'Approved apple anchor', 'apple.png'),
      manualReview: { decision: 'approved' as const, reviewerNotes: 'Approved as the style reference.' },
    };

    const result = await buildContactSheet(
      [approved, entry('banana-v1', 'Banana', 'apple.png')],
      root,
      resolve(root, 'reviews'),
    );

    expect(result.html).toContain('Manual decision: <strong>Approved</strong>');
    expect(result.reviewTemplate.candidates.map((candidate) => candidate.id)).toEqual(['banana-v1']);
    expect(result.reviewTemplate.batchId).toBe('chatgpt-pilot-001');
  });

  it('uses the predominant batch when writing a reviewed sheet with no pending entries', async () => {
    const root = await makeWorkspace();
    await copyFile(
      new URL('./fixtures/transparent-centered.png', import.meta.url),
      resolve(root, 'apple.png'),
    );
    const approvedEntry = (id: string, batchId: string) => ({
      ...entry(id, id, 'apple.png'),
      generation: { ...entry(id, id, 'apple.png').generation, batchId },
      manualReview: { decision: 'approved' as const },
    });
    const manifestPath = resolve(root, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify([
      approvedEntry('style-anchor', 'style-anchor-001'),
      approvedEntry('banana', 'chatgpt-pilot-001'),
      approvedEntry('carrot', 'chatgpt-pilot-001'),
    ]));

    const written = await writeContactSheetReview(manifestPath, resolve(root, 'reviews'));
    const review = JSON.parse(await (await import('node:fs/promises')).readFile(written.reviewPath, 'utf8'));

    expect(written.reviewPath).toContain('chatgpt-pilot-001.json');
    expect(review.batchId).toBe('chatgpt-pilot-001');
  });
});
