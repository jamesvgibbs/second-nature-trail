# Release evidence

Status: not release-approved. Updated 2026-11-09. This checklist records evidence; the presence of code is not a passing test. Automated tests cannot replace employee rehearsals, content approval, or hardware/browser measurements.

## Evidence register

| Scope requirement | Evidence needed | Current status |
| --- | --- | --- |
| Ready within three minutes | Ten representative employees, at least nine successful unassisted; start/end times | Pending human test |
| 100-player capacity | Full 60-minute active run, 100 joins over 60 seconds, two operators, presentation, trades, submissions, reconnects | Pending measured run |
| Meeting operation | Full 95-minute dress rehearsal, attendee/input-method record, host commentary, awards | Pending human rehearsal |
| Rendering | Lowest-spec agreed laptop and browser; >=30 FPS for 95% of measured play | Hardware baseline and measurement pending |
| Action latency | Representative network profile; p95 confirmed inventory/scoring <=500 ms; sampling method | Network profile and measurement pending |
| Clock | Phase transitions within one second of server under agreed network | Pending measurement |
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

- `node --test test/integration-security.test.mjs`: seven passing tests on 2026-11-09. Covers role separation, invitation takeover/session revocation, client lease requirement, request origin/type/size, restart identity, single database owner, roster freeze, mixed valid/invalid queued actions, and rollback/retry after simulated persistence failure. Re-run with pinned Node v24.20.0 also passed. This is transport coverage, not full game acceptance.
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
