# Browser-profile role conflict: isolated fix for review

Observed 2026-11-09 by the root agent in native Safari on frozen `f1218bf`: signing into `/host` in the same browser profile as an active player replaced the shared `trail` cookie. The player stream continued showing CONNECTED, but a subsequent target action failed with “Please sign in with the correct invitation.” This is not evidence of a targeting or pause-scoring failure. The browser review and recovery details are recorded separately by the root agent.

Read-only source inspection confirmed the cause in both frozen and current source. Player, operator, and display logins use one HttpOnly cookie with Path=/. The player SSE retains its captured session and lease after another login replaces the browser cookie. Action requests use the new cookie; the prior client displayed the resulting 401 only as a toast.

This patch is prepared on branch `fix/profile-role-guard`, in `/tmp/second-nature-trail-role-guard`, based on `a4dc6a1`. It has not been merged into the main checkout, frozen browser checkout, or running capacity build.

## Behavior

- A valid login for a different role returns 409 with `PROFILE_ROLE_CONFLICT` and separate-browser/profile guidance before changing cookies or sessions. All six cross-role directions are covered. Same-role login and existing player takeover remain supported.
- A host can still open the safe presentation state and SSE using its existing host cookie. That flow performs no presentation login and does not change the cookie.
- Invitation entry distinguishes role conflict from invitation takeover, so it does not offer an ineffective takeover action for a role conflict.
- A current player action returning 401 closes the stream, changes status to SIGN-IN REQUIRED, clears pending navigation/target selection/automatic confirmation, and presents sign-in recovery guidance. Later movement/scoring actions are blocked. Callbacks from the closed stream cannot restore CONNECTED; a late 401 from an already replaced connection cannot sign out the current connection.
- A 401 from the player lease probe stops connection setup instead of opening an SSE using an operator cookie.

The design remains one role per browser profile; it does not add simultaneous player/operator cookies. Host plus its safe display remains supported. Same-role identity changes retain the existing behavior.

## Focused validation

Actual binary: `/Users/jgibbs/.nvm/versions/node/v24.20.0/bin/node`, verified `v24.20.0`.

- `node --test test/client-transport.test.mjs`: 11 passed, including real client-function adapter tests for 401 gating, stale callback isolation, lease failure, and role-conflict entry guidance. Last run: 52.38 ms total.
- `node --test --test-name-pattern='cross-role login preserves|host session opens safe display|explicit takeover revokes' test/integration-security.test.mjs`: 3 passed. The new HTTP test exercises all six cross-role directions, no Set-Cookie on rejection, continued original authority, preserved live player lease/action, same-role relogin, and role separation. Existing tests cover safe host/display streaming and explicit player takeover. Last run: 435.08 ms total.
- Server/client syntax and whitespace checks passed. No full suite, load test, or browser interaction was run for this patch during the capacity run.

Native browser regression of the new guidance and sign-in-required UI remains pending. The previously observed pause state does not prove authenticated no-submit behavior while paused; that separate check needs independent player/operator profiles. Review and merge are deferred until the active capacity run finishes.
