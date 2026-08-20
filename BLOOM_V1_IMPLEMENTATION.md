# Bloom V1 — Implementation Plan

This is the working document. It owns: full type contracts, test strategy, milestone breakdown, git and shipping discipline, and the AI-native workflow specifics (evals, prompt versioning, content review, batch rhythm). It is updated as the build progresses.

The architecture (`ARCHITECTURE.md`) defines *what* is being built. The PRD (`PRD.md`) defines *why*. This document defines *how* and *in what order*.

## V1.1 addendum

M0–M5 below (the plan through tap-to-select) is complete and historical — read it for test strategy, git discipline, and AI-native workflow rules, all of which still apply unchanged. Its *content scope* (division-targeted drag-to-target/tap-to-select activities) is superseded by `BLOOM_V1.1_MVP_SPEC.md`; those 13 activities and their sprites moved to `library/archive/`. The active milestone plan is **§4a V1.1 Milestones (M6–M10)**, appended after the original milestone plan rather than rewriting it in place — same reasoning as never deleting old prompt versions.

Type contract deltas from V1.1 (full schemas still below in §2, this just flags what changed):
- `ConceptBriefSchema.mechanicId` gains `"find-all"`. `tap-to-select` is *not* renamed to "tap-one" — that's the spec's name for the same mechanic, param-reworked; see the mapping note in §4a.
- `ConceptBriefSchema.targetDivisionId` and `ActivityJSONSchema.metadata.targetDivisionId` are now **optional** — V1.1 drops per-activity division targeting in favor of settings.
- `ConceptBriefSchema.setting` / `ActivityJSONSchema.metadata.setting` (new, optional) — which of the 6 V1.1 settings (kitchen, playground, garden, market, farm, bathtime) this brief/activity belongs to.
- `instructionTemplate` / `settingIntro` (LLM-authored, replacing `prompt.audioRef` resolved at generation time) land in M8 alongside the prompt-template rework — not yet in the schema as of M6, since prompt changes go through the review process in CLAUDE.md before being written.

---

## 1. Tech stack

**Language:** TypeScript across the entire project. One language for studio scripts and runtime. Shared types directly imported across boundaries.

**Runtime:** Node 20+. The Phaser app and the studio scripts both run on Node tooling.

**Package manager:** pnpm. Faster than npm, stricter than yarn, good monorepo support if needed later.

**Studio (offline content production):**
- `@anthropic-ai/sdk` — Claude API for generation and review
- `openai` — TTS only (no other use)
- `zod` — schema validation
- `js-yaml` — YAML loader for framework, mechanics
- `vitest` — test runner
- `commander` — CLI argument parsing

**Runtime (online):**
- `phaser@3` — game engine
- `vite` — build tool
- TypeScript

**Shared:**
- `zod` — types defined once, used for both static type inference and runtime validation
- File-based JSON storage; no database in V1

**Hosting:** Vercel (runtime). Studio runs locally only.

**No:** React, Next.js, a UI framework for the runtime selection screen (Phaser handles it), Postgres, Redis, Docker, Kubernetes. None needed for V1.

---

## 2. Type contracts

All types defined in `shared/types.ts` using zod. Each type has a zod schema (for runtime validation) and a TypeScript type (inferred from the schema). One source of truth.

### Division (Framework Layer)

```typescript
import { z } from "zod";

export const DivisionSchema = z.object({
  id: z.string(),                    // e.g., "fine_motor.pincer_grip"
  name: z.string(),
  domain: z.string(),                // e.g., "fine_motor"
  ageRangeMonths: z.tuple([z.number(), z.number()]),
  description: z.string(),
  relatedMilestones: z.array(z.string()),
  designPrinciples: z.array(z.string()),
});
export type Division = z.infer<typeof DivisionSchema>;
```

### ConceptBrief (Concept Layer)

```typescript
export const ConceptBriefSchema = z.object({
  id: z.string(),                    // e.g., "concept_001"
  // V1.1: find-all added alongside tap-to-select (the spec's "tap-one" variant,
  // no rename — see V1.1 addendum above). drag-to-target stays registered (parked).
  mechanicId: z.enum(["drag-to-target", "tap-to-select", "find-all"]),
  // V1.1: optional — settings replace per-activity division targeting.
  targetDivisionId: z.string().optional(),
  secondaryDivisionId: z.string().optional(),
  ageMonths: z.object({
    min: z.number(),
    max: z.number(),
  }),
  difficulty: z.enum(["low", "medium", "high"]),
  themeHint: z.string(),
  targetDurationSeconds: z.number(),
  notes: z.string().optional(),
  itemSprites: z.array(z.string()).min(1),   // sprite filenames scoped to this concept's items
  targetSprites: z.array(z.string()),        // sprite filenames scoped to this concept's targets (may overlap itemSprites for shape-matching)
  // V1.1 (new, optional): which content setting this brief belongs to — see
  // concepts/settings.yaml. Optional until the M7/M8 briefs cutover makes it load-bearing.
  setting: z.string().optional(),
});
export type ConceptBrief = z.infer<typeof ConceptBriefSchema>;
```

### Layout system (shared — used by Mechanics Layer and Runtime)

