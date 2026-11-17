# Native review during whole-game simulation

November 17, 2026. This ledger supplements [automated coverage](simulation-coverage.md); it does not replace it or approve the new art direction.

## Environment and boundaries

Safari on macOS, operated through native UI controls, at a 1366 × 768 outer window. The compact check used 1024 × 768 and restored the original size. The isolated in-memory event on port 4184 had 99 authenticated HTTP/SSE bots and one native player. For the social check, a normal invitation takeover replaced one bot with a second native player in a private Safari session: 98 bots plus two native players. Neither the saved demos nor the paused art-review event on 4182 was changed.

The primary player joined normally, completed setup and all five practice steps, and earned the progress below through visible controls. No player position, clue, inventory, score or completion was assigned. The host used recorded pauses and advances for review; this is not a normal-duration or human-speed test. Bots clustered through normal movement requests. Replacing a controller briefly reduced the connected count before reconnecting the same identities.

The initial client was loaded while fixes were being developed. A chapter-two refresh loaded `87c1c37`; the two-player trade rerun loaded `5f413d2`; chapter seven loaded the payment-copy change `84231be`. Source hashes accompany the screenshots. The review server was started before the paused-scoring guard fix: rejection of those invalid host states is proved by the separate current-code regressions, not this native event.

## Observed player paths

| Area | Actual native result |
| --- | --- |
| Entry and controls | Invitation, character/robot choice, reduced motion, all five practice steps and Ready worked. Arrow movement earned its practice check. Inventory, rules, Help and Map were reachable; unopened districts gave useful feedback. |
| Accessibility | Extra-large text remained usable in the lobby, Move Day, learning dialogs and menus. Duplicate and whitespace key bindings were rejected. Saved UJNK/F/O/P/L bindings changed hints and menu shortcuts and survived refresh; defaults were restored. Remapped movement was pressed but not separately position-measured. |
| Move Day | Three real deliveries: protected cable +20, shortcut essentials +8, protected parts +17. Supplies changed exactly; the home lit after the first delivery. Main 45 + challenge 10 + both learning answers 20 = 75. Early challenge submission was rejected. N clue earned once. |
| Filters | Six sites completed, including an incorrect size followed by a correct retry. Main 60 + challenge 10 = 70. Three stored filters and three reserve filters were consumed. E clue earned. Current native learning checks were not repeated for this chapter. |
| Identity | I clue earned. The exact previously reported impersonation question awarded 10 points with an explicit correct-answer receipt. A wrong first answer to the second question followed by a correct practice answer stayed at zero. One inspected main site completed; chapter ended at 1/6 and 20 points after host advances. |
| Recovery | G clue earned. Two real recovery tasks completed, consuming food and then a traded part; 2/6 and 20 points. A registered assist did not establish an earned assist because this main objective remained unfinished. |
| Targeting | H clue earned. Friendly robots, marker labels and deliberate selection were visible. Six selected-auto hits cleared one site for 20 points. A deliberate decoy at the next site lost 5; a manually selected Space-confirmed target then counted. Final native main progress was 1/3, score 15. Full eighteen-hit completion is covered by the client adapters and the 100-player event, not this native route. |
| Payments | First payment on time retained 40; second paid on time and spent 20 on the optional decoration, retaining 60. The third was deliberately late: progress recorded, no on-time points, 90 retained. Main 40 + learning 20 + challenge 10 = 70. B clue earned. The next-cycle confirmation was disabled before its opening. A host broadcast preserved a selected learning answer across real SSE updates. |
| Rewards | In the persistent 100-player event, O clue and two real jobs earned 20 points and 4 tokens before the clock expired (2/7). Zero-token projects were visibly locked with an explanation. A separate fresh rewards rehearsal is recorded below. |
| Routing | All three homes connected with costs 8, 8 and 12. A deliberately broken route lost 5 points without progress, and its retry succeeded. Main 55 + challenge 10 + learning 20 = 85, 3/3. R clue earned. |
| Mystery | The same identity earned all eight letters through the visible UI across the eight chapters. An incorrect full answer retained usable controls; Backspace and Clear worked. Selecting NEIGHBOR with the letter buttons solved it. Refresh retained all eight clues and solved status. This is pointer acquisition under recorded host advances, not a separate keyboard-only or normal-duration pass. |
| Finale | With 59 normal bot contributions, Tab focused Restore a home and Return supplied repair 60. Success, the amber individual marker and disabled repeat were visible and survived reload. Awards rendered afterward. The native event intentionally had incomplete/unplayed bot objectives, so most prizes were unawarded; the full HTTP events supply fifteen-winner evidence. |

## Fresh rewards completion

A separate ordinary single-player chapter-seven preview on port 4186 supplied a clean redemption review. The helper explicitly starts at chapter seven; earlier chapters remain unplayed. The player completed setup, all five practice actions and Ready before the helper started the chapter. No job completion, tokens, scores or supplies were assigned.

