#!/usr/bin/env tsx
/**
 * Eval runner for the generation pipeline.
 * Usage: pnpm eval
 *
 * Runs all eval cases against the current validator.
 * Results saved to generation/evals/results/<timestamp>.json.
 * A regression in pass rate blocks a prompt commit.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityJSONSchema } from "shared/types.js";
import { validateActivity } from "../pipeline/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR   = join(__dirname, "cases");
const RESULTS_DIR = join(__dirname, "results");

interface Assertion {
  type: string;
  expected: boolean | string;
}

interface EvalCase {
  id: string;
  description: string;
  conceptId: string;
  mechanicId: string;
  input: unknown;
  assertions: Assertion[];
}

interface AssertionResult {
  type: string;
  expected: boolean | string;
  actual: boolean | string;
  passed: boolean;
}

interface CaseResult {
  id: string;
  description: string;
  passed: boolean;
  assertionResults: AssertionResult[];
}

function runAssertions(input: unknown, assertions: Assertion[]): AssertionResult[] {
  const schemaResult = ActivityJSONSchema.safeParse(input);
  const schemaValid  = schemaResult.success;

  const validationResult = validateActivity(input);
  const slotsValid       = schemaValid && !validationResult.errors.some((e) => e.startsWith("slot:"));
  const itemCountValid   = schemaValid && !validationResult.errors.some((e) => e.startsWith("params:"));
  const promptValid      = schemaValid && !validationResult.errors.some((e) => e.startsWith("prompt:"));

  // Duplicate item id check
  const items: Array<{ id: string }> = schemaValid
    ? ((schemaResult.data.filledSlots["items"] as Array<{ id: string }>) ?? [])
    : [];
  const itemIds = items.map((i) => i.id);
  const noDuplicateIds = itemIds.length === new Set(itemIds).size;

  return assertions.map((assertion): AssertionResult => {
    let actual: boolean | string;

    switch (assertion.type) {
      case "schema_valid":
        actual = schemaValid;
        break;
      case "slots_valid":
        actual = slotsValid;
        break;
      case "item_count_matches_difficulty":
        actual = itemCountValid;
        break;
      case "prompt_word_count_under_12":
        actual = promptValid;
        break;
      case "no_duplicate_item_ids":
        actual = noDuplicateIds;
        break;
      case "validation_error_contains":
        actual = validationResult.errors.some((e) =>
          e.includes(assertion.expected as string)
        )
          ? (assertion.expected as string)
          : "";
        break;
      default:
        actual = false;
    }

    const passed =
      assertion.type === "validation_error_contains"
        ? actual === assertion.expected
        : actual === assertion.expected;

    return { type: assertion.type, expected: assertion.expected, actual, passed };
  });
}

async function main() {
  const caseFiles = readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  console.log(`\n── Eval runner: ${caseFiles.length} cases ──\n`);

  const results: CaseResult[] = [];
  let totalPassed = 0;

  for (const file of caseFiles) {
    const raw = readFileSync(join(CASES_DIR, file), "utf-8");
    const evalCase: EvalCase = JSON.parse(raw);

    const assertionResults = runAssertions(evalCase.input, evalCase.assertions);
    const casePassed = assertionResults.every((r) => r.passed);
    if (casePassed) totalPassed++;

    results.push({
      id: evalCase.id,
      description: evalCase.description,
      passed: casePassed,
      assertionResults,
    });

    const icon = casePassed ? "✓" : "✗";
    console.log(`${icon}  ${evalCase.id}`);
    if (!casePassed) {
      assertionResults
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`     FAIL ${r.type}: expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)}`);
        });
    }
  }

  const passRate = totalPassed / caseFiles.length;
  console.log(`\nPass rate: ${totalPassed}/${caseFiles.length} (${(passRate * 100).toFixed(0)}%)\n`);

  // Save results
  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultPath = join(RESULTS_DIR, `${timestamp}.json`);
  writeFileSync(
    resultPath,
    JSON.stringify({ timestamp: new Date().toISOString(), passRate, totalPassed, total: caseFiles.length, results }, null, 2) + "\n"
  );
  console.log(`Results saved: generation/evals/results/${timestamp}.json`);

  if (passRate < 1.0) {
    console.error(`\n❌ Eval failed — ${caseFiles.length - totalPassed} case(s) did not pass.\n`);
    process.exit(1);
  }

  console.log("✅ All evals passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
