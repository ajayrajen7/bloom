# Bloom — Session Memory

Read this at the start of every session. Update it proactively when context approaches ~80%, and at the end of every session.

---

## Current milestone

- **Active:** V1.1 rescope, M6 — Foundations (docs + schema + rejection-logging fix + settings→briefs expander)
- **Status:** M6 complete pending final review/push. See `BLOOM_V1.1_MVP_SPEC.md` for the new scope and `BLOOM_V1_IMPLEMENTATION.md` §4a for the M6–M10 plan. M0–M5 (below) are historical — content archived, architecture/pipeline/test-strategy discipline carries forward unchanged.

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

**Library (12 approved activities)**
- `act_1778805627916_7da554.json` — concept_001, v4 prompt, low, "Put the fruits in the right basket!"
- `act_1778825695936_390bc0.json` — concept_001, v9 prompt, low, "Put each fruit in its basket!"
- `act_1778826178606_088db7.json` — concept_005, v9 prompt, low, "Match the shapes!"
- `act_1778828810983_a85e98.json` — concept_002, v10 prompt, medium, "Help the animals find their homes!" (92/100)
- `act_1778833226026_c65726.json` — concept_003, tap-to-select v1 prompt, low, "Tap the dog!" (97/100)
- `act_1778833454232_b8ed1d.json` — concept_004, tap-to-select v1 prompt, low, "Tap the red one!" (96/100)
- 6 additional auto-approved activities generated in batch (concepts 001–005, mix of mechanics)
- `act_dev_001.json` — dev fixture

**Deployment**
- `vercel.json` added at repo root: `buildCommand: pnpm build`, `outputDirectory: runtime/dist`
- Repo pushed to https://github.com/ajayrajen7/bloom (uses `gh auth token` for push — SSH key not in shell)
- Vercel connection: needs manual setup at vercel.com/new → import ajayrajen7/bloom

**Sprites**
- All 30 placeholder stub PNGs replaced with Fluent Emoji 3D 256×256 PNGs (microsoft/fluentui-emoji)
- Baskets (apple-basket, banana-basket, orange-basket, fruit-basket, wicker-basket) all use the same basket.png
- barn.png + coop.png use house-with-garden; pond.png uses water-wave; triangle.png uses star (no triangle in set)

**Test count: 139 tests, all passing (as of end of M5 / pre-V1.1)**

