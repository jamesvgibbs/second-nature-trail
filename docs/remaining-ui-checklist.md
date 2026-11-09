# Remaining UI rehearsal routes

Prepared 2026-11-09 from the current client/content and existing [controls matrix](controls-matrix.md) and [browser ledger](browser-checks.md). This is a checklist, not new pass evidence. The main-objective/knowledge matrix is recorded separately; do not repeat those passes here or assume they cover optional actions. Record revision, browser, method, actual result, refresh persistence, and artifact for each remaining route.

## Optional challenges and secrets

For each input method, use **Try the harder challenge → select the answer → Confirm** after actually completing that chapter's main objective. Expect +10 points and **✓ Challenge complete**. An early attempt must report that the main objective is required; reopening a completed challenge must not add points. A wrong challenge answer costs 5 points, so test that separately from a clean-success score comparison.

Use **Look for a secret → Inspect this spot** at the same second location. A secret does **not** require main completion. Expect **✓ Clue discovered**, one new chapter letter in **The neighborhood mystery**, no supply/score increase, and no duplicate letter on repeat. Refresh and verify persistence. Use Tab/Enter/Escape for keyboard, visible buttons/× for pointer; no pointer recovery in keyboard runs.

| Chapter | Challenge and secret destination | Correct challenge choice | Clue |
|---|---|---|---|
| 1 | Broken highway | Two trips with at most two units | N |
| 2 | Ventilation maze | Match dimensions to the vent before installing | E |
| 3 | Counterfeit town hall | Contact the organization through a known channel | I |
| 4 | Disaster block | The policy terms and actual circumstances | G |
| 5 | Pest-control HQ | Solid marked target | H |
| 6 | Payment station | Pay 70 and defer the purchase | B |
| 7 | Night market | Read the terms and choose a usable reward | O |
| 8 | AI headquarters | Exchange → relay, then one branch to each home | R |

These are authored QA expectations, not evidence that anyone discovered the answers. Optional challenges can use independent chapter previews, provided the main objective is completed through the UI in each preview. Seeding main completion would only prove conditional challenge controls and must be labeled synthetic. Existing completed preview progress cannot be presumed available after its server has stopped.

## Legitimate multi-chapter mystery

This needs **one persistent identity in one event across all eight chapters**, repeated with a fresh identity/event for the other input method. Independent chapter previews and the preloaded-clue mystery fixture cannot establish it.

1. Start an isolated chapter-1 waiting preview with the existing helper. Complete setup/practice and start normally. Use replacement mode. Never change player clues, progress, or mystery state through an API, console, database, or fixture.
2. Acquire chapter 1's secret through its UI. In the mystery dialog, exercise the available letter, Backspace, and Clear answer. Submit an incomplete answer and verify visible in-dialog feedback without closing or losing focus.
3. For a short **accelerated host-operated UI rehearsal**, use a separate operator session's **Advance to next phase → reason → confirmation** after each secret. Inspect the brag/next-chapter preview, then advance once more to the next chapter. Keep the same player session and acquire every next secret normally. Do not use Skip chapter. Record every host advance; this is legitimate UI acquisition under accelerated phase control, not normal event duration, balance, or prize evidence. Alternatively let all normal timers run.
4. In chapter 8, acquire R and solve **before ending that chapter**. Keyboard: type NEIGHBOR and submit with Enter. Pointer: click the eight discovered-letter buttons in chapter order, then **Reveal the message**; do not type. Exercise Backspace/Clear first, and check one incorrect full answer retains usable controls.
5. Expect the authored success message and **✓ Mystery solved**. Refresh and confirm all eight letters and solved status remain. A fresh identity must still have no inherited clues. Never describe the earlier preloaded-clue fixture as this pass.

Challenges can be combined with this route only by completing every main objective through the UI before its challenge; secrets alone do not unlock challenges. A two-player event can also supply the social checks below, but each method needs its own uncontaminated mystery evidence.

## Other remaining surfaces

