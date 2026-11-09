# Performance evidence

Updated 2026-11-09. The later frozen `d042570` complete localhost run passed its measured latency check at p95 **231.08 ms**, independently recomputed from raw samples; representative-network acceptance remains pending. Details follow below.

The historical completed `10a674c` run exercised 100 players, both operators, and presentation through 60 real game minutes. It completed every objective for every player, but scoring/inventory latency **failed the 500 ms target**: p95 506.95 ms and p99 1,097.72 ms over 12,452 samples. That historical harness did not export individual timing values. Its computed percentiles cannot be independently reconstructed afterward. See [the full-run summary](../test-results/capacity-full-10a674c-summary.json).

## Alternating synthetic profiles

These measurements reconstructed a late-event fixture from the captured journal. Missing top-level/trade details were synthesized; routing opportunities, positions, reserve, and score were reset between waves. Each run used 100 players, two operators, presentation, two warmup waves and ten measured 100-command waves. All eight runs recorded 1,000 scoring samples and no request errors. Movement-enabled cases also sent roughly 9,100–9,800 movement actions.

Clients and server shared the development Mac over localhost with instrumentation enabled. Root stopped its isolated 4174 browser work and Docker/full-suite work; the user 4173 preview and unrelated computer activity were uncontrolled. This is neither a normal event nor representative-network acceptance.

| Alternating run | Scoring-only p95 | With movement p95 |
| --- | ---: | ---: |
| Baseline `151c0e0`, first | 471.64 ms | 538.99 ms |
| Timer candidate `9252731`, first | 507.25 ms | 479.28 ms |
| Baseline, second | 490.17 ms | 498.28 ms |
| Timer candidate, second | 449.79 ms | 496.68 ms |

The candidate skips idle deadline snapshots and reuses a serialized mutation. It reduced measured state-serialization counts from 110 to 10 in scoring-only cases, and approximately 160 to 60 with movement. **The latency comparison is inconclusive:** results vary, and movement p95 remains near 500 ms. These data do not establish dependable headroom or a passing complete-event result.

Per-command checkpoints remained a substantial measured cost: roughly 2.65–2.74 seconds total across 1,000 commands. This supports investigating narrower rollback copies; it does not prove that any proposed replacement is correct or faster. Profiling categories overlap and must not be added as independent portions of response time. The reports explain their timing boundaries.

Source hashes, journal hash, counters, distributions, GC/event-loop observations, and transaction samples remain in the [comparison](../test-results/late-profile-9252731-comparison.json) and its eight linked reports. Raw CPU profiles remain locally available but are excluded from Git by the existing ignore rule. A [read-only evidence check](../test-results/late-profile-evidence-check.json) binds the 19 JSON/log artifacts and records consistency/privacy inspection; no measurements were rerun for that check.

## Rejected JSON-copy change

The [checkpoint-copy microbenchmark](../test-results/checkpoint-copy-9252731.json) used a 731,956-byte synthetic late-event mutable state, six alternating rounds, and 50 copies per method per round. Mean copy time was 2.927 ms for `structuredClone` and 3.215 ms for JSON serialization/parsing. JSON was slower in every round, so no runtime switch was made.

Value-equivalence and retained-history-reference checks passed on ten representative JSON-shaped states. That does not establish preservation of undefined values, nonfinite numbers, bigint, cycles, or shared-reference topology. This was a copy-kernel comparison, not HTTP latency or capacity evidence.

Any later checkpoint optimization needs independent rollback review and focused failure tests before equivalent profiling. A new frozen-source complete-event run and the specified representative-network measurement remain required for performance acceptance. The historical failed full run is preserved as failed; synthetic profiles do not replace it.

## Scoped player checkpoints

The next paired comparison used baseline server `6284c63` and candidate `c9ea9c5`, which snapshots players when a synchronous command first accesses them. Both use the same engine, content, profiling script, and captured journal. The helper hash is recorded in both cases, but the baseline server does not use it. Independent source review found no player-alias bypass in current command paths; rollback equivalence tests cover barter, supplier credit, assists, freeze, rejected commands, and persistence failures.

| Paired run | Scoring-only p95 | With movement p95 |
| --- | ---: | ---: |
| Baseline, first | 453.80 ms | 466.14 ms |
| Scoped candidate, first | 213.44 ms | 253.58 ms |
| Baseline, second | 436.56 ms | 467.03 ms |
| Scoped candidate, second | 221.35 ms | 243.30 ms |

Each report contains 1,000 awaited scoring responses, zero reported errors, and 103 streams observed without an ended flag. Command scope including validation fell from roughly 2.64–2.67 seconds to 0.469–0.486 seconds per 1,000 commands. These repeat measurements support a substantial improvement for this synthetic fixture. They do not establish a passing complete event or representative-network latency.

The candidate finished the waves sooner, so movement counts and elapsed time differ. Movement instrumentation also has a window-boundary limitation: candidate pair two records 9,019 server movement dispatches but 8,919 measured client responses because warmup requests can cross the instrumentation start. The scoring waves are awaited and retain the same 1,000 samples. The localhost/shared-host, reconstruction, instrumentation, and overlapping-category limits above still apply. No new benchmark was run during the independent review.

The [scoped-checkpoint evidence check](../test-results/late-scoped-evidence-check.json) links all eight reports, binds their 16 JSON/log artifacts, verifies source hashes against the recorded commits, and records count and credential/payload inspection. Full-event and representative-network acceptance remain pending.


## Complete-event validation after scoped checkpoints

The frozen `d042570` run completed 3,608.334 real game seconds with 100 players, two operators, and presentation. All 800 main objectives completed; 84 trades and the planned thirty-second reconnect were recorded with no request errors. Scoring/inventory p50/p95/p99 were **125.10 / 231.08 / 316.32 ms** over 12,452 accepted samples. Independent raw-series recomputation matched exactly; all 75,228 accepted-action rows were retained, with no truncation. The highest chapter-specific scoring p95 was chapter 8 at 404.94 ms.

Ranking, inventory replay, recorded outcomes, exact objective-time reconciliation, and the hash-bound journal all passed independent verification. All 103 connections observed all eighteen scheduled boundaries, maximum Node SSE receipt lag 392 ms. See the [complete-event summary](../test-results/capacity-full-d042570-summary.json), [timing verification](../test-results/capacity-full-d042570-timing-verification.json), and [acceptance qualifications](acceptance.md#completed-scoped-checkpoint-capacity-run).

This closes the local full-event performance regression. The environment was still a shared development Mac and localhost, with light Safari activity, not the agreed representative company network or rendering laptop. The later session-role guard `c37f09a` is outside the frozen workload. Production performance and human release gates remain pending; the old failed run remains failed.
