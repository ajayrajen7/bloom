import { describe, it, expect } from "vitest";
import { expandSettings, loadSettings } from "./expand-settings.js";

describe("loadSettings", () => {
  it("loads 6 settings from settings.yaml", () => {
    const { settings } = loadSettings();
    expect(Object.keys(settings)).toHaveLength(6);
  });

  it("every setting has an introLine and at least one object", () => {
    const { settings } = loadSettings();
    for (const [name, def] of Object.entries(settings)) {
      expect(def.introLine, `${name} missing introLine`).toBeTruthy();
      expect(def.objects.length, `${name} has no objects`).toBeGreaterThan(0);
    }
  });
});

describe("expandSettings", () => {
  it("produces 30 briefs — 6 settings × 5", () => {
    expect(expandSettings()).toHaveLength(30);
  });

  it("produces exactly 3 tap-one + 2 find-all briefs per setting", () => {
    const briefs = expandSettings();
    const { settings } = loadSettings();

    for (const setting of Object.keys(settings)) {
      const forSetting = briefs.filter((b) => b.setting === setting);
      expect(forSetting, `${setting} brief count`).toHaveLength(5);

      const tapOne = forSetting.filter((b) => b.mechanicId === "tap-to-select");
      const findAll = forSetting.filter((b) => b.mechanicId === "find-all");
      expect(tapOne, `${setting} tap-one count`).toHaveLength(3);
      expect(findAll, `${setting} find-all count`).toHaveLength(2);

      expect(tapOne.map((b) => b.difficulty).sort()).toEqual(["high", "low", "medium"]);
      expect(findAll.map((b) => b.difficulty).sort()).toEqual(["low", "medium"]);
    }
  });

  it("every brief has no targetDivisionId — V1.1 drops per-activity division targeting", () => {
    for (const brief of expandSettings()) {
      expect(brief.targetDivisionId).toBeUndefined();
    }
  });

  it("every brief has a setting and non-empty itemSprites", () => {
    for (const brief of expandSettings()) {
      expect(brief.setting).toBeTruthy();
      expect(brief.itemSprites.length).toBeGreaterThan(0);
    }
  });

  it("all 30 ids are unique", () => {
    const ids = expandSettings().map((b) => b.id);
    expect(new Set(ids).size).toBe(30);
  });

  it("is deterministic — same input produces identical output", () => {
    expect(expandSettings()).toEqual(expandSettings());
  });
});
