# Second Nature Trail · expedition demo design

Design delta, 2026-11-17. Uses the installed [retro design skill](/Users/jgibbs/orca/workspaces/my-brain/butterflyray/.agents/skills/retrogame-designer-expert/SKILL.md) and its Second Nature application brief. This document adapts the GDD template to the existing Canvas/DOM game. It is a design and implementation specification, not new release evidence. The current authoritative rules remain in [content.mjs](../content.mjs); [design.md](design.md) and [scope.md](scope.md) retain the event contract.

## 0. Vision and diagnosis

An expedition through a neighborhood whose systems have stopped serving people. Pack useful supplies, choose a route through the AI's bad decisions, and help residents get home. The Oregon Trail influence comes from the cart, the journey, decisions with understandable consequences, and a record of what happened. The Second Nature payoff is visible recovery: useful services, repaired homes, and neighbors helping neighbors. The tone is resourceful and dryly funny, without horror or punishment for inexperienced players.

Source review and the retained November 10 desktop screenshot show five problems: identical healthy-looking homes obscure district identity; repeated beacon plaques dominate the world; supplies are hidden in a modal; the sidebar gives five activities similar visual weight; and a main-action callback immediately closes or replaces the dialog containing its feedback. Delivery responses supply no narrative message at all. The underlying cargo, route, supplies, timing, and recovery systems already exist. This pass makes those systems legible.

The representative loop is **pack → choose route → walk to checkpoint → inspect crossing → deliver → read receipt → choose the next trip**. A persistent result makes the action matter before another dialog or automatic trip replaces it. The rest of the game receives the same visual hierarchy and truthful feedback treatment without changing its rules.

## 1. Identity and rendering

| Field        | Specification                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title        | Second Nature Trail                                                                                                                                                                                                  |
| Variant      | Expedition demo polish of the existing game                                                                                                                                                                          |
| Genre        | Cooperative neighborhood expedition with individual timed objectives                                                                                                                                                 |
| World        | One shared 1200 × 800 logical-pixel Canvas, sixteen activity buildings, eight districts, central square                                                                                                              |
| Rendering    | Existing Canvas 2D rectangles and DOM controls; no engine migration                                                                                                                                                  |
| Display      | Fit the actual Canvas element at 3:2 using ResizeObserver; preserve readable whole-world navigation at desktop and compact sizes. Pointer conversion uses that actual element's bounds, excluding surrounding space. |
| Frame target | 60 Hz where supported; requestAnimationFrame already drives rendering. This document makes no new measured FPS claim.                                                                                                |
| Platform     | Existing desktop/laptop browser support and keyboard/pointer equivalence                                                                                                                                             |

## 2. Palette and visual grammar

The client implementation uses the following agreed palette. Controlled districts read as dusky slate/teal with amber machine signals; recovered districts become warmer and greener. Recovery remains a text-and-shape state as well as a color change. Do not place a full-screen dimming layer over text or player controls.

| Semantic role                | Hex                                        | Treatment                                         |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Ink                          | `#142b35`                                  | Readable outlines and dark text                   |
| Night frame                  | `#102631`                                  | Header and expedition frame                       |
| Field journal                | `#f7f2df` / `#f5efdc`                      | Dialogs and mission panels                        |
| Muted text                   | `#52615d`                                  | Secondary explanation on light panels             |
| Recovery signal              | `#b9e5a5` / `#b9d9b0`                      | Confirmed progress and recovered district details |
| AI amber                     | `#e9a667`                                  | Machine interference on infrastructure            |
| Ground / district            | `#304b4b` / `#3b5552`                      | Controlled neighborhood                           |
| Asphalt / shoulder / marking | `#717f78` / `#a9ac91` / `#c9c8a5`          | Continuous traversable street bands               |
| Controlled walls             | `#71827c`, `#657d7c`, `#7b8580`, `#6b7b83` | Homes awaiting recovery                           |
| Machine roof                 | `#263f48`                                  | Controlled infrastructure                         |
| Warm window                  | `#f2d28a`                                  | Recovered homes                                   |

