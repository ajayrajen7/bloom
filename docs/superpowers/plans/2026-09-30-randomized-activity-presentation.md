# Randomized Activity Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Randomize the visible arrangement of find choices and matching pairs across activity attempts while preserving the activity's answer and target mappings.

**Architecture:** Keep activity JSON as semantic data: `correctItems` and `distractors` define correctness, while `items[].targetId` defines matching. Add pure seeded presentation helpers that place those records into runtime-computed position slots. Use a per-attempt seed from `ActivityScene.sessionId`, and constrained arrangements to keep correct choices out of the leading prefix and keep one-to-one matching pairs from appearing directly aligned.

**Tech Stack:** TypeScript, Phaser 3, Vitest, existing `shared/layout-engine.ts` position calculation.

**Spec:** Ajay's 2026-09-30 in-chat decision is to randomize both find-choice layouts and matching-pair layouts, without editing each activity file. Follow the runtime boundary in `BLOOM_V1_ARCHITECTURE_CANONICAL.md` and the existing activity contracts in `docs/superpowers/specs/2026-09-29-engaging-produce-activity-set-design.md`.

## Global Constraints

- Keep `tap-to-select` and `drag-to-target`; add no mechanic IDs, dependencies, or activity-specific layout patches.
- Correctness remains attached to each choice record; matching remains attached through `targetId`.
- Every attempt may get a new arrangement; the same seed must reproduce the same arrangement for QA.
- Use only positions already computed from the activity's layout; keep all existing iPad touch targets, labels, bounds, and spacing valid.
- In one-to-one matching rounds, no item may start in the same horizontal slot as its matching target when a non-aligned arrangement exists.
- In mixed find rounds, no arrangement may put all correct choices in the first `correctCount` row-major position slots when distractors are present; also distribute correct choices across rows and columns where the layout permits.
- Multi-item category bins retain their declared `targetId` membership; do not apply one-to-one derangement rules to them.
- Do not reorder or rewrite the approved activity JSON files to simulate presentation randomization.

## Review Focus

- Same seed produces the same arrangement; a set of distinct seeds produces different valid arrangements. Cover in Task 1.
- Correct choices are not all in the leading position prefix and are spatially distributed when possible. Cover in Task 1 and Task 2.
- Every choice appears exactly once and retains its original correctness after presentation. Cover in Task 1 and Task 2.
- Every one-to-one draggable item retains its original `targetId`, and no matching pair is directly aligned when a valid derangement exists. Cover in Task 1 and Task 3.
- Multi-item category bins and small/single-row layouts remain valid without impossible distribution constraints. Cover in Task 1 and Task 3.

---

## File Map

- `runtime/src/presentation/randomized-arrangement.ts`: pure seeded shuffle and mechanic-specific placement helpers; owns arrangement constraints and stable ID mappings.
- `tests/unit/randomized-arrangement.test.ts`: unit tests for reproducibility, variation, completeness, choice distribution, matching derangement, and many-to-one mappings.
- `runtime/src/scenes/activity.ts`: call the presentation helpers after computing layout positions and before creating mechanic configs; pass the per-attempt `sessionId` seed.
- `tests/integration/randomized-activity-presentation.test.ts`: load every currently indexed approved activity and verify the generic presentation contract across the active library.

### Task 1: Add deterministic presentation arrangement helpers

**Files:**
- Create: `runtime/src/presentation/randomized-arrangement.ts`
- Test: `tests/unit/randomized-arrangement.test.ts`

**Interfaces:**
- `arrangeTapChoices<T extends { id: string; isCorrect: boolean }>(items: readonly T[], positions: readonly Position[], seed: string): Array<T & { position: Position }>`
- `arrangeDragRows<Target extends { id: string }, Item extends { id: string; targetId: string }>(targets: readonly Target[], targetPositions: readonly Position[], items: readonly Item[], itemPositions: readonly Position[], seed: string): { targets: Array<Target & { position: Position }>; items: Array<Item & { position: Position }> }`
- `Position` comes from `shared/layout-engine.ts`. Reject mismatched position/item counts with a descriptive error.
- For one-to-one rows, `arrangeDragRows` identifies the one-to-one case when every item has a distinct `targetId` and every target is referenced once; arrange a seeded random derangement so each pair has different horizontal slot positions. For many-to-one rows, independently shuffle each row and preserve all IDs and mappings.

- [x] **Step 1: Add failing helper tests** named `reproduces an arrangement from the same seed`, `varies arrangements across distinct seeds`, `keeps every choice exactly once with its correctness`, `does not put all correct choices in the leading slots`, `places every one-to-one match in a different horizontal slot`, and `preserves many-to-one category mappings`.
- [x] **Step 2: Run the focused test and verify it fails** because the helper module is not implemented.

Run: `pnpm exec vitest run tests/unit/randomized-arrangement.test.ts`

Expected: FAIL with the missing helper import or exported function.

- [x] **Step 3: Implement seeded Fisher–Yates ordering and constrained slot assignment** in `randomized-arrangement.ts`. Derive deterministic independent random streams for choice order, target-row order, and item-row order from the provided seed; sample only arrangements that meet the applicable constraint.
- [x] **Step 4: Run the focused helper test and verify it passes.**

Run: `pnpm exec vitest run tests/unit/randomized-arrangement.test.ts`

