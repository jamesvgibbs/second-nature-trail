# Deployment check

Date: 2026-11-09. Local container validation only; no production service was created or published.

The Docker image built successfully from the pinned official Node 24.20.0 Debian slim image. Its base digest is `sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`.

The non-root container started with a writable temporary database mount. HTTP checks passed for health, the game page, JavaScript-module MIME type, authenticated read-only presentation, and rejection of presentation credentials from host state. The test container bound only to 127.0.0.1 and was removed after checking. Its test-only credentials had no employee data or production access.

Production still requires an approved host/domain, HTTPS, durable storage, operator credentials, read-only display credentials, roster import, backup/restore verification on that host, and a retention decision. The container's production default keeps Secure cookies enabled. The local HTTP check disabled that flag only in its disposable test container.

A local container smoke check does not establish production network latency, production durability, or event readiness. Build the final reviewed source again before deploying, since browser-only fixes may follow this check.

## Frozen build c595925

Built `second-nature-trail:c595925` from the frozen source. Image manifest list: `sha256:30d11daae5aea3c9657d1319bdc1eee579c9682296e5088fa6fa8fb848eea60d`.

The non-root container used a disposable Docker named volume. Opened the lobby through the primary operator, stopped and removed the container, recreated it with the same volume, and verified the lobby state and recorded operator action survived. The backup operator authenticated successfully. The separate presentation credential received safe state and was rejected from host state. Health and the optional frame-recorder module MIME type also passed.

This check used only synthetic credentials and loopback HTTP. The container and test volume were removed afterward. The image remains available locally. Evidence: [container-c595925.json](../test-results/container-c595925.json). This does not establish durability or TLS behavior on an eventual production host.
