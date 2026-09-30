# Engaging Produce Activity Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify 15 Kitchen produce activities, then publish them for Ajay's iPad QA alongside the two pilot activities.

**Architecture:** Keep the approved Concept → Mechanic + Theme + Asset Catalog → Activity Composition → Storage → Runtime boundaries. Promote the 15 approved activities directly into the active library and keep the development-only staged launch for future candidates. Extend only `drag-to-target` for six-pair boards and multi-item category bins.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Zod, YAML mechanic contracts, Vite development middleware, existing nine approved PNG sprites.

**Spec:** `docs/superpowers/specs/2026-09-29-engaging-produce-activity-set-design.md`

## Global Constraints

- Use only the nine already approved sprites under `library/assets/sprites/` and the existing `kitchen-v1` theme.
- Kitchen colors remain background `#F6F2E8`, prompt panel `#DDE8D2`, and foreground `#26352A`; no backdrop or artwork is added.
- The working age band remains 24–36 months.
- Promote the 15 approved activities directly into `library/activities/` and index them alongside the two pilots; do not keep duplicate staged copies.
- Ajay approved all 15 activities for the one-child iPad pilot on 2026-09-30. This does not claim child engagement or learning efficacy; those remain to be observed.
- Preserve the current two active approved pilots and do not migrate, repair, or otherwise support legacy activities.
- Implement gameplay deterministically in the existing `tap-to-select` and `drag-to-target` mechanics; do not add an LLM or a third mechanic.
- Do not claim child enjoyment or learning efficacy; no child observation is part of this work.
- Ajay authorized committing, pushing this branch, and creating a PR on 2026-09-30.
- Every activity is individually data-validated and manually interacted with in the staged-activity development launch before work begins on the next activity.
- Tap activities alternate `grid-3x2` and `grid-2x3` in activity order, starting with `grid-3x2`; drag matching uses `horizontal-six-pairs`; the category sort uses `horizontal-category-sort`.

## Review Focus

- Six-cell tap layout positions can exceed the play area or overlap labels at 1024×768. Add boundary and pairwise-spacing assertions to Task 1 layout tests.
- Six horizontal drag targets can collide because target labels extend below their rings. Add coordinate/label-bound checks for six-pair rows to Task 1.
- A category item can be counted twice or two items can occupy the same bin slot. Add capacity, unique-parking-position, and progress-once tests to Task 1.
- Staged launch could accidentally expose unpublished files in the production build. Test in Task 1 that staged routes work only on the Vite dev server and that `collectRuntimeFiles()` never emits staged paths.
- An activity could pass generic schema validation with the wrong named produce. Each activity task must assert its exact ordered prompt, correct/distractor refs or item-target map as stated in the spec's completion matrix.

---

## File Map

- `mechanics/specs/drag-to-target.yaml`: declares six-pair horizontal layout and count limits compatible with matching and category sorting.
- `generation/pipeline/validate.ts`: validates exact target cardinality and the selected medium-difficulty no-distractor matching rule; enforces category-sort bin membership where declared.
- `runtime/src/scenes/activity.ts`, `runtime/src/mechanics/drag-to-target.ts`, `runtime/src/mechanics/drag-to-target-logic.ts`: computes positions, supports multi-capacity target parking, and draws category bins with visible item positions.
- `runtime/publication.ts`, `runtime/src/main.ts`, `runtime/src/scenes/activity.ts`: dev-only staged-activity launch and file serving; production publication remains active-index-only and validates each approved activity.
- `shared/layout-engine.ts` and corresponding tests: deterministic positions/spacing checks for six-choice boards and six-pair rows.
- `concepts/briefs/concept_kitchen_<slug>_v1.json`: one concept scope per candidate.
- `library/activities/act_kitchen_<slug>_v1.json`: one approved activity definition per candidate.
- `tests/integration/staged-activity-<slug>.test.ts`: exact data/contract assertions for each activity; tests run before each candidate's live interaction check.
- `scripts/render-pilot-previews.ts`: renders all valid approved activities at 1024×768 to `library/assets/reviews/activities/`.
- `tests/integration/engaging-produce-set.test.ts`: verifies exact count, IDs, active-index isolation, approved assets, concepts, validation, and generated review artifacts for the complete set.