```typescript
// Arrangement types — discriminated union on "type"
export const LayoutArrangementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("linear"),
              axis: z.enum(["horizontal", "vertical"]),
              direction: z.enum(["left-to-right","right-to-left","top-to-bottom","bottom-to-top"]) }),
  z.object({ type: z.literal("grid"),
              columns: z.number().int().positive(),
              rows: z.number().int().positive() }),
  z.object({ type: z.literal("circular"),
              radiusFraction: z.number(), startAngle: z.number() }),
  z.object({ type: z.literal("random"),
              minSpacing: z.number() }),
]);

export const ZoneSpecSchema = z.object({
  arrangement: LayoutArrangementSchema,
  elementCount: z.object({ min: z.number(), max: z.number() }),
  elementSize:  z.object({ min: z.number(), max: z.number() }),
  // Position fields — which are used depends on arrangement type:
  yFraction: z.number().optional(),      // linear horizontal: zone Y in play area
  xFraction: z.number().optional(),      // linear vertical: zone X in play area
  xPadFraction: z.number().optional(),   // linear horizontal: left/right padding
  yPadFraction: z.number().optional(),   // linear vertical: top/bottom padding
  centerFraction: z.object({ x: z.number(), y: z.number() }).optional(), // grid, circular
  gapFraction: z.number().optional(),    // grid: gap between cells as fraction of width
  bounds: z.object({ xPadFraction: z.number(), yPadFraction: z.number() }).optional(), // random
});

export const LayoutVariantSchema = z.object({
  id: z.string(),
  description: z.string(),
  zones: z.record(ZoneSpecSchema),       // keyed by zone name, e.g. "item_zone", "target_zone"
});
```

All fractions (`yFraction`, `xPadFraction`, etc.) are relative to the play area (the canvas region between the prompt bar and progress bar), not the full canvas. The runtime maps play-area fractions to canvas coordinates.

`shared/layout-engine.ts` exposes `computeZonePositions(zone, count, playArea): Position[]` for all four arrangement types. It is pure TypeScript with no Phaser dependency and is fully unit-tested.

### MechanicSpec (Mechanics Layer)

```typescript
export const MechanicSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  deviceCompatibility: z.array(z.enum(["ipad", "phone", "desktop"])),
  slotSchema: z.record(z.unknown()),
  parameterSchema: z.record(z.unknown()),
  layouts: z.array(LayoutVariantSchema),  // available layout variants for this mechanic
});
export type MechanicSpec = z.infer<typeof MechanicSpecSchema>;
```

