# Engaging Produce Activity Set — Design

## Goal

Add 15 more varied Kitchen produce activities to Bloom using the existing approved sprite library. Together with the two current pilots, the app will offer 17 activities. The new set should feel more challenging through multi-pick rounds, larger picture-matching rounds, and one category-sorting round.

## Confirmed direction

- Ajay approved the 15 activity concepts listed below for design progression.
- These are 15 **additional** activities; the current tap and drag pilots remain.
- Use the existing `kitchen-v1` theme and its approved colors.
- Use only the nine existing approved produce sprite assets; create no new artwork.
- Preserve the current 24–36 month audience as a working assumption from the approved pilots.
- These 15 activities were built and interaction-checked as candidates. On 2026-09-30, Ajay approved all 15 activities for the pilot and authorized adding them to the production index. This approval does not claim child enjoyment or learning efficacy; those remain to be observed on the iPad.
- No child observation is part of this implementation.

## Activity set

### Tap to select

Each board shows six choices. Medium rounds have two correct choices and four distractors; the more challenging rounds have three correct choices and three distractors.

1. **Picnic Pack:** Find the red apple, banana, and orange among carrot, broccoli, and cucumber.
2. **Garden Basket:** Find the carrot, broccoli, and cucumber among the red apple, banana, and orange.
3. **Apple Twins:** Tap both apples—red and green—among banana, orange, grapes, and carrot.
4. **Green Team:** Tap the green apple, cucumber, and broccoli among the red apple, banana, and carrot.
5. **Orange Team:** Tap the orange and carrot among red apple, green apple, cucumber, and broccoli.
6. **Soup Chef:** Tap carrot, tomato, and broccoli among banana, orange, and grapes.
7. **Smoothie Mix:** Tap red apple, banana, and grapes among cucumber, carrot, and broccoli.
8. **Long-Shape Hunt:** Tap banana, carrot, and cucumber among red apple, orange, and broccoli.
9. **Round-Food Hunt:** Tap red apple, orange, and tomato among banana, carrot, and cucumber.
10. **Red Kitchen Hunt:** Tap red apple and tomato among green apple, banana, orange, and carrot.

### Drag to target

Four activities use five or six distinct draggable foods and one matching picture target per food. The fifth activity sorts six foods into two picture-led category bins.

11. **Market Match:** Drag red apple, banana, orange, grapes, carrot, and cucumber to their six matching pictures.
12. **Garden Harvest Match:** Match green apple, tomato, broccoli, carrot, banana, and orange to their pictures.
13. **Fruit Stand Match:** Match the red and green apples, banana, orange, and grapes to five picture targets.
14. **Mixed-Tray Scramble:** Match red apple, green apple, banana, grapes, tomato, and broccoli when the picture targets are in a different order.
15. **Fruit-or-Vegetable Sort:** Sort green apple, banana, and grapes into the apple-marked fruit bin, and cucumber, tomato, and broccoli into the carrot-marked vegetable bin.

## Objective completion criteria by activity

Each activity is complete only when its data passes the stated contract and its live interaction passes the activity-specific behavior checks below. A structural pass alone does not count as a working activity. The implementer records the test command/output and the live-runtime result for each activity before starting the next one.

