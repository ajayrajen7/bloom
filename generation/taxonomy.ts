import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_FILE = join(__dirname, "../library/assets/sprites/taxonomy.yaml");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpriteInfo {
  sprite: string;         // e.g. "apple.png"
  category: string;       // e.g. "fruits"
  type: string;           // e.g. "apple"
}

export interface TaxonomyEntry {
  category: string;
  type: string;
  sprites: string[];      // all attribute variants for this type
}

// ── Loader ────────────────────────────────────────────────────────────────────

let _cache: TaxonomyEntry[] | null = null;

function loadTaxonomy(): TaxonomyEntry[] {
  if (_cache) return _cache;

  const raw = yaml.load(readFileSync(TAXONOMY_FILE, "utf-8")) as Record<
    string,
    Record<string, string[]>
  >;

  const entries: TaxonomyEntry[] = [];
  for (const [category, types] of Object.entries(raw)) {
    for (const [type, sprites] of Object.entries(types)) {
      entries.push({ category, type, sprites });
    }
  }

  _cache = entries;
  return entries;
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export function getSpriteInfo(sprite: string): SpriteInfo | undefined {
  const filename = sprite.replace("sprites/", "");
  for (const entry of loadTaxonomy()) {
    if (entry.sprites.includes(filename)) {
      return { sprite: filename, category: entry.category, type: entry.type };
    }
  }
  return undefined;
}

export function sameType(spriteA: string, spriteB: string): boolean {
  const a = getSpriteInfo(spriteA);
  const b = getSpriteInfo(spriteB);
  if (!a || !b) return false;
  return a.category === b.category && a.type === b.type;
}

// Returns a formatted string for the generation prompt — structured by category and type.
// Each type row lists all its attribute sprites so the LLM knows which are variants.
export function formatTaxonomyForPrompt(): string {
  const taxonomy = loadTaxonomy();
  const byCategory = new Map<string, TaxonomyEntry[]>();

  for (const entry of taxonomy) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const lines: string[] = [];
  for (const [category, entries] of byCategory) {
    lines.push(`${category.toUpperCase()}`);
    for (const { type, sprites } of entries) {
      lines.push(`  ${type}: ${sprites.map((s) => `sprites/${s}`).join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

// Returns a formatted taxonomy string scoped to only the given sprites.
// Unknown sprites are silently ignored. Empty input returns empty string.
// Used to inject a theme-scoped sprite list into generation prompts.
export function formatFilteredTaxonomyForPrompt(sprites: string[]): string {
  if (sprites.length === 0) return "";

  const normalised = new Set(sprites.map((s) => s.replace("sprites/", "")));
  const taxonomy = loadTaxonomy();
  const byCategory = new Map<string, TaxonomyEntry[]>();

  for (const entry of taxonomy) {
    const matchingSprites = entry.sprites.filter((s) => normalised.has(s));
    if (matchingSprites.length === 0) continue;
    const list = byCategory.get(entry.category) ?? [];
    list.push({ ...entry, sprites: matchingSprites });
    byCategory.set(entry.category, list);
  }

  const lines: string[] = [];
  for (const [category, entries] of byCategory) {
    lines.push(`${category.toUpperCase()}`);
    for (const { type, sprites: s } of entries) {
      lines.push(`  ${type}: ${s.map((f) => `sprites/${f}`).join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

// Returns all unique sprite filenames (prefixed with "sprites/") across the taxonomy.
export function getAllSprites(): string[] {
  return loadTaxonomy().flatMap((e) => e.sprites.map((s) => `sprites/${s}`));
}