## Task 1: Add the six-pair layout, category parking, and safe staged-runtime review mode

**Files:**
- Modify: `mechanics/specs/drag-to-target.yaml`
- Modify: `shared/types.ts` only if typed activity metadata is needed for explicit bin capacity
- Modify: `generation/pipeline/validate.ts`
- Modify: `runtime/src/mechanics/drag-to-target-logic.ts`
- Modify: `runtime/src/mechanics/drag-to-target.ts`
- Modify: `runtime/src/scenes/activity.ts`
- Modify: `runtime/src/main.ts`
- Modify: `runtime/publication.ts`
- Modify: `runtime/tsconfig.json` when Vite development-mode types are needed by the staged review route
- Test: `shared/layout-engine.test.ts`
- Test: `tests/integration/drag-to-target-mechanic.test.ts`
- Test: `tests/integration/runtime-publication.test.ts`
- Test: `tests/integration/generation-pipeline.test.ts`

**Interfaces:**
- Produces a `horizontal-six-pairs` mechanic layout with six target positions and six item positions at 1024×768.
- Produces deterministic target parking positions for a target with `capacity: 3`; one item can occupy each position exactly once.
- Activity target records that accept multiple items declare `capacity: 3`; matching targets omit capacity and retain their single-item behavior.
- Category targets render as wide bin cards; drops inside the assigned bin snap to the next visible parking slot; wrong-bin/outside-bin drops bounce without progress.
- Produces a Vite-development-only staged activity URL `/?reviewActivity=<staged-id>` that loads `library/staged/<staged-id>.json` through the actual `ActivityScene`; dev mode validates the staged activity and its concept, while production bundle/publication routes never include staged activity JSON.
- Preserves current single-capacity matching behavior and current active publication behavior.

- [ ] **Step 1: Add failing tests** for six-item horizontal position bounds and non-overlap, six target labels staying between play-area divider and item row, target parking positions being distinct and stable, category capacity preventing a fourth placement, and staged routes not appearing in production publication.
- [ ] **Step 2: Run focused tests** with `pnpm exec vitest run shared/layout-engine.test.ts tests/integration/drag-to-target-mechanic.test.ts tests/integration/runtime-publication.test.ts tests/integration/generation-pipeline.test.ts`; confirm the new cases fail for the missing contracts/behavior.
- [ ] **Step 3: Add the six-pair layout and update validator** so medium matching accepts five or six items and zero distractors; each one-to-one item has a unique matching target, while the sort has exactly two declared bins, each with exactly three mapped items.
- [ ] **Step 4: Implement multi-capacity parking** so accepted items snap to the next open target slot, wrong-bin/outside-bin drops bounce without progress, full bins cannot accept a fourth item, and each parked item scales to fit visibly beside the other two.
- [ ] **Step 5: Add staged launch and server handling** guarded by development mode; reject unknown IDs, unsafe IDs, invalid concepts, invalid activities, unapproved assets, and all staged access through production preview/build handlers.
- [ ] **Step 6: Run the same focused tests and** `pnpm typecheck`; expect all tests and type checking to pass.
- [ ] **Step 7: Launch a temporary staged fixture** and use pointer interaction to confirm tap launch and multi-capacity drag semantics before starting activity authoring.

## Activity task sequence

For every activity task below, follow this exact cycle before starting the next numbered activity:

1. Add the concept brief, staged JSON, and an activity-specific test. Do not touch the active index.
2. Run `pnpm exec vitest run tests/integration/staged-activity-<slug>.test.ts`; require exact content assertions and `validateActivity(...)` to pass.
3. Start the dev runtime and open `/?reviewActivity=act_kitchen_<slug>_v1` at 1024×768. Verify the prompt, all sprites/targets, labels, progress, and no overlap.
4. Use actual pointer input: tap activities must pass each correct/distractor/progress/completion case in that activity's done matrix; drag activities must pass matching/wrong-target/progress/completion or category/capacity behavior as specified. Record a pass/fail evidence line in the SDD ledger.
5. If any check fails, fix and rerun that activity's focused test and live interaction before continuing.

### Task 2: Build activity 1 — Picnic Pack

**Files:** `concepts/briefs/concept_kitchen_picnic_pack_v1.json`; `library/activities/act_kitchen_picnic_pack_v1.json`; `tests/integration/staged-activity-picnic-pack.test.ts`.

- [ ] Author six choices with exact correct refs red apple, banana, orange and distractors carrot, broccoli, cucumber; prompt `Find the red apple, banana, and orange.`; `kitchen-v1`; difficulty `high`; layout `grid-3x2`.
- [ ] Apply the five-step activity cycle above; require three correct progress increments, zero progress for each distractor, and completion only on the third correct tap.

### Task 3: Build activity 2 — Garden Basket

**Files:** `concepts/briefs/concept_kitchen_garden_basket_v1.json`; `library/activities/act_kitchen_garden_basket_v1.json`; `tests/integration/staged-activity-garden-basket.test.ts`.

- [ ] Author six choices with exact correct refs carrot, broccoli, cucumber and distractors red apple, banana, orange; prompt `Find the carrot, broccoli, and cucumber.`; difficulty `high`; layout `grid-2x3`.
- [ ] Apply the five-step activity cycle; require all three correct taps to advance once, distractors to advance zero times, and completion on correct tap three.

### Task 4: Build activity 3 — Apple Twins

**Files:** `concepts/briefs/concept_kitchen_apple_twins_v1.json`; `library/activities/act_kitchen_apple_twins_v1.json`; `tests/integration/staged-activity-apple-twins.test.ts`.

- [ ] Author red and green apple as the exact two correct refs; banana, orange, grapes, carrot as four distractors; prompt `Find both apples.`; difficulty `medium`; layout `grid-3x2`.
- [ ] Apply the five-step activity cycle; either apple advances once, each non-apple advances zero times, and completion occurs after both apple variants.

### Task 5: Build activity 4 — Green Team

**Files:** `concepts/briefs/concept_kitchen_green_team_v1.json`; `library/activities/act_kitchen_green_team_v1.json`; `tests/integration/staged-activity-green-team.test.ts`.

- [ ] Author green apple, cucumber, broccoli as correct refs; red apple, banana, carrot as distractors; prompt `Find the green apple, cucumber, and broccoli.`; difficulty `high`; layout `grid-2x3`.
- [ ] Apply the five-step activity cycle; require three correct increments, no distractor increments, and completion on correct tap three.

### Task 6: Build activity 5 — Orange Team

**Files:** `concepts/briefs/concept_kitchen_orange_team_v1.json`; `library/activities/act_kitchen_orange_team_v1.json`; `tests/integration/staged-activity-orange-team.test.ts`.

- [ ] Author orange and carrot as correct refs; red apple, green apple, cucumber, broccoli as distractors; prompt `Find the orange and carrot.`; difficulty `medium`; layout `grid-3x2`.
- [ ] Apply the five-step activity cycle; require two correct increments, zero distractor increments, and completion after the second correct tap.

### Task 7: Build activity 6 — Soup Chef

**Files:** `concepts/briefs/concept_kitchen_soup_chef_v1.json`; `library/activities/act_kitchen_soup_chef_v1.json`; `tests/integration/staged-activity-soup-chef.test.ts`.

