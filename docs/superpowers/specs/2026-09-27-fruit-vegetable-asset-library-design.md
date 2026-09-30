# Bloom Asset Library Pilot — Design

**Status:** Proposed for Ajay's review; no implementation authorized by this document alone
**Date:** 2026-09-27
**Scope:** Local V1.1 restart, asset-library phase only

## 1. Goal

Test whether an AI-assisted workflow can produce a coherent, attractive, reusable library of familiar fruit and vegetable assets, including controlled variants. This is the first V1.1 claim to test. Activities and child playtesting follow only after the asset library is reviewed and approved.

Ajay will manually review every asset candidate in the pilot. Automated image checks and model-based evaluation are supporting evidence; neither may approve assets or replace human review. The pilot has no fixed asset-count target. A batch of 100 candidates is acceptable if it is useful for the experiment and all candidates are presented for review.

## 2. Decisions and recommendations

### Confirmed direction

- Limit the asset category to fruits and vegetables.
- Use generated art rather than collecting unrelated internet assets.
- Use a reference image as a candidate consistency aid.
- Review every pilot candidate manually.
- Keep scene backdrops separate from transparent object sprites.
- Preserve the prior sequence: asset library first, then two mechanics, then manual child observation.

### Proposed approach for review

- Establish and approve one **style anchor** image. Reuse that same anchor for each new canonical object; do not generate object B from object A, object C from B, and so on. Chaining can accumulate visual drift.
- Use explicit subject text with the shared anchor. The anchor communicates rendering style; the text specifies which fruit or vegetable to depict.
- For a variant, use that object's approved canonical image as the identity reference and request one defined change. Do not use the general style anchor as the only reference for object variants.
- Compare reference-conditioned and text-only generation on a small, controlled sample before scaling. A reference is a hypothesis for improving consistency, not a guarantee.
- Generate object sprites as individual images. Use contact sheets for review, rather than relying on a generated multi-object sheet as the primary asset source; this avoids adding slicing and framing errors to the initial consistency test.
- Treat size as a render-time scale parameter in the first pass. Generate an image variant for an attribute such as color only when the activity requires the child to distinguish that attribute.
- Preserve the existing `library/assets/sprites/` consumer path and current `assetRef` strings. New asset metadata lives in a separate manifest.

## 3. Pilot content

Restrict the set to produce, with varied silhouettes and colors so the style is tested across more than round objects.

Candidate seed set:

- Fruits: apple, banana, orange, grapes.
- Vegetables: carrot, tomato, cucumber, broccoli.

Candidate variant: one intentional color variant for a selected object, such as red and green apples. Size is represented by runtime scale unless later evidence shows that separately generated size art is needed.

This is a starting set, not a commitment to eight assets or a cap. The exact list and volume should be sized to the activity prototypes and the consistency question. The pilot can include many more candidates; every candidate remains subject to manual review.

## 4. Generation and reference strategy

### 4.1 Style anchor

Create candidate style anchors and select one before bulk generation. Record the approved anchor as a versioned project reference. Write a short style contract from the chosen image that describes visible, repeatable properties (for example, outline treatment, shading, texture/detail level, proportions, and background treatment). Avoid long prompt prose that contradicts the reference.

The image must be explicitly supplied as a **style reference**, not as the requested object or a composition to copy. Each canonical-object prompt names one subject, requests one centered object, and excludes text, scene backgrounds, extra objects, and baked-in labels.

### 4.2 Controlled reference test

For a small representative subset, generate candidates with the same model and equivalent subject instructions in two conditions:

1. Text-only prompt using the style contract.
2. The same prompt plus the approved style anchor.

Compare the results side by side without relying only on the generation model's own score. Evaluate whether reference conditioning improves consistency and whether it causes unwanted shape, color, or composition copying. Keep prompts, model/version, reference ID, and condition attached to each result.

The pilot uses ChatGPT's built-in image generation only. This avoids adding a second provider and account workflow. Record the ChatGPT surface and any model/version information it exposes; if the underlying model is not identified, record it as unknown. Do not include Recraft or another provider in the pilot. Keep reference-conditioning tests within the same ChatGPT generation path so the reference is the only changed variable.

### 4.3 Canonical objects and variants

Each object has one canonical approved asset. An attribute variant references the canonical asset and changes only the requested property; the object silhouette and identity should remain recognizable. Each variant is evaluated next to its canonical image. Size variants are not generated by default; runtime scale values preserve the source art and avoid unnecessary near-duplicates.

## 5. Asset evaluation and manual review

### 5.1 Evaluation set

Version a small asset evaluation set alongside the style contract. It contains representative object prompts, the approved style anchor, canonical-to-variant pairs, and a fixed evaluation rubric. It is used to compare generation conditions and detect regressions when prompts or models change.

