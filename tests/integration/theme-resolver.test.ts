import { describe, expect, it } from "vitest";
import * as themes from "../../runtime/src/themes/theme-resolver.js";

describe("runtime theme resolver", () => {
  it("resolves the versioned Kitchen theme and its approved colors", () => {
    const theme = themes.resolveTheme("kitchen-v1");
    expect(theme.id).toBe("kitchen-v1");
    expect(theme.version).toBe("1.0.0");
    expect(theme.presentation).toEqual({
      backgroundColor: "#F6F2E8",
      promptPanelColor: "#DDE8D2",
      foregroundColor: "#26352A",
    });
    expect(theme.backgroundAssetRefs).toBeUndefined();
    expect(theme.decorationAssetRefs).toBeUndefined();
  });

  it("rejects a missing or unknown explicit theme ID without fallback", () => {
    expect(() => themes.resolveTheme(undefined)).toThrow(/missing.*theme/i);
    expect(() => themes.resolveTheme("")).toThrow(/missing.*theme/i);
    expect(() => themes.resolveTheme("picnic-v1")).toThrow(/unknown.*picnic-v1/i);
  });

  it("turns theme presentation values into generic scene and mechanic visual tokens", () => {
    expect(themes.resolvePresentationColors({
      backgroundColor: "#112233",
      promptPanelColor: "#445566",
      foregroundColor: "#778899",
    })).toEqual({
      backgroundFill: 0x112233,
      promptPanelFill: 0x445566,
      foregroundFill: 0x778899,
      foregroundText: "#778899",
    });
  });

  it("passes foreground color to mechanics as generic visual config", () => {
    const colors = themes.resolvePresentationColors({
      backgroundColor: "#112233",
      promptPanelColor: "#445566",
      foregroundColor: "#778899",
    });
    expect(themes.createMechanicVisualConfig(colors)).toEqual({
      labelColor: "#778899",
      feedbackColor: 0x778899,
    });
  });
});
