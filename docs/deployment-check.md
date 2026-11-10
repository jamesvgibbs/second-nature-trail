# Deployment check

Updated: 2026-11-10. Local container validation only; no production service was created or published.

## Current packaged runtime: 1154c82

Built from a clean Git archive of **1154c82**, including the live Neighbors controls and explicit map chapter status. Image: `second-nature-trail:1154c82`; image ID `sha256:bee6775e837553304cce79762f52a8c73437ec1a964d39870543e86355d33972`.

The targeted production-mode check passed non-root Node 24 startup and health. All seven public assets matched the exact commit both inside the image and when served over HTTP; JavaScript and module MIME types passed. The server, engine, content, checkpoint helper and Dockerfile hashes still exactly match the durability-tested revision 9939a98. Default Secure-cookie configuration remained enabled; this check required no logins or gameplay. Its disposable loopback container and volume were removed, while the local image remains available.

Evidence: [packaging report](../test-results/container-1154c82-static.json), [smoke log](../test-results/container-1154c82-static.log), [build log](../test-results/container-1154c82-static-build.log). Repeat with `node scripts/smoke-container-static.mjs <full Git commit>` using Node 24 and Docker. The combined suite at this source passed 152 tests with zero failures or skips in 3.49 seconds: [full suite](../test-results/full-suite-1154c82-runtime.log). This targeted check does not repeat the capacity or backup/restore runs below. Their original source revisions remain authoritative.

## Durability-tested runtime: 9939a98

Built from a clean Git archive of **9939a98**, including role isolation, finale endings, paused display context, and bounded shutdown. The image is `second-nature-trail:9939a98`, image ID `sha256:e5336274d412c78bd55d1b3e92426db0d0534a326aba7644a37569ced3ee4be6`. It uses the pinned official Node 24.20.0 Debian slim base `sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e` and runs as non-root UID 1000.

The production-mode smoke passed on two disposable Docker named volumes with synthetic identities:

- Health, game assets and module MIME types; two operators and a separate safe presentation session; rejection of a conflicting login without replacing the original player session.
- A committed quiz, atomic barter, ordered accessibility settings, a pending trade, and a paused event; live SQLite WAL backup with integrity validation and overwrite refusal.
- Graceful stop with an explicit three-second grace, container removal and recreation on the same volume. Shutdown completed in 1,152 ms with exit 0. Score, inventory, settings/cursor, pause, identities and idempotent request replay survived; the pending trade was cancelled; the projection epoch changed.
- Restoration of the supported SQLite backup into a fresh volume. The restored state and session identities matched, committed quiz replay did not duplicate points, and SQLite integrity check returned `ok`.

Evidence: [report](../test-results/container-9939a98.json), [smoke log](../test-results/container-9939a98-smoke.log), [build log](../test-results/container-9939a98-build.log). The report records hashes of the packaged runtime files. The combined suite at this runtime passed 143 tests with zero failures or skips in 3.31 seconds: [full suite](../test-results/full-suite-9939a98-runtime.log). Repeat with `node scripts/smoke-container.mjs <full Git commit>` from the repository using Node 24 and Docker. The helper uses exclusive disposable resources, does not deploy a service, and removes its containers, volumes and temporary credentials after the check. It leaves the image locally available.

The test bound only to 127.0.0.1 over HTTP and disabled Secure cookies only for that disposable check. The image default keeps Secure cookies enabled. Production still needs an approved host/domain, HTTPS, durable storage, credentials, roster, retention decision, and backup/restore validation on that actual host. This local check does not establish production network latency or human event readiness.

## Shutdown finding and correction

The preceding c37f09a container stopped with exit137 after approximately 3.15 seconds using an unspecified Docker stop timeout. Its lock correctly blocked recreation after forced termination. A disposable diagnostic build from c37f09a observed zero registered SSE streams but five HTTP connections during shutdown; with an explicit 10-second grace it drained in about 4 seconds and passed both restart and backup restoration. These results do not imply persisted data corruption, and the diagnostic build is not the distribution image. Evidence: [original failure](../test-results/container-c37f09a-attempt4.json), [diagnostic result](../test-results/container-c37f09a-shutdown-diagnostic.json), [diagnostic log](../test-results/container-shutdown-diagnostic.log).

Independent native reproduction also showed an empty TCP connection or incomplete POST could hold shutdown indefinitely. Revision 9939a98 keeps a shared shutdown promise, rejects new work and body completions once shutdown begins, flushes already queued commands, and bounds remaining HTTP connections to a one-second drain. Final persistence and database closure precede nonce-checked lock release. It does not remove stale locks automatically. Three targeted regressions cover raw idle/partial sockets, late requests, repeated close calls, SSE closure, queued-command durability, and reopened score/idempotency. [Test output](../test-results/server-shutdown-after.log).

## Separate native capacity evidence

Frozen runtime **d042570** completed the normal real-time schedule with 100 players, two operators and one presentation. All 800 chapter objectives completed; 84 trades and a 30-second outage/reconnect ran without errors. Independent verification found 15 qualifying distinct winners and reconciled the complete action evidence. Scoring/inventory p95 was 231.08 ms across 12,452 samples; all 103 streams received 18 timed boundaries, with maximum 392 ms receipt lag. [Capacity summary](../test-results/capacity-full-d042570-summary.json).

That was a native-Node localhost capacity run, not a container or representative-network load test. Subsequent role, display-context and shutdown changes are covered by their focused tests and the current container smoke, not by a second claim of that hour-long run. See [acceptance](acceptance.md) for remaining browser, human and production gates.

## Historical checks

Runtime 10a674c passed its local production-mode startup, role, ordered-setting and lobby restart checks. Its separate native capacity run completed but failed the 500 ms target with p95 506.95 ms; its legacy completion-time evidence lacked exact clock provenance. Those limitations are preserved in the [historical capacity summary](../test-results/capacity-full-10a674c-summary.json), while the later d042570 evidence above supersedes them for that frozen runtime. [Historical container report](../test-results/container-10a674c.json).

The older c595925 image passed a small non-root lobby restart/role smoke but predates subsequent navigation, ordering and runtime changes. [Historical container report](../test-results/container-c595925.json).