The generation prompt may include the style contract and concise acceptance constraints. The evaluation rubric remains a separate artifact and is run after generation. A generator's self-evaluation is advisory only; an independent vision evaluator may score outputs, but it cannot approve or silently discard candidates.

### 5.2 Deterministic checks

For every candidate, record checks that can be computed reliably:

- File decodes and is the expected PNG format and dimensions.
- Alpha channel exists; corners/background are transparent rather than filled with a simulated checkerboard or solid color.
- Subject bounds stay inside a safe margin and are centered within a defined tolerance.
- Subject occupancy is recorded so objects do not appear arbitrarily tiny or oversized when placed in a common play cell.
- Composite previews on light and dark backgrounds reveal halos, matte edges, or leftover background pixels.
- No filename or manifest collision; all referenced files resolve.

Numeric bounds for centering, safe margin, and occupancy are provisional until calibrated against the approved anchor and the actual runtime display size. Geometric checks must not force distinct silhouettes (for example, a banana and an apple) into identical pixel area.

### 5.3 Visual rubric

Score each candidate against the anchor and at the intended play size on a simple 1–5 scale:

- **Style coherence:** rendering treatment belongs to the same visual system.
- **Recognition:** the named object is identifiable without relying on its filename.
- **Framing:** visual weight and placement are consistent, with clean transparent edges.
- **Prompt fidelity:** no unintended props, scene, text, or decorative details.
- **Variant fidelity:** for a variant, the intended attribute changes while identity and other important features remain stable.

Do not score every object on having a rounded silhouette. “Roundedness” describes the softness of the illustration treatment where appropriate; it must not penalize the natural shape of objects such as carrots or cucumbers. The visual threshold is calibrated with the style anchor and written down before bulk review.

### 5.4 Human review gate

Present every generated pilot candidate to Ajay in a review board or clearly indexed contact-sheet workflow. Each candidate is individually visible at full resolution and at approximate play size. The reviewer can approve or reject it, record a reason, and compare variants side by side. Automated checks and model scores appear as evidence and flags only.

Only manually approved candidates enter the runtime-approved sprite set. Retain review decisions and rejection reasons so that keep-rate and recurring failure modes can be assessed. The review process remains complete for a 100-asset pilot; sampling is not a substitute.

## 6. Local project organization

Keep existing asset consumers stable while separating candidate generation from approved content. Proposed layout:

```text
library/assets/
  sprites/                 # approved runtime sprites; current assetRef path remains valid
  manifest.json            # identity, category, variants, provenance, review status
  style/
    style-contract.md
    style-anchor-v1.png
  evals/
    asset-eval-v1.json     # fixed prompts/tasks and rubric version
  staging/<batch-id>/      # unapproved outputs and per-candidate metadata
  reviews/<batch-id>.json  # complete manual decisions and review notes
```

The manifest records stable asset ID, display name, category, canonical/variant relationship, variant attributes, file path, model and model version, prompt version, style-reference version, batch ID, deterministic metrics, evaluator scores, manual decision, and reviewer notes. Runtime activities continue to refer to approved images through the existing `assetRef` strings; gameplay schema changes are not part of this asset phase.

Legacy sprites remain available as historical comparison material and are not mixed into the newly approved visual system by default.

## 7. Success evidence and gate

The asset gate is met when:

- The full candidate set has been manually reviewed and decisions are recorded.
- Approved assets are recognizable at intended display size and visibly cohere with the selected anchor across both fruit and vegetable silhouettes.
- Canonical/variant pairs preserve identity and make the intended distinction clear.
- Approved assets have transparent backgrounds, clean edges, and consistent framing suitable for the current runtime.
- Reference-conditioned generation is compared with text-only generation and the result (including any failure) is documented.
- Keep-rate, rejection reasons, and human review time are known for the tested batch/model/condition.

An asset-count target, model score, or high keep-rate alone does not pass the gate. If the visual set fails, revise the anchor, style contract, generation condition, or normalization approach and review the next batch before beginning mechanics work.

## 8. Out of scope for this design

- Implementing or changing `tap-one`, `find-all`, or existing gameplay mechanics.
- Generating or approving a production-sized asset library.
- Story art, backdrops, audio, child profiles, personalization, and TTS.
- Automated approval of assets or replacing human review with model scores.
- Learning or developmental-effect claims.

## 9. Decisions to settle during spec review

1. Approve or edit the proposed eight-object seed set.
2. Use ChatGPT's built-in image generation for the first controlled comparison; no Recraft or other provider comparison is planned.
3. Select the intended initial illustration direction by approving a style anchor; this is a visual decision and is better made from examples than from adjectives alone.
4. Calibrate provisional framing/occupancy thresholds and the visual-score pass bar using the selected anchor and actual play-size preview.
5. Confirm whether any asset variants beyond one attribute example are needed before the first activity prototypes.

No code, generated images, or asset files should be produced until this design has been reviewed and the subsequent implementation plan is approved.
