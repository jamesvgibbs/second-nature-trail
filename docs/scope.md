---
type: project
title: "Second Nature Trail developer scope"
description: "Planning handoff for a hosted browser game with 100 concurrent employees, eight chapters, accessible controls, and fifteen prize winners."
tags: [second-nature, game, planning, developer-handoff]
timestamp: '2026-11-09T00:00:00-05:00'
---

# Second Nature Trail developer scope

status: active — 2026-11-09

Source: Jim Gibbs's planning conversation on 2026-11-09. This is a planning deliverable, not authorization to implement, deploy, purchase services, or contact developers. The title is provisional.

Build an original 8-bit-style browser adventure for Second Nature employees. Up to 100 employees occupy the same neighborhood during a comic AI apocalypse, complete benefit-themed chapters, trade supplies, help neighbors, and compete for different awards. Limited cart space and travel decisions provide the Oregon Trail influence. Use original art, characters, music, and writing.

## Scope authority

Jim's requirements are: planning only; browser delivery; support 100 simultaneous employees; several ways to win; chapter-based play; time to brag between chapters; a meeting from 3:15 to 4:50 with 10–15 minutes for joining; a 60-minute game; normally 10–15 winners; keyboard and mouse help; an explicit phone incompatibility message; and an option during character setup to avoid seeing spiders or bugs.

The release baseline below turns those requirements into a concrete handoff. Exact controls, chapter objectives, scoring, content quantities, and operating targets are proposed defaults for Jim's scope review. Developers should estimate against this baseline and identify changes explicitly. Product facts and final question wording require SN content-owner review before release.

## Release boundary

| Area | Release baseline |
|---|---|
| Audience and capacity | One private event for 50–100 SN employees; 100 concurrent players plus two operator connections and one presentation connection. |
| Platform | Laptop or desktop web browser, keyboard and mouse or trackpad. No installation or extension. |
| Browsers | Test the current and previous stable desktop Chrome, Edge, Firefox, and Safari versions at release; record exact versions in the test report. |
| World | One shared neighborhood with Bragging Square, eight districts, and two named activity locations per district. Interiors may be overlays or compact rooms. |
| Format | Eight timed chapters, individual progress, shared contributions, and a cooperative finale. |
| Reusable activity systems | Collection/delivery; deduction/quiz; timed targeting; routing/planning puzzles. Trading and inventory support the world across chapters. |
| Content | Eight main objectives, eight optional harder challenges, sixteen scored learning encounters, eight chapter secrets, and one multi-chapter mystery. |
| Characters | Twelve ready-made pixel characters with palette choices. No avatar uploads or custom character editor. |
| Social tools | Six emotes, preset help requests, assisted tasks, and voluntary two-party trading. Meeting audio remains in the meeting application. |
| Awards | Eight chapter prizes and seven whole-event prizes, one prize per employee. |
| Delivery | Deployed game and host tools, source repository, content/configuration files, test evidence, operating runbook, and results export. |

Keep the same logical world for all players. Developers may stream nearby characters and effects to maintain performance, but must preserve shared events, named player presence, and accurate contribution totals. Do not silently split employees into unrelated copies of the neighborhood.

## Entry and device checks

The event organizer receives a roster-based invitation workflow that produces one private entry link per employee. An entry link establishes a participant session; it never grants host access. Refreshing, reconnecting, or reopening the invitation restores the same identity. Only one active play connection per identity is permitted; an explicit takeover moves that identity to the new browser. Do not collect passwords inside the game.

Before loading the world, check required rendering, connection, and storage capabilities. Provide a readable failure message and retry action when something is unavailable. A blocked check must not consume the invitation.

On recognized phones and tablets, show a dedicated blocking screen before character setup:

> This game requires a laptop or desktop with a keyboard and mouse or trackpad. Phones and tablets are not supported. Open your invitation link on a computer to join.

Include a copy-link action and short event code. Do not load a broken playable interface or require the phone user to complete setup. A touch-capable laptop remains supported. A small desktop window gets an enlarge-window message rather than a phone diagnosis. Target a usable 1024 × 640 CSS-pixel game area at normal zoom; verify readable menus when text is enlarged.

Device classification must use several signals and tested cases. Neither a touch screen, a narrow viewport, nor a user-agent string alone reliably identifies an unsupported device. Provide an explanatory support path for ambiguous cases without promising phone support.

## Character setup and first arrival