| Route | Concrete browser checks | Fixture/session requirement |
|---|---|---|
| Social help | Two players near each other: B asks **Help with my task** while unfinished; A chooses **Neighbors → B → Help**. Verify registration feedback, then B actually completes its objective. Check recorded assist after completion, no duplicate credit, and useful too-far/already-complete feedback. | Two independent browser sessions; joining both identities in the same cookie profile would replace the first login. Main completion must be real UI work for earned-assist evidence. |
| Barter and inventory | A offers one cable for one part. Verify incoming notification, both players see identical quantities, first confirmation does not transfer, second confirmation changes both inventories exactly once. Refresh both. Repeat with cancellation, changed inventory, disconnect, takeover, and chapter boundary; stale offers must not transfer. For supplier qualification, consume the received item in a real task and inspect recorded results; a completed trade alone is insufficient. | Same two sessions; record before/after counts. Test stale/invalid paths in an isolated event. No request injection needed for ordinary UI cases. |
| Emotes/help/map | Send each preset/emote; see the other player receive it. Open every district from Map, inspect inactive-district feedback, close with the assigned method, and regain map focus. Help/rules remain reachable without pausing the timer. | Any ordinary two-player preview; inspect real peer updates rather than only the sender's toast. |
| Remapping/settings | In Settings remap up/left/down/right/interact/inventory/map/help to u/j/n/k/f/o/p/l, respectively. Save; test movement with map focus, interaction, all three menus, updated hints, and refresh persistence. Verify duplicate/empty bindings are rejected. Test 16/20/24 text, reduced motion, keyboard and pointer selection, independent music/effects volumes, and mute by listening. | Ordinary preview; restore defaults through the UI afterward. Do not infer audio behavior from source or silence while muted. |
| Operator dashboard | Check live joined/ready/reconnecting labels with real player connect/disconnect. Review frozen rules/content fingerprint. Exercise start/cancel countdown, pause/resume, broadcast, rescue, shorten, and advance with reasons; verify player and display effects and audit entries. Backup operator can act after primary disconnect; verify owner label reflects the latest operator action. Test Skip chapter's unranked state and End scoring/Close in a separate destructive rehearsal. Export only after results freeze and inspect the downloaded file. | Separate primary/backup operator cookie sessions. Existing HTTP tests do not prove rendered buttons, feedback, focus, or room usability. Use an isolated ordinary server for full draft-to-lobby checks; the chapter helper already opened its lobby. |
| Presentation | Dedicated read-only login, no private roster/invites/operator controls. Check lobby, countdown, chapter, pause, all brag previews, finale, awards, reconnect and fallback ending. Test opening presentation with an existing host session does not strip host privileges; use a separate session for dedicated display login. Verify text from the actual back of the intended room. | Presentation-safe content regardless of player insect preference. Room readability needs the real display/room, not a desktop screenshot. Full fifteen-award rendering may use an explicitly labeled fixture, without claiming its awards were earned. |
| Finale | Keyboard contribution, disabled repeat, visible individual repair, refresh persistence, success and fallback endings; inspect reward decorations and unchanged frozen awards. | Real contribution through UI; isolated fresh events for alternate endings. Earlier pointer observation does not certify keyboard or all endings. |

## Safety and platform checks

The [surface inventory and failed-enable sequence](controls-matrix.md#insect-replacement-surface-inventory) already specify the full sweep; retain that ledger as the source of truth. Remaining rendered checks include failed/disconnected insect enable, immediate replacement without Save, out-of-order enable/replacement responses, reload/reconnect/takeover before and after authoritative state arrives, chapter-5 target rounds, secrets/mystery, brag previews, awards, dedicated presentation, and audible effects. A browser cannot prove delayed-response ordering unless the delay/failure is actually induced and recorded; helper tests remain separate evidence. Use only isolated review servers/sessions, never the active capacity process or the user's preview.

The legitimate eight-secret route can inspect all secret panels and previews in replacement mode. Independent chapter previews can cover targeting, settings, remapping, ordinary social actions, and individual optional challenges. Device/browser rejection, supported desktop browsers, smallest agreed laptop FPS, actual network conditions, and room presentation remain separate platform/rehearsal gates. No checklist completion substitutes for those measurements or content approval.
