import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { ConceptBrief, Division } from "shared/types.js";
import {
  LLMTapToSelectOutputSchema,
  ActivityJSONSchema,
  type LLMTapToSelectOutput,
  type ActivityJSON,
} from "shared/types.js";
import { getLayoutVariant } from "../../mechanics/loader.js";
import { formatFilteredTaxonomyForPrompt } from "../taxonomy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROMPT_VERSION = "v1";
const PROMPT_FILE = join(
  __dirname,
  "../prompts",
  `generate-tap-to-select.${PROMPT_VERSION}.txt`
);

const CORRECT_COUNTS:    Record<string, number> = { low: 1, medium: 2, high: 3 };
const DISTRACTOR_COUNTS: Record<string, number> = { low: 3, medium: 4, high: 3 };
const LAYOUT_IDS:        Record<string, string> = { low: "grid-2x2", medium: "grid-2x3", high: "grid-3x2" };

export interface TapToSelectPromptResult {
  raw: string;
  llmOutput: LLMTapToSelectOutput;
  activity: ActivityJSON;
  promptVersion: string;
  tokensUsed: { input: number; output: number };
}

export async function runTapToSelectPrompt(
  concept: ConceptBrief,
  division: Division,
  client: Anthropic
): Promise<TapToSelectPromptResult> {
  const template = readFileSync(PROMPT_FILE, "utf-8");

  const designPrinciples = division.designPrinciples
    .map((p) => `- ${p}`)
    .join("\n");

  const correctCount    = CORRECT_COUNTS[concept.difficulty]    ?? 1;
  const distractorCount = DISTRACTOR_COUNTS[concept.difficulty] ?? 3;

  const filled = template
    .replace("{{THEME_HINT}}", concept.themeHint)
    .replace("{{DIVISION_NAME}}", division.name)
    .replace("{{DIFFICULTY}}", concept.difficulty)
    .replace("{{CORRECT_COUNT}}", String(correctCount))
    .replace("{{DISTRACTOR_COUNT}}", String(distractorCount))
    .replace("{{TARGET_DURATION_SECONDS}}", String(concept.targetDurationSeconds))
    .replace("{{DIVISION_DESIGN_PRINCIPLES}}", designPrinciples)
    .replace("{{NOTES}}", concept.notes ?? "")
    .replace("{{SPRITE_TAXONOMY}}", formatFilteredTaxonomyForPrompt(concept.itemSprites));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: filled }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(`Generation prompt returned non-JSON output:\n${raw}`);
  }

  const llmOutput = LLMTapToSelectOutputSchema.parse(parsedJson);
  const activity = assembleTapToSelectOutput(llmOutput, concept, correctCount, distractorCount);

  return {
    raw,
    llmOutput,
    activity,
    promptVersion: PROMPT_VERSION,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

export function assembleTapToSelectOutput(
  llmOutput: LLMTapToSelectOutput,
  concept: ConceptBrief,
  correctCount: number,
  distractorCount: number
): ActivityJSON {
  const id = `act_${Date.now()}_${randomUUID().slice(0, 6)}`;
  const layoutId = LAYOUT_IDS[concept.difficulty] ?? "grid-2x2";
  const layout = getLayoutVariant("tap-to-select", layoutId);

  if (!layout) {
    throw new Error(`Layout "${layoutId}" not found in tap-to-select mechanic spec`);
  }

  return ActivityJSONSchema.parse({
    id,
    conceptId: concept.id,
    mechanicId: "tap-to-select",
    generatedAt: new Date().toISOString(),
    filledSlots: llmOutput.filledSlots,
    parameters: {
      layoutId,
      layout,
      correctCount,
      distractorCount,
      visualSimilarity: concept.difficulty,
    },
    prompt: {
      text: llmOutput.prompt.text,
      audioRef: "audio/prompts/PLACEHOLDER.mp3",
    },
    audioRefs: {
      successSfx: "audio/sfx/success_bright.mp3",
      errorSfx: "audio/sfx/try_again.mp3",
      completionSfx: "audio/sfx/celebration.mp3",
    },
    metadata: {
      targetDivisionId: concept.targetDivisionId,
      secondaryDivisionId: concept.secondaryDivisionId,
      ageMonths: concept.ageMonths,
      difficulty: concept.difficulty,
      targetDurationSeconds: concept.targetDurationSeconds,
      reviewScore: 0,
      reviewerNotes: "",
    },
  });
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in output");

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  throw new Error("Unclosed JSON object in output");
}