These are semantic anchors, not a claim that the renderer uses only these colors. Avatar palettes and skin tones remain intact. Additional state colors belong beside their renderer constants and must be reconciled here after implementation.

## 3. Sprite and environment inventory

The existing game draws original procedural sprites; it has no texture atlas. Preserve established house, doorway, road, and scenery clearance bounds.

| Asset                   | Existing geometry / state                                                                                     | Demo treatment                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twelve avatars          | Approximately 17 × 32 logical pixels including accessories; world scale 1.5; one static drawing per character | Retain identity and six shirt palettes; distinguish the local player without obscuring destination labels                                                                   |
| Homes                   | 90 × 65 body; roof/body/shadow union approximately 102 × 85; entrance path 12 × 35                            | Three roof profiles and eight service facade motifs remain inside the safe footprint; center doors remain clear                                                             |
| Trees                   | Full canopy/trunk/shadow 36 × 44                                                                              | Keep verified placement; new scenery must clear the entire silhouette, not just the trunk                                                                                   |
| Repeated beacon objects | Removed in the November 17 map correction                                                                     | They implied an interaction that did not exist. Actual recovery belongs in homes/infrastructure and the field report.                                                       |
| Cart / cargo            | A 21 × 19 decorative loaded-cart drawing beside the local avatar, driven by accepted chapter-one cargo        | The expedition UI shows the selected manifest and four-slot capacity; the drawing adds no collision or resource state                                                       |
| Destination             | Existing `!` / `?` marker and selected-destination outline; shortened 15px site names on 21px backed signs    | Main destination takes priority. Redundant map chapter badge removed to avoid painting over signs; full destination remains in task text.                                   |
| Recovery                | Lit windows, building repair detail, reward projects, 6 × 6 finale markers in a compact grid                  | Make before/after visible while keeping the existing restoration denominator. The local repair has an outline and a DOM legend; decorative repeated road debris is removed. |

District motifs are depot crates, filter vents, identity verification insignia, insurance repair materials, safe response equipment, payment terminal, reward stall, and exchange equipment. These are decorative, not new interactive objects. All insect-related artwork continues to obey the existing replacement preference, including previews and presentation.

## 4–5. Assets and layers

No new atlas, camera, parallax, or scrolling system. Paint terrain and district plots before the continuous streets; place structures, scenery, labels and repair markers outside the street and shoulder corridors. Active objectives, avatars and the selected destination are interactive foreground markers, not street-blocking decoration. DOM status, supplies, and instructions stay outside the map's painted scene.

Jim's November 17 correction requires continuous asphalt and shoulders, with no buildings, roofs, nameplates, plot fill, repeated rubble, or noninteractive beacon placards painted over them. The existing horizontal street bands crossed immutable house footprints; merely changing their color cannot fix that. Relocate the visual street bands and associated artwork into actual open corridors while retaining every authored door, checkpoint, obstacle and movement rule. The cargo crossings stay at `(230,60)` and `(230,160)`. Verify both paint order and `clipMove`/`isWalkable` against the unchanged collision geometry.

The implemented street envelopes, including shoulders, are horizontal `(0,230,1200,28)` and `(0,470,1200,40)`, and vertical `(375,0,40,800)` and `(790,0,40,800)`, expressed as x/y/width/height. District grounds precede road painting and stay outside these bands. Front-yard nameplates start 24 pixels below each door; plaza artwork ends above the lower street. The exact constants are exported from `public/scenery.mjs` and checked against actual renderer primitives.

## 6. Scene and state contract

| Surface         | Purpose / transition                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Entry           | Establish the expedition premise and private invitation flow                                                     |
| Setup           | Existing identity, character, required visual preference, accessibility settings                                 |
| Draft / lobby   | Existing five real practice actions and Ready; no competitive score                                              |
| Countdown       | Existing shared ten seconds, included in chapter one's five minutes                                              |
| Chapter         | One dominant next action, visible supplies, personal objective progress, secondary activities                    |
| Encounter       | Existing action options and explicit confirmation                                                                |
| Receipt         | Accepted outcome, actual changes, next action; stays readable until dismissed or the authoritative phase changes |
| Brag break      | Existing standings, award results and next-chapter preview; frozen movement/scoring                              |
| Finale          | Frozen award inputs, cooperative home repairs, actual ending                                                     |
| Awards / closed | Existing results and ending; closed clock remains ENDED                                                          |
| Paused          | Show the saved display phase but preserve actual paused state and disabled actions                               |

