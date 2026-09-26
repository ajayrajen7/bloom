# Bloom — System Architecture (Canonical)

**Version:** 1.1 · Supersedes the layer maps in the original `BLOOM_V1_ARCHITECTURE.md` and the v0.2 conversation doc. Pipeline internals, contracts, and implementation discipline in existing docs remain authoritative where they do not conflict with this architecture or [`bloom-v1.1-mvp-spec.md`](bloom-v1.1-mvp-spec.md).

**How to read this:** every layer has an **end-state role** and a **V1.1 scope** (the restart experiment defined in [`bloom-v1.1-mvp-spec.md`](bloom-v1.1-mvp-spec.md)). V1.1 proves two things in sequence: an AI asset workflow can produce a visually coherent library, and activities built from that library with two mechanics can engage the child. The asset work starts as a bounded pilot; its scale depends on the result. Personalization is deferred.

---

## 1. Principles (unchanged, hard-won)

1. **Deterministic mechanics, generative content.** Interaction code is hand-built and tested; AI fills semantic content. Never AI-generated gameplay code.
2. **Pre-generated everything.** Assets, activities, and audio are produced at build time. The child's device fetches; it never generates. No runtime AI calls, ever.
3. **The Library stores reusable activity specs and assets.** V1.1 specs are directly playable and contain no unresolved child-specific slots. A future Pack Builder may resolve personalization tokens when that becomes an explicit experiment.
4. **QA at every layer boundary.** Automated eval + selective human review after each layer. Contour shifts downstream: human-heavy upstream (catches *classes* of errors), automated downstream (catches *instances*). An instance failure downstream is escalated upstream as a spec defect.
5. **Minimize the LLM's decision surface.** The pipeline computes everything computable (layout, sizing, difficulty parameters); the LLM decides only semantics (which objects, what prompt line, what theme).
6. **Child Context is a bounded privacy core in the end state.** V1.1 has no child profile, name injection, or personalized audio. A placeholder boundary can reduce exposure, but does not by itself establish privacy-law compliance; any future external TTS or profile flow needs its own data-handling review.
7. **Combinatorial leverage: M × T × P.** Mechanics grow slowly (curated code). Themes grow fast (generated). Personalization is free at pack build. Library scale is the product of the three.

---

## 2. Layer map

### Plane A — Content Factory (build-time, shared across all children)

| # | Layer | End-state role | V1.1 scope |
|---|-------|---------------|------------|
| A1 | **Development Framework** | Age-banded developmental targets (category → subcategory → division). Human-governed; psychologist-reviewed annually **plus** revisions triggered by generation failures surfacing granularity gaps. | Static markdown for age 2–3 (exists). Referenced in prompts. No system. |
| A2 | **Concept Layer** | Maps framework targets → content scope: content types, difficulty ladders per age band (with cross-band overlap), guided/self modes. **Constrains A3** — a developmental target admits only certain mechanics. | Embedded in generation prompt templates + the difficulty table in the V1.1 spec. Not a separate system. |
| A3 | **Mechanics Registry** | Curated library of interaction templates with tunable difficulty parameters and device profiles. Slow-growing, engineering-owned. Deterministic. | Two entries: `tap-one`, `find-all` (Phaser). Drag parked in repo, out of scope. |
| A4 | **Story / Theme Engine** | Generates themes, narrative arcs, recurring-world elements — an axis that can later grow independently of mechanics. Uses placeholders, never real child data. | No story arcs. Use a small, consistent set of backdrops only if the pilot activities need them; keep backdrops separate from transparent object sprites. |
| A5 | **Asset Registry** *(the first restart experiment)* | Curated, tagged sprite/backdrop/audio-SFX library. Production method: **sheet generation**, **style-reference conditioning**, **programmatic normalization** (slice, transparency, canvas and palette normalization), and human curation with measured keep-rate. | Bounded pilot first, not a 90–100 asset commitment. Recraft v4 primary and GPT Image 2 comparison as scoped in the restart spec; start with common fruits, vegetables, utensils, and familiar animals. Each object has a canonical asset and intentional variants. Expand only after the pilot demonstrates coherence and usability. |
| A6 | **Generation Layer** | Fuses A2 target + A3 mechanic + A4 theme + A5 manifest into a playable activity spec with computed layout/difficulty and LLM-filled semantics. | Use the existing pipeline; extend it for `tap-one` and `find-all`. No child-name tokens or personalized audio. |
| A7 | **QA Gates** (cross-cutting, one per boundary) | Per-boundary automated evals and human review where visual or semantic judgment is needed. Rejections feed the eval suite. | Asset contact-sheet curation and normalization checks; programmatic activity validation; multimodal review of rendered activities; human review of both initial activities before child testing. |
| A8 | **Content Library** | Versioned store of approved reusable assets and activity specs, indexed by target × mechanic × difficulty × theme × age band. Coverage/staleness audits. | File-based store. No fixed asset or activity count; the pilot is sized to exercise both mechanics and the asset families they need. |