| # / activity | Data checks that must pass | Live interaction checks that must pass |
|---|---|---|
| 1. Picnic Pack | Prompt: “Find the red apple, banana, and orange.” Exactly those three are correct; carrot, broccoli, and cucumber are distractors. Six distinct approved sprites; high difficulty; `3 + 3` choices. | Correctly tapping each of the three advances progress once; tapping any of the three distractors does not; the third correct tap completes. |
| 2. Garden Basket | Prompt: “Find the carrot, broccoli, and cucumber.” Exactly those three are correct; red apple, banana, and orange are distractors. Six distinct approved sprites; high difficulty; `3 + 3` choices. | Same multi-pick checks: all three correct taps advance once, distractors do not advance, and the third correct tap completes. |
| 3. Apple Twins | Prompt: “Find both apples.” Correct refs are `apple-red-v1` and `apple-green-v1`; distractors are banana, orange, grapes, and carrot. Six unique refs; medium difficulty; `2 + 4` choices. | Either apple advances once; non-apples do not; completion occurs after both apple variants are selected. |
| 4. Green Team | Prompt: “Find the green apple, cucumber, and broccoli.” Correct refs are green apple, cucumber, and broccoli; distractors are red apple, banana, and carrot. Six unique refs; high difficulty; `3 + 3` choices. | All three correct taps advance once; distractors do not; the third correct tap completes. |
| 5. Orange Team | Prompt: “Find the orange and carrot.” Correct refs are orange and carrot; distractors are red apple, green apple, cucumber, and broccoli. Six unique refs; medium difficulty; `2 + 4` choices. | Either correct tap advances once; distractors do not; completion occurs after both correct choices. |
| 6. Soup Chef | Prompt: “Find the carrot, tomato, and broccoli.” Correct refs are carrot, tomato, and broccoli; distractors are banana, orange, and grapes. Six unique refs; high difficulty; `3 + 3` choices. | All three correct taps advance once; distractors do not; the third correct tap completes. |
| 7. Smoothie Mix | Prompt: “Find the red apple, banana, and grapes.” Correct refs are red apple, banana, and grapes; distractors are cucumber, carrot, and broccoli. Six unique refs; high difficulty; `3 + 3` choices. | All three correct taps advance once; distractors do not; the third correct tap completes. |
| 8. Long-Shape Hunt | Prompt: “Find the banana, carrot, and cucumber.” Correct refs are banana, carrot, and cucumber; distractors are red apple, orange, and broccoli. Six unique refs; high difficulty; `3 + 3` choices. | All three correct taps advance once; distractors do not; the third correct tap completes. |
| 9. Round-Food Hunt | Prompt: “Find the red apple, orange, and tomato.” Correct refs are red apple, orange, and tomato; distractors are banana, carrot, and cucumber. Six unique refs; high difficulty; `3 + 3` choices. | All three correct taps advance once; distractors do not; the third correct tap completes. |
| 10. Red Kitchen Hunt | Prompt: “Find the red apple and tomato.” Correct refs are red apple and tomato; distractors are green apple, banana, orange, and carrot. Six unique refs; medium difficulty; `2 + 4` choices. | Either correct tap advances once; distractors do not; completion occurs after both correct choices. |
| 11. Market Match | Prompt: “Put each food on its matching picture.” Six unique items and six unique targets: red apple→red apple, banana→banana, orange→orange, grapes→grapes, carrot→carrot, cucumber→cucumber. Every target is used exactly once; medium difficulty; no distractors. | Each item dropped on its matching target advances once and remains visibly parked; dropping an item on a different target returns it without progress; the sixth correct match completes. |
| 12. Garden Harvest Match | Prompt: “Match each harvest to its picture.” Six unique pairs: green apple, tomato, broccoli, carrot, banana, and orange each maps to its identical picture target. Every target is used exactly once; medium difficulty; no distractors. | Same one-to-one checks as #11; completion follows the sixth distinct match. |
| 13. Fruit Stand Match | Prompt: “Put each fruit on its matching picture.” Five unique pairs: red apple, green apple, banana, orange, and grapes each maps to its identical target. Every target is used exactly once; medium difficulty; no distractors. | Each of five correct matches advances once; a wrong-target drop bounces without progress; the fifth match completes. |
| 14. Mixed-Tray Scramble | Prompt: “Match each food to its picture.” Six unique one-to-one pairs: red apple, green apple, banana, grapes, tomato, broccoli. Target row order differs from item row order, and every item still maps by its target ID to its identical picture. Medium difficulty; no distractors. | All six correct matches work independent of visual row order; wrong-target drops do not advance; completion follows six correct matches. |
| 15. Fruit-or-Vegetable Sort | Prompt: “Put fruit with fruit and vegetables with vegetables.” Six items map to exactly two targets: green apple, banana, and grapes→Fruit (apple-led bin); cucumber, tomato, and broccoli→Vegetables (carrot-led bin). Each target has `capacity: 3`. | Each correct category drop advances once and occupies a distinct visible position in its bin; each incorrect category drop returns without progress; all six items fit without overlap and the sixth correct sort completes. |

**Set-wide done gate:** all 15 records pass activity/schema/asset validation and the assertions above; every referenced sprite is registered, approved, and present; all boards and labels fit at 1024×768; each live interaction is individually verified before the following activity is built; and all 15 approved activities are indexed alongside the two original pilots.

## Runtime and contract design

### Six-choice tap rounds