1. Confirm the employee's display name and choose a character. Public labels show names, not email addresses.
2. Ask the required visual-preference question before displaying any insect imagery: **"Show spiders and insects?"** Choices: **"Replace with friendly robots"** and **"Show spiders and insects."** Nothing is preselected; the world remains insect-free until a choice is saved.
3. Offer text size, reduced motion, music/effects volume, and control preference. Settings remain available during play.
4. Enter Bragging Square and complete a short tutorial: move, interact, collect, answer, and request help.
5. Mark the player ready and show the start status. Players may practice without earning competitive points.

The replacement setting covers enemies, icons, shadows, silhouettes, loading screens, tutorial content, decorations, secrets, cutscenes, award cards, and relevant sound effects. Use friendly robots with the same hitboxes, timing, rewards, and difficulty. Switching to replacement mode removes any currently visible insects immediately, before further gameplay frames, and persists through reconnects. No surprise insect reveal is permitted.

The host presentation uses the replacement visuals throughout. A player's setting cannot protect them from another employee's independently shared screen; the runbook should direct group demonstrations through the safe presentation view.

## Controls and help

Both keyboard-only and mouse/trackpad-only play must complete every required activity. No drag-only, hover-only, rapid-click-only, or simultaneous-button requirement. Keyboard and pointer controls invoke the same actions, movement speed, action limits, and scoring rules.

| Action | Keyboard default | Mouse or trackpad default |
|---|---|---|
| Move | WASD or arrow keys | Click destination with pathfinding. |
| Interact | E or Enter near the target | Click an object or its action button. |
| Target in action games | Arrow-key target selection, Space to act | Click target; equivalent repeat-action option. |
| Inventory and map | I and M | Persistent inventory and map buttons. |
| Quiz choice | Tab and Enter; number shortcuts 1–4 | Click answer, then confirm. |
| Help | H | Persistent question-mark button. |
| Close or cancel | Escape | Visible close/cancel button. |
| Menus | Tab, Shift+Tab, arrows, Enter | Click controls. |

Show contextual key hints beside actions and a first-use control overlay. Support remapping of gameplay keys with conflict checking. Arrow keys move the character in the world and select targets only while an action-game panel has focus; entering and leaving that mode must be visible. Closing help returns focus to the game. Browser shortcuts continue to work outside the focused game surface. Opening help does not stop the shared clock; disclose this clearly.

Sound is optional. Provide visual equivalents for instructions and alerts, visible focus states, readable contrast, text plus symbols for state, reduced camera motion, and no flashing effects. The action-game alternative must preserve attainable scores without repeated rapid input. Validate both input methods with people who rarely play games.

## Host launch and event operation

The host uses a private authenticated control page. Player links and the audience display cannot issue host commands. A backup operator has the same event access but sees the current control owner and recent actions.

1. Create or select the event and load the frozen content/scoring version.
2. Open the lobby at 3:15. Display the entry instructions on the meeting screen.
3. Check connected, tutorial-complete, ready, and reconnecting counts. Individual status is visible privately to operators.
4. At 3:30, explain the mission and award rules while employees finish practice.
5. At 3:35, click **Start event**. A confirmation shows the event name, player count, and start action. This prevents an accidental launch; it is not a request for a separate person's approval.
6. Start a shared ten-second countdown, then the first chapter introduction and objective. Countdown and introduction are included in the first five-minute play window.

The server owns the event state: draft → lobby → start countdown → chapter play → brag break → next chapter → finale → awards → closed. Chapter play and brag break repeat eight times. Pause is a recoverable state that records the phase and time remaining. The host may cancel the countdown before play begins and return everyone to the lobby without score changes. Reissuing the same start command cannot create a second countdown; after play begins, another start cannot restart the event or reset scores.

Normal transitions are automatic. The host can pause/resume, skip a broken chapter, rescue a stuck character, broadcast a message, and end scoring. A skip makes that chapter unranked for everyone, disables its prize, and removes it from all aggregate denominators. Finale/awards can still run; the final report explains the exception. This is recovery behavior, not a promised fifteen-prize outcome after a failure.

On pause, scoring actions, trades, timers, and competitive movement freeze together. A host disconnect does not stop the server schedule. A returning host or backup operator reconnects to the existing event. Every operator mutation records who did it, when, and why.

## Run of show

