import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { ConceptBrief, Division, MechanicSpec } from "shared/types.js";
import {
  LLMGenerationOutputSchema,
  ActivityJSONSchema,
  type LLMGenerationOutput,
  type ActivityJSON,
} from "shared/types.js";
import { formatFilteredTaxonomyForPrompt } from "../taxonomy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROMPT_VERSION = "v10";
const PROMPT_FILE = join(
  __dirname,
  "../prompts",
  `generate-drag-to-target.${PROMPT_VERSION}.txt`
);

// Difficulty → counts. These are pipeline decisions, not LLM decisions.
const ITEM_COUNTS:       Record<string, number> = { low: 3, medium: 5, high: 6 };
// low: 1:1 mapping (each item has its own target, no sharing). Sharing starts at medium.
const TARGET_COUNTS:     Record<string, number> = { low: 3, medium: 3, high: 4 };
const DISTRACTOR_COUNTS: Record<string, number> = { low: 0, medium: 1, high: 2 };

export interface PromptResult {
  raw: string;
  llmOutput: LLMGenerationOutput;
  activity: ActivityJSON;
  promptVersion: string;
  tokensUsed: { input: number; output: number };
}

export async function runGenerationPrompt(
  concept: ConceptBrief,
  division: Division,
  _mechanicSpec: MechanicSpec,
  client: Anthropic
): Promise<PromptResult> {
  const template = readFileSync(PROMPT_FILE, "utf-8");

  const designPrinciples = division.designPrinciples
    .map((p) => `- ${p}`)
    .join("\n");

  const itemCount       = ITEM_COUNTS[concept.difficulty]       ?? 3;
  const targetCount     = TARGET_COUNTS[concept.difficulty]     ?? 3;
  const distractorCount = DISTRACTOR_COUNTS[concept.difficulty] ?? 0;

  const filled = template
    .replace("{{THEME_HINT}}", concept.themeHint)
    .replace("{{DIVISION_NAME}}", division.name)
    .replace("{{DIFFICULTY}}", concept.difficulty)
    .replace("{{ITEM_COUNT}}", String(itemCount))
    .replace("{{TARGET_COUNT}}", String(targetCount))
    .replace("{{DISTRACTOR_COUNT}}", String(distractorCount))
    .replace("{{TARGET_DURATION_SECONDS}}", String(concept.targetDurationSeconds))
    .replace("{{DIVISION_DESIGN_PRINCIPLES}}", designPrinciples)
    .replace("{{NOTES}}", concept.notes ?? "")
    .replace("{{SPRITE_TAXONOMY}}", formatFilteredTaxonomyForPrompt([
      ...concept.itemSprites,
      ...concept.targetSprites,
    ]));

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

  const llmOutput = LLMGenerationOutputSchema.parse(parsedJson);
  const activity = assembleLLMOutput(llmOutput, concept, itemCount);

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

// Assembles a full ActivityJSON from the LLM's slim output + deterministic pipeline fields.
// Exported so the assembly integration test can verify correctness without a real LLM call.
export function assembleLLMOutput(
  llmOutput: LLMGenerationOutput,
  concept: ConceptBrief,
  itemCount: number
): ActivityJSON {
  const id = `act_${Date.now()}_${randomUUID().slice(0, 6)}`;

  return ActivityJSONSchema.parse({
    id,
    conceptId: concept.id,
    mechanicId: "drag-to-target",
    generatedAt: new Date().toISOString(),
    filledSlots: llmOutput.filledSlots,
    parameters: {
      layoutId: "horizontal-standard",
      itemCount,
      distractorCount: llmOutput.filledSlots.distractors.length,
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

// Extract the outermost JSON object from text that may contain preamble or code fences.
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