Six inspected jobs consumed two cables, two parts and two food, leaving 1 part / 3 filters / 1 food / 1 cable. They earned 12 tokens and 60 points. Buying the garden for 4 completed the objective at 7/7 with the score still 60 and 8 tokens left. Its repeat purchase was disabled; the 12-token celebration was unaffordable. Buying the welcome station for 8 left zero tokens and still 60 points. Both projects appeared in the plaza and remained after refresh with the saved balance and completion. Native celebration redemption was not repeated; the mixed and full events exercise it.

The final combined suite passed **275/275** on pinned Node v24.20.0, with no failures or skips: [output](../test-results/simulation-final-suite-344e41f.log). [Final client hashes](../test-results/simulation-native-source-84231be.json) identify the actual client files, including the feedback module.

## Two-player social check

The first offer exposed a real problem: confirmations were below all 99 roster rows. Fix `5f413d2` puts active offers first and uses names/“You” instead of internal IDs. Both native sessions were refreshed before the successful rerun.

The primary player offered one cable for one part. The first confirmation showed **1 of 2** without transferring supplies. The second player confirmed the same quantities; its inventory became 2 parts / 3 filters / 3 food / 4 cable. The primary player received one part, subsequently consumed it in a real recovery task, and both inventories survived refresh. The initial unconfirmed offer was absent after the reload; this observation alone does not identify the exact cancellation trigger.

The second player registered an assist, with explicit feedback that credit requires the unfinished objective to be completed. A recipient saw **Wave** next to the sender in Neighbors; it expired later. The map stayed free of emote/name overlays. After closing the second native tab, the bot controller reattached through ordinary invitations without changing the primary player.

## Operations and observed defects

The primary operator logged in in a separate private session, reviewed the frozen rules/fingerprint, paused with an explicit reason and audit entry, opened safe presentation, returned with host privileges intact, and advanced paused chapter-two bragging into chapter three. The presentation showed the public neighborhood and friendly-robot policy without operator controls. Dedicated read-only token authentication remains HTTP-test evidence.

A host rescue was issued after a clue dialog had already opened. Its old-location inspection correctly failed with “Move closer”; closing and travelling back earned the clue normally. This did not reproduce an in-flight route replan. The independent actual-frame regression supplies that proof.

Native review also found sidebar scroll carried into the next phase. The fix resets it only on phase/chapter changes; the chapter-two transition was inspected afterward with its heading and instructions visible. The late-payment receipt was accurate but indirect about points; `84231be` adds “No on-time points earned” for a validated unsuccessful cycle, with targeted current-code checks.

The controller compared frozen exports before and after its 59 contributions and reported no change. The saved native export was captured after the human supplied repair 60; it does not separately establish a byte comparison across that native action. Current automated finale tests cover that invariant.

## Visual evidence

- [Original reported question now credited](../test-results/simulation-original-quiz-fixed.png)
- [Extra-large Move Day delivery and home repair](../test-results/simulation-move-day-delivery-extra-large.png)
- [Trade hidden below the roster, before](../test-results/simulation-trade-hidden-below-roster.png) and [offers first, after](../test-results/simulation-trade-visible-before-roster.png)
- [Recipient emote](../test-results/simulation-recipient-emote-active.png)
- [Compact paused view](../test-results/simulation-compact-paused-crowd.png)
- [Fixed phase scroll position](../test-results/simulation-phase-scroll-fixed.png)
- [Safe targeting](../test-results/simulation-safe-targeting.png)
- [Late-payment result before the explicit no-points wording](../test-results/simulation-late-payment-feedback.png)
- [Earned garden](../test-results/simulation-rewards-garden.png), [balance and purchase locks](../test-results/simulation-rewards-balance-locks.png), and [both projects after refresh](../test-results/simulation-rewards-persisted.png)
- [Safe presentation](../test-results/simulation-presentation-paused.png)
- [Final network detour](../test-results/simulation-network-detour.png)
- [Earned mystery](../test-results/simulation-mystery-earned.png) and [clues after refresh](../test-results/simulation-mystery-persisted.png)
- [Chapter eight with 99 nearby](../test-results/simulation-chapter-eight-complete.png)
- [Finale before contributions](../test-results/simulation-finale-before.png), [success](../test-results/simulation-finale-success.png) and [awards](../test-results/simulation-native-awards.png)

The overview draws **at most** three nearby companions. At a fully occupied approach it can draw none, protecting doors and markers; the nearby count and full Neighbors roster remain available. Move Day uses its separate three laybys. Screenshots demonstrate legibility for these arrangements, not frame-rate performance on every device or room readability. Later chapters retain the existing overview pending Jim’s review of the representative Move Day art.