**V1.1, M6 — Foundations (2026-08-20)**
- State-of-repo audit done first (`STATE_OF_REPO_2026-08-18.md`, PR #1) — surfaced the auto-approve gate bypass and broken rejection logging before any V1.1 work started
- GitHub App plumbing fixed: was authorized (OAuth) but never installed (no repo access grant) — reconnecting via claude.ai only re-did the OAuth half. Fix was installing directly via `github.com/apps/claude` → Install & Authorize, selecting the `bloom` repo
- `BLOOM_V1.1_MVP_SPEC.md` + `BLOOM_ARCHITECTURE_CANONICAL.mermaid` — landed in-repo as first-class canonical docs (previously only existed as uploaded files)
- `generation/pipeline/store.ts` — `rejectActivityDirect()` added; `generation/generate-cli.ts` now calls it on both Gate 1 (validate) and Gate 2 (LLM review) failures. Restores the CLAUDE.md rejection-logging invariant; auto-approve itself stays (per V1.1 sign-off: sampled human = per-batch iPad review, not per-activity staging)
- `shared/types.ts` — `ConceptBriefSchema`: `mechanicId` gains `"find-all"`; `targetDivisionId` → optional; new optional `setting` field. `ActivityJSONSchema.metadata`: same `targetDivisionId`→optional and new optional `setting`. All additive — old V1 fixtures/briefs still validate unchanged
- `mechanics/specs/find-all.yaml` — new mechanic spec (slotSchema `targets[]`+`distractors[]`, parameterSchema `targetCount`/`distractorCount`/`visualSimilarity`, 4 layout variants); wired into `mechanics/loader.ts`'s `MECHANIC_FILES` map
- `concepts/settings.yaml` + `concepts/expand-settings.ts` — 6 settings × ~12 objects each (seeded from the spec's examples, padded); deterministic expander produces 30 ConceptBrief-shaped stubs (3 tap-one + 2 find-all per setting). Writes to `concepts/briefs-v1.1/` (committed as a preview), deliberately **not** `concepts/briefs/` — see "deferred" note below
- 13 V1 activities archived: `library/activities/*.json` → `library/archive/v1-activities/`; `index.json` reset to `{"activities": []}`
- Docs: `CLAUDE.md`, `BLOOM_V1_ARCHITECTURE.md`, `BLOOM_V1_IMPLEMENTATION.md` (§4a added), `BLOOM_V1_PRD.md` — all updated with V1.1 addenda/banners, old content kept for history, not deleted
- Test count: **157 tests, all passing** — 139 prior + 8 new (`concepts/expand-settings.test.ts`) + 4 new (`find-all` cases in `mechanics/loader.test.ts`) + 6 new (V1.1 schema-delta cases in `shared/types.test.ts`)

**Deliberately deferred to M7/M8 (not oversights — reasoning in `BLOOM_V1_IMPLEMENTATION.md` §4a):**
- `concepts/briefs/` cutover (old V1 briefs archived, `briefs-v1.1/` promoted in) — blocked on M7's manifest existing to fill real `itemSprites`
- `library/assets/sprites/` + `taxonomy.yaml` archival — load-bearing for the still-green V1 test suite until the new manifest replaces them
- `instructionTemplate`/`settingIntro`/prompt text — prompt changes go through the CLAUDE.md review process with Ajay, not written autonomously here

---

## In progress

V1.1 M6 done-when checklist:

| Criterion | Status |
|-----------|--------|
| `pnpm test && pnpm typecheck` green | ✅ 157/157, clean typecheck |
| `library/activities/` empty, old content archived not deleted | ✅ |
| `expand-settings` produces the 3+2×6=30 split | ✅ (tested + run, output committed) |
| Docs no longer contradict codebase or V1.1 spec | ✅ this pass — re-verify at M7 kickoff |
| Committed + pushed to PR #1 | ⏳ next action |

**Known pre-existing issues, noted but not fixed this session (out of M6 scope):**
- `concepts/new-concept.ts` — `ConceptBriefSchema.parse()` call omits `mechanicId`, `itemSprites`, `targetSprites` (all required at the time this CLI was last touched). Would throw at runtime. Not covered by tests. Mostly superseded by `expand-settings.ts` for V1.1 batch authoring, but still broken if anyone runs it.
- `generation/pipeline/llm-review.ts` injects raw `concept` and `division` objects (JSON.stringify'd) directly into the review prompt template — violates CLAUDE.md invariant #2 ("no raw domain objects in LLM prompts"), pre-existing, not introduced this session. Worth fixing when review.v4 is authored in M8.
- Old V1 visual/UX issues from the 2026-05-15 session (circle-only target zones, shared basket/barn sprites, shape emoji mismatches) are moot — that content is archived and V1.1 uses a different asset pipeline entirely.

---

## Last decisions / changes made

| Decision | Date |
|----------|------|
| `onlyBuiltDependencies: ["esbuild"]` for pnpm v11 | 2026-05-08 |
| SNAP_DISTANCE=80pt starting value, calibrate against Nitara | 2026-05-08 |
| LLM review threshold set to 0.85 (placeholder — calibrate after first batch) | 2026-05-08 |
| Layout system added pre-M5: mechanic specs define layout variants; runtime reads from activity JSON | 2026-05-09 |
| filledSlots typed as Record<string, unknown> — pipeline code casts per use | 2026-05-08 |
| GitHub repo: https://github.com/ajayrajen7/bloom — use `gh auth token --user ajayrajen7` for push (SSH not in shell) | 2026-05-08 |
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
| Skip manual review for all generated activities going forward — auto-approve pipeline only | 2026-05-15 |
| All 30 sprite stubs replaced with Fluent Emoji 3D PNGs; download script uses gh curl + python URL encoding | 2026-05-15 |
| vercel.json added: buildCommand=pnpm build, outputDirectory=runtime/dist | 2026-05-15 |
| Selection screen: camera-based drag scroll, 8px dead zone, scrollbar indicator, scroll suppresses card tap | 2026-05-15 |
| V1.1 rescope adopted: ~30 tap-based activities, 6 settings, AI-generated sprite manifest, TTS at pack-build time. Full reconciliation + sign-off in chat, 2026-08-20. | 2026-08-20 |
| Old content archived, not deleted: 13 activities + concept briefs stay on disk under `library/archive/` (activities) and `concepts/briefs/` (briefs, archival deferred to M7/M8) | 2026-08-20 |
| Mechanic naming: `tap-to-select` = V1.1's "tap-one" (param rework only, no rename). `find-all` is a new, separate `mechanicId`. Decided with Ajay to avoid renaming churn across working code/content. | 2026-08-20 |
| Gate policy formalized: Gates 1–2 stay auto-approve (was already true, undocumented); "sampled human" = per-batch iPad review, not per-activity staging restored | 2026-08-20 |
| Division targeting dropped: `targetDivisionId` optional on ConceptBrief + ActivityJSON — settings are the new organizing principle, not divisions | 2026-08-20 |
| M7 asset spike: GPT Image only (no Recraft comparison arm) per Ajay's call — known risk that low keep-rate won't distinguish technique failure from model weakness, logged for M7 kickoff | 2026-08-20 |
| Asset generation scripts run locally on Ajay's Mac (not this remote environment) — keys stay local, curation needs his eyes anyway | 2026-08-20 |

---

## Doc changes made during execution

| Doc | Change | Date |
|-----|--------|------|
| BLOOM_V1_PRD.md | "Difficulty parameters" section replaced with composite function table showing all axes by difficulty level | 2026-05-15 |
| BLOOM_V1_ARCHITECTURE.md | Parameter computation table updated: low targetCount=3 (was 2); fixed high row; added itemSprites/targetSprites note to concept brief description | 2026-05-15 |
| BLOOM_V1_IMPLEMENTATION.md | ConceptBriefSchema in §2 updated with itemSprites and targetSprites fields | 2026-05-15 |
| CLAUDE.md | Added absolute path for memory.md; added commit discipline rule; added explicit "things to do without being asked" block | 2026-05-15 |
| BLOOM_V1_IMPLEMENTATION.md | ConceptBriefSchema in §2 needs update: mechanicId field added (required enum, drag-to-target or tap-to-select) — not yet done | 2026-05-15 |
| BLOOM_V1.1_MVP_SPEC.md | New file — landed in-repo verbatim from Ajay's uploaded spec (previously only existed outside the repo) | 2026-08-20 |
| BLOOM_ARCHITECTURE_CANONICAL.mermaid | New file — landed in-repo verbatim, canonical 3-plane architecture diagram | 2026-08-20 |
| CLAUDE.md | V1.1 addendum: new required-reading docs, updated Project context decisions (mechanics/divisions/TTS/visual assets/gate policy), updated "never without asking" list, Current milestone → M6 | 2026-08-20 |
| BLOOM_V1_ARCHITECTURE.md | V1.1 addendum at top (5-layer ↔ 3-plane mapping, gate policy delta, Gate 2 multimodal delta); "Visual assets" decision marked superseded; TTS decision updated with pack-build-time delta | 2026-08-20 |
| BLOOM_V1_IMPLEMENTATION.md | V1.1 addendum at top; §2 ConceptBriefSchema/ActivityJSONSchema updated with actual current schema (setting, optional targetDivisionId, find-all); layout-variants-per-mechanic table updated; new §4a with M6–M10 milestone plan | 2026-08-20 |
| BLOOM_V1_PRD.md | Superseded-scope banner added at top, pointing to BLOOM_V1.1_MVP_SPEC.md; original sections kept for history | 2026-08-20 |

---

## Blockers

- Vercel not yet connected — needs one-time manual setup at vercel.com/new → import ajayrajen7/bloom (carried over from V1, still applies to V1.1's iPad PWA delivery)
- M7 asset spike needs Ajay's local machine (keys + curation) — not something this remote session can execute
- M1 iPad test / old V1 visual issues: moot, superseded by V1.1 rescope

---

## Next steps

1. **Get M6 committed + pushed** — this session's work, to PR #1 on `claude/state-of-repo-report-btqas0`.
2. **M7 asset spike** (Ajay, locally): style block authored with Claude first (prompt review process), then kitchen sheets via GPT Image, slice/normalize/palette-snap scripts, curate, measure keep-rate against the ≥50% bar.
3. **M8 kickoff** only after M7's keep-rate decision is logged — don't start pipeline/mechanic wiring against a manifest that might not exist yet.
4. Old next-steps (Vercel connection, tap-to-select integration tests/evals) are superseded by the V1.1 plan — tap-to-select gets new integration tests/evals as part of M8, not bolted onto the old V1 content.

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
| 2026-05-15 | Deployment prep: batch-generated 5 more activities (12 total), replaced 30 stub sprites with Fluent Emoji 3D PNGs, added vercel.json, pushed to GitHub. Fixed selection screen: camera scroll + scrollbar + tap/scroll conflict guard. |
| 2026-05-15 | Wired sprite rendering in both mechanics: ActivityScene preloads all 30 sprites, items/targets now use images. tap-to-select correct tap = green tint. Multiple visual issues remain — Ajay to review and specify. |
| 2026-08-18 | State-of-repo audit (fresh session, remote environment). Verified 139 tests / clean typecheck, then found and reported: generate-cli.ts bypasses manual review + staging entirely (auto-approve direct to library), rejection logging broken on Gates 1–2, M5 done-when 3/4 unmet, TTS never implemented, empty tests/regression/, CI missing lint. Report pushed as `STATE_OF_REPO_2026-08-18.md`, PR #1. GitHub App plumbing fixed along the way (authorized-but-not-installed). |
| 2026-08-20 | V1.1 rescope: reconciled BLOOM_V1.1_MVP_SPEC.md + BLOOM_ARCHITECTURE_CANONICAL.mermaid against the audited repo, got sign-off on M6–M10 plan and 4 decision points (archive-and-regenerate, tap-to-select=tap-one naming, auto-approve+sampled-human gates, GPT-Image-only spike run locally). Executed M6: rejection logging fixed, schema deltas landed (find-all mechanicId, optional targetDivisionId, new setting field), find-all mechanic spec, settings.yaml + expand-settings.ts (30-brief expander, tested), 13 V1 activities archived, all 4 core docs updated with V1.1 addenda. 157 tests passing, clean typecheck. |
