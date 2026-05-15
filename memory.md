# Bloom — Session Memory

Read this at the start of every session. Update it proactively when context approaches ~80%, and at the end of every session.

---

## Current milestone

- **Active:** M5 — tap-to-select mechanic + 6-8 activities
- **Status:** In progress — runtime mechanic complete, 2 tap-to-select activities approved, 4-6 more needed

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
- `generation/pipeline/llm-review.ts` — Claude API review call, score threshold 0.85, review.v3.txt
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

**Generation pipeline — structural sprite fix + prompt v10 (2026-05-15)**
- `shared/types.ts` — `LLMGenerationOutputSchema` (distractors typed as `{id, label, assetRef}`); `ConceptBriefSchema` includes `itemSprites` and `targetSprites`
- `concepts/briefs/concept_001–005.json` — all updated with explicit `itemSprites` and `targetSprites`; concept_003 corrected to `language.receptive_language`
- `generation/taxonomy.ts` — `getSpriteInfo()`, `sameType()`, `formatTaxonomyForPrompt()`, `getAllSprites()`, `formatFilteredTaxonomyForPrompt(sprites[])`
- `library/assets/sprites/taxonomy.yaml` — category > type > attribute hierarchy, 30 sprites
- `generation/pipeline/validate.ts` — sprite-scope check (items, targets, distractors); distractor count check per difficulty (low=0, medium=1, high=2); taxonomy type-level check
- `generation/pipeline/prompt.ts` — active version **v10**; DISTRACTOR_COUNTS map; `{{DISTRACTOR_COUNT}}` injection; distractorCount derived from LLM output length; visualSimilarity from concept.difficulty
- `generation/prompts/generate-drag-to-target.v10.txt` — active: all v9 rules + Rule 7 (distractors), GOOD medium example (farm animals + cat distractor)
- `generation/prompts/review.v2.txt` — superseded by v3
- `generation/pipeline/store.ts` — excludes `.approved.json` from index scan
- `generation/review-ui/serve.ts` — excludes `.approved.json` and `.rejected.json` from review queue (was causing .approved.approved.json chains)
- `.gitignore` — added `library/staged/` and `generation/review-ui/staged/`
- `generation/taxonomy.test.ts` — 21 tests
- `tests/integration/generation-pipeline.test.ts` — 39 tests (added distractor + medium concept fixtures, v10 boundary test)

**M5 — tap-to-select mechanic (in progress, 2026-05-15)**
- `runtime/src/mechanics/tap-to-select-logic.ts` — pure logic: TapItemConfig, isTapCorrect, isActivityComplete, getCorrectItems; 7 tests
- `runtime/src/mechanics/tap-to-select.ts` — Phaser mechanic: tap → correct=green pulse, incorrect=shake, complete→CompletionScene
- `runtime/src/scenes/activity.ts` — routes by mechanicId; both drag-to-target and tap-to-select fully wired
- `shared/types.ts` — LLMTapToSelectOutputSchema; mechanicId added to ConceptBriefSchema
- `concepts/briefs/concept_001–005.json` — all updated with mechanicId field
- `generation/pipeline/prompt-tap-to-select.ts` — CORRECT_COUNTS/DISTRACTOR_COUNTS/LAYOUT_IDS maps; runTapToSelectPrompt(); assembleTapToSelectOutput() embeds full layout variant
- `generation/pipeline/validate.ts` — branched on mechanicId; validateDragToTarget() + validateTapToSelect() helpers; collectAssetRefs handles both slot schemas
- `generation/generate-cli.ts` — routes by concept.mechanicId
- `generation/prompts/generate-tap-to-select.v1.txt` — active generation prompt
- `generation/prompts/review.v3.txt` — active: mechanic-aware safety checks, tap-to-select item count guidance
- `generation/pipeline/llm-review.ts` — bumped to v3

**Library (7 approved activities)**
- `act_1778805627916_7da554.json` — concept_001, v4 prompt, low, "Put the fruits in the right basket!"
- `act_1778825695936_390bc0.json` — concept_001, v9 prompt, low, "Put each fruit in its basket!"
- `act_1778826178606_088db7.json` — concept_005, v9 prompt, low, "Match the shapes!"
- `act_1778828810983_a85e98.json` — concept_002, v10 prompt, medium, "Help the animals find their homes!" (92/100)
- `act_1778833226026_c65726.json` — concept_003, tap-to-select v1 prompt, low, "Tap the dog!" (97/100)
- `act_1778833454232_b8ed1d.json` — concept_004, tap-to-select v1 prompt, low, "Tap the red one!" (96/100)
- `act_dev_001.json` — dev fixture

