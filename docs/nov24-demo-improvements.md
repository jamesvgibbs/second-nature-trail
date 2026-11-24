# November 24 demo improvements

Personal arrival history and an occasional shortcut wheel repair extend the existing local game. Cargo values, score calculations, world collision geometry and existing saved progress retain their meanings. User-owned visual acceptance notes and earlier evidence are preserved.

## Design

A destination is **Reached** only after an accepted movement endpoint or an accepted physical task/challenge/secret interaction within 65 world units. Clicking a destination, starting a route, peer activity, restoring old position data and operator rescue do not invent visits. Each player's first arrival is recorded separately from objective completion and shared restoration. The neighborhood Map shows full destination names with Reached/Unexplored text; personal canvas badges show ✓/?. Public presentation has no personal badges.

The 14×18 badge sits beside each existing sign, clear of front walks, trees, streets, repair marks and the objective marker. Town Hall uses the right side; the canvas label DISASTER leaves room for its left badge while the accessible Map retains the full name. Badges use 16px type; existing sign type remains 15px. Shortening the sign adjusts its decorative front-walk junction without changing the playable world.

The rubble shortcut has a one-in-four loose-wheel outcome, resolved only when the normal crossing action is accepted at its checkpoint. A server-only seed, player identity and trip index determine a stable HMAC bucket. Refresh, retry and transaction rollback cannot reroll that crossing. Before arrival, the UI gives the general shortcut risk without revealing the future outcome. The paved detour never triggers this incident.

An unlucky crossing enters **repair**, with the cart wheel visibly displaced and a saved journal instruction. The normal repair action reseats the wheel before delivery. It consumes no extra supply, adds no bonus or penalty, and preserves the existing shortcut cargo damage. Pending, rejected or paused repair requests leave the wheel broken. The accepted journal survives page-local state loss and server restart. Existing trips gain no retroactive incidents or inferred visits.

## Automated evidence

Tests run actual Engine actions and extracted actual client handlers. UI fixtures place actors at validated targets explicitly; they prove action/feedback contracts, not browser navigation or rendered layout. Engine navigation tests use the real pathfinder/movement action. HTTP tests use isolated temporary SQLite databases and authenticated sessions.

| Area | Checks |
|---|---|
| Arrival and privacy | `nov24-engine.test.mjs` exercises real movement, interaction, rescue exclusion, first-arrival idempotence and legacy restoration. `nov24-arrival-boundary.test.mjs` checks 70-unit midpoint marks neither neighboring door, 65-unit endpoints mark only the appropriate door, and one player's history does not appear in another player's peer roster. |
| Durable acceptance | `nov24-durability.test.mjs` forces SQLite write failure on arrival and crossing. Position, visit, crossing stage, request cache and action log roll back; the identical request/sequence can retry. Disk state is checked before success is accepted, then reopened. Duplicate crossing/repair commits once. |
| Marker geometry and Map | `nov24-visit-ui.test.mjs` checks all 16 badge rectangles against actual signs, roads, walks, props, trees and objective regions at full/compact scale. Actual Map navigation creates no visits; authoritative arrival refresh preserves the open modal, its revision and focused row. Objective completion alone remains Unexplored. |
| Actual canvas/crowd | `simulation-crowd-render.test.mjs` draws 100-player projections with three recorded sites: exactly 3 checks and 13 question badges, no personal badges in public presentation. Existing self-plus-three crowd limits and unobstructed road/entrance checks remain exercised. |
| Random outcome and legacy trips | Engine tests cover both stable shortcut outcomes, independently recompute HMAC buckets, reject distant crossings, preserve outcomes through restart/duplicates, and retain published paved/shortcut points. Legacy missing fields produce no fabricated history or retroactive repair. |
| Repair interaction | `nov24-wheel-ui.test.mjs` executes actual choice/primary/journal handlers against the Engine. Pointer repair, keyboard on focused controls with saved remapped F, double-submit, pause, rejected-response retry, pending phase change, persistent feedback and accepted wheel paint are covered. Supplies and score stay unchanged by repair; subsequent shortcut delivery yields 10 points / 6 useful value for the repair-parts plan, paved 17/10. |