**Layout variants per mechanic:**
- `drag-to-target` (parked, V1): `horizontal-standard`, `horizontal-reversed`, `vertical-standard`, `vertical-reversed`
- `tap-to-select` (V1.1's "tap-one"): `grid-2x2`, `grid-2x3`, `grid-3x2`, `horizontal-line`, `circle`, `random`
- `find-all` (new, V1.1): `grid-2x3`, `grid-3x3`, `horizontal-line`, `random` — see `mechanics/specs/find-all.yaml`

The generation layer selects a `layoutId` per activity. At store time, `store.ts` resolves it against the mechanic spec and inlines the full `LayoutVariant` into `parameters.layout`. The ActivityJSON in the library is self-describing — the runtime reads `parameters.layout` directly and never loads the mechanic spec.

### ActivityJSON (Generation output / Runtime input)

```typescript
export const ActivityJSONSchema = z.object({
  id: z.string(),                    // e.g., "act_001"
  conceptId: z.string(),
  mechanicId: z.string(),
  generatedAt: z.string().datetime(),
  filledSlots: z.record(z.any()),    // validated against per-mechanic schema
  parameters: z.record(z.any()),     // validated against per-mechanic parameter schema
  prompt: z.object({
    text: z.string(),
    audioRef: z.string(),            // path relative to library/assets/
  }),
  audioRefs: z.object({
    successSfx: z.string(),
    errorSfx: z.string(),
    completionSfx: z.string(),
  }),
  metadata: z.object({
    targetDivisionId: z.string().optional(),  // V1.1: optional, see ConceptBrief note above
    secondaryDivisionId: z.string().optional(),
    ageMonths: z.object({ min: z.number(), max: z.number() }),
    difficulty: z.enum(["low", "medium", "high"]),
    targetDurationSeconds: z.number(),
    reviewScore: z.number(),
    reviewerNotes: z.string(),
    humanApprovedAt: z.string().datetime().optional(),
    humanApprover: z.string().optional(),
    setting: z.string().optional(),           // V1.1 (new)
  }),
});
export type ActivityJSON = z.infer<typeof ActivityJSONSchema>;
```
### LLMGenerationOutputSchema (Generation Layer — LLM response only)

This is the slim schema for validating the LLM's raw response before assembly into a full ActivityJSON. It contains ONLY the fields the LLM is responsible for. The pipeline validates against this schema immediately after parsing the LLM response.

```typescript
export const LLMGenerationOutputSchema = z.object({
  _reasoning: z.string().optional(),  // stripped after parsing, not stored
  filledSlots: z.object({
    items: z.array(z.object({
      id: z.string(),
      targetId: z.string(),
      label: z.string(),
      assetRef: z.string(),
    })),
    targets: z.array(z.object({
      id: z.string(),
      label: z.string(),
      assetRef: z.string(),
    })),
    distractors: z.array(z.any()),
  }),
  prompt: z.object({
    text: z.string(),
  }),
});
export type LLMGenerationOutput = z.infer<typeof LLMGenerationOutputSchema>;
```

The pipeline assembles the full ActivityJSON by combining this output with deterministic values (id, metadata, parameters, audioRefs) computed from the ConceptBrief, difficulty mapping, and pipeline constants. The assembled object must validate against ActivityJSONSchema.

### SessionRecord (Runtime → telemetry)

```typescript
export const SessionRecordSchema = z.object({
  sessionId: z.string(),
  activityId: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  outcome: z.enum(["completed", "abandoned"]),
  durationSeconds: z.number(),
  parentRating: z.enum(["loved", "fine", "bailed"]).optional(),
  events: z.array(z.object({         // optional fine-grained event log
    timestamp: z.number(),
    type: z.string(),
    payload: z.record(z.any()).optional(),
  })),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;
```

### RejectionReason (Generation pipeline failures)

```typescript
export const RejectionReasonSchema = z.object({
  stage: z.enum(["validate", "llm_review", "manual_review"]),
  reason: z.string(),
  details: z.record(z.any()).optional(),
  rejectedAt: z.string().datetime(),
});
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
```

---

## 3. Test strategy

Three test categories. Each has clear responsibilities and explicit gating.

### Unit tests

**What:** Pure-function tests of individual modules.

**Where:** Co-located with source. `framework/loader.ts` → `framework/loader.test.ts`.

**Tool:** Vitest.

**Coverage expectations:**
- All loader functions (Framework, Concept, Mechanics) — must have unit tests.
- All validators (programmatic validation in Generation) — must have unit tests.
- Pure helpers (asset reference resolution, ID generation, layout computation, etc.) — must have unit tests.
- `shared/layout-engine.ts` — unit tested at `shared/layout-engine.test.ts`. All four arrangement types (linear, grid, circular, random) have tests for count, position correctness, and direction.
- Phaser scene logic — *not* unit-tested. Tested via integration.

**Gate:** Unit tests must pass before any commit. CI runs them on every push.

### Integration tests

**What:** Tests that exercise multi-layer flows end-to-end with real (or realistic) inputs.

**Where:** `tests/integration/`.

**Specific integration tests V1 must have:**

1. **Framework → Concept → Generation pipeline.** Given a real ConceptBrief that references a real Division, the generation pipeline produces a valid ActivityJSON. (Mocks the LLM call to return a fixture. Real validation, real schema check.)
2. **Generation → Runtime.** Given a real ActivityJSON in the library, the runtime can load and render it without errors. (Headless Phaser test — Phaser supports a `headless: true` mode for CI.)
3. **Manual review surface generation.** Given a staged activity, the static preview HTML renders correctly with all three views (visual, JSON, reviewer notes).
4. **Full pipeline (mocked LLM).** Concept → Generate (mocked LLM) → Validate → LLM Review (mocked) → Stage → Preview → (manual approval simulated) → Store. End-to-end, no human in the loop, all stages real except the LLM calls.

**Gate:** Integration tests must pass before merging to main. CI runs them on every PR.

### Regression tests

**What:** Tests that lock in fixes for specific bugs found during development.

**Where:** `tests/regression/`.

**Convention:** Every bug fix gets a regression test. The test is named after the issue (e.g., `regression/drag-during-scroll-fix.test.ts`). The test description references the original failure ("Nitara could trigger page scroll while dragging an item; this test ensures the drag handler claims the touch event before scroll can engage").

**Gate:** Regression tests must pass before merge. They never get deleted — they accumulate as the project's living memory of what was once broken.

### Eval gating (for the Generation Layer specifically)

This is separate from the test categories above and applies only to the Generation Layer. It is the most important quality gate in the system because LLM outputs are non-deterministic.

See section 5 (AI-native workflow) below.

### What is not tested

- Phaser visual rendering pixel-by-pixel. Phaser is trusted; we test that scenes load and inputs work, not that pixels match.
- Specific LLM outputs. LLMs are non-deterministic; we test the pipeline around the LLM, not the LLM itself. The eval system (section 5) is how we measure LLM output quality.
- Third-party libraries. We trust zod, vitest, vite, Phaser to do their jobs.

### TDD discipline

**Where TDD is mandatory:**
- Type validators (write failing schema test → write schema → pass)
- Pipeline stage logic (write failing pipeline test with mocked LLM → write pipeline → pass)
- Mechanic slot validators (write failing test for invalid slot data → write validator → pass)

**Where TDD is loose:**
- Phaser scene logic. TDD-ing game scenes is awkward; integration tests catch the failures that matter.
- CLI scripts. These are exercised by integration tests.

**Where TDD is wrong:**
- Prompts. Prompts are not code in the traditional sense. They are evaluated by the eval system, not tests.

---

## 4. Milestone plan

Six milestones, sequenced by dependency. Each milestone has an explicit "done" criterion. Parallelism is called out where it exists.

The build is sequenced so that **Nitara has new content at the end of every milestone**, even if the underlying system is incomplete. This forces useful output at every step.

### Milestone 0: Project skeleton

**Goal:** Repo exists, tooling works, CI runs.

**Deliverables:**
- pnpm workspace initialised
- TypeScript config, vitest config, vite config
- Directory structure per `ARCHITECTURE.md` repo layout
- Shared types module with zod schemas (Division, ConceptBrief, MechanicSpec, ActivityJSON, SessionRecord, RejectionReason)
- Unit tests for every zod schema (round-trip serialise/parse)
- GitHub Actions CI: runs unit tests on every push
- Vercel project linked
- `CLAUDE.md` written
- One commit to main with this as the baseline

**Done when:** `pnpm test` passes on CI. Empty Phaser app deploys to Vercel and shows "Bloom" on iPad.

**Time estimate:** 1 weekend (it is mostly setup, not creative work).

**Parallelism:** None — this is the foundation.

---

### Milestone 1: Runtime — drag-to-target on iPad

**Goal:** A polished drag-to-target activity that feels good on iPad. Nitara plays it. Built directly in TypeScript with no AI yet — this milestone validates Phaser solves the interaction problem.

**Deliverables:**
- Phaser 3 set up with Vite, deployed to Vercel
- Selection screen (placeholder — single-button "Play" while only one activity exists)
- Activity screen with hardcoded apple-in-basket activity
- Drag-to-target mechanic implemented:
  - Items render with proper sizing (min 120pt)
  - Drag follows finger, no scroll conflict
  - Correct target snapping with success animation + sound
  - Incorrect target bounce-back with soft feedback
  - Activity completion with celebration
- Free-library art for items, targets, sound effects
- Touch input handled via Phaser's input system (not DOM)
- "Add to Home Screen" tested on actual iPad
- Integration test: scene loads and a programmatically-triggered drag completes

**Done when:**
- Nitara plays the apple-in-basket activity on iPad
- Drag is crisp, no scroll conflicts, feedback is loud and clear
- The interaction issues from the prior prototype are visibly resolved
- Integration test for the activity screen passes in CI

**Time estimate:** 1 weekend. Risk: if Phaser drag isn't crisp by end of weekend, fall back to one polished hand-built variant of the prior HTML version for Nitara's continued play, continue Phaser work into milestone 2.

**Parallelism:** None within the milestone, but Milestone 2 work on the Framework can begin in parallel (different person, or for solo dev: separate evening sessions).

**What this milestone deliberately defers:**
- Activity-from-JSON loading. The activity is hardcoded. Refactoring to JSON-driven happens in Milestone 3.
- Tap-to-select mechanic. Added in Milestone 5.

---

### Milestone 2: Framework + Mechanics + Concept layers

**Goal:** All three "data" layers exist as real, testable modules with their handshakes wired up.

**Deliverables:**
- `framework/framework-2-3.yaml` populated with the 3 V1 divisions plus minimal context for each
- `framework/loader.ts` exposing `getDivisionsForAge(months)` and `getDivisionById(id)`
- `mechanics/specs/drag-to-target.yaml` with full slot and parameter schema
- `mechanics/specs/tap-to-select.yaml` with full slot and parameter schema
- `mechanics/loader.ts` exposing `getMechanicSpec(id)` and `listMechanicSpecs()`
- `concepts/new-concept.ts` CLI that walks through producing a ConceptBrief
- `concepts/loader.ts` exposing `getConceptBrief(id)` and `listConceptBriefs()`
- 5 hand-authored ConceptBriefs in `concepts/briefs/` (will feed Milestone 3)
- Unit tests for every loader
- Integration test: load a ConceptBrief, look up its target Division, look up the matching MechanicSpec — all three layers exchange data correctly

**Done when:**
- `pnpm test` passes
- Running `pnpm new-concept` produces a valid ConceptBrief on disk
- Integration test confirming the three-layer handshake passes

**Time estimate:** 1 weekend.

**Parallelism:** Can be partially done in parallel with Milestone 1 (different files, no dependencies in the other direction).

---

### Milestone 3: Generation pipeline (offline studio)

**Goal:** The full generation pipeline works end-to-end. Generates real activities. Reviewed by both LLM and human. Approved activities land in the library.

**This is the AI-craft milestone.** Most learning concentrated here.

**Deliverables:**

*Pipeline stages:*
- `generation/pipeline/prompt.ts` — takes ConceptBrief + MechanicSpec + Division, calls Claude, returns proposed ActivityJSON
- `generation/pipeline/validate.ts` — programmatic validation (schema, asset references, parameter bounds)
- `generation/pipeline/llm-review.ts` — separate Claude call for content review, returns score + structured notes
- `generation/pipeline/stage.ts` — writes staged activity + generates static preview HTML
- `generation/pipeline/store.ts` — moves approved activity from staged → library
- `generation/generate-cli.ts` — CLI entry point: `pnpm generate <concept-id>`
*Pipeline boundary (LLM vs deterministic):*
- `prompt.ts` has three internal phases: (1) read data layers + compute deterministic params, (2) call Claude with slim prompt, (3) assemble full ActivityJSON from LLM output + deterministic values
- The LLM prompt template receives only: themeHint, itemCount, targetCount, divisionName, designPrinciples, availableSprites. No raw ConceptBrief, Division, or MechanicSpec objects.
- The LLM returns only: filledSlots (items, targets, distractors) and prompt.text. All other ActivityJSON fields are set by pipeline code.
- `LLMGenerationOutputSchema` in shared/types.ts validates the LLM response before assembly.

*Prompts (versioned files):*
- `generation/prompts/generate-drag-to-target.v1.txt`
- `generation/prompts/review.v1.txt`

*Manual review surface:*
- `generation/review-ui/` — generates a static HTML page per staged activity with three views: visual preview (rendered items + targets + audio playback), full JSON inline, LLM reviewer notes
- `pnpm review` opens the staged-activity HTML pages in a browser

*Eval system:*
- `generation/evals/cases/` — 10 hand-authored test cases as JSON files
- `generation/evals/runner.ts` — executes all eval cases against the current pipeline, reports pass/fail per case per level (schema / content / mechanic)
- Eval runner is also runnable via `pnpm eval`

*Integration test:*
- Full pipeline test (mocked LLM): ConceptBrief in → validated ActivityJSON in library out
- Real-LLM smoke test: generate one activity end-to-end with a real Claude call (run manually, not in CI)
- **LLM-pipeline boundary test.** The prompt template file must contain `{{ITEM_COUNT}}` and `{{TARGET_COUNT}}` (pipeline-injected) and must NOT contain `{{CONCEPT_BRIEF}}`, `{{DIVISION}}`, or `{{MECHANIC_SPEC}}` (raw object injection). This test prevents boundary drift.
- **Assembly correctness test.** Given a mock LLM response matching LLMGenerationOutputSchema and a ConceptBrief, the assembly function produces an ActivityJSON that passes ActivityJSONSchema validation. All deterministic fields (id, metadata, audioRefs, parameters) are set by the pipeline, not copied from LLM output.
**Done when:**
- `pnpm generate <concept-id>` produces a staged activity with a viewable preview
- `pnpm review` allows approving/rejecting staged activities
- 5 activities have gone through the full pipeline end-to-end (covering drag-to-target only)
- Eval runner reports passing scores
- Integration test (mocked LLM) passes in CI

**Time estimate:** 2 weekends. The most complex milestone.

**Parallelism:** Some — the eval cases can be authored in parallel with pipeline code. Prompts can be drafted before pipeline code is written.

---

### Milestone 4: Runtime — JSON-driven, multi-activity

**Goal:** Runtime loads activities from the library, presents them in a Selection screen, plays any of them.

**Deliverables:**
- Runtime refactored to load ActivityJSONs from `library/activities/` (not hardcoded)
- Selection screen showing categorised activity grid
- Activity screen renders any drag-to-target activity from JSON
- Completion screen with parent rating capture
- Session telemetry to localStorage
- Integration test: load an ActivityJSON, render it, simulate completion, verify session record stored

**Done when:**
- All 5 activities generated in Milestone 3 are playable from the Selection screen
- Nitara plays multiple activities in a session
- Parent rating is captured and persisted
- Integration test passes in CI

**Time estimate:** 1 weekend.

**Parallelism:** Can begin once Milestone 3 has produced its first staged activity. Does not need to wait for full Milestone 3 completion.

---

### Milestone 5: Tap-to-select mechanic

**Goal:** Second mechanic added end-to-end. Validates the architecture: a new mechanic can be added without restructuring the layers.

**Deliverables:**
- `mechanics/specs/tap-to-select.yaml` (already written in Milestone 2 — confirm completeness)
- `runtime/src/mechanics/tap-to-select.ts` — Phaser implementation
- `generation/prompts/generate-tap-to-select.v1.txt`
- 6-8 tap-to-select activities through the full pipeline
- Integration tests added for tap-to-select mechanic
- Eval cases added for tap-to-select

**Done when:**
- Tap-to-select activities are playable on iPad
- Full library count reaches 15-20 activities
- All eval cases (drag-to-target + tap-to-select) pass
- Integration tests for both mechanics pass

**Time estimate:** 1 weekend.

**Parallelism:** Most of this milestone is content production (running the pipeline) plus a single new mechanic implementation. The implementation is small; the content is bulk.

---

### Milestone 6: Polish + V1 ship

**Goal:** V1 is shippable. All success criteria from the PRD met.

**Deliverables:**
- All success criteria from PRD checked
- README documenting how to run, generate, review, deploy
- Production deployment on Vercel verified working from iPad
- Telemetry from Nitara's first week of real use captured and reviewed
- Known issues documented for V1.5

**Done when:**
- The "5-minute demo" from the PRD plays out as described
- Nitara has played activities across at least 3 sessions, at least one unprompted
- Builder can articulate the full system without notes (PRD success criterion #6)
- Final commit tagged `v1.0.0`

**Time estimate:** 1 weekend (if everything else has gone well; longer if technical debt has accumulated).

---

### Total time estimate

7 weekends, with the explicit understanding that:
- Some milestones may take longer if quality bar is higher than estimated
- Nitara has new content at the end of every milestone (Milestone 1 onward)
- Parallel work between Milestones 1 and 2, and between Milestones 3 and 4, can compress total wall-clock time

**Critical path:** M0 → M1 → M3 → M4 → M5 → M6. M2 runs parallel to M1.

*Note: M6 above (Polish + V1 ship) is the original plan's final milestone and was never reached — V1.1 rescoped before it started. The "M6" used from here on refers to the first V1.1 milestone below, not this one. Renumbering avoided a collision by starting V1.1 at M6 anyway, since nothing here was built; flagged so the two aren't confused later.*

---

## 4a. V1.1 Milestones (M6–M10)

Supersedes §4's remaining milestones (the original M6 above). Scope per `BLOOM_V1.1_MVP_SPEC.md`; sequencing mirrors its §8 build sequence.

**Mechanic naming, settled:** the spec calls the two tap variants "tap-one" and "find-all." `tap-to-select` (built, 8 V1 activities, code/specs/prompts all reference this id) **is** tap-one — param-map rework only (§3a's low/medium/high table), no rename, no code churn. `find-all` is a new, separate `mechanicId` (`mechanics/specs/find-all.yaml`, landed M6).

**Gate policy, settled:** Gates 1–2 (validate, LLM review) stay auto-approve. The spec's "sampled human" gate = per-batch iPad review (you, each batch of 5, before it ships to Nitara) — not a return to per-activity staging. `pnpm review` / `library/staged/` stay in the repo, parked.

### M6: Foundations

**Goal:** Docs and schema catch up to reality and to V1.1, without touching the generation prompts or runtime yet.

**Deliverables:**
- Fix rejection logging: `generate-cli.ts` Gate 1/Gate 2 failures now call `rejectActivityDirect()` (`generation/pipeline/store.ts`), restoring the CLAUDE.md invariant that every rejection is logged to `library/rejected/`.
- Schema deltas landed additively (§2 above): `ConceptBrief.setting` (optional), `targetDivisionId` → optional on both `ConceptBrief` and `ActivityJSON.metadata`, `mechanicId` gains `find-all`.
- `mechanics/specs/find-all.yaml` — slotSchema (`targets[]`, `distractors[]`), parameterSchema (`targetCount`, `distractorCount`, `visualSimilarity`), 4 layout variants per the spec's §3 table.
- `concepts/settings.yaml` + `concepts/expand-settings.ts` — deterministic expander, 6 settings × 5 briefs (3 tap-one + 2 find-all). Writes to `concepts/briefs-v1.1/` (draft), **not** `concepts/briefs/` — see below.
- Old V1 content archived: 13 activities → `library/archive/v1-activities/`, `library/activities/index.json` reset to empty. Old concept briefs (`concept_001`–`005`) and the 30 Fluent Emoji sprites **stay in place** (see "What M6 deliberately doesn't do").
- Docs updated: this file, `ARCHITECTURE.md`, `CLAUDE.md` (all addenda), `BLOOM_V1_PRD.md` (superseded-scope banner).

**What M6 deliberately doesn't do, and why:**
- **Doesn't cut over `concepts/briefs/`.** The expander's output briefs reference manifest-driven sprite filenames (`kitchen_apple.png` etc.) that don't exist on disk until M7's asset spike runs. Promoting them into `concepts/briefs/` now would either break `validate.ts`'s asset-existence check the moment anyone runs `pnpm generate`, or require faking file existence — neither is honest. Cutover (archive old briefs, promote new ones) happens once the M7 manifest is real.
- **Doesn't touch `library/assets/sprites/` or `taxonomy.yaml`.** Both are load-bearing for the still-green V1 test suite (`generation/taxonomy.test.ts`, the asset-existence checks in `tests/integration/generation-pipeline.test.ts`). Archiving them now would break 60+ passing tests with nothing to replace them until M7 lands. They move to `library/archive/` in the same commit that wires the new manifest in (M7/M8), not before.
- **Doesn't touch `instructionTemplate`/`settingIntro`/prompt text.** Prompt changes go through the CLAUDE.md review process (structure proposed, feedback, then written) — that's M8 work, done with Ajay, not autonomously here.

**Done when:** `pnpm test && pnpm typecheck` green; `library/activities/` empty (archived, not deleted); `concepts/expand-settings.test.ts` passes with the 3+2×6=30 split; docs no longer contradict the codebase or the V1.1 spec.

### M7: Asset spike (gates everything visual)

**Goal:** Prove the sheet-generation technique works before spending a mechanic/pipeline build on it.

**Deliverables:** style block (prompt — reviewed with Ajay, not written autonomously); sheet-gen script (GPT Image only per Ajay's call — no Recraft comparison arm this round, see risk note below); slice/normalize/palette-snap scripts (`scripts/assets/`, new top-level dir, already asked/approved); curate-review UI (reuses the `review-ui` HTML-preview pattern); manifest writer (`assets/manifest.json`); kitchen sheets run end-to-end; keep-rate measured. Runs **locally on Ajay's Mac** — keys in `.env.local`, not this remote environment.

**Known risk (flagged at planning, not new):** GPT-Image-only means no comparison arm. If keep-rate misses the ≥50% bar, that's ambiguous — technique failure vs. model weakness — and the honest next step is trying Recraft before concluding the sheet-generation approach itself doesn't work, not falling back to icon libraries (explicitly ruled out in the spec).

**Done when:** ≥50% keep-rate on kitchen sheets, manifest populated, decision logged either way. Below 30% after 2 prompt iterations → stop, reassess with Ajay — no silent fallback.

### M8: Mechanic + pipeline update

**Goal:** find-all runtime-wired, tap-to-select reparamaterized, manifest replaces taxonomy.yaml, multimodal Gate 2, audio pipeline.

**Deliverables:** `find-all` Phaser mechanic (progress dots, per-item found state); tap-to-select param rework to the spec's §3a table; `taxonomy.ts` repointed at `assets/manifest.json` (old sprites + `taxonomy.yaml` archived in this same change, per the M6 deferral above); generation prompt updates for both mechanics (**structure proposed to Ajay first**, per CLAUDE.md); multimodal review harness (Playwright + built runtime + `?activity=<id>` deep link) and review.v4 prompt (**same review process**); `instructionTemplate`/`settingIntro` added to the LLM output schema and `ActivityJSONSchema` (this is where those fields actually land — see V1.1 addendum note above); TTS 3-voice "Nitara" test; `build-pack` CLI (new `distribution/` dir); replay button + backdrop rendering in the runtime; `concepts/briefs/` cutover (archive V1 briefs, promote `concepts/briefs-v1.1/` in).

**Done when:** one kitchen activity flows brief → generate → both gates → `build-pack --child nitara` → plays on iPad with her name in the audio.

### M9: Batch 1 — kitchen

5 activities through the full pipeline, iPad, 2–3 informal Nitara sessions. Cost + human-minutes logged per the spec's §7 metrics. **Done when:** repeatability check passes — a second setting's batch needs zero code changes.

### M10: Batches 2–6 + 4-week observation

Remaining 5 settings, 5 activities each, assets generated the weekend before each batch. Weekly pack refresh mixing new + old. Decision gate at end of week 4 against the spec's §7 success criteria — not a build milestone, an evaluation one.

---

## 5. AI-native workflow

These are the disciplines specific to building AI-native products. They are first-class workflow rules, not afterthoughts.

### Eval discipline

**An eval case is:** `(ConceptBrief, MechanicSpec, expected_properties[])`. The expected_properties are assertions about the generated activity that should hold regardless of the specific LLM output.

**Examples of expected_properties:**
- "all `targetId` values in `items` reference an `id` in `targets`"
- "`itemCount` parameter is between 3 and 7 inclusive"
- "`prompt.text` is non-empty and under 100 characters"
- "every `assetRef` resolves to a file in `library/assets/`"
- "`metadata.difficulty` matches the input concept's `difficulty`"
- "no item label contains profanity or offensive content" (LLM-judged sub-eval)

**When to add an eval case:**
- Every time a manual review rejects a staged activity, the rejection reason becomes a new eval case (or strengthens an existing one).
- Every time a class of bug is discovered in production (Nitara plays an activity that surfaces a problem), it becomes an eval case.
- Whenever a new mechanic is added, at least 3 baseline eval cases are added for it.

**When to update an eval case:**
- When the schema changes (eval case must remain valid against the new schema).
- When the assertion is found to be over-strict and is rejecting valid outputs.

**Eval gating:**
- Evals run before any prompt change is committed. Pass rate must hold or improve.
- Evals run before any pipeline code change. Pass rate must hold or improve.
- Eval runs are scripted (`pnpm eval`) and produce a report saved to `generation/evals/results/<timestamp>.json`.
- A regression in eval pass rate blocks commit.

**Eval set growth:**
- V1 starts with 10 hand-authored cases.
- Target by end of V1: ~25 cases (10 baseline + 15 from real rejections).
- Target by end of V2: ~100 cases.

### Prompt versioning

**Prompts are code.** They live in versioned files, are tracked in git, and have explicit versions in their filenames.

**Naming convention:**
- `generation/prompts/generate-drag-to-target.v1.txt`
- `generation/prompts/generate-drag-to-target.v2.txt`
- `generation/prompts/review.v1.txt`

**When to bump a prompt version:**
- Material change to instructions, structure, or output format.
- Not for typo fixes; those stay on the same version.
- The currently-active version is referenced in the pipeline code as a constant.

**Prompt change workflow:**
1. Copy the active version to a new file with bumped version number.
2. Make edits in the new file.
3. Update the pipeline code to reference the new version.
4. Run evals. If pass rate holds or improves, commit. If it regresses, iterate or revert.
5. Old prompt files are kept in the repo permanently. Never deleted — they are the project's prompt-engineering history.

**Commit convention:** Prompt changes are isolated commits. A commit either changes a prompt or changes pipeline code, not both. Makes bisection trivial.

### Content review workflow

**Cadence:** Manual review happens in batches, not one at a time. A typical V1 review batch is 5-10 staged activities.

**Workflow:**
1. Run `pnpm generate` for several concept briefs in sequence. Each produces a staged activity with a preview HTML page.
2. Run `pnpm review`. Opens all staged activities' preview pages.
3. For each staged activity:
   - View the rendered preview.
   - Inspect the JSON if anything looks off.
   - Listen to the prompt audio.
   - Approve, reject (with reason), or regenerate.
4. Approved activities move to `library/activities/`.
5. Rejections feed back as new eval cases (manually written, or auto-generated from the rejection reason).

**Reviewer notes are mandatory.** Every reject or regenerate decision must include a reason. "Bad" is not a valid reason; "prompt is condescending — uses 'good job' before the child has done anything" is.

### Generation batch rhythm

**Batches are the unit of content production.** A batch = ~5-10 activities generated, reviewed, and either stored or rejected together.

**Why batches:**
- Manual review is more efficient at the batch level (you build context across a set of similar activities).
- Eval results are more meaningful at the batch level than per-activity.
- Cost monitoring is more visible (one batch = one observable spend).

**Batch composition guidance for V1:**
- A batch should target one mechanic and one division per session, varying difficulty and theme.
- Example batch: 6 drag-to-target activities targeting pincer grip — 2 themes × 3 difficulties.

### Cost monitoring

**For V1 (low volume), cost monitoring is light:**
- Each generation run logs estimated tokens used (input + output, both Claude and OpenAI TTS).
- A weekly summary script (`pnpm cost-report`) aggregates total LLM spend.
- Hard stop: if a single batch of 10 activities costs more than $5 to generate, investigate before generating more.

**At V1 volume, total monthly LLM spend should be well under $50.** If it is meaningfully more, the pipeline has a bug (regenerating, looping, or not caching).

---

## 6. Git and shipping discipline

### Branch strategy

**Trunk-based development.** Solo developer; long-lived feature branches are unnecessary friction.

- `main` is always deployable.
- Work happens on short-lived feature branches (`feature/runtime-drag` etc.) — rarely longer than a day or two.
- Merge to `main` via PR, even for solo dev. The PR is the moment CI runs.
- No release branches in V1.

### Commit conventions

**Conventional Commits.** Forces commit messages to communicate intent.

```
feat: add drag-to-target mechanic to runtime
fix: prevent scroll during drag in activity scene
refactor: extract validation logic from pipeline
docs: update CLAUDE.md with eval workflow
prompt: update generate-drag-to-target to v2
eval: add 5 new eval cases for tap-to-select
test: add integration test for full pipeline
chore: bump phaser to 3.80
```

**Why this matters for AI-native:** `prompt:` and `eval:` are first-class commit types. They isolate AI-craft changes from code changes. Bisection across "when did the eval pass rate drop?" becomes possible.

### CI/CD

**On every push to a feature branch:**
- Lint (typescript-eslint)
- Type check (tsc --noEmit)
- Unit tests (vitest)

**On every PR to main:**
- All of the above
- Integration tests
- Build the runtime app (verify it compiles)

**On merge to main:**
- All of the above
- Deploy runtime to Vercel preview environment
- (Future, post-V1: deploy to production on tag)

**What is not in CI:**
- Eval runs. Evals require LLM calls (real cost, real time). They are run manually via `pnpm eval` before any prompt change. Considered for nightly runs in V2+.
- Real LLM smoke tests. Same reason — costs money to run, run manually.

### Shipping

**V1 is shipped when** all PRD success criteria are met and the v1.0.0 tag is created.

**Deployment workflow:**
- Runtime auto-deploys to Vercel on merge to main.
- Studio is local-only — no deployment.
- No staging vs production split in V1. There is one environment.

**Rollback:**
- Vercel keeps deployment history. Reverting to a previous deploy is one click.
- For studio bugs (bad activities reaching the library), the manual review step is the firewall.

### Git hygiene

- `.gitignore` includes `node_modules`, `dist`, `.env`, `library/sessions/` (telemetry — local only), `generation/evals/results/`, anything under `library/staged/` not yet promoted.
- Secrets (Anthropic API key, OpenAI API key) live in `.env.local`. Never committed.
- Generated assets (TTS audio files) are committed. They are part of the activity, not a build artifact.

---

## 7. Definition of done — checklist for V1 ship

This list is checked before declaring V1 complete and tagging v1.0.0.

**Architectural:**
- [ ] All five layers exist as separate modules
- [ ] Every layer's handshake is typed (zod schema) and tested
- [ ] Integration test exercising all layer handshakes passes

**Content:**
- [ ] 15+ activities in `library/activities/`
- [ ] Every activity has passed: programmatic validation + LLM review + manual review
- [ ] Both V1 mechanics (drag-to-target, tap-to-select) have ≥3 activities each
- [ ] All 3 V1 divisions are represented in the activity library

**Engagement (Nitara):**
- [ ] Has played activities across ≥3 sessions
- [ ] At least one session was unprompted (she asked for it)
- [ ] Sessions average >5 minutes
- [ ] Has played both mechanics

**Interaction quality:**
- [ ] No drag-vs-scroll conflicts
- [ ] Feedback is loud and clear (success and failure)
- [ ] Colors are bold and high-contrast

**Pipeline:**
- [ ] `pnpm generate <concept-id>` works end-to-end
- [ ] `pnpm review` allows approval/rejection
- [ ] Time from concept brief to approved library activity is <15 minutes of human time
- [ ] Eval runner reports passing scores on all current cases

**Tests:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All regression tests pass (if any have been added)
- [ ] CI is green on main

**Builder skill (PRD criterion #6):**
- [ ] Can articulate without notes: prompt structure, eval levels, ActivityJSON schema, runtime consumption flow

**Shipping:**
- [ ] Runtime deployed to Vercel
- [ ] iPad "Add to Home Screen" works in production
- [ ] README has setup instructions for a fresh clone
- [ ] CLAUDE.md is current
- [ ] v1.0.0 tag created

---

## 8. Known unknowns

Things that will be discovered during the build, captured here so they're not surprises:

- **Phaser drag tuning.** The 60pt snap distance, 1.1x scale, etc. are starting values. Real values get tuned against Nitara's actual play.
- **TTS voice selection.** Which OpenAI voice works best for a 2-year-old. Tested empirically.
- **Eval threshold calibration.** The 0.85 score cutoff for LLM review is a placeholder. Calibrated against the first 20 generated activities.
- **LLM review prompt iteration.** The review prompt will need 2-3 iterations before it reliably catches what manual review catches.
- **Asset library sufficiency.** Whether Flaticon has every asset every concept needs. Pre-checked but not exhaustively.
- **Phaser performance on iPad.** Should be fine; verified at Milestone 1.

These are not blockers. They are points of expected adjustment.