**Test count: 139 tests, all passing**

---

## In progress

M5 runtime + generation pipeline complete. M5 done-when status:

| Criterion | Status |
|-----------|--------|
| Tap-to-select activities playable on iPad | ❌ not tested |
| Library reaches 15–20 activities | ❌ at 7 (need 8–13 more) |
| All eval cases pass (drag + tap) | ❌ no tap-to-select evals yet |
| Integration tests for both mechanics pass | ❌ no tap-to-select integration tests yet |

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
| store.ts + serve.ts .approved.json bug fixed: both now exclude non-pending files from scan/queue | 2026-05-15 |
| pnpm worktree esbuild fix: run `pnpm approve-builds --all` in the worktree if you see ERR_PNPM_IGNORED_BUILDS | 2026-05-15 |
| Prompt versioning discipline: never modify in place — always bump version. v5→v9 one session, v9→v10 next. | 2026-05-15 |
| Distractor support added: v10 prompt, DISTRACTOR_COUNTS, distractorCount from LLM output, validation per difficulty | 2026-05-15 |
| library/staged/ and generation/review-ui/staged/ added to .gitignore (transient pipeline artifacts) | 2026-05-15 |
| mechanicId added to ConceptBriefSchema — required enum field, all 5 concept briefs updated | 2026-05-15 |
| LLMTapToSelectOutputSchema added to shared/types.ts (correctItems + distractors, no targetId mapping) | 2026-05-15 |
| tap-to-select pipeline: CORRECT_COUNTS {low:1, medium:2, high:3}, DISTRACTOR_COUNTS {low:3, medium:4, high:3}, LAYOUT_IDS {low:grid-2x2, medium:grid-2x3, high:grid-3x2} | 2026-05-15 |
| review.v3.txt: mechanic-aware review prompt replacing v2; handles both drag-to-target and tap-to-select | 2026-05-15 |
| concept_004 redesigned: difficulty low→low, medium difficulty dropped (sprite set too limited for 2 correct + 4 distractors without ambiguity); single-word colour labels ("Red", "Blue") | 2026-05-15 |
| .env.local symlinked into worktree to enable pnpm generate from worktree directory | 2026-05-15 |

---

## Doc changes made during execution

| Doc | Change | Date |
|-----|--------|------|
| BLOOM_V1_PRD.md | "Difficulty parameters" section replaced with composite function table showing all axes by difficulty level | 2026-05-15 |
| BLOOM_V1_ARCHITECTURE.md | Parameter computation table updated: low targetCount=3 (was 2); fixed high row; added itemSprites/targetSprites note to concept brief description | 2026-05-15 |
| BLOOM_V1_IMPLEMENTATION.md | ConceptBriefSchema in §2 updated with itemSprites and targetSprites fields | 2026-05-15 |
| CLAUDE.md | Added absolute path for memory.md; added commit discipline rule; added explicit "things to do without being asked" block | 2026-05-15 |
| BLOOM_V1_IMPLEMENTATION.md | ConceptBriefSchema in §2 needs update: mechanicId field added (required enum, drag-to-target or tap-to-select) — not yet done | 2026-05-15 |

---

## Blockers

- M1 iPad test pending (not blocking M5)
- GitHub push pending (not on critical path)

---

## Next steps

1. **Generate more activities** — run `pnpm generate concept_003` (more animal variants) and `pnpm generate concept_004` (more colour variants) until library hits 15–20. Run from worktree (`/Users/ajayrajendran/Documents/code/bloom/.claude/worktrees/epic-kare-26d462`) — .env.local is symlinked there.
2. **Tap-to-select integration tests** — add to `tests/integration/generation-pipeline.test.ts`: assembleTapToSelectOutput correctness, validateTapToSelect pass/fail cases.
3. **Tap-to-select eval cases** — add 8 cases to `generation/evals/cases/`, run `pnpm eval` green.
4. **stage.ts preview** — update `buildPreviewHTML` to show correctItems/distractors for tap-to-select (currently renders drag-to-target item→target table, confusing for manual review).
5. **iPad test** — play both mechanics on device before marking M5 complete.

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
| 2026-05-15 | Distractor support: v10 prompt, validate.ts distractor count + scope checks, concept_002 generated (92/100) and approved. serve.ts .approved.json re-queue bug fixed. 139 tests. 5 approved activities. |
| 2026-05-15 | M5 tap-to-select: runtime mechanic (logic + Phaser), ActivityScene routing, full generation pipeline (prompt-tap-to-select.ts, validate branching, review.v3), concept_003 (97/100) + concept_004 (96/100) approved. 7 activities total. |
