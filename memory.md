# Bloom — Session Memory

Read this at the start of every session. Update it proactively when context approaches ~80%, and at the end of every session.

---

## Current milestone

- **Active:** M5 — tap-to-select mechanic + 6-8 activities
- **Status:** Not started (pipeline unblocked, ready to generate content)

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
- `generation/pipeline/prompt.ts` — refactored: slim inputs only, validates LLM output against LLMGenerationOutputSchema, assembles full ActivityJSON via exported `assembleLLMOutput()`
- `generation/pipeline/validate.ts` — schema + slot + item count + prompt length + asset ref + taxonomy type-level checks
- `generation/pipeline/llm-review.ts` — Claude API review call, score threshold 0.85, now on review.v2.txt
- `generation/pipeline/stage.ts` — writes staged JSON + HTML preview
- `generation/pipeline/store.ts` — approve (→ library/activities/) or reject (→ library/rejected/)
- `generation/generate-cli.ts` — `pnpm generate <concept-id>`, uses assembled output from prompt.ts
- `generation/review-ui/serve.ts` — `pnpm review` interactive approval CLI
- `library/assets/sprites/` — 29 placeholder stub PNGs
- `library/assets/audio/sfx/` — 3 SFX stubs
- `generation/evals/cases/eval_001–010.json` — 10 eval cases
- `generation/evals/runner.ts` — `pnpm eval` runner

**M4 — complete**
- `shared/types.ts` — added ActivityIndexSchema + ActivityIndexEntrySchema
- `library/activities/act_dev_001.json` — dev fixture
- `library/activities/index.json` — activity manifest (auto-regenerated on approve)
- `runtime/vite.config.ts` — publicDir set to `../library`
- `runtime/src/telemetry.ts` — buildSessionRecord, appendSession, getSessions (injectable storage)
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

**Generation pipeline fixes + taxonomy system — complete (2026-05-15)**
- `shared/types.ts` — added `LLMGenerationOutputSchema` + `LLMGenerationOutput` type
- `generation/prompts/generate-drag-to-target.v3–v5.txt` — v5 is active: slim inputs ({{THEME_HINT}}, {{ITEM_COUNT}}, {{TARGET_COUNT}}, {{DIVISION_NAME}}, {{SPRITE_TAXONOMY}}), slim output (filledSlots + prompt.text only), hierarchy-aware design rules
- `generation/prompts/review.v2.txt` — active: clarified compound target labels are allowed; visual sorting (colour/shape/size) is developmentally appropriate for 24–36 months
- `generation/taxonomy.ts` — `getSpriteInfo()`, `sameType()`, `formatTaxonomyForPrompt()`, `getAllSprites()`
- `library/assets/sprites/taxonomy.yaml` — canonical category > type > attribute hierarchy for all 29 sprites
- `generation/pipeline/validate.ts` — taxonomy check: at low/medium difficulty, items sharing a target must be different types (apple.png + red-apple.png now fails validation)
- `generation/taxonomy.test.ts` — 14 tests covering taxonomy loader and helpers
- `tests/integration/generation-pipeline.test.ts` — boundary test (v5 prompt), assembly tests, taxonomy validation test (15 tests total)

**Test count: ~135 tests, all passing**

**Staged activities**
- `library/staged/act_1778805627916_7da554.json` — concept_001, v4 prompt, score 88/100. Ready to approve via `pnpm review`.

---

## In progress

Nothing — pipeline is fully unblocked. v5 generation prompt + taxonomy system complete. Transient API overload prevented final e2e run of v5, but all tests pass and typecheck clean.

---

## Last decisions / changes made