| Time | Phase |
|---|---|
| 3:15–3:30 | Joining, setup, tutorial, practice. |
| 3:30–3:35 | Host briefing and ready check. |
| 3:35–3:42 | Chapter 1: five minutes play, two minutes bragging. |
| 3:42–3:49 | Chapter 2: five minutes play, two minutes bragging. |
| 3:49–3:56 | Chapter 3: five minutes play, two minutes bragging. |
| 3:56–4:03 | Chapter 4: five minutes play, two minutes bragging. |
| 4:03–4:10 | Chapter 5: five minutes play, two minutes bragging. |
| 4:10–4:17 | Chapter 6: five minutes play, two minutes bragging. |
| 4:17–4:24 | Chapter 7: five minutes play, two minutes bragging. |
| 4:24–4:31 | Chapter 8: five minutes play, two minutes bragging. |
| 4:31–4:35 | Shared finale. |
| 4:35–4:45 | Seven whole-event prizes, winner stories, final results. |
| 4:45–4:50 | Closing and recovery buffer. |

The game is 60 minutes, including chapter bragging and the finale. Pauses consume the closing buffer first. If recovery needs more time, the host must shorten or skip a phase explicitly; do not claim both an extended game and an unchanged 4:50 finish.

At each brag break, stop scoring and freeze supplies/trades. Show the chapter standings, the eligible prize winner, and a verified game-generated highlight. Give the winner approximately thirty seconds to explain their strategy. The rest of the break supports host commentary, emotes, and the next chapter preview. Players can view menus while the world is frozen.

## World and chapter contract

Every chapter contains one main objective, one optional harder challenge, two scored learning encounters, a cooperative contribution, and a secret. Balance the main objective to take about three minutes after tutorial familiarity. Leave the rest of the play window for helping, trading, learning, and discovery. No player queues for an exclusive non-player character or puzzle station.

| Chapter | Locations | Main objective | Primary chapter metric |
|---|---|---|---|
| Move day mayhem | Moving depot; broken highway | Fit supplies into a limited cart and deliver them through route hazards. | Delivered useful cargo value, with damaged cargo worth less. |
| The great filter shortage | Filter warehouse; ventilation maze | Match filters to the correct destinations and restore airflow. | Correct installations, minus incorrect attempts. |
| Attack of the clones | Identity bureau; counterfeit town hall | Investigate messages and identify AI impersonators. | Correct scam decisions, minus false accusations. |
| RIP, my apartment | Insurance office; disaster block | Prepare a home, then choose recovery actions during fictional disasters. | Preparation and recovery decision points. |
| Pest resistance | Apartment block; pest-control HQ | Handle timed pest outbreaks or their friendly-robot equivalents. | Valid targets resolved, minus decoy hits. |
| Credit where it's due | Trading post; payment station | Budget across simulated payment cycles while trading supplies. | On-time simulated payments, then retained budget. |
| Rewards rebellion | Rewards arcade; night market | Finish resident challenges and decide how to use earned rewards. | Unique challenge points. |
| Reconnect humanity | Internet exchange; AI headquarters | Connect homes through routing puzzles while the AI interferes. | Valid homes connected, minus invalid connection attempts. |

The shared neighborhood visibly improves as contributions accumulate: homes light up, roads clear, and the AI loses control. Chapter completion and learning answers remain individual. Nobody can finish another employee's knowledge encounter for them.

Movement includes limited cargo space and explicit route tradeoffs. Characters pass through each other. No theft, combat against employees, player elimination, or permanent loss that blocks future chapters. Every player advances when the chapter clock ends, even if an objective is incomplete.

Essential supplies have a personal allocation. Shared contributions earn bounded bonuses. Trading uses item-for-item barter with fixed published inventory valuations and limited quantities. Both parties must confirm the current offer, and the transfer completes atomically; inventory changes invalidate an unconfirmed offer. No negative inventory, duplicate transfers, or trading during frozen phases. The Credit Building chapter's simulated budget is local to that activity and is not a tradable currency.

At 4:31, or the equivalent phase boundary after a host intervention, settle all accepted chapter actions, cancel pending trades, and freeze an immutable award snapshot. It includes inventory valuation, objective times, quiz results, assists, qualifying trades, secrets, and all chapter scores. Award allocation and exports use this snapshot. Finale interactions cannot change any award input.

The finale offers each connected player a contribution and completes within four minutes even when participation is below 100. Early completion uses remaining time for celebration. If the group misses its target, give a comic alternate ending. Finale contributions use a separate shared supply meter; personal inventories and prize results remain frozen.

## Knowledge and secrets

