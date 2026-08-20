# Bloom V1.1 — MVP Spec

**Goal-seek:** ~30 tap-based activities across 6 settings with varying difficulty and audio instructions, produced through the AI pipeline with AI-generated visual assets, playable by Nitara on iPad.

**Proves:** (1) the studio pipeline — including AI asset production, the piece that failed before — can produce quality content at known cost and effort; (2) Nitara engages and asks for repeats over 4 weeks.

**Relationship to existing docs:** Architecture, pipeline design, and implementation discipline from `ARCHITECTURE.md` / `IMPLEMENTATION.md` stand. This spec supersedes the *scope* sections of `PRD.md` and replaces the visual-assets decision. Deltas listed at the end.

---

## 1. Scope

**In:** tap mechanic (two variants), 6 settings, ~30 activities, AI-generated sprite assets, TTS audio instructions with name injection, existing generation pipeline (3 gates + evals), Phaser runtime, iPad PWA via Vercel.

**Out:** drag-to-target (parked, not deleted — code stays), stories/narration, selection logic (parent picks from grid), telemetry beyond the existing local session record, parent surface, multi-child, any runtime AI calls.

---

## 2. Settings and content plan

6 settings × 5 activities = 30. Settings are proposals — swap freely, the pipeline doesn't care:

| Setting | Example objects (~12 each) |
|---|---|
| Kitchen | fruits, vegetables, cup, spoon, plate, bottle |
| Playground | ball, swing, slide, bucket, spade, kite |
| Garden | flowers, butterfly, bee, leaf, pot, watering can |
| Market | fruits, veggies, basket, bag, weighing scale |
| Farm | cow, dog, cat, hen, goat, duck |
| Bathtime | duck, soap, towel, bubbles, mug, brush |

Per setting: **3 × tap-one** (low/medium/high) + **2 × find-all** (low/medium).

A setting is conveyed three ways: a muted flat backdrop, the object families, and the audio intro word ("In the kitchen… Nitara, tap the red apple!"). No narrative arcs — the "story" is one warm line.

---

## 3. Mechanic spec: tap (two variants)

### 3a. tap-one
Child taps the single correct item.
- Correct → glow + scale + success SFX, item marks done, next prompt or completion.
- Wrong → gentle shake + soft SFX, no state change. Never harsh.

### 3b. find-all
Child taps ALL items matching an attribute ("tap all the red things").
- Each correct tap → success feedback, item marks found, progress dot fills.
- Wrong tap → gentle shake.
- Completion when all targets found. No time limit, no failure state.

### Difficulty parameters (computed by pipeline, not LLM — per existing principle)

| Variant | Level | Items on screen | Targets | Distractor similarity | Min element size |
|---|---|---|---|---|---|
| tap-one | low | 3 | 1 | different category (apple vs ball) | 120pt |
| tap-one | medium | 5 | 1 | same category (apple vs banana) | 100pt |
| tap-one | high | 7 | 1 | same object, different attribute (red vs green apple) | 90pt |
| find-all | low | 5 | 2 | attribute = color, obvious | 110pt |
| find-all | medium | 7 | 3 | attribute = color or size, closer | 95pt |

Layout variants reused from existing layout engine: `grid-2x3`, `grid-3x3`, `horizontal-line`, `random` (min-spacing enforced). 48pt minimum spacing rule stands.

**Consequence for assets:** "high" difficulty requires attribute variants of the same object (red/green apple, big/small ball). The asset manifest must support this — see §4.

---

## 4. Asset pipeline (the new part — this is what failed before, solved differently)

### Principle
Never generate objects one call at a time (guarantees drift). Generate **sheets** (many objects in one image = consistent by construction), slice programmatically, normalize in code, curate ruthlessly, store in a tagged manifest. Cross-sheet consistency via **style reference**: sheet 1, once approved, is passed as the style anchor for every later sheet.

### Style block (write once, version like a prompt)
Flat vector illustration, thick soft rounded outlines, muted warm palette (define 8–10 hex values as the brand palette), no gradients, no fine detail, no faces on objects, isolated objects, plain white background, evenly spaced grid.

### Workflow per setting
1. **Generate sheet:** "4×3 grid of [kitchen objects: apple, banana, cup…], [style block]" — primary model **Recraft v4** (design-asset native, SVG output, batch style controls); comparison arm **GPT Image 2** on the first two sheets only. Keep whichever wins on keep-rate, drop the other.
2. **Attribute variants:** where difficulty needs them, request within the same sheet ("red apple, green apple, big ball, small ball") — same-sheet = matched by construction.
3. **Slice:** script cuts the grid into individual sprites (grid detection or fixed-cell crop).
4. **Normalize (scripts, no AI):** background removal → trim/center → resize to standard canvas (e.g. 512×512) → **palette snap**: quantize colors and remap to the brand palette. Palette snap is the deterministic consistency lever — even when the model drifts, output is forced onto brand colors.
5. **Curate:** human pass in a simple review grid (reuse review-ui pattern). Keep/reject per sprite. Target keep-rate ≥50%; below 30% after two prompt iterations = technique flagged, fall back to regenerating that sheet with the other model.
6. **Manifest entry** per kept sprite:

```json
{
  "id": "kitchen_apple_red_01",
  "setting": "kitchen",
  "object": "apple",
  "category": "fruit",
  "color": "red",
  "sizeClass": "standard",
  "file": "assets/sprites/kitchen_apple_red_01.png",
  "sheetId": "kitchen_sheet_01",
  "model": "recraft-v4",
  "approvedAt": "..."
}
```

7. **Backdrops:** one muted flat backdrop per setting (single generation each, very low detail, low contrast). QA rule: automated contrast check between sprite palette and backdrop; fail = lighten backdrop.

### Asset budget
~12 objects × 6 settings + attribute variants ≈ 90–100 sprites kept. At 50% keep-rate ≈ 2 sheets per setting ≈ 12–15 sheet generations total. Cost is trivial; **human curation minutes are the real cost — log them.**

### Change to generation prompt contract
The LLM no longer invents `assetRef`s freely; it selects sprite IDs **from the manifest filtered by setting** (the existing `itemSprites`/`targetSprites` scoping in ConceptBrief already supports this — the manifest becomes the source). Gate 1 already validates refs resolve on disk; unchanged.

---

## 5. Audio spec

- **One instruction line per activity**, English, warm and short: `"In the {setting}… {childName}, tap the red apple!"` / find-all: `"{childName}, find all the red things!"`
- **Generated at pack-build time per child** (name baked into audio), not at activity-generation time. Activity JSON stores the line as a template; `build-pack --child nitara` resolves it and calls TTS. This is the personalization injection point — same slot later takes any child's name.
- **Provider:** OpenAI TTS (per existing decision). **Gate before committing: generate "Nitara" in 3 voices, pick by ear.** If all mangle it, switch to ElevenLabs. Budget either way: negligible.
- **SFX:** existing free-library set (success / try-again / completion). Unchanged.
- Replay button on screen: tapping the prompt icon replays the instruction (2-year-olds miss it the first time).

---

## 6. Pipeline changes vs existing docs

1. Remove drag-to-target from active scope; add `find-all` variant to the tap mechanic spec (slotSchema gains `targets[]` as a list; parameterSchema gains `targetCount`).
2. Asset source: manifest of AI-generated sprites replaces Flaticon. New directory `assets/manifest.json` + `scripts/assets/` (generate-sheet, slice, normalize, palette-snap, curate-ui).
3. **Gate 2 upgrade — multimodal review:** the LLM review call now receives the rendered preview screenshot alongside the JSON. Checks added: visual crowding, target/distractor visual distinctness matches intended difficulty, sprite-backdrop contrast. (This gate class wasn't possible when the docs were written.)
4. Prompt templates: add `settingIntro` and `instructionTemplate` (with `{childName}` slot) to LLM output schema; everything else the LLM decides stays the same (items, targets, mapping).
5. `build-pack` CLI added: takes approved activities + child config (name) → resolves audio via TTS → emits deployable pack. No runtime generation, per your rule.

---

## 7. Success criteria

### Objective 1 — pipeline feasibility (measured, not felt)
- Asset keep-rate per model per sheet (target ≥50%).
- Cost per approved activity, all-in: generation tokens + review call + amortized assets + TTS.
- **Human minutes per approved activity** (target <15, per existing PRD — now including asset curation amortized).
- Repeatability: batch 2 (a new setting) runs end-to-end with zero code changes.

### Objective 2 — Nitara (4-week protocol)
- Weeks 1–2 = novelty, ignore. Signal window is **weeks 3–4**: unprompted requests.
- Completes activities without adult explanation (audio instruction carries it).
- Pattern holds in ≥2 sessions run by Arathy without you present.
- Two-line dated note after each session (asked for it? which activities? finished or bailed?). No telemetry build.

---

## 8. Build sequence

1. **Repo audit** (½ day): Claude Code reports repo state vs docs; update docs from reality.
2. **Asset spike** (weekend, gates everything visual): style block → kitchen sheets on Recraft + GPT Image 2 → slice/normalize/palette-snap scripts → curate → measure keep-rate. Decision point: technique works → proceed; doesn't → stop and reassess (do NOT silently fall back to icon libraries — that path already failed you).
3. **Mechanic + pipeline update** (weekend): find-all in runtime + spec; prompt template updates; manifest wiring; multimodal Gate 2; TTS name test.
4. **Batch 1** (evenings): kitchen, 5 activities end-to-end through all gates → onto the iPad → 2–3 informal Nitara sessions. Fix what she breaks (she will).
5. **Batches 2–6** (1–2 weeks of evenings): remaining settings, 5 per batch. Assets for each setting generated the weekend before its batch.
6. **Observe** (4 weeks): weekly pack refresh mixing new + old activities (re-requests of *old* ones = the attachment signal). Decision gate at end of week 4 against §7.

## 9. Open items
- Final 6 settings sign-off (table in §2 is a proposal).
- Brand palette hex values (pick during style-block authoring; 8–10 colors).
- Whether "high" tap-one needs a 7th item or 6 is enough on a 10" screen at 90pt — tune against real device in Batch 1.
- Recraft raster vs SVG output mode — decide in the spike based on slicing ease.
