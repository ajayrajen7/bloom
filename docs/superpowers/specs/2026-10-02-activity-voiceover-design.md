# Activity Voice-over Design

**Status:** Approved by Ajay 2026-10-04
**Date:** 2026-10-04

## Goal

Help a non-reading child understand an activity before play, and give a brief spoken celebration when the activity is completed. The first release uses pre-generated audio and keeps the interaction deterministic.

## V1 scope

- Provide a spoken instruction for each of the 17 indexed pilot activities.
- Provide one shared spoken “Well done!” clip at completion.
- Use one pre-generated voice pack for V1. Keep the selected pack and its audio references in authoring data/configuration, rather than making the voice choice part of gameplay logic. A different pre-generated pack can be selected by changing that data/configuration once its corresponding clips exist.
- Do not add item-by-item progress guidance, remaining-item names/counts, wrong-answer narration, inactivity prompts, browser speech synthesis, native speech APIs, network speech, or generated speech in V1.
- A later playtime experiment may use browser speech synthesis to call the device's installed voice. That experiment may sound different from V1 recordings; this is an accepted tradeoff. V1 recordings may be replaced if a later voice direction requires it.

## Screen-by-screen experience

### 1. Activity selection

The child sees the existing scrollable activity list. Selecting a card enters the instruction state for that activity; it does not expose the game board yet.

### 2. Instruction state

- Replace the list with a full-screen instruction view using the selected activity's existing theme background color. Render this view immediately on activity selection, while activity data and audio load.
- Show one centered speaker/listening symbol, 96 CSS pixels across. Pulse it from 1.0 to 1.06 scale and back over a 1.5-second cycle while narration plays. Do not show activity sprites, targets, choices, progress dots, stars, or other game-board content in this state.
- Show the full spoken instruction as a centered, 32 CSS-pixel caption, responsive down on smaller viewports and constrained to 80% of viewport width, wrapping as needed. The caption is for the accompanying adult; it is not the child-facing instruction or a fallback that assumes the child can read.
- Begin the pre-generated instruction automatically as soon as the activity data and clip are ready. Until then, show a loading spinner and the short status “Getting ready…” below the speaker symbol. Do not require the child to press a button to start listening.
- The script must say the mechanic action and the task count/scope in plain language (for example, “Find three vegetables” or “Drag the three foods to their matching pictures”). It may name the target items as part of this initial instruction.
- Keep all activity input unavailable throughout the instruction. When the audio's `ended` event fires, transition immediately to the play state without another tap.

### 3. Audio failure fallback

If the clip is missing, fails to load, or playback is rejected or errors before completion, remain on the instruction view and replace the listening pulse with a clear error state. Keep the full caption visible for the adult. Provide two controls, each at least 240 by 72 CSS pixels: **Try voice again** and **Start activity**. The first retries the same clip; the second lets the adult read the caption aloud and then enter the activity. Do not automatically reveal the board on failure, since that would leave a non-reading child without the instruction. Repeated failure leaves these controls available; it must not trap the user or navigate away.

### 4. Activity play and instruction replay

- Enter the existing activity board with its prompt, objects, progress indicators, and mechanics unchanged. Preserve the session ID and any progress when entering play.
- Add a visible speaker/replay control in the prompt area with a minimum 64-by-64 CSS-pixel hit target. Activating it temporarily hides and disables the board and returns to the same instruction view, with the same caption, while the same clip plays again. At the clip's `ended` event, restore the existing board at the same progress and object arrangement. If replay fails, restore the board and progress immediately; do not reinitialize the activity.
- Do not add count-based progress narration or remaining-item names during play in V1.

### 5. Activity completion and return to the list

- After the final correct interaction, retain the existing 900 ms completion transition delay, then enter the completion view. Do not play “Well done!” before completion view appears.
- Show the existing full-screen celebration: themed background, “Well done! 🎉” text, and star animation. Start the shared pre-generated spoken “Well done!” clip once when this view appears. Do not repeat it if completion is signaled again while this view is active.
- Keep the celebration visible for at least two seconds and until the spoken clip has ended, whichever is longer. If the clip fails to load or play, keep the celebration visible for two seconds.
- Then automatically return to the activity list; require no child or parent confirmation, do not open another activity automatically, and do not show a rating/feedback prompt. Restore the list at its previous scroll position when available.
- Spoken audio must remain audible over existing sound effects. Do not play a completion oscillator effect over the spoken phrase; the existing success/error effects otherwise remain unchanged.

## Voice and configuration