Only views and accepted responses supply state. Stale chapter/phase/stream responses cannot reopen a receipt or start travel. A receipt must not invent an event, change a saved score, or imply that opening/closing a dialog pauses the shared clock.

## 7. Mechanics retained

Movement remains 190 logical pixels/second, with existing continuous collision and pathfinding. Players pass through one another. Setup-complete players may move in draft, lobby, chapter, and finale. Other phases keep their current restrictions. No jumping, shooting, damage, health, lives, starvation, random encounter rolls, or new scarcity system is introduced.

The twelve-item tradable storage persists across chapters. The four-slot delivery load is separate: parts and cable each weigh two slots; food weighs one. Each chapter has its own six-per-item personal reserve, consumed only when the corresponding tradable item is unavailable. Reserve items cannot be traded and do not count toward the hoarder prize. Do not present these reserves as one dwindling event-wide stock or call the twelve-item storage a four-slot inventory.

Chapter one has three deliveries. Available load values are 10, 11, and 12 from the frozen rules. The paved detour preserves value; the shortcut subtracts two value units per item, deterministically. Loading selects a manifest; supplies are consumed on delivery. A packing receipt therefore reports a selected load, not supplies already spent. The checkpoint inspection enables delivery, and delivery advances personal trip progress. Three completed trips contribute one completed objective to shared recovery.

The shared district denominator comes from `event.restoration.perDistrict`, frozen from participants when the event starts. The retained saved demo has twenty participants; the new isolated walkthrough defaults to one. Neither count is a UI constant. Personal `1 / 3 trips` must never be confused with `1 / 20 neighbors completed` or `5% district recovery`. Partial shared completion changes district tint and building repair detail; full warm facades require complete district recovery.

Other chapters retain six-site inspection/deduction, three timed targeting sites with six valid hits each, three fictional payment cycles, reward earning/redemption, and three constrained network routes. All authored questions, keys, targets, deadlines, trade rules, assists, secrets, and mystery rules remain unchanged.

## 8–9. Score, progression, and consequences

Read all values from the public rules projection rather than new UI constants. Main objective maximum remains 60 points: three delivery/targeting/routing/payment steps at up to 20, or six spatial decisions at 10. The optional challenge adds 10, two correct first learning answers add 10 each, and the chapter assist cap is 5. Published mistakes subtract 5 with a zero floor. Existing chapter-specific ranking metrics and eligibility remain distinct from points.

Receipt hierarchy: **what happened → actual consequence → next destination**. Show confirmed score and supply changes where they exist; no change is a legitimate result. Totals are explicitly historical, labeled “After this action”; later accepted assist/trade updates change the live HUD without replacing the receipt or stealing focus. If a newer personal projection already superseded the HTTP response before its receipt could open, show a neutral saved-action notice and the latest field panel instead. Wrong choices keep their retry path and penalty explanation; wrong optional challenges return to that challenge. Inspection reveals evidence directly; ordinary targeting rounds retain inline feedback, with a report at site completion. A completed objective clearly ends its main loop. Opening a receipt is not another scored action.

Eight five-minute chapters and eight two-minute breaks lead to the four-minute finale. Fifteen awards, their allocation order, tie breaks, and frozen-input boundary remain as implemented. No new win/lose condition is added.

## 10. HUD and interaction hierarchy

1. Header: title, connection, authoritative phase and timer.
2. Current expedition: chapter title, one sentence of purpose, one dominant stage-aware action.
3. Personal progress: chapter one trip count and current pack/route/inspect/deliver stage; other chapters retain their actual step totals.
4. Supplies: always-visible counts for parts, filters, food, and cable; clearly separate personal reserve details and selected cargo.
5. Shared recovery: actual district/neighborhood progress, never a fabricated danger meter.
6. Secondary actions: learning, challenge, secrets/mystery and social tools remain accessible with explicit labels.

