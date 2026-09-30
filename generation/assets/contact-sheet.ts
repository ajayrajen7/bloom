import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AssetManifestSchema, type AssetManifest } from './manifest.js';
import { validateAsset, type AssetValidationResult } from './validate.js';

interface ReviewCandidate {
  id: string;
  decision: 'pending';
  reviewerNotes: '';
  reviewedAt: null;
}

interface CandidateView {
  entry: AssetManifest[number];
  imageUrl: string;
  missing: boolean;
  validation: AssetValidationResult | null;
  validationError: string | null;
}

export interface ContactSheetResult {
  html: string;
  reviewTemplate: { batchId: string; candidates: ReviewCandidate[] };
  missingFiles: string[];
}

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toRelativeUrl = (fromDirectory: string, targetPath: string) =>
  relative(fromDirectory, targetPath)
    .split(sep)
    .map((part) => encodeURIComponent(part))
    .join('/');

const formatMetadata = (entry: AssetManifest[number], validation: AssetValidationResult | null, validationError: string | null) => ({
  category: entry.category,
  kind: entry.kind,
  generation: entry.generation,
  metrics: entry.metrics ?? validation,
  validationError,
});

export async function buildContactSheet(
  entries: AssetManifest,
  assetsRoot: string,
  outputDirectory: string,
): Promise<ContactSheetResult> {
  const absoluteAssetsRoot = resolve(assetsRoot);
  const absoluteOutputDirectory = resolve(outputDirectory);
  const views: CandidateView[] = [];
  const missingFiles: string[] = [];

  for (const entry of entries) {
    const assetPath = resolve(absoluteAssetsRoot, entry.file);
    const imageUrl = toRelativeUrl(absoluteOutputDirectory, assetPath);
    try {
      await access(assetPath);
      try {
        views.push({ entry, imageUrl, missing: false, validation: await validateAsset(assetPath), validationError: null });
      } catch (error) {
        views.push({
          entry,
          imageUrl,
          missing: false,
          validation: null,
          validationError: error instanceof Error ? error.message : String(error),
        });
      }
    } catch {
      missingFiles.push(entry.id);
      views.push({ entry, imageUrl, missing: true, validation: null, validationError: null });
    }
  }

  const candidatesHtml = views.map(({ entry, imageUrl, missing, validation, validationError }) => {
    const title = escapeHtml(entry.displayName);
    const id = escapeHtml(entry.id);
    const provenance = escapeHtml(JSON.stringify(formatMetadata(entry, validation, validationError), null, 2));
    const fileStatus = missing
      ? '<p class="file-status missing">Missing file</p>'
      : validationError
        ? `<p class="file-status invalid">Could not validate: ${escapeHtml(validationError)}</p>`
        : `<p class="file-status">Validation: ${validation?.valid ? 'passed' : 'issues found'}</p>`;
    const image = missing
      ? '<div class="placeholder">Image file is missing</div>'
      : `<a href="${escapeHtml(imageUrl)}" target="_blank" rel="noreferrer"><img class="full-size" src="${escapeHtml(imageUrl)}" alt="Full-size ${title}"></a>`;
    const decision = entry.manualReview.decision[0].toUpperCase() + entry.manualReview.decision.slice(1);
    const reviewerNotes = entry.manualReview.reviewerNotes
      ? `<p class="reviewer-notes">Reviewer notes: ${escapeHtml(entry.manualReview.reviewerNotes)}</p>`
      : '';
    return `<article class="candidate" id="${id}">
      <header><h2>${title}</h2><code>${id}</code></header>
      ${fileStatus}
      <div class="views"><section><h3>Full-size</h3>${image}</section>
      <section><h3>Play-size preview (180 × 180)</h3><div class="play-size">${missing ? '<div class="placeholder">Missing</div>' : `<img src="${escapeHtml(imageUrl)}" alt="Play-size ${title}">`}</div></section></div>
      <details><summary>Generation and validation details</summary><pre>${provenance}</pre></details>
      <p class="decision">Manual decision: <strong>${decision}</strong></p>${reviewerNotes}
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bloom asset review</title><style>
body{font:16px system-ui,sans-serif;margin:0;background:#f4f1ec;color:#222}main{max-width:1200px;margin:auto;padding:24px}h1{margin-top:0}.notice{background:#fff5d7;padding:12px 16px;border-radius:8px}.candidate{background:white;border:1px solid #ddd;border-radius:12px;margin:20px 0;padding:20px}.candidate header{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}.candidate h2{margin:0}.candidate code{color:#555}.views{display:flex;gap:24px;align-items:start;flex-wrap:wrap}.views section{min-width:220px}.full-size{display:block;max-width:100%;max-height:480px;object-fit:contain;background:#f3f3f3}.play-size{width:180px;height:180px;display:grid;place-items:center;background:#e5e5e5;border:1px solid #aaa}.play-size img{width:100%;height:100%;object-fit:contain}.file-status.missing,.file-status.invalid{color:#a21818;font-weight:700}.placeholder{color:#a21818;padding:12px}details{margin-top:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f6f6;padding:12px}.decision{border-top:1px solid #ddd;padding-top:12px}
</style></head><body><main><h1>Bloom asset review</h1>
<p class="notice">Pending candidates need human review. Automated validation is evidence only and does not approve assets; prior manual decisions are preserved.</p>
${candidatesHtml || '<p>No candidate assets in this manifest.</p>'}
</main></body></html>`;

  const pendingEntries = entries.filter((entry) => entry.manualReview.decision === 'pending');
  const batchCounts = new Map<string, number>();
  entries.forEach((entry) => batchCounts.set(entry.generation.batchId, (batchCounts.get(entry.generation.batchId) ?? 0) + 1));
  const predominantBatch = [...batchCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const batchId = pendingEntries[0]?.generation.batchId ?? predominantBatch ?? 'empty';
  const reviewTemplate = {
    batchId,
    candidates: pendingEntries.map((entry) => ({ id: entry.id, decision: 'pending' as const, reviewerNotes: '' as const, reviewedAt: null })),
  };
  return { html, reviewTemplate, missingFiles };
}

export async function writeContactSheetReview(manifestPath: string, outputDirectory?: string) {
  const absoluteManifestPath = resolve(manifestPath);
  const entries = AssetManifestSchema.parse(JSON.parse(await readFile(absoluteManifestPath, 'utf8')));
  const destinationDirectory = resolve(outputDirectory ?? resolve(dirname(absoluteManifestPath), 'reviews'));
  const result = await buildContactSheet(entries, dirname(absoluteManifestPath), destinationDirectory);
  await mkdir(destinationDirectory, { recursive: true });
  const htmlPath = resolve(destinationDirectory, 'contact-sheet.html');
  const reviewPath = resolve(destinationDirectory, `${result.reviewTemplate.batchId}.json`);
  await writeFile(htmlPath, result.html, 'utf8');
  await writeFile(reviewPath, `${JSON.stringify(result.reviewTemplate, null, 2)}\n`, 'utf8');
  return { htmlPath, reviewPath, missingFiles: result.missingFiles };
}

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (args.length < 1 || args.length > 2) {
    process.stderr.write('Usage: node --import tsx/esm generation/assets/contact-sheet.ts <manifest.json> [output-directory]\n');
    process.exitCode = 2;
  } else {
    const result = await writeContactSheetReview(args[0], args[1]);
    process.stdout.write(`Wrote ${result.htmlPath}\nWrote pending review template ${result.reviewPath}\n`);
    if (result.missingFiles.length > 0) {
      process.stdout.write(`Missing asset files: ${result.missingFiles.join(', ')}\n`);
    }
  }
}
