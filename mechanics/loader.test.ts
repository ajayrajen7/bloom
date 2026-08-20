import { describe, it, expect, beforeEach } from "vitest";
import { getMechanicSpec, listMechanicSpecs, getLayoutVariant, _resetCache } from "./loader.js";

beforeEach(() => _resetCache());

describe("listMechanicSpecs", () => {
  it("returns all three registered mechanics (drag-to-target parked, not deleted)", () => {
    const specs = listMechanicSpecs();
    expect(specs).toHaveLength(3);
  });

  it("includes drag-to-target, tap-to-select, and find-all", () => {
    const ids = listMechanicSpecs().map((s) => s.id);
    expect(ids).toContain("drag-to-target");
    expect(ids).toContain("tap-to-select");
    expect(ids).toContain("find-all");
  });
});

describe("getMechanicSpec", () => {
  it("returns drag-to-target spec", () => {
    const spec = getMechanicSpec("drag-to-target");
    expect(spec?.name).toBe("Drag to Target");
    expect(spec?.deviceCompatibility).toContain("ipad");
  });

  it("returns tap-to-select spec", () => {
    const spec = getMechanicSpec("tap-to-select");
    expect(spec?.name).toBe("Tap to Select");
    expect(spec?.deviceCompatibility).toContain("ipad");
  });

  it("returns undefined for unknown mechanic id", () => {
    expect(getMechanicSpec("swipe-to-sort")).toBeUndefined();
  });

  it("returned spec has slotSchema and parameterSchema", () => {
    const spec = getMechanicSpec("drag-to-target");
    expect(spec?.slotSchema).toBeDefined();
    expect(spec?.parameterSchema).toBeDefined();
  });

  it("returned spec has layouts array", () => {
    const spec = getMechanicSpec("drag-to-target");
    expect(spec?.layouts).toBeDefined();
    expect(spec?.layouts.length).toBeGreaterThan(0);
  });
});

describe("drag-to-target layouts", () => {
  it("has all four expected layout variants", () => {
    const spec = getMechanicSpec("drag-to-target")!;
    const ids = spec.layouts.map((l) => l.id);
    expect(ids).toContain("horizontal-standard");
    expect(ids).toContain("horizontal-reversed");
    expect(ids).toContain("vertical-standard");
    expect(ids).toContain("vertical-reversed");
  });

  it("horizontal-standard has item_zone and target_zone", () => {
    const spec = getMechanicSpec("drag-to-target")!;
    const layout = spec.layouts.find((l) => l.id === "horizontal-standard")!;
    expect(layout.zones["item_zone"]).toBeDefined();
    expect(layout.zones["target_zone"]).toBeDefined();
  });

  it("item_zone arrangement is linear horizontal", () => {
    const spec   = getMechanicSpec("drag-to-target")!;
    const layout = spec.layouts.find((l) => l.id === "horizontal-standard")!;
    const zone   = layout.zones["item_zone"]!;
    expect(zone.arrangement.type).toBe("linear");
    if (zone.arrangement.type === "linear") {
      expect(zone.arrangement.axis).toBe("horizontal");
    }
  });
});

describe("tap-to-select layouts", () => {
  it("has grid and non-grid variants", () => {
    const spec = getMechanicSpec("tap-to-select")!;
    const ids = spec.layouts.map((l) => l.id);
    expect(ids).toContain("grid-2x2");
    expect(ids).toContain("grid-2x3");
    expect(ids).toContain("grid-3x2");
    expect(ids).toContain("horizontal-line");
    expect(ids).toContain("circle");
    expect(ids).toContain("random");
  });

  it("grid-2x2 arrangement has 2 columns and 2 rows", () => {
    const spec   = getMechanicSpec("tap-to-select")!;
    const layout = spec.layouts.find((l) => l.id === "grid-2x2")!;
    const zone   = layout.zones["item_zone"]!;
    expect(zone.arrangement.type).toBe("grid");
    if (zone.arrangement.type === "grid") {
      expect(zone.arrangement.columns).toBe(2);
      expect(zone.arrangement.rows).toBe(2);
    }
  });
});

describe("find-all layouts", () => {
  it("returns find-all spec", () => {
    const spec = getMechanicSpec("find-all");
    expect(spec?.name).toBe("Find All");
    expect(spec?.deviceCompatibility).toContain("ipad");
  });

  it("has the layout variants named in the V1.1 spec", () => {
    const spec = getMechanicSpec("find-all")!;
    const ids = spec.layouts.map((l) => l.id);
    expect(ids).toContain("grid-2x3");
    expect(ids).toContain("grid-3x3");
    expect(ids).toContain("horizontal-line");
    expect(ids).toContain("random");
  });

  it("grid-3x3 arrangement has 3 columns and 3 rows", () => {
    const spec   = getMechanicSpec("find-all")!;
    const layout = spec.layouts.find((l) => l.id === "grid-3x3")!;
    const zone   = layout.zones["item_zone"]!;
    expect(zone.arrangement.type).toBe("grid");
    if (zone.arrangement.type === "grid") {
      expect(zone.arrangement.columns).toBe(3);
      expect(zone.arrangement.rows).toBe(3);
    }
  });

  it("slotSchema and parameterSchema are defined", () => {
    const spec = getMechanicSpec("find-all");
    expect(spec?.slotSchema).toBeDefined();
    expect(spec?.parameterSchema).toBeDefined();
  });
});

describe("getLayoutVariant", () => {
  it("returns the matching variant", () => {
    const variant = getLayoutVariant("drag-to-target", "horizontal-standard");
    expect(variant?.id).toBe("horizontal-standard");
  });

  it("returns undefined for unknown layoutId", () => {
    expect(getLayoutVariant("drag-to-target", "zigzag")).toBeUndefined();
  });

  it("returns undefined for unknown mechanicId", () => {
    expect(getLayoutVariant("unknown-mechanic", "horizontal-standard")).toBeUndefined();
  });
});