The sixteen scored learning encounters have a fixed first submission, a clear explanation, and an optional unscored retry. Each employee receives equivalent content and scoring opportunities. Secrets may reveal jokes, cosmetic effects, or clues, but cannot reveal scored answers or grant a competitive resource advantage.

Questions teach the resident problem, how the benefit is used, and a common misconception. An SN content owner must verify benefit names, explanations, eligibility statements, and answer keys. All insurance outcomes and credit progression are clearly fictional game models. Trading itself must never imply that buying or selling improves real credit.

The multi-chapter mystery uses clues from the eight chapter secrets. Players may compare clues. Its reveal counts toward the discovery award but cannot block chapter progress. Secret access uses equivalent keyboard and pointer interactions.

Use scripted AI dialogue and authored alternate lines. Generative AI services are outside the release boundary. Humor should target absurd machines and everyday friction. Named employee jokes require the subject's approval before inclusion.

## Awards and fairness

Eight chapter prizes are allocated in chronological chapter order. The actual top performer is recognized on the standings even if already awarded; the next eligible employee receives the prize. Chapter winners remain active competitors, but cannot receive another prize. Prize eligibility is visible separately from raw ranking.

At the end, allocate the remaining seven prizes in the fixed order below, excluding prior prize recipients. Do not change the order during the event.

| Order | Whole-event prize | Rule |
|---|---|---|
| 1 | Top hoarder | Highest final inventory value using fixed item values and the same storage limit. |
| 2 | Trailblazer | Complete all ranked main objectives; lowest summed chapter objective time. Each timer starts at its chapter opening, includes mistakes/help, and continues through disconnects. |
| 3 | Neighborhood hero | Most distinct completed assists. Cap scored assists to one per player pair per chapter. An assist requires an actual unfinished task and confirmed completion. |
| 4 | Human intelligence champion | Most correct first submissions out of all sixteen encounters; unanswered encounters count as incorrect. |
| 5 | Easter egg hunter | Most unique secrets discovered, counting the multi-chapter reveal once. |
| 6 | Master trader | Most distinct employees supplied through a completed barter trade whose received item is subsequently consumed by an unfinished required task. Each recipient counts once per supplier across the event, and each item can credit only one supplier. Gifts and circular exchanges do not count. |
| 7 | All-round survivor | Highest mean chapter score, with each chapter normalized to 0–100 against fixed maximums and unplayed ranked chapters scored zero. |

All eligibility thresholds, point values, caps, penalties, and puzzle variants live in one versioned ruleset used by the server, host page, player help, and results export. Freeze it before the event. Exact item prices and point weights are balance work within this scope, not separate features. Require a complete rules table and recorded balance rehearsal before release.

Ties use the category's published secondary metric, then a server-recorded seeded draw among exact ties. Publish the secondary metrics in the ruleset before joining opens. Never resolve ties through an unannounced host preference. Use the next eligible ranked participant when an award's qualifying threshold has no candidate only through a prepublished fallback rule; otherwise leave that prize unawarded and explain why.

Fifteen distinct winners is the normal-event target, not a guarantee regardless of participation or failures. The rehearsal must demonstrate fifteen qualifying recipients. All client-submitted actions require server validation. No browser can award itself points, change inventory, reveal the whole answer key, or grant host privileges.

## Reliability and recovery

Save accepted progress on the server throughout the event. Refresh, transient network loss, and switching browsers must not duplicate or erase committed scores or items. Show reconnect status and disable actions that require server confirmation until the connection returns. Catch up to the authoritative phase when reconnecting.

Late players join the current chapter after setup. Earlier chapters remain visibly unplayed, with zero points; do not award fictional completions. They can win later chapter prizes and categories for which they qualify. A disconnected participant's in-progress trades cancel safely unless already committed.

The presentation view uses safe visuals, large text, a visible timer, district progress, chapter reveals, and final winners. It never displays invitation links, employee email addresses, unrevealed answers, or secret locations. Winners and highlights come from recorded events, not generated claims.

## Release acceptance

These are proposed acceptance targets, to be measured before release rather than claimed as existing performance.

