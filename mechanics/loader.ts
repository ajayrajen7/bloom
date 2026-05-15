import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { MechanicSpecSchema, type MechanicSpec } from "shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = join(__dirname, "specs");

const MECHANIC_FILES: Record<string, string> = {
  "drag-to-target": "drag-to-target.yaml",
  "tap-to-select": "tap-to-select.yaml",
};

let cache: Map<string, MechanicSpec> | null = null;

function load(): Map<string, MechanicSpec> {
  if (cache) return cache;
  cache = new Map();
  for (const [id, filename] of Object.entries(MECHANIC_FILES)) {
    const raw = readFileSync(join(SPECS_DIR, filename), "utf-8");
    const parsed = yaml.load(raw);
    const spec = MechanicSpecSchema.parse(parsed);
    cache.set(id, spec);
  }
  return cache;
}

export function getMechanicSpec(mechanicId: string): MechanicSpec | undefined {
  return load().get(mechanicId);
}

export function listMechanicSpecs(): MechanicSpec[] {
  return Array.from(load().values());
}

export function getLayoutVariant(mechanicId: string, layoutId: string) {
  return load().get(mechanicId)?.layouts.find((l) => l.id === layoutId);
}

export function _resetCache() {
  cache = null;
}
