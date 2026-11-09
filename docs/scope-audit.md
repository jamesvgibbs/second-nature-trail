# Scope audit

Updated 2026-11-09. This separates implemented behavior from release evidence. The authority remains [scope.md](scope.md); [acceptance.md](acceptance.md) records measured checks and unmet release gates. The latest full capacity attempt was stopped for a confirmed shared navigation defect affecting 29 of 100 players in chapter 2. Exact continuous collision geometry and chained fractional-start regressions now pass; a targeted 100-player chapter 2 rerun completed every main objective. The final combined runtime still requires a new full run. It is not a completed hour-long acceptance run.

## Functional coverage

| Requirement | Implementation or evidence | Remaining work |
| --- | --- | --- |
| One shared neighborhood, eight districts, two locations each | Shared authoritative engine; public world geometry; world tests align all sixteen doors to content | Human visual review |
| 100 players, two operators, one presentation | Server capacity bound; load harness opens all 103 connections; separate operator/display roles | Complete frozen-source 60-minute capacity run |
| Private roster invitations, persistent identity | Offline roster import, hashed invitation/session storage, explicit takeover, one active play lease | Choose real roster/delivery method and production identity arrangement |
| Device/capability checks before setup | Guarded storage/rendering/connection checks; device policy tests; exact mobile warning and copy action | Physical iOS/Android/tablet/touchscreen-laptop checks; iPad fine-primary-pointer policy covered by synthetic signal regression |
| Twelve characters and palettes | Original canvas avatars and setup choices; same server ability rules | Final brand/art review |
| Required unselected insect choice | Boolean server setting, required setup radios, pre-choice safe world; persistent immediate replacement override | Complete visual/sound audit across supported browsers |
| Safe presentation | Separate read-only credential; forced robot visuals; sanitized state without invitations/answers | Full meeting-screen rehearsal |
| Tutorial and ready state | Real movement, interaction, collection, answer, and help required; no practice scoring | Nine of ten real employees ready within three minutes, unassisted |
| Keyboard and pointer parity | Native buttons/menus, shared movement limits/path geometry, target selection, remapping; mystery has clickable clues | Complete every objective and knowledge encounter with each method; novice validation |
| Accessible presentation | Text-size settings, reduced motion, focus treatment, visual alerts, optional sound | Contrast/zoom/minimum-window and screen-reader review on supported browsers |
| Timed event control | Authoritative countdown/chapter/break/finale/awards clock; idempotent launch, pause/resume, skip, rescue, broadcast, end scoring | Shorten and advance implemented; rehearse pause/skip/shorten timing |
| Operator continuity | Separate operator identity and audit reason; subprocess test shows host stream loss does not stop schedule | Named primary/backup operators and full run-through |
| Move day mayhem | Four-slot load plans, finite supplies, physical route checkpoints, three deliveries, cargo-value primary metric | Balance rehearsal |
| Filter shortage | Six inspected spatial work orders, dimension/installation decisions, correct-minus-incorrect primary metric | Content approval and balance rehearsal |
| Attack of the clones | Six evidence-based spatial investigations, correct decisions and false-accusation penalties | Content approval and balance rehearsal |
| RIP, my apartment | Six inspected preparation/recovery decisions; fictional insurance outcomes | Content approval and balance rehearsal |
| Pest resistance | Three spatial sites, six resolutions per site, server-owned nine-second rounds with two-second warning; same target model for robot/insect art; three-player HTTP scenario completed all eighteen hits each | Full input/visual audit |
| Credit where it is due | Three 45-second simulated payment cycles with carryover funds, due times, retained-budget secondary metric | Content approval and balance rehearsal |
| Rewards rebellion | Six unique resident work orders earn tokens; seventh step funds one of three neighborhood projects | Three-player HTTP scenario passed all reward choices; UI verification and content approval remain |
| Reconnect humanity | Three spatial home stations; required relays, weighted edges, budgets, blocked links, loop validation; three-player HTTP scenario completed all stations | Full pointer/keyboard route interaction check |
| Eight harder challenges and sixteen scored questions | Authored content; first-submission scoring immutable; explanation withheld until submission; optional unscored retry | Named SN approval for every question, key, explanation and benefit claim |
| Eight secrets and multi-chapter mystery | Chapter clues; mystery requires all eight; no resource or scored-answer reward | Pointer-only synthetic mystery entry verified in Safari; final content review remains |
| Emotes/help/assists | Six presets; actual unfinished help request and confirmed task completion; one scored pair per chapter | Social/balance rehearsal |
| Atomic item barter | Both confirm current version; inventory mutation invalidates stale offer; transfer/capacity/provenance validation | Full event trading exercise and adversarial rehearsal |
| Master trader anti-collusion | Recipient must consume supplied item in required task; distinct recipients; circular/re-traded supply cannot multiply credit | Recorded final qualifying winners in full run |
| Fifteen distinct prizes | Chronological chapter allocation, fixed whole-event order, qualification thresholds, published ties/fallbacks; virtual-clock 24-player run verifies 15 distinct recipients | Real-time normal run with matching results export |
| Immutable pre-finale results | Frozen snapshot and seeded draw records; finale separate contribution meter | Export reconciliation in complete capacity/rehearsal run |
| Cooperative finale | Each connected player can contribute; visible individual repair markers, threshold and timed alternate ending | Four-minute audience clarity rehearsal |
| Committed-state durability | SQLite transactions; mixed-validity batch and persistence-failure rollback tests; actual SIGKILL/restart test | Production volume/backup/restore verification |
| Disconnect and recovery | Session/lease enforcement; reconnect state; pending-trade cancellation on disconnect/restart; thirty-second simulated outage | Full frozen-source capacity run and human recovery rehearsal |
| Original assets and exclusions | Authored pixel geometry/characters/music/dialogue; no public chat, PvP, real financial transactions, or generative dialogue service | Final content/license review |

