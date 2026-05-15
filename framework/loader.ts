import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { DivisionSchema, type Division } from "shared/types.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FrameworkFileSchema = z.object({
  ageband: z.string(),
  description: z.string(),
  divisions: z.array(DivisionSchema),
});

type FrameworkFile = z.infer<typeof FrameworkFileSchema>;

// Loaded once, then cached
let cache: FrameworkFile | null = null;

function load(): FrameworkFile {
  if (cache) return cache;
  const filePath = join(__dirname, "framework-2-3.yaml");
  const raw = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw);
  cache = FrameworkFileSchema.parse(parsed);
  return cache;
}

export function getDivisionsForAge(ageMonths: number): Division[] {
  const { divisions } = load();
  return divisions.filter(
    (d) => ageMonths >= d.ageRangeMonths[0] && ageMonths <= d.ageRangeMonths[1]
  );
}

export function getDivisionById(divisionId: string): Division | undefined {
  const { divisions } = load();
  return divisions.find((d) => d.id === divisionId);
}

export function listDivisions(): Division[] {
  return load().divisions;
}

// Test helper — clears the module cache so tests can reload fresh
export function _resetCache() {
  cache = null;
}
