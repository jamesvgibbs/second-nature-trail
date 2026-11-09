# Release evidence

Status: not release-approved. Updated 2026-11-09. This checklist records evidence; the presence of code is not a passing test. Automated tests cannot replace employee rehearsals, content approval, or hardware/browser measurements.

## Evidence register

| Scope requirement | Evidence needed | Current status |
| --- | --- | --- |
| Ready within three minutes | Ten representative employees, at least nine successful unassisted; start/end times | Pending human test |
| 100-player capacity | Full 60-minute active run, 100 joins over 60 seconds, two operators, presentation, trades, submissions, reconnects | Completed full localhost scenario; latency target missed; representative network still pending |
| Meeting operation | Full 95-minute dress rehearsal, attendee/input-method record, host commentary, awards | Pending human rehearsal |
| Rendering | Lowest-spec agreed laptop and browser; >=30 FPS for 95% of measured play | Hardware baseline and measurement pending |
| Action latency | Representative network profile; p95 confirmed inventory/scoring <=500 ms; sampling method | Localhost scoring p95 506.95 ms exceeds 500 ms; representative network pending |
| Clock | Phase transitions within one second of server under agreed network | Localhost 103×18 transitions verified, max 372 ms; representative network pending |
| Browser support | Current and previous Chrome, Edge, Firefox, Safari, exact versions and OS | Pending matrix |
| Recovery | Refresh, duplicate requests, two tabs/takeover, host loss, 30-second player outage, server restart | Automated coverage in progress; rehearsal pending |
| Controls | All main objectives/learning keyboard-only and pointer-only, comparable attainable scores | Pending complete interaction checks |
| Accessibility | Visible focus, large text, contrast, reduced motion, visual alerts, no rapid-input requirement | Pending review and novice test |
| Insect replacement | No exposure before choice, replacement, presentation, reconnect, secrets, preview, awards | Pending full visual/sound audit |
| Unsupported devices | Real representative iOS/Android phones/tablets; touchscreen laptop remains supported | Pending device checks |
| Scoring | Expected rankings, 15 distinct qualifying winners, ties, fallbacks, export reconciliation | Automated coverage in progress; balance rehearsal pending |
| Abuse | Forged score/inventory/host requests, repeated assists, collusive/circular trades | Automated coverage in progress |
| Timing | 60-minute normal game inside 95-minute meeting; pause/skip recovery | Pending real-time rehearsal |
| Content | Named SN owners approve all 16 questions, answer keys, benefit claims | Pending approval |
| Production | HTTPS deployment, durable storage, backup/restore, roster invitation delivery, operator authentication | Pending decisions and deployment verification |

## Recorded development runs

- `node --test test/integration-security.test.mjs`: nine passing tests on 2026-11-09. Covers role separation, invitation takeover/session revocation, client lease requirement, request origin/type/size, restart identity, single database owner, roster freeze, mixed valid/invalid queued actions, and rollback/retry after simulated persistence failure. Re-run with pinned Node v24.20.0 also passed. This is transport coverage, not full game acceptance.
- Ten-player localhost smoke: 25.9 seconds, 90 confirmed actions, p95 54.1 ms, no errors. Early engine iteration; not capacity evidence.
- One-hundred-player localhost smoke: 36.6 seconds with joins over five seconds, 1,973 requests, 576 confirmed actions, 21 completed trades, p95 3,570 ms. Forty-eight event streams terminated and 1,293 subsequent actions failed lease checks. **Failed performance/reliability development run.** Synchronous full-state fanout on each action was identified for repair. This run did not exercise a full event or the representative network. Raw report: `test-results/load-100-smoke.json`.

