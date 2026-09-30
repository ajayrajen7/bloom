# Bloom Activity and Theme Contract

**Status:** Approved by Ajay on 2026-09-28; product-code implementation is gated on review of the implementation plan.
**Date:** 2026-09-28
**Scope:** Reconcile the agreed activity-composition diagram with Bloom's canonical architecture and define the V1.1 activity/theme handoff.

## 1. Goal

Define how a concept, mechanic, theme, and approved assets become a playable activity; how that activity is stored; and what the runtime consumes. Preserve the canonical Content Factory, Distribution, and Runtime planes. Treat the simpler Concept → Mechanic/Theme/Asset Catalog → Activity Composition → Storage → Runtime diagram as the domain view of the existing factory-to-library-to-runtime flow.

The pilot uses the already approved asset set and a shared theme across the two mechanic examples. This contract does not add personalization, story arcs, runtime generation, or new asset-generation providers.

## 2. Architecture reconciliation

| Agreed activity diagram | Canonical architecture | Contract meaning |
|---|---|---|
| Concept | A2 Concept Layer, grounded in A1 Development Framework | Describes age-banded intent, skill goal, and difficulty; constrains eligible mechanics and activity parameters. |
| Mechanic | A3 Mechanics Registry | Selects a deterministic, versioned interaction template and its slot/parameter contract. |
| Theme | A4 Story / Theme Engine | Supplies a reusable setting and visual treatment. Full story arcs remain deferred. |
| Asset catalog | A5 Asset Registry | Supplies approved, versioned object, variant, setting, and optional audio references with provenance. |
| Activity composition | A6 Generation Layer | Combines the selected inputs, computes deterministic fields, and produces the playable activity definition. |
| Quality review | A7 cross-cutting QA gates | Validates assets and activity structure; includes human review of rendered activities before child observation. |
| Storage | A8 Content Library | Publishes approved activity definitions and the shared assets they reference. |
| Runtime | C3 Child Runtime | Loads approved activities and assets, renders theme and mechanic, and records session outcomes. |

The separate blocks are useful contract boundaries; they do not require each to be a separately deployed service. A5 is the authoring/catalog view. A8 is the approved, versioned publication store. A7 remains between composition and publication even though the simplified diagram omits it. B1 Pack Builder and C1/C2/C5 personalization and selection systems remain outside V1.1.

## 3. Approved contracts

### Concept

The concept identifies the age range, skill goal, difficulty, and allowed content/mechanic constraints. It constrains composition but does not own or select the theme. A free-text content hint, if retained, is not a theme identifier.

### Mechanic

The mechanic registry entry declares a stable ID, supported input slots, parameter schema, and layout requirements. Mechanics remain deterministic and interaction-focused. A mechanic receives resolved items, targets, and parameters from the activity; it does not select a theme, load catalog metadata, or fetch art. Runtime asset loading is shared infrastructure.

### Theme

A theme is an independently versioned reusable setting and visual treatment, separate from the interaction and from any individual object sprite. Proposed minimum shape:

```ts
interface ThemeSpec {
  id: string;
  version: string;
  name: string;
  setting: string;
  visualTreatment: string;
  presentation: {
    backgroundColor: string;
    promptPanelColor: string;
    foregroundColor: string;
  };
  backgroundAssetRefs?: string[];
  decorationAssetRefs?: string[];
}
```

Object sprites and theme artwork remain in the asset registry as separate approved assets. A theme references those assets; it does not copy or redefine their provenance. A theme may have no background art in the first pilot, provided the setting/visual treatment is still explicit.

For this pilot, Activity Composition receives an explicit `themeId`; it uses the same selected theme for both mechanic examples. The concept does not infer the theme, and Runtime does not choose one. Later experiments may let the generation policy select from an approved theme set without changing mechanic contracts.

### Activity definition and composition

Activity Composition is the A6 generation output boundary. It takes the concept, mechanic, theme, prompt/content, layout constraints, and approved asset references, validates them, and emits a complete playable activity. The existing activity schema already carries `conceptId`, `mechanicId`, `filledSlots`, `parameters`, prompt, and review metadata. The contract adds a required `themeId` and keeps versioned asset references in the existing `assetRef` fields for this pilot.

The stored activity is self-contained for playback: layout and mechanic parameters are resolved, every asset reference points to an approved version, and there are no child-specific unresolved slots. The LLM may supply bounded semantic content, but pipeline code chooses/validates references and assembles deterministic fields.

### Storage and runtime

A8 stores approved, immutable activity definitions and the versioned assets they reference. A5 manifest and review metadata remain build-time provenance/QA inputs; Runtime does not need to interpret the generation manifest.

C3 loads the approved activity and referenced assets, applies the theme's visual treatment, instantiates the selected mechanic with resolved data, and records interaction/session outcomes. The runtime makes no AI calls. V1.1 outcomes remain local session records and parent observations rather than a profile or selection service.

## 4. V1.1 decisions to carry into the reconciled scope

The canonical V1.1 files formerly specified `tap-one` and `find-all`, parked drag, and named Recraft v4 plus GPT Image 2 for an asset-model comparison. Later user-approved decisions recorded in the restart checkpoint and phase-two plan specify `tap-to-select` plus `drag-to-target` and ChatGPT ImageGen only. Ajay approved keeping the canonical layer boundaries while updating the V1.1 scope to these later pilot decisions. The V1.1 scope text and canonical diagram labels have been reconciled accordingly.

The current fruit/vegetable library is the deliberately bounded first asset family for that pilot. Additional utensils and animals are not prerequisites for the activity/theme interface.

## 5. Validation and acceptance criteria

- Each activity names exactly one concept, mechanic, and theme version.
- The same explicit theme is used in both pilot activities.
- The selected mechanic's slot and parameter schemas validate the composed activity.
- All `assetRef` values resolve to approved, versioned assets; staged/rejected candidates cannot be published.
- Activity layout and mechanics parameters are resolved before publication; no child-specific slots remain.
- QA review occurs before the activity enters A8 and before child observation.
- Runtime can load the published definition and assets without generation-manifest access or AI calls.
- Session outcomes are recorded through the existing local runtime/session path.

## 6. Out of scope

- Implementing the schema or runtime changes.
- Selecting the concrete pilot theme, activity prompts, or produce subset; those are activity-content decisions to settle before drafting examples.
- Building a general story-arc engine, theme marketplace, Pack Builder, child profile, personalization, automated selection, or remote analytics.
- Changing the asset approval process or generating new assets.

## 7. Approval and implementation gate

Ajay approved this design on 2026-09-28. The implementation plan records the new pilot schema, asset resolution, runtime theme rendering, validation, and activity review. Existing unusable activities are outside the implementation scope. Product-code work begins only after Ajay reviews that plan and chooses the execution approach. No product code is authorized by this design alone.
