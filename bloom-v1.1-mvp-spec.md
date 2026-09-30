# Bloom V1.1 — Restart MVP Spec

**Status:** Current product scope for the restart
**Product vision:** [`BLOOM_VISION.md`](BLOOM_VISION.md)
**Canonical architecture:** [`BLOOM_V1_ARCHITECTURE_CANONICAL.md`](BLOOM_V1_ARCHITECTURE_CANONICAL.md) and its [Mermaid diagram](BLOOM_V1_ARCHITECTURE_CANONICAL.mermaid)

## 1. Why this restart

The first build showed a useful signal: the child remained interested and asked to play again, even though the activities looked inconsistent. The downloaded assets came from different sources and varied in style, background, and apparent size. The asset-production approach—not a lack of initial child interest—is the first problem to investigate.

This restart proceeds in order. First, build a coherent AI-generated asset library. Then use that library in two mechanics and manually observe the resulting activities with the child.

## 2. What V1.1 must prove

Both claims are required to continue:

1. **Asset factory:** An AI-assisted workflow can produce a coherent, attractive, reusable set of familiar objects and intentional variants.
2. **Child experience:** Activities using those assets and two mechanics are understandable and enjoyable to the child in actual play.

The prior requests to replay are encouraging context, not proof that the new visual system or activities work. V1.1 is a small product experiment; it does not prove learning outcomes, long-term retention, or a scalable business.

Factory keep-rate, generation cost, and human minutes are supporting measures. They help determine whether the asset process is practical, but cannot substitute for either required claim.

## 3. Primary user and setting

- **Child:** a 2–3-year-old using a tablet, with a parent nearby.
- **Parent:** observes the activity, notes where the child needs help or loses interest, and decides whether to try another activity.
- **Use:** short, manually selected activities. There is no automated recommendation or child profile in this experiment.

## 4. Scope and sequence

### Phase 1 — Build and assess the asset library

Create assets with an image-generation model. Do not assemble the library by downloading unrelated internet assets.

The first approved asset pilot is limited to fruits and vegetables, with nine approved versioned sprites already reviewed. Generate with ChatGPT ImageGen only; do not add a provider comparison. There is no fixed asset target. Expand only after reviewing the pilot library.

The registry should represent a canonical object and its intentional variants. Candidate variant dimensions include color and size. Keep the object identity distinct from the way the runtime renders it. Whether size variants should be separate generated images or a render-time scale setting remains an open decision; do not generate duplicate size assets by default without testing whether they add value.

The asset workflow should:

- establish a concise style guide and reusable visual reference before batch generation;
- generate object sprites as separate, transparent assets, with scene backdrops maintained as separate assets;
- use the approved individual-sprite workflow with the style reference and reference conditioning;
- normalize slicing, transparency, canvas/framing, and palette where appropriate;
- record object, variant, model, prompt/reference, and normalization information in `manifest.json`;
- review a contact sheet before assets enter the approved library.

Record the ChatGPT generation surface and any model/version information it exposes. If the underlying model is not identified, record it as unknown.

**Asset review checks:**

- objects look like members of one art system when placed together;
- sprites have consistent framing and transparent backgrounds, rather than unrelated backgrounds baked into each object;
- objects remain recognizable and distinct at tablet display size;
- each variant changes the intended attribute while preserving the canonical object;
- backdrops, if used, form a consistent scene system and remain independent of object sprites.

Set a practical visual acceptance bar before generating the pilot. Track keep-rate and human time by sheet/model so rejected outputs are visible rather than silently discarded.

**Gate:** Do not start mechanic implementation until the pilot contact sheet and representative assets meet the agreed coherence and usability bar. If the pilot misses it, revise the style reference or generation/normalization method before scaling the library.

### Phase 2 — Use the library in two mechanics

Use the same approved asset library in the already confirmed V1.1 mechanics: `tap-to-select` and `drag-to-target`. Keep one explicit theme shared across both activities.

Create at least one manually reviewable activity for each mechanic. The selected objects and variants should exercise more than one asset family without making the activity content itself too complicated to assess. Keep the content and mechanic code deterministic; AI generates semantic content and visual assets, never gameplay code.

Review each rendered activity before child testing. Check object legibility, layout/crowding, visual distinction at the chosen difficulty, and whether the activity instructions match the interaction.

### Phase 3 — Manually observe actual play

Test the activities on the target tablet with a parent nearby. Capture brief observations about whether the child understands the task, engages with it, encounters confusing or frustrating moments, and asks to replay or continue. Completion, abandonment, and adult assistance are useful context. Session length alone is not a success measure.

The experiment is qualitative and small. Do not present one child’s sessions as evidence of population-level engagement or developmental efficacy.

## 5. In scope

- A reusable, AI-generated asset library for familiar everyday objects.
- Canonical objects plus deliberately defined variants.
- A style-reference, normalization, manifest, and human-curation workflow for individual sprites.
- The `tap-to-select` and `drag-to-target` mechanics.
- Representative activities using the approved assets.
- Manual review of both rendered activities and manual observation of child use.
- Existing local session capture and brief parent notes where useful.

## 6. Deferred

- Name-in-audio or other per-child audio personalization.
- Child Context Store, Pack Builder, profiles, and per-child pack generation.
- Selection Engine or automated activity recommendations.
- Story arcs, recurring characters, and a full Story/Theme Engine.
- Parent dashboard, accounts, multi-child support, remote analytics, billing, and distribution expansion.
- A fixed library-volume target such as 15–20 activities or 90–100 assets.
- Claims that the product improves development or learning.

Generic activity instructions or existing sound effects may be used if already available, but personalized TTS is not required for this experiment.

## 7. Decision criteria

Continue beyond the pilot only if both required claims have credible supporting evidence:

- **Assets:** the contact sheets meet the agreed consistency bar, objects are usable and recognizable, and the workflow can reproduce that quality across sheets.
- **Activities:** the two rendered activities work on the target tablet, and observed play gives a credible positive signal without repeated adult explanation or unresolved interaction/visual problems.

If asset quality passes but activities do not, keep the library and revise content, mechanics, or presentation. If the child experience is positive but asset quality remains inconsistent, improve the asset workflow before expanding content. If neither passes, revisit the product experiment before adding volume.

## 8. Open decisions to resolve before execution

- The manual observation sheet and session procedure.

The approved style reference, asset review criteria, mechanic pair, shared Kitchen theme (theme colors only, no backdrop), and pilot object/activity choices are settled. Use `themeId` explicitly in each composed activity; do not infer the theme from a concept or mechanic. The pilot uses red apple, banana, orange, and carrot: tap to find the red apple among those four, and drag red apple, banana, and orange to matching picture targets.

These decisions should be resolved in the design discussion before implementation begins.

## 9. Follow-up decision — 15 activities for iPad QA

On 2026-09-30 Ajay approved the 15 additional Kitchen produce activities for the one-child iPad pilot. The production index contains the two original pilots plus those 15 activities. This approval does not claim child enjoyment or learning efficacy; those remain to be observed. The existing two mechanics, Kitchen theme, and approved sprites are unchanged.
