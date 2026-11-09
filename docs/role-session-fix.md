# Browser-profile role conflict and recovery

Observed 2026-11-09 by the root agent in native Safari on frozen `f1218bf`: signing into `/host` in the same browser profile as an active player replaced the shared `trail` cookie. The player stream continued showing CONNECTED, but a subsequent target action failed with “Please sign in with the correct invitation.” This is not evidence of a targeting or pause-scoring failure. The browser review and recovery details are recorded separately by the root agent.

Read-only source inspection confirmed the cause in both frozen and current source. Player, operator, and display logins use one HttpOnly cookie with Path=/. The player SSE retains its captured session and lease after another login replaces the browser cookie. Action requests use the new cookie; the prior client displayed the resulting 401 only as a toast.

Prepared on `fix/profile-role-guard` based on `a4dc6a1`, then merged into main as `4f2e97d` and `6b6b268` after the capacity process exited normally. Documentation revision `c37f09a` includes both fixes. The frozen browser checkout and user preview remain unchanged; the completed capacity evidence is explicitly for earlier `d042570`.

## Behavior

- A valid login for a different role returns 409 with `PROFILE_ROLE_CONFLICT` and separate-browser/profile guidance before changing cookies or sessions. All six cross-role directions are covered. Same-role login and existing player takeover remain supported.
- A host can still open the safe presentation state and SSE using its existing host cookie. That flow performs no presentation login and does not change the cookie.
- Invitation entry distinguishes role conflict from invitation takeover, so it does not offer an ineffective takeover action for a role conflict.
- A current player action returning 401 closes the stream, changes status to SIGN-IN REQUIRED, clears pending navigation/target selection/automatic confirmation, and presents sign-in recovery guidance. Later movement/scoring actions are blocked. Callbacks from the closed stream cannot restore CONNECTED; a late 401 from an already replaced connection cannot sign out the current connection.
- A 401 from the player lease probe stops connection setup instead of opening an SSE using an operator cookie.

The design remains one role per browser profile; it does not add simultaneous player/operator cookies. Host plus its safe display remains supported. Same-role identity changes retain the existing behavior.

## Focused validation

Actual binary: `/Users/jgibbs/.nvm/versions/node/v24.20.0/bin/node`, verified `v24.20.0`.

- `node --test test/client-transport.test.mjs`: 13 passed after `7592d92`, including real client-function adapter tests for 401 gating, stale callback isolation, lease failure, and role-conflict entry guidance. Last run: 54.16 ms total.
- `node --test --test-name-pattern='cross-role login preserves|host session opens safe display|explicit takeover revokes' test/integration-security.test.mjs`: 3 passed. The new HTTP test exercises all six cross-role directions, no Set-Cookie on rejection, continued original authority, preserved live player lease/action, same-role relogin, and role separation. Existing tests cover safe host/display streaming and explicit player takeover. Last run: 435.08 ms total.
- Server/client syntax and whitespace checks passed. No full suite or load test was run for this patch during the capacity run; bounded native checks are recorded below.

Bounded native regression of the new guidance and amended sign-in-required UI passed, as recorded below. The previously observed pause state does not prove authenticated no-submit behavior while paused; that separate check needs independent player/operator profiles. The merge occurred after the capacity run finished; combined validation is recorded below.


## Native review follow-up: expired-session takeover

The root agent's native review of `42523bb` verified player-to-host conflict guidance with a subsequent committed player emote, operator-to-player rejection without a takeover offer, and safe host presentation access followed by a committed host lobby action. These are bounded observed passes; the captures and full native ledger are maintained separately by the root agent.

The same review exposed a recovery gap: restarting the isolated in-memory candidate server invalidated its cookies. The player showed RECONNECTING, and Resume here → Take over here remained there because `connect(true)` skipped the player authorization probe. That observation is a failed recovery check, not a sign-in-required pass.

The follow-up probes player authorization for every connection attempt, including explicit takeover. A valid takeover ignores `otherClient` as intended, while 401 enters the existing SIGN-IN REQUIRED state before any new stream opens. Generation guards still discard stale probe completions. Added adapter regressions cover both expired-cookie takeover and authorized takeover with another client lease. The amended native retest passed as described below; the capacity build was unchanged during that isolated review.


## Amended native recovery passed

The root agent retested `7592d92` using in-memory candidate 95250 on port 4175: Safari demo-1 explicitly chose robots and reached CONNECTED. A clean stop followed by fresh in-memory candidate 89421 deliberately invalidated the tokens. Resume here → Take over here now opened Player sign-in required. Closing it left SIGN-IN REQUIRED / Sign-in help, with no Resume here action. Meet guide → Say hello reopened sign-in guidance without practice completion; Open invitation entry reached the real homepage form. Candidate 89421 stopped normally.

This is synthetic authorization expiry, not a durability or restart-restoration test. Earlier `42523bb` cross-role checks preserved a usable player after rejected operator login, preserved host actions after rejected player login, and rendered safe host presentation without operator controls. The main-checkout browser ledger contains seven captures, including the failed initial recovery image explicitly labeled as historical failure. Wider authentication/network/platform and authenticated pause-no-submit checks remain open. The runtime fix is now merged; these native observations remain tied to the isolated candidate revisions above.

## Combined validation after merge

On 2026-11-09, Node 24.20.0 ran the complete suite at `c37f09a`: **131 passed, zero failed, zero skipped**, in 1,632.19 ms. Evidence: [full-suite-c37f09a-runtime.log](../test-results/full-suite-c37f09a-runtime.log). This validates the combined changes; it does not extend the earlier `d042570` capacity measurements to the new login/recovery paths.