- Coalesced-broadcast smoke: 103.1 seconds, 100 players, 3,203 requests, 3,096 confirmed actions, 50 trades and one 30-second reconnect. No stream terminations. Overall confirmed-action p95 was 1,104.7 ms, so latency still needs work. Three tutorial/phase errors in the simulation and an SSE shutdown callback after database close were identified; both were subsequently patched. Runtime was Node v26.7.0, not the target v24.20.0. Raw report: `test-results/load-100-coalesced-smoke.json`.
- Pinned Node v24.20.0 profile smoke: 37.6 seconds, 100 joins over five seconds, 3,584 requests, 3,180 confirmed actions, 50 completed trades, no errors. Continuous travel at up to ten movement requests per second per player. Overall action p95 469.5 ms; **scoring/inventory p95 841.8 ms across 550 samples, failing the proposed 500 ms target even on localhost**. No outage completed in this short run. Raw report: `test-results/load-100-profile.json`. CPU profile identified full-state serialization in `mutate` as the largest measured active self-time, followed by structured cloning and persistence. This is a development diagnosis, not a production measurement.
- Batched durable writes and compact responses were then tested with 100 players and **10,000 explicitly synthetic prior actions** in the request history. This 46.2-second localhost run on Node v24.20.0 had 600 confirmed scoring/inventory samples, p95 366.2 ms, 50 completed trades, and zero request errors. This passes that short-run localhost latency check only. It does not establish representative-network latency, complete-event capacity, reconnect coverage, or award reconciliation. Report: `test-results/load-100-ledger.json`; source hashes and frozen content hash are embedded.
- Two subprocess recovery tests passed on Node v24.20.0. The first commits character setup and an actual first cargo delivery through authenticated HTTP, leaves a partially confirmed trade, kills the server with SIGKILL, verifies stale-lock denial, confirms the process has exited before recovering the test lock, and restarts the same database. Committed score/inventory/progress survive; pending trade is canceled. The second disconnects the operator stream and verifies server-driven countdown/chapter/break transitions. Test clocks are advanced explicitly; this is not a real-time rehearsal. Files: `test/integration-crash.test.mjs` and its isolated subprocess fixture.
- Three pure UI policy tests passed under Node v24.20.0 for representative device signals, preference-storage failure, settings conversions, and key conflicts. These are not physical-device or rendered-browser tests.

Re-run after transport repair and record a separate report. Do not overwrite a failed run with a passing label.

## Test report format

For each execution, record build commit, content/rules version, test command or script, date/time, operator, OS/hardware/browser versions, network profile, participant count, duration, expected result, actual result, and links to raw evidence. Do not label a shortened accelerated simulation a 60-minute load test.

Store automated command output and any load traces under `test-results/` without invitation or host secrets. The rules table and content must be frozen for the run. Seeded draws must be reproducible from recorded inputs. Report p50/p95/p99 alongside sample counts; FPS must report percent of measured play meeting threshold, not only an average.

## Release blockers

Inventory duplication, unauthorized host access, lost committed progress, replacement-mode insect exposure, and scores that cannot reconcile to accepted actions block release. Any missing required human/content/performance evidence also prevents a claim that the specified release acceptance is complete.

## Human rehearsal sheet

| Participant alias | Novice/experienced | Input method | Ready seconds | Intervention | All chapters complete | Visual preference | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| To be recorded | | | | | | | |

Keep real attendance in the organizer's approved private location. This template is not evidence that anyone attended.

## Reproducing capacity checks

Use Node v24.20.0. The harness creates an isolated temporary SQLite database and a local-only server. It logs phase changes while running and writes both a report and any frozen results export. It never contacts the production event or uses real employees.

```sh
LOAD_SECONDS=3605 LOAD_JOIN_SECONDS=60 LOAD_PLAYERS=100 LOAD_OUTPUT=test-results/capacity-full.json node scripts/load.mjs
```

`LOAD_SECONDS` measures game time from the confirmed Start command, in addition to joining and setup. The default is 3,605 seconds so the normal 60-minute schedule reaches awards. The report must show the actual final phase, fifteen distinct qualifying winners, matching export, completed trades, the thirty-second reconnect, request errors, and scoring/inventory latency. Inspect per-phase logs for missed transitions or stalled activity. Latency remains localhost evidence until the representative company network is agreed and exercised.

