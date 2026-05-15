import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ConceptBriefSchema, type ConceptBrief } from "shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIEFS_DIR = join(__dirname, "briefs");

let cache: Map<string, ConceptBrief> | null = null;

function load(): Map<string, ConceptBrief> {
  if (cache) return cache;
  cache = new Map();
  const files = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = readFileSync(join(BRIEFS_DIR, file), "utf-8");
    const brief = ConceptBriefSchema.parse(JSON.parse(raw));
    cache.set(brief.id, brief);
  }
  return cache;
}

export function getConceptBrief(id: string): ConceptBrief | undefined {
  return load().get(id);
}

export function listConceptBriefs(): ConceptBrief[] {
  return Array.from(load().values());
}

export function _resetCache() {
  cache = null;
}