| Test | Required evidence |
|---|---|
| Joining | At least 9 of 10 representative employees reach ready status within three minutes of opening a valid link, without facilitator intervention. |
| Capacity | A complete 60-minute run with 100 simulated active players, both operators, and the presentation view; include a burst of 100 joins over sixty seconds, trading, simultaneous submissions, transitions, and reconnects. |
| Real-user rehearsal | A full 95-minute dress rehearsal covering entry through closing, with representative novice and experienced players, both input methods, safe visuals, host commentary, and award allocation. Record attendance; do not substitute a small rehearsal for the separate capacity test. |
| Rendering | At least 30 frames per second for 95% of measured play time on the agreed lowest-spec company laptop at the target game area. Record the hardware and browser. |
| Responsiveness | Under the agreed representative network profile, 95th-percentile confirmed scoring/inventory actions return within 500 ms. Record the profile and sampling method. |
| Clock | Connected clients show phase transitions within one second of server time under that network profile. |
| Recovery | Refreshes, repeated requests, two tabs, host disconnect, and a thirty-second player outage preserve committed state and cannot award points twice. |
| Controls | Complete every main objective and knowledge encounter with keyboard only, then mouse/trackpad only, without score disadvantages caused by control design. |
| Insect replacement | No spider or insect visuals/sounds before choice or in replacement mode, including presentation, secrets, previews, reconnects, and awards. |
| Unsupported devices | Verified warning on representative iOS and Android phones; no rejected touchscreen laptop solely because it supports touch. |
| Scoring | A recorded run produces the expected rankings, fifteen distinct qualifying winners, correct ties and fallbacks, and matching exported results. Test collusive trades, repeated assists, and forged requests. |
| Timing | Normal run follows the 3:35–4:35 game window and finishes the meeting by 4:50; separately rehearse pause and skip recovery. |
| Content | SN owners approve all sixteen questions and all claims about benefits. |

Inventory duplication, unauthorized host access, lost committed progress, replacement-mode insect exposure, or scoring that cannot be reconciled to recorded actions blocks release.

## Quality bar

Proven reference: Oregon Trail's finite supplies, visible consequences, and route choices. Use only original assets. Select one specific multiplayer movement/social reference at the design gate and write down the interactions to match; that comparison target is still open.

Better axis: joining and learning controls. The measurable target is the three-minute ready-status test above. There is no measured baseline for prior SN games, so do not claim a quantified improvement over them.

New element: SN benefit decisions collectively restore a visible neighborhood. Compare three paper/storyboard treatments for the finale: restoring a central utility, reclaiming AI headquarters, or synchronizing home repairs. Choose by how clearly individual contributions affect the shared outcome and whether the sequence fits four minutes. Only one finale is built.

## Developer delivery sequence

1. **Design package:** annotated map, entry/phone/setup screens, control diagrams, chapter cards, rules table, host state diagram, content inventory, and estimate with assumptions.
2. **Playable slice:** working browser entry, safe character setup, one polished chapter, both input methods, real shared presence, host launch/pause, saved progress, and a sample award. This is the first build-quality review gate; no implementation is authorized by this planning conversation.
3. **Complete event:** all eight chapters, social tools, secrets, finale, presentation, awards, and export.
4. **Release candidate:** reviewed content, performance evidence, recovery rehearsal, accessibility checks, deployment instructions, and event runbook.

The development team proposes the engine, hosting, persistent storage, and network implementation after reviewing the scope. Require a cost estimate covering development, art/audio, content integration, testing, hosting, event support, and handover. A detailed schedule or budget is not established in this conversation.

## Exclusions

No phone/tablet gameplay, native application, voice chat, open text chat, public matchmaking, live generative AI dialogue, user-generated art, unrestricted building, player-versus-player combat, real-money transactions, persistent player economy, or multi-event progression. In-game purchases and insurance/credit outcomes are fictional and never connect to resident or employee financial accounts.

## Decisions before a development contract

- Event date, budget range, delivery deadline, and development owner.
- Lowest-spec supported company laptop and representative network conditions.
- Employee roster source, invitation delivery method, host authentication provider, and event data-retention period.
- Named SN content approvers and final brand/title review.
- Final balance rules, award secondary metrics/fallbacks, and the selected finale treatment at the design gate.

## Design references

- [Microsoft new-player entry guidance](https://developer.microsoft.com/en-us/games/resources/productinclusion/product-inclusion-actions/create-entryways/): practice and training before multiplayer competition.
- [Xbox Accessibility Guidelines](https://learn.microsoft.com/gaming/accessibility/guidelines): reference checklist for controls, presentation, and accessible interaction.
- [MDN browser-detection guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent): limitations of user-agent-based classification and the role of capability checks.
- [Unity server authority](https://docs.unity.com/en-us/cloud-code/server-authority): background for server-enforced rules. This does not select Unity as the implementation engine.

References consulted 2026-11-09. They support design practices; the feature counts, operating model, and acceptance targets above are project scope proposals.