The shipped default is a single authored, pre-generated voice pack. Voice-pack selection is configuration/data, not a child-facing audition flow or gameplay behavior. The initial selection can be changed without changing gameplay code, provided the replacement pack supplies the required prompt and completion clips.

The production voice for V1 is selected for clear, comfortable speech. The pilot does not require matching the device's future browser voice, and parents do not need to choose among samples before the feature can be built or deployed. The later browser-voice experiment will establish the device's available/default voice on the actual iPad and assess whether to keep the authored pack, switch to device speech, or replace the authored pack.

## Content and audio behavior

- Each indexed activity has an authored spoken instruction associated with its activity ID.
- Instruction scripts include the mechanic action and target count/scope. They are distinct from the existing visible prompt when needed to make the spoken direction complete for a non-reading child.
- The completion phrase is shared across activities: “Well done!”
- The first release uses local, pre-generated audio assets. It introduces no speech service, external request, or runtime text generation.
- Existing success/error oscillator effects remain unchanged. Their overlap with spoken completion should be prevented or intentionally sequenced so the speech is audible.
- A clip plays once per relevant scene entry. Re-entering/replaying the activity plays its instruction again; repeated completion signals within one completion entry must not duplicate the clip.
- Audio load/play failures are non-fatal and must not strand the child on the instruction screen.

## Acceptance criteria

1. **Selection to instruction:** Selecting an indexed activity enters a full-screen instruction view; the play board, activity sprites, targets, choices, progress dots, and mechanics are not visible or interactive in that view.
2. **Instruction layout:** The view appears immediately after selection, uses the selected activity's theme background color, shows a 96 CSS-pixel centered speaker/listening symbol pulsing from 1.0 to 1.06 scale over a 1.5-second cycle during speech, and displays the complete adult caption centered at 32 CSS pixels with an 80%-viewport maximum width. While loading, it shows a spinner and “Getting ready…” beneath the symbol. No activity artwork or game animation appears before the spoken instruction finishes.
3. **Instruction content:** Each script tells the child what action to perform and states the number/scope of targets. Scripts are plain-language and complete without reading the screen. Where needed, scripts name the initial target items.
4. **Automatic start:** Once data and audio are ready, narration starts automatically. When narration ends, the current activity board appears and accepts input without requiring another tap.
5. **Failed instruction audio:** Missing, load-failed, or rejected/errored playback leaves the instruction view visible, with the complete adult caption and two controls at least 240 by 72 CSS pixels: “Try voice again” and “Start activity.” Retry replays the same clip. Start activity reveals the board after an adult can read the caption. No failed-audio path silently drops the child into an unexplained activity or traps the user.
6. **Replay during play:** The activity has a visible speaker control with a minimum 64-by-64 CSS-pixel hit target. Using it hides/disables the board while the original instruction replays; after playback the same board returns with the same session, progress, arrangement, and mechanic state. If replay fails, the board returns immediately with that state intact.
7. **Completion entry:** Only after the final correct interaction and existing 900 ms delay does the completion view appear. It shows the existing themed “Well done! 🎉” and star celebration, and starts the shared spoken “Well done!” clip once.
8. **Completion timing and fallback:** The celebration remains visible for at least two seconds and until the clip ends, whichever is longer. If the clip cannot play, the celebration remains visible for two seconds and completion still succeeds.
9. **Return to selection:** After the celebration duration, the app returns automatically to the activity list at its previous scroll position when available. It does not require a tap, show a feedback/rating request, or start another activity.
10. **Audio coexistence:** No existing sound effect overlaps the spoken completion phrase; existing success/error sound behavior is otherwise preserved.
11. **Voice/configuration:** The active pre-generated voice pack and references are data/configuration. Switching to another complete pre-generated pack does not require gameplay logic changes.
12. **V1 exclusions:** No browser/device speech synthesis, runtime text generation, remaining-item narration, inactivity narration, or wrong-answer narration ships in V1.

## Architecture note

The canonical architecture's “Pre-generated everything” rule remains in force for V1. This design adds generic, pre-generated activity narration within the existing content/audio path; it does not introduce runtime generation. Browser/device speech synthesis is a separately gated future experiment and will require the architecture and MVP documents to be reconciled before implementation.

## Out of scope

- Remaining-item callouts or naming items as they are found.
- Inactivity narration, wrong-answer narration, or additional praise variants.
- A voice-audit tool, child-facing voice selection, or an adult audition dependency.
- Runtime text-to-speech and arbitrary use of installed device voices.
- Per-child names, personalization, cloud services, or network speech APIs.