For development only, shorten `LOAD_SECONDS` and `LOAD_JOIN_SECONDS`. `LOAD_LEDGER_PREFILL=10000` seeds ten thousand synthetic historical actions before measured play to probe late-event ledger costs. The report labels that prefill explicitly; it is not ten thousand measured network requests. A short smoke run cannot satisfy the hour-long capacity requirement.

## Full-run environment

The `ee0857d` capacity run uses a Mac16,5 with an Apple M4 Max, 64 GiB RAM, macOS 26.7.2 build 25G332, and Node v24.20.0. Clients and server share one process over localhost. Manual Safari checks and lightweight development work continue on the same computer; CPU-heavy builds are avoided. This is not an isolated benchmark, the agreed lowest-spec laptop, or the representative company network. Environment evidence is in `test-results/capacity-full-ee0857d-environment.json`.

## Balance review still required

The current main-objective structures differ in length. Moving uses three cargo trips with packing, route choice, checkpoints, and delivery. Filters, clones, insurance, and rewards each use six locations with inspection and a decision or delivery. Pest targeting now requires eighteen correct timed rounds at three spatial sites, payment planning spans three server-timed cycles, and internet restoration uses three spatial routing puzzles with required relays and cost limits. A mechanical targeting simulation at 190 pixels/second completes in 155 seconds without reading or errors. Human completion time remains unmeasured. Do not treat matching chapter counts or passing the virtual event test as evidence of that balance target. Record novice and experienced completion times, then adjust activity depth and difficulty before release.

Browser evidence so far: native Safari manually rendered setup with neither visual preference preselected; replacement mode was selected; keyboard movement, guide interaction, practice collection, practice answer, help request, and ready status were completed. The initial delivery flow was exercised through loading, route choice, and travel to the checkpoint. This was an agent-operated check on the development machine, not the required ten-employee joining test or all-input-method rehearsal.

## Aborted first capacity attempt

The full run from `ee0857d` was stopped in chapter 2. Chapter 1 completed for all 100 players; its cumulative scoring/inventory p95 was 333.7 ms over 1,800 samples with no request errors. In chapter 2, the simulator skipped intermediate path corners at eight pixels and stalled at Willow home. This was a harness defect; the browser already used a half-pixel threshold. A regression starting at the recorded fractional positions then exposed a separate shared pathfinder defect: the first route segment could cross a corner because reconstruction omitted the rounded starting node. Both defects were fixed, and the harness now shares browser waypoint logic. Tests simulate actual movement/collision along all thirty distinct spatial-site routes and both recorded stall origins.

The aborted attempt is not full capacity evidence. Its log, partial-state report, and environment record remain under `test-results/capacity-full-ee0857d-*`. A new frozen-source full run is required.

## Superseded second capacity attempt

The `da5cf29` run completed chapters 1 and 2 for all 100 simulated players, including every six-site work order in chapter 2. At its chapter-2 break it recorded 18,104 requests, 3,501 scoring/inventory samples, scoring p95 339.6 ms, and zero request errors. It was deliberately stopped while additional required functionality was being added: earned Rewards spending, host phase shortening, and fuller targeting/routing objectives. This was an incomplete and superseded run, not a performance failure and not full-hour acceptance. Evidence remains in `test-results/capacity-full-da5cf29-*`.

The next frozen run must use the expanded activities and reach all eight chapters, the finale, and fifteen distinct qualifying awards. `LOAD_START_CHAPTER=1` through `7` is a development-only harness option that advances past earlier chapters to validate later contracts; any such run is explicitly labeled a shortened scenario and cannot satisfy normal event timing.

## Expanded activity contract checks

Pinned Node v24.20.0, localhost, three simulated players, explicitly shortened chapter-start scenarios (not normal event timing):