| Decision | Date |
|----------|------|
| `onlyBuiltDependencies: ["esbuild"]` for pnpm v11 | 2026-05-08 |
| Extracted `drag-to-target-logic.ts` (no Phaser dep) for testable logic | 2026-05-08 |
| SNAP_DISTANCE=80pt starting value, calibrate against Nitara | 2026-05-08 |
| LLM review threshold set to 0.85 (placeholder — calibrate after first batch) | 2026-05-08 |
| Layout system added pre-M5: mechanic specs define layout variants; runtime reads from activity JSON | 2026-05-09 |
| filledSlots typed as Record<string, unknown> — pipeline code casts per use | 2026-05-08 |
| GitHub push parked — credentials not handy. Repo: https://github.com/ajayrajen7/bloom | 2026-05-08 |
| Telemetry uses injectable storage (no localStorage default) — keeps module testable in Node | 2026-05-08 |
| LLM boundary enforced: prompt receives slim fields only, not raw ConceptBrief/Division/MechanicSpec objects | 2026-05-15 |
| Assembly moved into pipeline (assembleLLMOutput in prompt.ts) — generate-cli.ts no longer does the spread | 2026-05-15 |
| Sprite taxonomy system added: category > type > attribute. Validator blocks same-type items sharing a target at low/medium difficulty | 2026-05-15 |
| v5 prompt maps difficulty to hierarchy level: low=category sort, medium=type sort, high=attribute sort | 2026-05-15 |
| review.v2: compound target labels (e.g. "Round Basket") are valid; visual sorting is developmentally appropriate for 24–36m | 2026-05-15 |
| pnpm worktree esbuild fix: run `pnpm approve-builds --all` in the worktree if you see ERR_PNPM_IGNORED_BUILDS | 2026-05-15 |

---

## Doc changes made during execution

| Doc | Change | Date |
|-----|--------|------|
| BLOOM_V1_IMPLEMENTATION.md | LLMGenerationOutputSchema already defined in §2 type contracts — confirmed implemented in shared/types.ts | 2026-05-15 |

---

## Blockers

- None blocking. API was transiently overloaded (529) at end of session — not a code issue.
- GitHub push pending (not on critical path)
- M1 iPad test pending (not blocking M5)

---

## Next steps

1. **Verify v5 e2e:** `pnpm generate concept_001` — should produce a category-level sort (animals vs food, or similar) that passes review ≥ 0.85.
2. **Approve staged activity:** `pnpm review` — approve `act_1778805627916_7da554` (88/100, v4 prompt, concept_001).
3. **Generate batch for concepts 002–005** — one per concept, review and approve. Target: 5 approved activities before starting M5.
4. **Start M5:**
   - `runtime/src/mechanics/tap-to-select-logic.ts` — pure logic (no Phaser), testable in Node
   - `runtime/src/mechanics/tap-to-select.ts` — Phaser tap mechanic
   - `generation/prompts/generate-tap-to-select.v1.txt` — generation prompt (use same taxonomy system)
   - Update `ActivityScene` to route based on `activity.mechanicId`
   - Generate 6-8 tap-to-select activities
   - 8 eval cases + integration test

---

## Session log

| Date | What happened |
|------|---------------|
| 2026-05-08 | Project context loaded. Docs complete. memory.md created. |
| 2026-05-08 | M0 complete. 21 tests. |
| 2026-05-08 | M1 code complete. 29 tests. Dev server on port 3000. |
| 2026-05-08 | M2 complete. 57 tests. Framework + Mechanics + Concepts layers fully wired. |
| 2026-05-08 | M3 complete. 66 tests. Full generation pipeline — prompts, validate, LLM review, stage, store, eval system. |
| 2026-05-08 | M4 complete. 73 tests. Runtime JSON-driven: activity loaded from library, selection grid, session telemetry persisted to localStorage. |
| 2026-05-09 | Pre-M5 layout system. Mechanic specs rebuilt with layout variants. Layout engine in shared/. Runtime now layout-driven. 121 tests. |
| 2026-05-09 | Generation pipeline working end-to-end (API key, env loading fixed). Generation + validation passing. LLM review failing on prompt quality issues — Ajay reviewing prompts. |
| 2026-05-15 | Pipeline unblocked. LLMGenerationOutputSchema added. Prompt refactored to slim boundary (v3→v5). Assembly moved to pipeline. Review prompt v2. Taxonomy system built (category>type>attribute, 29 sprites). Validator now enforces type-level distinctness. ~135 tests. Staged activity 88/100 ready to approve. |
