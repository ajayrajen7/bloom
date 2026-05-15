# Bloom — Session Memory

Read this at the start of every session. Update it proactively when context approaches ~80%, and at the end of every session.

---

## Current milestone

- **Active:** M5 — tap-to-select mechanic + 6-8 activities
- **Status:** Not started

---

## What's been built

**M0 — complete**
- pnpm workspace, all configs, shared types (6 schemas, 21 tests), CI, directory structure

**M1 — code complete, pending iPad test**
- `runtime/src/audio.ts` — programmatic Web Audio tones
- `runtime/src/mechanics/drag-to-target-logic.ts` — pure logic (SNAP_DISTANCE=80)
- `runtime/src/mechanics/drag-to-target.ts` — full Phaser drag mechanic
- `runtime/src/scenes/` — selection, activity, completion
- Dev server: `pnpm vite runtime` → http://localhost:3000

**M2 — complete**
- `framework/framework-2-3.yaml` + loader (getDivisionsForAge, getDivisionById)
- `mechanics/specs/drag-to-target.yaml` + `tap-to-select.yaml` + loader
- `concepts/briefs/concept_001–005.json` (5 briefs, all 3 divisions)
- `concepts/loader.ts` + `concepts/new-concept.ts` CLI
- Integration test: Framework→Concept→Mechanics handshake

**M3 — complete**
- `generation/pipeline/prompt.ts` — slim inputs, validates LLM output via LLMGenerationOutputSchema, assembles full ActivityJSON via `assembleLLMOutput()`
- `generation/pipeline/validate.ts` — schema + slot + item count + prompt length + asset ref + taxonomy type-level + sprite-scope checks
- `generation/pipeline/llm-review.ts` — Claude API review call, score threshold 0.85, review.v2.txt
- `generation/pipeline/stage.ts` — staged JSON + HTML preview
- `generation/pipeline/store.ts` — approve (→ library/activities/) or reject (→ library/rejected/); regenerates index.json on approve; now correctly excludes .approved.json from index scan
- `generation/generate-cli.ts` — `pnpm generate <concept-id>`
- `generation/review-ui/serve.ts` — `pnpm review` interactive approval CLI
- `library/assets/sprites/` — 30 placeholder stub PNGs
- `library/assets/audio/sfx/` — 3 SFX stubs
- `generation/evals/cases/eval_001–010.json` — 10 eval cases
- `generation/evals/runner.ts` — `pnpm eval` runner

**M4 — complete**
- `shared/types.ts` — ActivityIndexSchema + ActivityIndexEntrySchema
- `library/activities/act_dev_001.json` — dev fixture
- `library/activities/index.json` — activity manifest (auto-regenerated on approve)
- `runtime/vite.config.ts` — publicDir set to `../library`
- `runtime/src/telemetry.ts` — buildSessionRecord, appendSession, getSessions
- `runtime/src/scenes/activity.ts` — JSON-driven, layout-driven
- `runtime/src/scenes/selection.ts` — loads index.json, renders card list
- `runtime/src/scenes/completion.ts` — persists SessionRecord to localStorage on rating tap
- `generation/pipeline/store.ts` — regenerates index.json after every approve

**Layout system — complete (pre-M5 architectural fix)**
- `mechanics/specs/drag-to-target.yaml` — 4 layout variants
- `mechanics/specs/tap-to-select.yaml` — 6 layout variants
- `shared/types.ts` — LayoutArrangementSchema, ZoneSpecSchema, LayoutVariantSchema
- `shared/layout-engine.ts` — pure position computation, no Phaser dependency
- `shared/layout-engine.test.ts` — 18 tests

