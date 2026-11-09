# Performance evidence

Updated 2026-11-09. The completed `10a674c` run exercised 100 players, both operators, and presentation through 60 real game minutes. It completed every objective for every player, but scoring/inventory latency **failed the 500 ms target**: p95 506.95 ms and p99 1,097.72 ms over 12,452 samples. That historical harness did not export individual timing values. Its computed percentiles cannot be independently reconstructed afterward. See [the full-run summary](../test-results/capacity-full-10a674c-summary.json).

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
