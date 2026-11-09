# Deployment check

Date: 2026-11-09. Local container validation only; no production service was created or published.

Latest checked runtime: **10a674c**, including exact navigation, ordered projections, and persistent preference-request ordering. The older c595925 image below is historical and excludes these fixes.

The 10a674c production-mode container passed health/module delivery, a synthetic roster invitation, authenticated ordered state, and rejection of an obsolete insect-enable request after a newer replacement choice. The lobby, participant setting, and settings cursor survived container removal and recreation on a disposable named volume. Restart produced a new projection epoch. Backup-operator login and safe presentation isolation also passed. Evidence: [container-10a674c.json](../test-results/container-10a674c.json).

Image: `second-nature-trail:10a674c`; manifest list `sha256:797bf79e50cdf2701ebca8dbb69d9b6acb318ffb680b41495d12917cde17be51`. The local test used loopback HTTP, disabled Secure cookies only for that test, and removed its container and volume afterward. No production readiness is implied.

The Docker image built successfully from the pinned official Node 24.20.0 Debian slim image. Its base digest is `sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`.

The non-root container started with a writable temporary database mount. HTTP checks passed for health, the game page, JavaScript-module MIME type, authenticated read-only presentation, and rejection of presentation credentials from host state. The test container bound only to 127.0.0.1 and was removed after checking. Its test-only credentials had no employee data or production access.

Production still requires an approved host/domain, HTTPS, durable storage, operator credentials, read-only display credentials, roster import, backup/restore verification on that host, and a retention decision. The container's production default keeps Secure cookies enabled. The local HTTP check disabled that flag only in its disposable test container.

The same frozen runtime completed a separate native-Node localhost run with 100 players, two operators, and one presentation through 60 real game minutes and awards. All 100 completed all eight chapters; 15 qualifying distinct winners and inventory/recorded outcomes passed independent verification. All 103 streams received 18 timed boundaries each, with maximum 372 ms receipt lag. This was not a container performance test.

The performance gate remains unmet: scoring/inventory p95 was 506.95 ms across 12,452 samples, above 500 ms; p99 was 1,097.72 ms. The recorded completion time uses an earlier clock read than its outcome log, so exact time provenance remains incomplete even though conditional ranking/inventory/outcome checks passed. Individual raw latency samples were not exported by this historical harness. See [capacity summary](../test-results/capacity-full-10a674c-summary.json) and [acceptance](acceptance.md). Homepage-only revisions after the frozen startup need to be included in any later distribution image.

A local container smoke check does not establish production network latency, production durability, or event readiness. Build the final reviewed source again before deploying, since browser-only fixes may follow this check.

## Frozen build c595925

Built `second-nature-trail:c595925` from the frozen source. Image manifest list: `sha256:30d11daae5aea3c9657d1319bdc1eee579c9682296e5088fa6fa8fb848eea60d`.

The non-root container used a disposable Docker named volume. Opened the lobby through the primary operator, stopped and removed the container, recreated it with the same volume, and verified the lobby state and recorded operator action survived. The backup operator authenticated successfully. The separate presentation credential received safe state and was rejected from host state. Health and the optional frame-recorder module MIME type also passed.

This check used only synthetic credentials and loopback HTTP. The container and test volume were removed afterward. The image remains available locally. Evidence: [container-c595925.json](../test-results/container-c595925.json). This does not establish durability or TLS behavior on an eventual production host.
