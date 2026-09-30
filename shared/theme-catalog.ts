import kitchenTheme from "../library/themes/kitchen-v1.json";
import { ThemeSpecSchema, type ThemeSpec } from "./types.js";

const kitchen = ThemeSpecSchema.parse(kitchenTheme);
const themes = new Map<string, ThemeSpec>([[kitchen.id, kitchen]]);

export function resolveThemeSpec(themeId: string | undefined): ThemeSpec {
  if (!themeId) throw new Error("Missing activity theme ID");
  const theme = themes.get(themeId);
  if (!theme) throw new Error(`Unknown activity theme ID: ${themeId}`);
  return theme;
}

export function requireSupportedThemeArtwork(theme: ThemeSpec): void {
  if (theme.backgroundAssetRefs?.length || theme.decorationAssetRefs?.length) {
    throw new Error(`Unsupported theme artwork refs in ${theme.id}`);
  }
}