**Generation pipeline — structural sprite fix + prompt v9 (2026-05-15)**
- `shared/types.ts` — `LLMGenerationOutputSchema`, `LLMGenerationOutput` type; `ConceptBriefSchema` now includes `itemSprites: z.array(z.string()).min(1)` and `targetSprites: z.array(z.string())`
- `concepts/briefs/concept_001–005.json` — all updated with explicit `itemSprites` and `targetSprites`; concept_003 `targetDivisionId` corrected to `language.receptive_language`
- `generation/taxonomy.ts` — `getSpriteInfo()`, `sameType()`, `formatTaxonomyForPrompt()`, `getAllSprites()`, `formatFilteredTaxonomyForPrompt(sprites[])` (concept-scoped filtered taxonomy)
- `library/assets/sprites/taxonomy.yaml` — category > type > attribute hierarchy, 30 sprites (added orange-basket.png)
- `generation/pipeline/validate.ts` — sprite-scope check: items and targets must use only sprites declared in concept brief; accepts `concept?: ConceptBrief` (optional for eval runner compat)
- `generation/pipeline/prompt.ts` — active version v9; `formatFilteredTaxonomyForPrompt` injects only concept-scoped sprites; `{{NOTES}}` injected from concept.notes; TARGET_COUNTS.low=3 (1:1 mapping)
- `generation/prompts/generate-drag-to-target.v9.txt` — active: slim inputs, difficulty as visual-similarity composite, Rule 3 (1:1 at low), Rule 6 (general target sprite), `{{NOTES}}` override block, GOOD/BAD examples
- `generation/prompts/review.v2.txt` — active: compound target labels valid; visual sorting developmentally appropriate
- `generation/taxonomy.test.ts` — 21 tests covering taxonomy loader, sameType, formatFilteredTaxonomyForPrompt
- `tests/integration/generation-pipeline.test.ts` — sprite-scope validation tests, v9 boundary test, assembly tests (35 tests total)
- `generation/pipeline/store.ts` — `.approved.json` filter fix (no more duplicate index entries)

**Library (4 approved activities)**
- `act_1778805627916_7da554.json` — concept_001, v4 prompt, "Put the fruits in the right basket!"
- `act_1778825695936_390bc0.json` — concept_001, v9 prompt, "Put each fruit in its basket!"
- `act_1778826178606_088db7.json` — concept_005, v9 prompt, "Match the shapes!"
- `act_dev_001.json` — dev fixture

**Test count: ~135 tests, all passing**

---

## In progress

Nothing — all pending fixes from last session are complete. Next work is M5 (tap-to-select) or concept_002 (medium difficulty, needs distractor support in prompt).

---

## Last decisions / changes made

| Decision | Date |
|----------|------|
| `onlyBuiltDependencies: ["esbuild"]` for pnpm v11 | 2026-05-08 |
| SNAP_DISTANCE=80pt starting value, calibrate against Nitara | 2026-05-08 |
| LLM review threshold set to 0.85 (placeholder — calibrate after first batch) | 2026-05-08 |
| Layout system added pre-M5: mechanic specs define layout variants; runtime reads from activity JSON | 2026-05-09 |
| filledSlots typed as Record<string, unknown> — pipeline code casts per use | 2026-05-08 |
| GitHub push parked — credentials not handy. Repo: https://github.com/ajayrajen7/bloom | 2026-05-08 |
| Telemetry uses injectable storage (no localStorage default) | 2026-05-08 |
| LLM boundary enforced: prompt receives slim fields only, not raw ConceptBrief/Division/MechanicSpec | 2026-05-15 |
| Sprite taxonomy system: category > type > attribute. Validator blocks same-type items sharing target at low/medium | 2026-05-15 |
| itemSprites + targetSprites added to ConceptBrief: structural enforcement of sprite scope per concept | 2026-05-15 |
| Difficulty is a composite function of item count + visual similarity (+ future axes). Docs updated. | 2026-05-15 |
| TARGET_COUNTS.low changed 2→3: 1:1 mapping at low difficulty (no sharing). Pipeline + prompt updated. | 2026-05-15 |
| {{NOTES}} injection added to prompt v9: per-concept overrides that take precedence over general rules | 2026-05-15 |
| concept_003 targetDivisionId corrected to language.receptive_language ("Tap the dog!" is receptive language, not visual discrimination) | 2026-05-15 |
| store.ts duplicate index bug fixed: .approved.json files excluded from index scan | 2026-05-15 |
| pnpm worktree esbuild fix: run `pnpm approve-builds --all` in the worktree if you see ERR_PNPM_IGNORED_BUILDS | 2026-05-15 |
| Prompt versioning discipline: never modify in place — always bump version. v5→v6→v7→v8→v9 this session. | 2026-05-15 |

