import { readFileSync } from "fs";
import { join } from "path";
import { AssetManifestSchema } from "./manifest.js";

/** Approved canonical assets and approved variants of approved canonicals. */
export function approvedRuntimeVisualRefs(assetsDir: string): Set<string> {
  const manifest = AssetManifestSchema.parse(
    JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8"))
  );
  const byId = new Map(manifest.map((entry) => [entry.id, entry]));
  const refs = new Set<string>();
  for (const entry of manifest) {
    if (entry.manualReview.decision !== "approved") continue;
    if (entry.kind === "variant") {
      const canonical = byId.get(entry.canonicalId);
      if (!canonical || canonical.kind !== "canonical" || canonical.manualReview.decision !== "approved") continue;
    }
    refs.add(entry.file);
  }
  return refs;
}
