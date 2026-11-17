# Move Day crowd and server review

This developer fixture supports a visual review with 100 simultaneous participants. It is a short chapter 1 check, not the full-hour capacity test, a human rehearsal, or production-network acceptance. It uses an isolated in-memory server and never opens the saved 4173/4175 databases.

Use Node 24.20.0 and an interactive terminal:

```sh
node scripts/move-day-review.mjs --players 100 --port 4182
```

The script creates 100 invitations, reserves the first for the reviewer, and joins 99 simulated neighbors through normal HTTP/SSE. Each bot completes ordinary setup and walks to the depot through the real movement API. They remain connected and idle; no completed objectives, supplies or points are fabricated. The human browser becomes participant 100 after opening the printed player invitation.

The terminal prints the player URL, host URL and a fresh local operator token. Use the printed localhost player link and 127.0.0.1 host link to separate their cookies. Use a separate browser profile from saved demos: ports on the same hostname share cookies. The host’s safe-presentation link shares its operator sign-in. Two simulated operator streams and one safe presentation stream also stay connected.

| Command | Effect |
| --- | --- |
| `square` | All simulated neighbors walk to Bragging Square |
| `depot` | They walk to a compact grid near the moving depot |
| `spread` | They walk along the Move Day depot–crossing–home route |
| `district` / `optional` | Walk to the current chapter’s main / optional activity site |
| `start` | Ordinary host start, including the normal ten-second countdown |
| `pause` / `resume` | Normal host pause and resume |
| `repair 5` | Five unfinished bots play three real deliveries each; use only after unrepaired captures |
| `contribute 59` | During finale, 59 existing bots contribute through the normal API; frozen results are checked unchanged |
| `status` | Print phase, exact connected-participant count and completed objectives |
| `quit` | Close this isolated server and discard its walkthrough |

Movement commands obey normal phase rules. Arrange the crowd while in the lobby or an unpaused chapter. They do not teleport, bypass collisions, or move during pause. If stdin closes, the server remains available; SIGTERM stops it. The live scene should bound the companions it draws without hiding the true participant count. Renderer tests and native screenshots establish visual crowd behavior separately from these server connections.

A review controller can reconnect simulated identities to an already-running fixture with `--attach http://127.0.0.1:4182` and its local operator token in `MOVE_REVIEW_HOST_TOKEN`. This uses normal invitation takeover for bots 2–100; it preserves the human identity and existing state. It does not open a new server or database. The replacement controller must be stopped before the original server. These bot reconnects are review activity and must be disclosed in screenshots/evidence.

The optional repair sequence uses a protected repair kit, shortcut essentials, then a protected connection kit. Each bot earns 45 delivery points and 27 useful delivered value, finishes with 0 parts / 3 filters / 1 food / 1 cable, and consumes no personal reserve. Those values are checked against real accepted actions. A completed bot contributes one actual district repair; with 100 invitations that is 1% of the district. No roster denominator is rewritten for the screenshot. In a finale with 100 connected setup participants, the target is 60: 59 bot contributions plus the native reviewer can earn success. Capture unmet progress before contributing. Advancing an unmet finale fixes its fallback ending; success and fallback cannot be earned sequentially in one immutable event.

## Bounded server check

```sh
node scripts/move-day-review.mjs --verify --players 100 --output test-results/move-day-100-new.json
```

Verification uses 100 simulated participants on an ephemeral loopback port, plus the two operator and presentation streams. It keeps the ordinary countdown, completes three deliveries per participant, validates all 1,200 accepted task submissions and final inventories, checks every player projection for private answer fields, and confirms subsequent peer updates retain each player’s completed progress. It then exits. A smaller `--players 3` variant is used in subprocess regression tests.

The report includes exact loaded-source hashes, source files that differ from its recorded Git commit, participant counts, outcome assertions, SSE frame count and observed task response quantiles. The server and clients share one local process; other browser/review activity may run on the same computer. These timings are diagnostic and do not replace the original acceptance evidence. Use a fresh output filename; reports are written exclusively with mode 0600 and contain no credentials.

## Recorded check — November 17, 2026

The [100-participant report](../test-results/move-day-100-0ac6efe.json) and [process log](../test-results/move-day-100-0ac6efe.log) record a successful 25.97-second check on Node 24.20.0. All 100 participants completed their three deliveries; all 1,200 accepted task submissions and final inventories passed the assertions, with no errors or exposed answers. The 9,376 SSE frames preserved each participant’s own progress. Observed task p95 was 44.86 ms.

The backend and harness were committed at `0ac6efe`; the report explicitly records the exact hashes of two uncommitted client files. The separate 99-bot native-review fixture and browser activity were also running on this computer. This result establishes the bounded server scenario above. It does not establish visual acceptance, isolated performance, a complete event, or representative network behavior.
