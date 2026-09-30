import { describe, it, expect } from "vitest";
import { getSpriteInfo, sameType, formatTaxonomyForPrompt, formatFilteredTaxonomyForPrompt, getAllSprites } from "./taxonomy.js";

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

  it("groups approved red and green apples under one canonical apple type", () => {
    expect(getSpriteInfo("apple-red-v1.png")).toEqual({ sprite: "apple-red-v1.png", category: "fruits", type: "apple" });
    expect(getSpriteInfo("apple-green-v1.png")).toEqual({ sprite: "apple-green-v1.png", category: "fruits", type: "apple" });
    expect(sameType("sprites/apple-red-v1.png", "sprites/apple-green-v1.png")).toBe(true);
  });

  it.each([
    ["banana-v1.png", "fruits", "banana"],
    ["grapes-v1.png", "fruits", "grapes"],
    ["orange-v1.png", "fruits", "orange"],
    ["broccoli-v1.png", "vegetables", "broccoli"],
    ["carrot-v1.png", "vegetables", "carrot"],
    ["cucumber-v1.png", "vegetables", "cucumber"],
    ["tomato-v1.png", "vegetables", "tomato"],
  ])("indexes approved produce %s as %s/%s", (sprite, category, type) => {
    expect(getSpriteInfo(sprite)).toEqual({ sprite, category, type });
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

describe("formatFilteredTaxonomyForPrompt", () => {
  it("includes every approved produce type and both apple variants", () => {
    const approved = [
      "apple-red-v1.png", "apple-green-v1.png", "banana-v1.png", "broccoli-v1.png",
      "carrot-v1.png", "cucumber-v1.png", "grapes-v1.png", "orange-v1.png", "tomato-v1.png",
    ];
    const output = formatFilteredTaxonomyForPrompt(approved);
    expect(output).toContain("FRUITS");
    expect(output).toContain("VEGETABLES");
    expect(output).toMatch(/apple:.*apple-red-v1\.png.*apple-green-v1\.png/);
    for (const sprite of approved) expect(output).toContain(`sprites/${sprite}`);
    expect(output).not.toContain("banana-text-only.png");
    expect(output).not.toContain("carrot-text-only.png");
  });

  it("includes only categories represented in the sprite list", () => {
    const output = formatFilteredTaxonomyForPrompt(["apple.png", "banana.png", "apple-basket.png"]);
    expect(output).toContain("FRUITS");
    expect(output).toContain("CONTAINERS");
    expect(output).not.toContain("ANIMALS");
    expect(output).not.toContain("SHAPES");
    expect(output).not.toContain("CLOTHING");
  });

  it("includes only types represented in the sprite list", () => {
    const output = formatFilteredTaxonomyForPrompt(["apple.png", "banana.png"]);
    expect(output).toContain("apple:");
    expect(output).toContain("banana:");
    expect(output).not.toContain("orange:");
  });

  it("includes attribute variants when one variant is listed", () => {
    const output = formatFilteredTaxonomyForPrompt(["apple.png"]);
    expect(output).toContain("apple.png");
  });

  it("accepts sprites with sprites/ prefix", () => {
    const output = formatFilteredTaxonomyForPrompt(["sprites/apple.png", "sprites/banana.png"]);
    expect(output).toContain("FRUITS");
    expect(output).toContain("apple:");
    expect(output).toContain("banana:");
  });

  it("works for cross-category themes", () => {
    const output = formatFilteredTaxonomyForPrompt(["apple.png", "banana.png", "cat.png", "dog.png"]);
    expect(output).toContain("FRUITS");
    expect(output).toContain("ANIMALS");
    expect(output).not.toContain("CONTAINERS");
  });

  it("returns empty string for an empty sprite list", () => {
    const output = formatFilteredTaxonomyForPrompt([]);
    expect(output.trim()).toBe("");
  });

  it("ignores unknown sprites without throwing", () => {
    const output = formatFilteredTaxonomyForPrompt(["apple.png", "nonexistent.png"]);
    expect(output).toContain("FRUITS");
    expect(output).not.toContain("nonexistent");
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

  it("includes the existing library plus nine approved pilot sprites", () => {
    expect(getAllSprites()).toHaveLength(39);
  });
});