The original fixed-four-actions-per-trip scenario assumptions were corrected to count the optional accepted repair, with a hard maximum of 15 actions for three trips and exact history/log reconciliation. No scoring expectations were relaxed. Initial failures are retained in `test-results/nov24-demo/developer-suite-initial-failures.tap`. **Final combined suite: 351/351 passed, zero failures/skips/cancellations, 44.32 seconds on Node 24.20.0.** The final TAP is `developer-suite.tap`; tested source hashes are in `qa-source-frame.json` beside it. This is not a new full-hour capacity measurement.

## Native evidence

Root performed actual Safari interaction in isolated durable review events. The clear and unlucky developer identities were selected for opposite first-crossing outcomes; the separate ordinary demo uses an unselected identity. No visits, supplies, scores or completed trips were assigned for these browser checks.

- The normal shortcut repair-parts trip used Tab/Enter and delivered 10 points. Depot/highway became Reached while the chapter remained Partial. Walking to the upcoming Filter depot marked only that destination; Vent Maze remained Unexplored.
- A second native trip selected Essentials with 2+E and the paved route with 1+E; E handled travel, inspection and delivery. It earned 18 points/11 useful value with no incident, bringing the same player to 28 points and 2/3 deliveries (`paved-delivered-keyboard.png`).
- Three legitimate visits, one completed delivery and 10 points survived graceful server restart and page refresh with exact player-state equality: `visit-restart-verification.json`, `visits-after-server-restart.png`.
- Mixed full and compact Map/overview captures show personal visit status separately from objective status. Root inspected 1366×768 and 1280×706 windows; the latter legitimately triggers the minimum-height warning because browser content height is below 640. A 1280×1410 tall-window check is additional evidence, not a substitute for a compact laptop viewport.
- Unlucky-route selection, actual slipped wheel and persisted incident after restart are captured in `incident-route-no-spoiler.png`, `incident-wheel-slipped.png`, and `incident-persisted-after-restart.png`. After normal host resume, native E repaired the wheel; pointer Go home and Deliver then earned 10 points/6 useful value and warmed the home at 1/3. `incident-wheel-reseated.png` and `incident-delivered.png` capture the accepted results.

The curated local gallery is `test-results/nov24-demo/evidence.html`; it excludes intermediate resize/debug frames and labels the compact warning explicitly. The native attempt to observe arrival while Map was open did not reach a destination because the modal suspended autopilot. It is not counted as a native focus-preservation pass; the dedicated actual-handler regression covers that transition.

All artifacts above are under `test-results/nov24-demo/`. Browser evidence is bounded to the recorded surfaces and input methods. Automated DOM/canvas checks are not labeled native rendering or hardware performance evidence.

## Defects found and addressed

Independent geometry checks caught Town Hall and Disaster badge intersections with front walks; the safe-side placement/shortened canvas label resolves them. Native interaction caught the focused Move Day button ignoring E after selection; the control handler now supports the configured interact key on choices, primary action and journal. The prior Map refresh reopened the whole modal; updates now replace only the district rows, preserving focus and the modal revision. These behaviors have dedicated regressions.

## Local review

Open http://127.0.0.1:4232 and choose **Play / continue** under **Play the demo**. Complete setup; the normal countdown starts automatically. The demo identity uses normal unselected odds. The two developer cases retain the completed native checks and can continue from their saved state. Pause/resume controls are on the review page.

The captured evidence is served at http://127.0.0.1:4232/evidence/. The local runner uses ports 4230–4233 and durable SQLite files in ignored `data/nov24-review/`. Start it from the game checkout with Node 24: `node scripts/review-nov24.mjs`. Restart preserves invitations and progress. Existing port-4180 demo state was not restarted or reset.

`served-build-verification.json` confirms exact served/local client source equality on all three new game servers, successful evidence responses, and the original unlucky incident timestamp retained through repair and delivery. The final runner restart also preserved both completed native cases. The normal case is paused at two deliveries / 28 points; the incident case is paused at one delivery / 10 points; the ordinary demo remains fresh in the lobby.