Use existing readable DOM text and visible focus, rather than bitmap-only body text. Existing text-size settings remain effective. Return focus to the receipt's primary action after a successful command; closing returns to the map. Never steal focus from another modal/input because an SSE update arrived. Pointer and keyboard must reach the same actions; no drag, hover, double-click, or rapid-input dependency.

## 11–12. Audio and atmosphere

Retain optional audio and visual equivalents. Current synthesis is a sixteen-note triangle-wave melody at 320 ms per step and a short 660 Hz acknowledgement; this is implementation description, not a new composition specification. Music and effects volumes remain separate. Sound changes are lower priority than visible consequences and require their own verification.

CRT scanlines, vignette, phosphor bloom, cabinet bezel, coin insertion, attract-mode death, shooter enemies, and all-caps body copy are not applicable to this expedition. They would obscure the readable employee experience. Do not add flashes or compulsory movement animation; reduced-motion behavior remains supported.

## 13. Delta and developer checks

This pass changes presentation, hierarchy, and feedback. No server rule/content hash, score calculation, collision, host authority, save schema, session identity, visual-preference safety, or event schedule change is authorized by the visual specification.

First verify one full chapter-one sequence: load selected → detour/shortcut disclosed → checkpoint reached → delivery accepted → receipt shows actual score/inventory/reserve effect → next trip works → three trips finish → shared contribution increases once. Check both input methods, wrong/rejected requests, refresh in each stage, stale/paused phase callbacks, and completion focus. Then apply the common treatment to the other existing encounter types without flattening their distinct controls.

Visual checks are separate: entry/setup/world/encounter/receipt/host/presentation at desktop and compact widths; safe mode; readable labels and hierarchy; whole-map scenery clearance; no false “all restored” appearance on a partially completed district. Root owns rendered inspection. Automated tests are developer evidence, not employee or device rehearsal. Hosting stays deferred.

Developer verification for this delta covers the actual client callback flow through the real engine, including double confirmation, pending-dialog dismissal, stale phase/chapter/epoch responses, newer SSE totals, focus, full three-trip completion, spatial retries, optional-challenge retries, and fictional payment feedback. Geometry checks cover every street and shoulder against unchanged collisions, all eight active districts at zero/partial/full recovery, all sixteen facades/signs, and all one hundred personal finale outlines. Root separately inspected the finished chapter-one walkthrough, chapter-two wrong/correct feedback, and corrected desktop/compact road views. Exact screenshots and the combined-suite result belong in the associated evidence report; these focused checks do not renew the historical full-capacity measurement.

## 14. File map and handoff

- `public/app.js`: scenes, controls, Canvas drawing, encounters and feedback.
- `public/style.css`: visual hierarchy, responsive layout, typography and accessibility.
- `public/scenery.mjs`: established safe scenery placement.
- `public/trail-feedback.mjs`: presentation-only delivery facts and guarded shared accepted-action receipts; no scoring authority.
- `public/trail-visuals.mjs`: scene copy, shortened site labels, stage labels, and aspect-preserving display sizing.
- `scripts/demo-local.mjs`: isolated in-memory walkthrough with ordinary host commands and clocks; [demo.md](demo.md) describes it. It never opens the saved user event.
- `public/world.mjs`: unchanged movement/collision geometry.
- `engine.mjs`, `content.mjs`, `server.mjs`: unchanged authoritative contract; any presentation helper must preserve it.
- `test/`: focused helper/actual-renderer/interaction regressions added with the implementation.

**Canvas implementation handoff (Phaser not applicable):** derive UI from ordered projections; keep receipt state distinct from scoring state; distinguish storage, manifest and per-chapter reserve; use the frozen shared denominator; keep all decorative bounds clear; preserve actual phase guards and keyboard focus. Reconcile this specification with the integrated implementation before recording the pass as complete.