- Rewards: all three completed six jobs plus redemption; garden, welcome station, and celebration were each selected once. One thirty-second outage reconnected. Fifty-five scoring/inventory samples, p95 33.3 ms, no request errors. `test-results/rewards-scenario.json`.
- Targeting: all three completed eighteen valid resolutions across three spatial sites within the 196.95-second scenario, including one thirty-second outage and reconnect. Seventy scoring/inventory samples, p95 30.0 ms, no request errors. `test-results/targeting-scenario.json`.
- Routing: all three completed all three spatial stations using required relays, permitted edges, and cable budgets. Twenty-five scoring/inventory samples, p95 24.2 ms, no request errors. `test-results/routing-scenario.json`.

These checks validate harness/server contracts and do not certify pointer/keyboard rendering, employee comprehension, balance, representative-network performance, or complete-event capacity.

## Frozen v0.3.0 preflight

Commit `c595925` passed 64 functional tests. Its first 100-player/10,000-synthetic-history smoke recorded scoring/inventory p95 596.7 ms across 600 samples, above the provisional 500 ms target, with no request errors. Docker container checks overlapped on the shared host; that overlap does not establish causation. A clean identical repeat with those checks stopped recorded p95 442.8 ms across 600 samples, fifty completed trades, and no request errors. Both reports are preserved as `test-results/load-c595925-ledger*.json`. The clean repeat passes only that shortened localhost check.

The full real-time `c595925` run started with 100 players joining over sixty seconds, two operators, and a presentation connection. It has no synthetic history prefill. Its live log and environment frame are `test-results/capacity-full-c595925-live.log` and `test-results/capacity-full-c595925-environment.json`. It was subsequently stopped for the confirmed navigation defect below and is not a capacity pass.

## Aborted v0.3.0 capacity run

The `c595925` run completed chapter 1 for all 100 players but chapter 2 for only 71. Twenty-nine players stalled approaching Elm home. At the chapter 2 break it had 74,876 requests, 3,269 scoring/inventory samples, p95 347.3 ms, and no rejected requests. Successful HTTP responses therefore did not establish successful navigation.

The shared planner sampled long segments every two pixels and missed a 0.359-pixel crossing of an expanded obstacle corner. Incremental movement correctly refused that route, producing a permanent stall. Starting from `(896,364)` toward the planner waypoint `(610,550)` reproduces the defect without network timing or SSE. Tests that began every route at an exact door center missed the real within 25-pixel stopping positions. A new regression chains actual arrival positions into later routes.

The run was stopped after saving its log, sanitized stalled-player states, environment, and abort record under `test-results/capacity-full-c595925-*`. This is a game navigation failure requiring repair and a new capacity run. The later `fddf372` UI-only safe-preference fix did not change the tested backend/content/harness and did not cause this stall.

## Continuous geometry repair checks

The shared world module now uses exact segment/expanded-rectangle intersection for both visibility and movement, replacing two-pixel sampling. Geometry tests cover 1,170 fractional starts and varied frame intervals; the load regression uses actual within 25-pixel endpoints as the origin of subsequent routes.

An explicit 100-player chapter 2 scenario started participants at deterministic valid fractional positions near six authored sites. All 100 completed all six work orders; no navigation stalls or request errors occurred. One thirty-second outage reconnected. Synthetic main completion p50/p95 were 81.4/81.5 seconds; scoring p95 was 440.2 ms. Separate concurrent three-player routing and targeting cross-checks also completed all objectives with no errors; targeting recorded 18 resolutions per player and included the same outage. These are shortened functional checks using the preceding transport contract, not a new complete capacity pass. Reports: `test-results/exact-geometry-*.json`.

A separate transport-ordering repair adds projection epoch/version metadata and per-client movement sequence numbers. The load client shares the browser's projection reducer; its final combined runtime was subsequently exercised in the full run below.

