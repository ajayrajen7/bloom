import { type ThemeSpec } from "shared/types.js";
import { resolveThemeSpec } from "shared/theme-catalog.js";
import type { MechanicVisualConfig } from "../mechanics/visual-config.js";

export function resolveTheme(themeId: string | undefined): ThemeSpec {
  return resolveThemeSpec(themeId);
}

export interface PresentationColors {
  backgroundFill: number;
  promptPanelFill: number;
  foregroundFill: number;
  foregroundText: string;
}

export function resolvePresentationColors(presentation: ThemeSpec["presentation"]): PresentationColors {
  return {
    backgroundFill: Number.parseInt(presentation.backgroundColor.slice(1), 16),
    promptPanelFill: Number.parseInt(presentation.promptPanelColor.slice(1), 16),
    foregroundFill: Number.parseInt(presentation.foregroundColor.slice(1), 16),
    foregroundText: presentation.foregroundColor,
  };
}

export function createMechanicVisualConfig(colors: PresentationColors): MechanicVisualConfig {
  return { labelColor: colors.foregroundText, feedbackColor: colors.foregroundFill };
}