- [ ] Author carrot, tomato, broccoli as correct refs; banana, orange, grapes as distractors; prompt `Find the carrot, tomato, and broccoli.`; difficulty `high`; layout `grid-2x3`.
- [ ] Apply the five-step activity cycle; require three correct increments, zero distractor increments, and completion on correct tap three.

### Task 8: Build activity 7 — Smoothie Mix

**Files:** `concepts/briefs/concept_kitchen_smoothie_mix_v1.json`; `library/activities/act_kitchen_smoothie_mix_v1.json`; `tests/integration/staged-activity-smoothie-mix.test.ts`.

- [ ] Author red apple, banana, grapes as correct refs; cucumber, carrot, broccoli as distractors; prompt `Find the red apple, banana, and grapes.`; difficulty `high`; layout `grid-3x2`.
- [ ] Apply the five-step activity cycle; require three correct increments, zero distractor increments, and completion on correct tap three.

### Task 9: Build activity 8 — Long-Shape Hunt

**Files:** `concepts/briefs/concept_kitchen_long_shape_hunt_v1.json`; `library/activities/act_kitchen_long_shape_hunt_v1.json`; `tests/integration/staged-activity-long-shape-hunt.test.ts`.

- [ ] Author banana, carrot, cucumber as correct refs; red apple, orange, broccoli as distractors; prompt `Find the banana, carrot, and cucumber.`; difficulty `high`; layout `grid-2x3`.
- [ ] Apply the five-step activity cycle; require three correct increments, zero distractor increments, and completion on correct tap three.

### Task 10: Build activity 9 — Round-Food Hunt

**Files:** `concepts/briefs/concept_kitchen_round_food_hunt_v1.json`; `library/activities/act_kitchen_round_food_hunt_v1.json`; `tests/integration/staged-activity-round-food-hunt.test.ts`.

- [ ] Author red apple, orange, tomato as correct refs; banana, carrot, cucumber as distractors; prompt `Find the red apple, orange, and tomato.`; difficulty `high`; layout `grid-3x2`.
- [ ] Apply the five-step activity cycle; require three correct increments, zero distractor increments, and completion on correct tap three.

### Task 11: Build activity 10 — Red Kitchen Hunt

**Files:** `concepts/briefs/concept_kitchen_red_kitchen_hunt_v1.json`; `library/activities/act_kitchen_red_kitchen_hunt_v1.json`; `tests/integration/staged-activity-red-kitchen-hunt.test.ts`.

- [ ] Author red apple and tomato as correct refs; green apple, banana, orange, carrot as distractors; prompt `Find the red apple and tomato.`; difficulty `medium`; layout `grid-2x3`.
- [ ] Apply the five-step activity cycle; require two correct increments, zero distractor increments, and completion after correct tap two.

### Task 12: Build activity 11 — Market Match

**Files:** `concepts/briefs/concept_kitchen_market_match_v1.json`; `library/activities/act_kitchen_market_match_v1.json`; `tests/integration/staged-activity-market-match.test.ts`.

- [ ] Author six one-to-one pairs: red apple, banana, orange, grapes, carrot, cucumber; prompt `Put each food on its matching picture.`; difficulty `medium`; layout `horizontal-six-pairs`; no distractor slots.
- [ ] Apply the five-step activity cycle; verify all six correct targets, one deliberate wrong-target bounce with no progress, and completion after match six.

### Task 13: Build activity 12 — Garden Harvest Match

**Files:** `concepts/briefs/concept_kitchen_garden_harvest_match_v1.json`; `library/activities/act_kitchen_garden_harvest_match_v1.json`; `tests/integration/staged-activity-garden-harvest-match.test.ts`.

- [ ] Author six pairs: green apple, tomato, broccoli, carrot, banana, orange; prompt `Match each harvest to its picture.`; difficulty `medium`; layout `horizontal-six-pairs`; no distractor slots.
- [ ] Apply the five-step activity cycle; verify each mapping, one wrong-target bounce without progress, and completion after the sixth distinct match.