The final combined protocol baseline passes 89 automated tests, including exact geometry, stale projection/move handling, persistent settings-order protection across restart, and rollback-safe retry. Command output is `test-results/functional-exact-geometry-ordering.log`. This does not upgrade earlier rendered Safari evidence to the final source revision; the final compatibility/control matrix remains pending.

## Completed final-runtime capacity run

Frozen commit `10a674c` includes exact continuous geometry and the final movement/projection/settings ordering contracts. Its clean 100-player preflight with 10,000 explicitly synthetic prior actions recorded 600 scoring/inventory samples, p95 393.5 ms, fifty trades, and zero errors. Report: `test-results/load-10a674c-ledger.json`.

The normal-schedule run finished at awards after 3,608.182 real game seconds (3,672.481 total seconds). All 100 participants joined over 60.007 seconds and completed every chapter, with two operator streams and one presentation. It recorded 75,987 requests, 84 completed trades, one planned outage/reconnect, and zero request errors or detected navigation stalls. No synthetic history was prefilled. Source/runtime hashes were captured at startup; homepage-only revisions during the run are qualified in the environment sidecar.

The result is **functional scenario completion, not a passing release-capacity result**. Across 12,452 scoring/inventory samples, p50 was 312.90 ms, p95 **506.95 ms**, and p99 1,097.72 ms. The 500 ms target was missed. These are the original harness's computed percentiles; individual timing samples were not exported, so an independent raw-series recomputation is unavailable. Clients/server shared a development machine over localhost, with light documented Safari activity, rather than the agreed production hardware/network.

Independent post-run verification passed prize allocation/qualification/tie draws, final inventory replay, and recorded-outcome replay against the hash-bound accepted-request journal. All 15 recipients were distinct and qualified. All 103 connections reached all 18 timed boundaries: 1,854 observations, maximum 372 ms receipt lag, no negative or missing observations. This is Node SSE receipt evidence, not browser painting or representative-network timing.

Exact completion-time provenance remains incomplete because the objective completion and its outcome log use separate clock reads. The verifier checks upper-bound consistency and reports `fullActionReconciliationPass: false`; recorded server correctness is not independent content approval, physical-proximity proof, or human acceptance. Reports are [summary](../test-results/capacity-full-10a674c-summary.json), [raw load report](../test-results/capacity-full-10a674c.json), [results export](../test-results/capacity-full-10a674c.export.json), [independent verification](../test-results/capacity-full-10a674c-qa-verification.json), and [bound journal](../test-results/capacity-full-10a674c-journal.json).

Future harness runs write a separate `.timings.json` artifact containing every retained confirmed `/api/action` sample, its action type, phase/chapter at send and confirmation, request ID, wall-clock timestamps, monotonic elapsed milliseconds, and a small allowlisted outcome. Authentication calls, cookies, tokens, answer text, and other payload fields are excluded. The artifact carries source hashes and synthetic-prefill metadata; synthetic history never becomes a measured network sample.

Raw recording is bounded at 500,000 samples. Both report and timing artifact explicitly report any dropped rows and incomplete coverage; independent full-series recomputation is valid only when coverage is complete and counts match. The quantile method is preserved: zero-based sorted index `min(n-1, floor(n*q))`, without interpolation. Files are created exclusively with mode 0600; choose a fresh `LOAD_OUTPUT` for each run. These new records do not retroactively supply the missing raw latencies for the historical `10a674c` run.

Raw timing contract verification passed on a separate three-player, thirty-second localhost smoke after instrumentation: all 116 confirmed-action samples and 19 scoring-category samples were present. Independently sorting the raw durations reproduced every reported p50/p95/p99 exactly. Source hashes matched, every record used the allowlisted fields, tested credential strings were absent, and file mode was 0600. Two focused unit tests also passed for quantile/filter behavior, bounded truncation, and field exclusion. This checks recording correctness only; it does not establish 100-player performance or replace the historical full run. Evidence: `test-results/raw-timings-contract-verification.json` and the corresponding smoke artifacts.
