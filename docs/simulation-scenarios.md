# Behavioral simulations

The automated checks use isolated temporary SQLite files and loopback ports. They do not open the saved demos or the paused art-review fixture. Browser appearance and input behavior require the separate client/native evidence; none of these scripts proves that every possible interaction is correct.

## Mixed decisions across the whole game

```sh
node scripts/simulate-event.mjs test-results/simulation-mixed-new.json
```

This runs 24 real HTTP/SSE participants through all eight chapters, the finale and awards. An injected server clock advances between actions to exercise timed rules quickly. Every position change, task, trade, assist, quiz, secret, reward and host action uses the normal API. No position, inventory, score or completed objective is assigned directly.

Assertions cover three cargo plans and both routes; concurrent trade confirmations and conservation; duplicate/conflicting request IDs; wrong first quiz answers that cannot be overwritten; wrong spatial, targeting, routing and challenge outcomes followed by retries; eighteen correct target signals; incomplete and late payments; optional expenses; every reward project; eight clues and the mystery; pause/resume; and a real SQLite close/reopen preserving identities, inventory and progress. A frozen journal and export are independently replayed for inventory provenance, scores, qualification, seeded allocation and fifteen distinct winners. The report lists verified coverage and expected rejections. A subprocess regression also supplies a sentinel `DB_PATH` and confirms it remains untouched.

This is a synthetic-clock behavioral check, not evidence for the normal one-hour schedule, realistic reaction times, sustained capacity or browser rendering. Authored answer keys are used only by the test process to choose inputs; wrong answers are deliberately submitted as well.

## Current normal-clock 100-player event

```sh
LOAD_EXPECT_FULL=1 LOAD_PLAYERS=100 LOAD_JOIN_SECONDS=60 LOAD_SECONDS=3605 \
  LOAD_OUTPUT=test-results/capacity-current-new.json node scripts/load.mjs
```

The existing load harness keeps normal clocks and movement limits, uses two operator streams and one safe display, and plays all eight main activities, learning questions, optional challenges and secrets. It includes trades, assists and a thirty-second player outage. Strict mode requires all 800 main objectives, fifteen distinct award recipients, a completed trade and reconnect, no unexpected errors, and independent frozen-result reconciliation. It writes raw timings, phase observations, export, bound request journal and independent audit alongside the report. Phase observations are independently audited; shared-host timings are not representative company-network acceptance.

Keep source labels exact: a run already in progress retains the modules loaded at launch. Later fixes are covered by their own regressions and cannot silently be attributed to that earlier run.

### Recorded mixed-decision result

The frozen `bfb89d9` scenario passed on November 17, 2026 in 24.00 seconds of wall time using its explicitly accelerated clock. All 24 identities completed each main objective, secret and optional challenge: 192 of each. Twelve deliberate invalid requests were rejected. The [report](../test-results/simulation-mixed-bfb89d9.json), [frozen export](../test-results/simulation-mixed-bfb89d9.export.json), [bound journal](../test-results/simulation-mixed-bfb89d9.journal.json) and [process log](../test-results/simulation-mixed-bfb89d9.log) retain the exact inputs and source hashes. Independent ranking, inventory and recorded-outcome replay all passed with no evidence gaps. Its [subprocess regression](../test-results/simulation-mixed-bfb89d9-test.log) also passed.

During harness construction, four attempts stopped on harness assumptions: the expected wording for a correct paused-action rejection, the projection epoch field name, normal rate-limit pacing, and a stale pre-restart client snapshot that had not yet refreshed a peer’s earned assist. Those were corrected in the simulator. They are distinct from the actual paused-phase `endScoring` guard defect, fixed in `509854b` and covered by the host-control regressions.

## Seeded adversarial sequences

```sh
SIM_PROPERTY_REPORT=test-results/simulation-properties-new.json \
  node --test test/simulation-properties.test.mjs
```

Eight independent three-player databases each earn a real delivery objective, race two overlapping trade confirmations, then execute 90 seeded actions. The actions mix valid and invalid supplies, quantities, quiz indices, task choices, assists, cancellations, movement and request reuse. Invariants check every original item’s exact owner or single consumption event, storage/reserve bounds, immutable first answers and completed objectives, complete rollback of rejected requests, and snapshot/award stability. Concurrent duplicate requests must return the same result; competing offers must commit exactly one transfer and cancel the other.

Recovery sequences exercise pause, rescue, shorten, resume, skip versus ranked continuation, early scoring freeze, both finale endings, close and SQLite reopen. Every final export is independently reconciled. Reopen comparison uses the documented JSON storage representation, where numeric negative zero serializes as zero.

The [validated report](../test-results/simulation-properties-validated.json) and [test log](../test-results/simulation-properties-validated.log) passed at `e06bf60`: 720 randomized steps, 44 successful replay checks, 75 concurrent duplicate pairs and eight competing trade races. The recorded serial action attempts include 459 accepted and 446 expected rejections. All eight independent audits and reopen checks passed. The bounded seeds exercise combinations; they are not a claim that every possible interleaving or state has been exhausted.