- Continue using `tap-to-select`; do not add a new mechanic ID.
- Use the existing six-item grid layouts, alternating `grid-2x3` and `grid-3x2` where the composition allows it.
- Use two correct plus four distractor items for medium rounds and three correct plus three distractors for high rounds. The activity prompt names the requested set directly.
- Concepts declare the exact item sprite scope for each activity. No activity may include both apple variants unless both are part of its concept scope.

### Five- and six-pair drag rounds

- Extend the drag contract to allow up to six target pictures and add a six-pair horizontal layout. At the 1024×768 reference canvas, show six target pictures in the upper row and six draggable foods in the lower row; retain enough spacing for the 140-unit target rings, 110-unit item sprites, and labels.
- Add a category-sort layout with two wide, visibly separate bin cards centered at one-third and two-thirds of the play-area width; place the picture and category label in the upper part of each card and three parking positions in one horizontal row beneath them. Place all six draggable starts in a separate lower row. The six parking positions must fit without overlap at 1024×768.
- Four one-to-one rounds use five or six unique asset types; each draggable item maps to the target with the same picture. Activity 14 intentionally orders the item and target rows differently.
- Treat five/six matching pairs with no extra draggable distractor as medium difficulty. Update generation and validation rules so they agree with what the runtime actually loads; do not count ignored `distractors` slots as gameplay.
- Preserve snap-to-match, bounce-back for an incorrect drop, progress feedback, and completion after every required match.

### Fruit-or-vegetable sort

- Keep this inside `drag-to-target`, with two labeled picture bins: an apple image labeled “Fruit” and a carrot image labeled “Vegetables.”
- Each bin receives three different draggable items. Repeated `targetId` values are intentional for this activity.
- Add three non-overlapping visible parking positions per bin. A correct item snaps to the next open position; an incorrect category drop returns the item to its start and does not advance progress. Completion requires all six items to be sorted.
- Draw category targets as visibly bounded bins rather than small circular matching rings. A drop within a bin counts only when the item's declared `targetId` is that bin; wrong-bin and outside-bin drops return without progress. Each accepted item occupies the next open parking position and is scaled to fit beside the other two.
- Store the expected category mapping in the activity data and validate that each bin receives exactly the three declared items.

## Approval and publication flow

- Keep the existing two approved activities active.
- Store the 15 approved activities directly in `library/activities/` with their own concept briefs and Kitchen theme IDs; add them to `library/activities/index.json`.
- Keep the generated 1024×768 review artifacts and actual interaction checks as QA evidence. Ajay approved the 15 activities for the one-child pilot on 2026-09-30.
- Use the observation template only after the app interactions have been reviewed; record supervised child observations separately from content approval.

## Acceptance criteria

1. Exactly 15 new candidates are added, with the 10 tap rounds and five drag rounds above; the original two activities remain.
2. All 15 use only registered, approved existing sprite refs and `kitchen-v1`; no new assets are generated.
3. Tap validation proves six choices and the stated correct/distractor mapping for each board.
4. Drag validation proves five/six one-to-one matches for activities 11–14 and three-to-one category bin membership for activity 15.
5. Runtime displays all six target pictures without overlap at the reference viewport; items, labels, and progress remain inside their intended areas.
6. Correct drops update progress; incorrect drops bounce back without counting; the category sort parks each item visibly in its assigned bin.
7. All 15 approved activities are in `library/activities/` and indexed alongside the two original pilots with approval metadata dated 2026-09-30.
8. Existing two active activities remain unchanged and continue to pass validation.

## Out of scope

- Generating or commissioning more artwork, backgrounds, audio, or themes.
- Adding mechanics beyond multi-pick tap, one-to-one drag matching, and the specified category-bin variation within drag-to-target.
- Migrating or repairing the legacy activities.
- Claiming that an activity is fun, effective, or suitable for a wider population before supervised observation.

## Design self-review

- **Count:** The plan defines ten tap activities and five drag activities, exactly 15 additions.
- **Asset scope:** Every referenced object exists in the approved produce library; no new art is needed.
- **Current implementation gaps:** Drag targets/layouts are currently capped below six, and drag validation's medium-difficulty distractor rule does not match runtime handling. The plan explicitly changes both. The category sort also requires visible multi-drop parking positions rather than stacking items at one target coordinate.
- **Review boundaries:** Ajay approved the 15 activities for this one-child pilot on 2026-09-30. Child enjoyment and learning efficacy remain untested until supervised iPad observations are recorded.
- **Audience:** The 24–36 month range is inherited from the current pilots because no new age range was requested; Ajay can revise it during spec review.