### Task 14: Build activity 13 — Fruit Stand Match

**Files:** `concepts/briefs/concept_kitchen_fruit_stand_match_v1.json`; `library/activities/act_kitchen_fruit_stand_match_v1.json`; `tests/integration/staged-activity-fruit-stand-match.test.ts`.

- [ ] Author five pairs: red apple, green apple, banana, orange, grapes; prompt `Put each fruit on its matching picture.`; difficulty `medium`; layout `horizontal-six-pairs`; no distractor slots.
- [ ] Apply the five-step activity cycle; verify five mappings, one wrong-target bounce without progress, and completion after match five.

### Task 15: Build activity 14 — Mixed-Tray Scramble

**Files:** `concepts/briefs/concept_kitchen_mixed_tray_scramble_v1.json`; `library/activities/act_kitchen_mixed_tray_scramble_v1.json`; `tests/integration/staged-activity-mixed-tray-scramble.test.ts`.

- [ ] Author six pairs: red apple, green apple, banana, grapes, tomato, broccoli. Set target order to differ from item order; prompt `Match each food to its picture.`; difficulty `medium`; layout `horizontal-six-pairs`; no distractor slots.
- [ ] Apply the five-step activity cycle; prove every mapping follows `targetId` rather than row order, test one wrong-target bounce, and complete six matches.

### Task 16: Build activity 15 — Fruit-or-Vegetable Sort

**Files:** `concepts/briefs/concept_kitchen_fruit_or_vegetable_sort_v1.json`; `library/activities/act_kitchen_fruit_or_vegetable_sort_v1.json`; `tests/integration/staged-activity-fruit-or-vegetable-sort.test.ts`.

- [x] Author green apple, banana, grapes → apple-picture target labeled `Fruit`; cucumber, tomato, broccoli → carrot-picture target labeled `Vegetables`; declare target capacity three; prompt `Put fruit with fruit and vegetables with vegetables.`; difficulty `medium`; layout `horizontal-category-sort`.
- [x] Apply the five-step activity cycle; verify each category mapping, one wrong-bin bounce without progress, three distinct visible positions per bin, full-bin behavior, and completion after the sixth correct sort.

## Task 17: Generate all review previews and run the set-wide release gate

**Files:**
- Modify: `scripts/render-pilot-previews.ts`
- Create/modify: `tests/integration/engaging-produce-set.test.ts`
- Create: 15 static previews under `library/assets/reviews/activities/`

- [x] Generalize the preview renderer to enumerate the 15 approved activity IDs, require valid concept/activity pairs, and render every prompt, target, item, label, and progress marker using the same 1024×768 coordinates as the runtime.
- [x] Test that exactly 15 approved activity records and previews exist; IDs are unique; each activity's mechanic/theme and exact sprite mapping match the spec matrix; no asset is unapproved or missing; and the approved activity records join the two current pilots in the active index.
- [x] Run `pnpm exec vitest run tests/integration/engaging-produce-set.test.ts tests/integration/pilot-candidates.test.ts`; the 15-candidate gate and the pilot regression gate pass.
- [x] Ajay approved all 15 activities for the one-child pilot on 2026-09-30. Static previews are retained as review artifacts; preview-by-preview manual inspection was not required for this pilot.

## Task 18: Verify full project behavior and production publication

- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm exec tsc --noEmit --project runtime/tsconfig.json`, `pnpm build`, and `git diff --check`; record exact output in the SDD ledger.
- [x] Inspect built publication files and confirm the activity index and JSON contain the two pilots and 15 approved activities, while staged sources, the asset manifest, and review data remain excluded from `runtime/dist`.
- [x] Confirm all 15 development-mode live interactions have a pass entry in the ledger before calling the implementation complete.
- [x] Promote the 15 activities to the approved activity library after Ajay's 2026-09-30 approval for the one-child iPad pilot; retain no duplicate staged activity files.