---

## Doc changes made during execution

| Doc | Change | Date |
|-----|--------|------|
| BLOOM_V1_PRD.md | "Difficulty parameters" section replaced with composite function table showing all axes by difficulty level | 2026-05-15 |
| BLOOM_V1_ARCHITECTURE.md | Parameter computation table updated: low targetCount=3 (was 2); fixed high row; added itemSprites/targetSprites note to concept brief description | 2026-05-15 |
| BLOOM_V1_IMPLEMENTATION.md | ConceptBriefSchema in §2 updated with itemSprites and targetSprites fields | 2026-05-15 |
| CLAUDE.md | Added absolute path for memory.md; added commit discipline rule; added explicit "things to do without being asked" block | 2026-05-15 |

---

## Blockers

- **concept_002 (medium difficulty):** Requires 1 distractor in the generation prompt. Current prompt hardcodes `"distractors": []`. Need to add distractor support to v9 (→ v10) before concept_002 can be generated.
- M1 iPad test pending (not blocking M5)
- GitHub push pending (not on critical path)

---

## Next steps

1. **Start M5 — tap-to-select mechanic:**
   - `runtime/src/mechanics/tap-to-select-logic.ts` — pure logic (no Phaser), testable in Node
   - `runtime/src/mechanics/tap-to-select.ts` — Phaser tap mechanic
   - `generation/prompts/generate-tap-to-select.v1.txt` — generation prompt (use same taxonomy system + {{NOTES}} pattern)
   - Update `ActivityScene` to route based on `activity.mechanicId`
   - Generate 6-8 tap-to-select activities (concepts 003, 004 are ready)
   - 8 eval cases + integration test

2. **concept_002 (medium difficulty):** Add distractor support to generation prompt (v9 → v10). Medium difficulty needs distractors — items that look similar but have no correct target.

---

## Session log

| Date | What happened |
|------|---------------|
| 2026-05-08 | Project context loaded. Docs complete. memory.md created. |
| 2026-05-08 | M0 complete. 21 tests. |
| 2026-05-08 | M1 code complete. 29 tests. Dev server on port 3000. |
| 2026-05-08 | M2 complete. 57 tests. Framework + Mechanics + Concepts layers fully wired. |
| 2026-05-08 | M3 complete. 66 tests. Full generation pipeline — prompts, validate, LLM review, stage, store, eval system. |
| 2026-05-08 | M4 complete. 73 tests. Runtime JSON-driven: activity loaded from library, selection grid, session telemetry. |
| 2026-05-09 | Pre-M5 layout system. Mechanic specs rebuilt with layout variants. Layout engine in shared/. 121 tests. |
| 2026-05-09 | Generation pipeline working end-to-end. LLM review failing on prompt quality issues — Ajay reviewing prompts. |
| 2026-05-15 | Major pipeline session: LLMGenerationOutputSchema, slim boundary, taxonomy system (30 sprites), sprite-scope validation, itemSprites/targetSprites on ConceptBrief, prompts v5→v9, 1:1 mapping at low, {{NOTES}} injection, concept_001 + concept_005 approved. ~135 tests. |
| 2026-05-15 | Bug fixes: store.ts .approved.json duplicate index bug fixed; concept_003 division corrected to language.receptive_language; BLOOM_V1_IMPLEMENTATION.md ConceptBriefSchema updated. |