### Plane B — Distribution (per child, at build time — not runtime)

| # | Layer | End-state role | V1.1 scope |
|---|-------|---------------|------------|
| B1 | **Pack Builder (Instantiation)** | Future personalization injection point. Takes selected specs + child context, resolves slots, and can produce a self-contained per-child pack. | Deferred. No child context, name resolution, per-child TTS, or pack-instantiation experiment in this restart. The runtime loads approved V1.1 activities and their shared assets directly. |

### Plane C — Runtime (child-facing, zero AI)

| # | Layer | End-state role | V1.1 scope |
|---|-------|---------------|------------|
| C1 | **Child Context Store** | Privacy core for future personalization: name, family, interests, language mix, preferences. Strictest boundary in the system; other layers see tokens. | Absent. V1.1 does not store child profile data or personalize audio. |
| C2 | **Selection Engine** | Given profile (C4) + context (C1) + framework (A1) + parent policy (C5): picks next activities. Balances developmental need, novelty, engagement history, session limits. | Absent. Parent picks from a grid. (An age lookup would add nothing at n=1.) |
| C3 | **Child Runtime** | Phaser PWA, tablet-first, offline pack, calm by design: muted palette, no reward loops, no autoplay chaining, gentle failure feedback, instruction-replay button. Emits telemetry. | Full build (exists; add find-all, backdrops, audio playback). |
| C4 | **Assessment & Profile** | **The moat.** Session telemetry (completion, struggle, retries, abandonment, re-requests) → inferred per-child developmental profile → drives C2 and feeds C5. Compounds monthly; cannot be shortcut by a competitor. | A dated two-line parent note per session + existing local session record. The spreadsheet *is* the profile layer at n=1. |
| C5 | **Parent Surface** | The buy-side: progress narrative (from C4), session controls, context management (writes C1), content preferences. Consumes what C4 produces. | Absent. Ajay + Arathy are the parent surface. |

---

## 3. Data flows

**Factory (shared, continuous):**
A1 → A2 ⇒(constrains) A3; A4 ∥ A5 alongside → A6 fuses all → Gate → A8 Library.

**V1.1 delivery:**
A8 approved activities + shared assets → C3 runtime. No child-specific pack-build step.

**V1.1 learning loop:**
C3 plays activities → local session record + brief parent observation → week-4 decision gate. The end-state may later turn these signals into C4, C2, and C5.

**Escalation path:** asset or rendered-activity defect → affected asset/spec flagged in A8 → human review at the relevant A5/A6 gate → eval suite grows where the defect is repeatable.

---

## 4. What V1.1 deliberately proves per layer

| Required claim | Layer(s) | Evidence produced |
|---|---|---|
| AI asset generation can produce a coherent, usable library | A5, A8 | Curated contact sheets across object families; keep-rate by model/sheet; recognizable objects and intentional variants; generation cost and human minutes |
| Activities built from those assets and two mechanics engage the child | A3, A6–A8, C3, C4 | One or more manually reviewed activities per mechanic; observed comprehension without adult explanation, engagement, friction, and requests to replay |

Generation cost, keep-rate, and human time help assess factory efficiency; they do not substitute for either required claim. Personalization is not a V1.1 success criterion.

Layers A1, A2, C2, C5: provisioned, intentionally not built. Their stand-ins (doc, prompts, parent, nobody) cost nothing to replace later because the interfaces they'd occupy already exist in the flow.

---

## 5. Known future decision points (parked, not forgotten)

1. Whether personalization should use a Pack Builder and whether packs are generated daily or on demand at multi-child scale.
2. Where difficulty adaptation lives: Selection (pick harder spec) vs Pack Build (tune same spec's parameters) — likely both, boundary TBD.
3. Recurring-character visual consistency (Story layer's hard problem) — out until text-only personalization proves/disproves the retention effect.
4. Restaurant-mode vs development-mode: same Selection engine, different session policies — or distinct modes.
5. Voice: parent-recorded narration as a personalization feature vs TTS at scale.
6. C4 formalization: which telemetry events, what inference model, when a spreadsheet stops being enough (signal: friends'-kids round).