## Findings and fixes before the next freeze

These historical findings came from code inspection, not employee rehearsal. Their implementation status and remaining verification are recorded separately below.

| Finding | Consequence | Owner/status |
| --- | --- | --- |
| World restoration initially lit homes after the first contribution but did not clear roads or reduce a visible AI-control indicator | Incomplete shared-neighborhood progression | Fixed; Safari synthetic restoration fixture showed staged road/relay progress and 31% restoration/69% AI control |
| Rewards jobs did not produce a spendable earned-reward choice | Missing chapter capability | Implemented; three-player HTTP scenario passed all reward choices; rendered check pending |
| No direct phase-shortening action existed; skipping during a brag break restarted its two-minute timer | Recovery cannot reliably reclaim the intended remaining time | Engine implementation and recovery tests pass; rendered host verification pending |
| Graph/pattern/trade caps, assist distance and finale fraction were outside the published frozen rules object | Rules table and content hash do not fully describe authoritative behavior | Published RULES now include these constants |
| Clone chapter primary score penalized all wrong decisions, while its wording specified false accusations | Metric and published description disagree | Engine/content aligned; tests cover semantics |
| Host display lacked a reconnecting count and explicit per-player connection state | Operators cannot distinguish practice from a disconnected player | Implemented; visual verification pending |
| Brag break lacked an explicit next-chapter preview | Missing transition aid | Fixed; Safari fixture displayed next title, objective and both locations |
| First-use controls were available through help/tutorial but lacked the specified opening overlay | Missing entry aid | Fixed; Safari keyboard dismissal returned focus to map |
| Objective copy retained three-task and cart/storage descriptions after activity expansion | Players receive inaccurate instructions | Engine/content aligned; tests cover semantics |
| Some presentation paragraph styling remained small despite the larger layout | Meeting-screen readability is unverified | CSS minimum sizes corrected; rendered and room rehearsal pending |
| Frozen results omitted operational audit entries after scoring closes | Post-finale interventions disappear from a snapshot-only handover | Separate operationalAudit export implemented; frozen award inputs preserved |

Targeting now requires eighteen resolutions across three sites; a mechanical simulation using actual shared paths at 190 pixels/second finishes at 155 seconds without reading or mistakes. Routing now includes required relays and cost limits across three spatial stations. These are implementation and synthetic timing evidence, not measured novice completion times. Balance rehearsal remains mandatory; do not claim the objective-duration target is met from virtual-clock tests.

## Restart condition

Implementation fixes above must pass their functional checks; browser evidence remains explicitly separate. Align the UI and load actions, run the relevant functional tests, then freeze the backend/content version and commit. The next full run must reach awards after sixty real game minutes, record all eight chapter completion counts, exercise trades and a thirty-second outage, produce fifteen distinct qualifying winners, and reconcile its export. A successful short smoke or virtual-clock test cannot substitute for that run.

Production deployment, content sign-off, real participant rehearsal, the supported-browser matrix, physical devices, lowest-spec rendering, and representative-network measurements remain separate required release gates.

Browser evidence and its limits are recorded in [browser-checks.md](browser-checks.md). Earlier targeting/routing checks predate the final expanded mechanics. The latest all-chapter input matrix and host/presentation rendered checks remain incomplete because browser control could not proceed reliably alongside user activity; this is not a passing visual check. The optional `?measure=1` recorder has pure tests for visible-frame sampling and hidden/paused exclusion, but no actual hardware FPS measurement has been recorded.

## Final combined protocol baseline

The exact geometry repair, three-watermark projection reducer, monotonic movement requests, and transactionally persisted settings ordering now have 89 passing automated tests. The server refuses obsolete movement/settings writes; same-epoch older views cannot roll back later accepted core state or position, and a new server epoch is accepted through the active stream generation. A saved replacement preference survives an older delayed enable request and restart. The shared load client now exercises the same projection reducer and sequence contracts.

These changes supersede the earlier Safari runtime baseline. Earlier screenshots still support their specifically observed layouts and controls, but do not verify the final ordering/reconnect/failed-enable sequences, the final expanded activities, or host/presentation live rendering. Those checks remain listed in [controls-matrix.md](controls-matrix.md) and [browser-checks.md](browser-checks.md). No complete frozen-source capacity run has passed yet.
