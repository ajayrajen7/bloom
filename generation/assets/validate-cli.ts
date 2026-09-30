import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AssetManifestSchema } from './manifest.js';
import { validateAsset } from './validate.js';

export async function validateManifest(manifestPath: string): Promise<number> {
  const absoluteManifestPath = resolve(manifestPath);
  const manifest = AssetManifestSchema.parse(JSON.parse(await readFile(absoluteManifestPath, 'utf8')));
  let invalidCount = 0;

  for (const entry of manifest) {
    const assetPath = resolve(dirname(absoluteManifestPath), entry.file);
    try {
      const result = await validateAsset(assetPath);
      if (!result.valid) invalidCount += 1;
      process.stdout.write(`${JSON.stringify({ id: entry.id, file: entry.file, ...result })}\n`);
    } catch (error) {
      invalidCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`${JSON.stringify({
        id: entry.id,
        file: entry.file,
        valid: false,
        issues: [`file-unreadable: ${message}`],
      })}\n`);
    }
  }

  if (manifest.length === 0) process.stdout.write('No assets in manifest.\n');
  return invalidCount;
}

const args = process.argv.slice(2).filter((argument) => argument !== '--');
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (args.length !== 1) {
    process.stderr.write('Usage: assets:validate -- <manifest.json>\n');
    process.exitCode = 2;
  } else {
    const invalidCount = await validateManifest(args[0]);
    if (invalidCount > 0) process.exitCode = 1;
  }
}
