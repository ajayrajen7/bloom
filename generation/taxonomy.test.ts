import { describe, it, expect } from "vitest";
import { getSpriteInfo, sameType, formatTaxonomyForPrompt, getAllSprites } from "./taxonomy.js";

describe("getSpriteInfo", () => {
  it("returns correct category and type for a known sprite", () => {
    const info = getSpriteInfo("apple.png");
    expect(info).toEqual({ sprite: "apple.png", category: "fruits", type: "apple" });
  });

  it("returns correct category and type for an attribute variant", () => {
    const info = getSpriteInfo("red-apple.png");
    expect(info).toEqual({ sprite: "red-apple.png", category: "fruits", type: "apple" });
  });

  it("works with sprites/ prefix", () => {
    const info = getSpriteInfo("sprites/banana.png");
    expect(info?.type).toBe("banana");
    expect(info?.category).toBe("fruits");
  });

  it("returns undefined for an unknown sprite", () => {
    expect(getSpriteInfo("nonexistent.png")).toBeUndefined();
  });
});

describe("sameType", () => {
  it("returns true for two attribute variants of the same type", () => {
    expect(sameType("apple.png", "red-apple.png")).toBe(true);
    expect(sameType("apple.png", "green-apple.png")).toBe(true);
    expect(sameType("red-apple.png", "green-apple.png")).toBe(true);
  });

  it("returns true with sprites/ prefix", () => {
    expect(sameType("sprites/apple.png", "sprites/red-apple.png")).toBe(true);
  });

  it("returns false for different types within the same category", () => {
    expect(sameType("apple.png", "banana.png")).toBe(false);
    expect(sameType("apple.png", "orange.png")).toBe(false);
    expect(sameType("cat.png", "dog.png")).toBe(false);
  });

  it("returns false for sprites from different categories", () => {
    expect(sameType("apple.png", "cat.png")).toBe(false);
    expect(sameType("banana.png", "shoe.png")).toBe(false);
  });

  it("returns false if either sprite is unknown", () => {
    expect(sameType("apple.png", "unknown.png")).toBe(false);
    expect(sameType("unknown.png", "banana.png")).toBe(false);
  });
});

describe("formatTaxonomyForPrompt", () => {
  it("includes all categories", () => {
    const output = formatTaxonomyForPrompt();
    expect(output).toContain("FRUITS");
    expect(output).toContain("ANIMALS");
    expect(output).toContain("CONTAINERS");
    expect(output).toContain("CLOTHING");
    expect(output).toContain("BALLS");
    expect(output).toContain("SHAPES");
  });

  it("groups variants under the same type line", () => {
    const output = formatTaxonomyForPrompt();
    expect(output).toContain("apple:");
    expect(output).toMatch(/apple:.*apple\.png.*red-apple\.png/);
  });

  it("uses sprites/ prefix on filenames", () => {
    const output = formatTaxonomyForPrompt();
    expect(output).toContain("sprites/apple.png");
  });
});

describe("getAllSprites", () => {
  it("returns all sprites with sprites/ prefix", () => {
    const sprites = getAllSprites();
    expect(sprites).toContain("sprites/apple.png");
    expect(sprites).toContain("sprites/red-apple.png");
    expect(sprites).toContain("sprites/banana.png");
    expect(sprites).toContain("sprites/cat.png");
  });

  it("returns 29 sprites matching the library", () => {
    expect(getAllSprites()).toHaveLength(29);
  });
});
