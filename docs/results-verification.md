# Independent results verification

`scripts/verify-results.mjs` recomputes category metrics and prize allocation without importing the game engine, its ranking functions, or authored content. Its explicit category definitions implement `trail-0.3.0-draft`; another rules version requires review. Run it after the event has frozen scoring, using Node 24.

Preserve the results export, frozen source/content hashes, load report if applicable, and a SQLite backup. The normal host export omits accepted-request fingerprints. Extract the supplemental journal from the retained backup to verify accepted mystery submissions and first quiz inputs:

```sh
node scripts/backup.mjs data/event.sqlite evidence/event-backup.sqlite
node scripts/export-audit.mjs evidence/event-backup.sqlite evidence/journal.json SOURCE_COMMIT
node scripts/verify-results.mjs evidence/results.json evidence/load-report.json evidence/verification.json evidence/journal.json
```

Create the evidence directory beforehand. The audit extractor opens SQLite read-only, reads one committed state row, refuses an unfrozen event, and creates a new output file with mode `0600` and exclusive creation. It never exports session or invitation tables. Its output contains participant actions and names; retain it with the event's private evidence. Extraction is allowed in finale, awards, or closed. Record a checksum of the original output with the run record.

For an event without the synthetic load report, use the module directly:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyResults } from './scripts/verify-results.mjs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const result = verifyResults(read('evidence/results.json'), {
  requireFifteen: true,
  journal: read('evidence/journal.json'),
});
writeFileSync('evidence/verification.json', JSON.stringify(result, null, 2));
```

The supplemental journal must match the exact frozen export fields, excluding the export's later `operationalAudit`. The verifier checks snapshot hash, request hash, content hash, seed, freeze time, and capture phase/time. Hashes detect changed artifact bytes against their recorded digests; they do not establish authenticity if someone replaces both data and hashes. Preserve the original capture or backup as provenance.

## Interpret each result separately

- `rankingPass`: published metrics, secondary metrics, seeded SHA-256 ties, chronological allocation, exclusion of previous winners, and empty-category fallback match an independent calculation from frozen inputs. `rankings` includes raw qualifying order and eligibility at allocation time.
- `fifteenQualifyingDistinctRecipients`: the independent calculation finds fifteen qualifying recipients. A normal capacity invocation requires this; a skip/recovery event can correctly leave prizes unawarded.
- `inventoryReplayPass`: allocated item IDs, atomic transfer ownership, capacity, first-transfer supplier provenance, consumption, qualifying trader credits, and final item metadata reconcile.
- `recordedOutcomeReplayPass`: recorded quiz/assist/task/secret outcomes reconstruct stored points, primary metrics, completions, and applicable counters without contradiction. This uses the server's recorded correctness outcomes; it does not independently grade every authored answer or prove proximity.
- `fullActionReconciliationPass`: no detected contradiction **and no evidence gap**. Inspect `evidenceGaps`; do not replace this field with a broader “all scoring verified” statement.
- `objectiveTimeObservations`: new builds record `objectiveCompleted` with one exact `completedAt`, the pause-adjusted `chapterOpenedAt`, and their `timeMs` difference. The verifier requires one consistent record per completed objective and matches the frozen duration. Older exports lack this event and retain an explicit evidence gap: cargo outcomes were logged before completion and other outcomes afterward, using separate clock reads. Their observed timestamp offsets are reported without claiming exact reconstruction or inventing a tolerance.
- `journalBound`: supplemental accepted requests belong to this frozen event and have intact recorded hashes. A mystery flag needs its recorded success; first quiz requests must match frozen choice and correctness. Missing/wrong clone classification remains an explicit gap for runs with incorrect clone decisions because that classification is omitted from the action record.
- `phases.pass`: every synthetic client identity, both operators, and presentation supplied all eighteen expected automatic transition observations at the expected deadlines, with no negative or greater-than-one-second lag. This checks Node SSE receipt on localhost. It does not measure browser paint time or the representative company network. The current raw samples lack chapter IDs; chapter progression is checked indirectly through the alternating phase sequence and scheduled deadlines.

The verifier creates its output as a new private file and refuses to overwrite an existing file, including an input artifact. Choose a new output filename for a repeated audit.

CLI exit code 1 signals a demonstrated contradiction in rankings, inventory, recorded outcomes, or phase observations. Exit code 0 can still contain evidence gaps. It is not a release-acceptance flag. The pure functions expose results for other evidence workflows.

The load harness's original `exportReconciles` field is only internal consistency between the engine's awards and its export. Preserve that wording. It cannot substitute for this independent calculation, a human balance rehearsal, or required deployment/network/browser evidence.

## Regression fixtures

```sh
node --test test/verify-results.test.mjs test/export-audit.test.mjs
```

Fixtures cover a known seeded tie winner, secondary ordering, incomplete high scorers, exhausted eligibility, unranked exclusion, altered awards/metrics, duplicate awards, item provenance/rebarter, altered journal bindings, missing accepted mystery results, missing phase connections/transitions, negative/delayed lags, and safe read-only audit extraction. They are small deterministic checks, not capacity evidence.

The exact completion event is an additive audit record. It does not change scoring rules or invalidate saved events. Old completions are never backfilled with invented timestamps; mixed restored events retain evidence gaps for their older objectives. Source hashes identify which build produced each record.