Expected: PASS for all cases, including all IDs appearing exactly once and all original semantic fields remaining unchanged.

- [x] **Step 5: Commit the helper and unit tests.**

```bash
git add runtime/src/presentation/randomized-arrangement.ts tests/unit/randomized-arrangement.test.ts
git commit -m "feat: add seeded activity presentation arrangements"
```

### Task 2: Randomize tap-to-select choices in the runtime

**Files:**
- Modify: `runtime/src/scenes/activity.ts` in the `tap-to-select` branch
- Test: `tests/integration/randomized-activity-presentation.test.ts`

**Interfaces:**
- Consume `arrangeTapChoices` from Task 1.
- `ActivityScene.sessionId` is created once in `init()` for each attempt and is the arrangement seed.
- Build each `TapItemConfig` from the arranged item and its returned `position`; preserve `isCorrect` without using presentation order to infer answers.

- [ ] **Step 1: Add a failing runtime integration test** named `presents every indexed tap activity with all choices and unchanged correctness`; assert each indexed activity preserves its correct/distractor IDs, assigns each item one position, and never presents all correct choices in the leading `correctCount` slots when distractors exist.
- [ ] **Step 2: Run the focused integration test and verify it fails** because the runtime still maps the concatenated correct-then-distractor array directly to positions.

Run: `pnpm exec vitest run tests/integration/randomized-activity-presentation.test.ts`

Expected: FAIL on the current unrandomized tap presentation.

- [ ] **Step 3: Wire `arrangeTapChoices` into `ActivityScene`** after `computeZonePositions`; pass `this.sessionId` and construct the mechanic's tap configs from arranged output.
- [ ] **Step 4: Run the focused integration test and verify it passes** for every active indexed tap activity, including one-correct, two-correct, and three-correct rounds.

Run: `pnpm exec vitest run tests/integration/randomized-activity-presentation.test.ts`

Expected: PASS with unchanged correctness and no target set in the leading prefix.

- [ ] **Step 5: Commit the tap-to-select runtime wiring and integration test.**

```bash
git add runtime/src/scenes/activity.ts tests/integration/randomized-activity-presentation.test.ts
git commit -m "feat: randomize find activity choices"
```

### Task 3: Randomize one-to-one drag matching rows

**Files:**
- Modify: `runtime/src/scenes/activity.ts` in the `drag-to-target` branch
- Test: `tests/integration/randomized-activity-presentation.test.ts`

**Interfaces:**
- Consume `arrangeDragRows` from Task 1.
- Keep item `targetId` unchanged; position target and item rows independently using `this.sessionId`.
- For each one-to-one item, use its matching target's logical slot index to verify its start slot differs from the target slot. Do not match on array index or sprite label.

- [ ] **Step 1: Add a failing integration assertion** named `presents every indexed one-to-one match in separate horizontal slots`; assert all items and targets remain present, every item retains its `targetId`, and no pair shares the same horizontal slot.
- [ ] **Step 2: Run the focused integration test and verify it fails** because the current runtime maps both authored arrays in their original sequence.
- [ ] **Step 3: Wire `arrangeDragRows` into `ActivityScene`** after computing the two position arrays; build target and item configs from the returned records and positions.
- [ ] **Step 4: Verify many-to-one category sort behavior**: all six items retain their declared two-bin mapping and occupy unique starts; category bins do not get one-to-one derangement constraints.
- [ ] **Step 5: Run the focused integration test and verify all drag cases pass.**

Run: `pnpm exec vitest run tests/integration/randomized-activity-presentation.test.ts tests/integration/staged-activity-fruit-stand-match.test.ts tests/integration/staged-activity-garden-harvest-match.test.ts tests/integration/staged-activity-market-match.test.ts tests/integration/staged-activity-fruit-or-vegetable-sort.test.ts`

Expected: PASS for matching, existing wrong-drop behavior, completion, and category sorting.

- [ ] **Step 6: Commit the drag matching presentation and integration assertions.**

```bash
git add runtime/src/scenes/activity.ts tests/integration/randomized-activity-presentation.test.ts
git commit -m "feat: randomize matching pair positions"
```

### Task 4: Verify the full activity set and iPad experience

**Files:**
- Test: `tests/integration/randomized-activity-presentation.test.ts`
- Verify: full existing test/build/typecheck commands; no new activity JSON is expected.

- [ ] **Step 1: Add a library-wide seed sweep** for all currently indexed approved activities, confirming layout bounds, unique item positions, correct-to-target mappings, and seed reproducibility.
- [ ] **Step 2: Run the full automated checks.**

Run: `pnpm test && pnpm typecheck && pnpm build && git diff --check`

Expected: all tests and type checks pass, production build succeeds, and the diff has no whitespace errors.

- [ ] **Step 3: Manually verify on iPad** one three-target find round, one two-target find round, one one-to-one drag matching round, and the many-to-one category sort. Confirm each new board is varied, no one-to-one pair begins directly aligned, all existing interactions still work, and replaying an activity changes its arrangement.
- [ ] **Step 4: Record the iPad result in the checkpoint and prepare the PR** from the current default branch containing merged PR #3.

## Resume Handoff

This is the next Bloom implementation task. Start from the latest default branch containing merged PR #3. Do not change activity JSON to hand-code item positions. Execute Tasks 1–4 in order; they share one presentation helper and one runtime integration point. Implementation has not started as of this plan's creation.
