# Target controls and operator session review

Native Safari 27.2, frozen review checkout f1218bf (client f012152), isolated chapter-5 waiting preview on port 4174, Node 24.20.0. The review used the real UI and one test player. Earlier chapters were intentionally unplayed. The preview was stopped normally after this review. The user's port-4173 preview and the full capacity run were untouched.

## Observed operator behavior

The local operator login rendered the participant roster, 1 connected player, 0 ready, and the existing preview-operator control owner. Pause required a confirmation containing the event name, roster count, current phase, and editable reason. Confirming with “Verify frozen target selection during pause” changed the owner to operator-1 and recorded the action, time, and reason in the visible operator log.

The player showed PAUSED at 02:31, with its action buttons disabled. The E key could still open the nearby target dialog for inspection; Resolve was disabled and the dialog said “Play is paused.” Selecting the marked A target and enabling automatic confirmation left the resolution count at 0/6. The screenshot [target-auto-paused.jpg](../test-results/target-auto-paused.jpg) shows that state. This is rendered-state evidence only: the player cookie had been replaced by the host login, as explained below. It does not independently prove that an authenticated player submitted no paused request.

Resume required its own reason and confirmation. The operator log recorded “Continue isolated target-control review,” approximately 53 seconds after pause. The player returned to chapter play at 02:30, closed the old dialog, and retained zero score. No broader host, presentation, trade-freeze, or countdown pass is claimed.

## Discovered session defect

Signing in as host in a second Safari tab replaced the shared player cookie. The original player stream continued showing CONNECTED. A subsequent manual target action produced “Please sign in with the correct invitation.” No resolution was credited. Source inspection confirmed a single role cookie and an already-open stream retaining its former identity. This is a misleading authorization-state defect, not evidence of a scoring failure.

Hosting and playing currently require separate browsers or profiles. Another tab in the same profile does not isolate sign-in. A corrective implementation is being prepared separately from the frozen capacity run; this document does not claim it is fixed.

## Authenticated recovery and target controls

Navigating back to the original demo invitation offered explicit takeover. Taking over restored the same player, default settings, zero score, and the ongoing chapter. No new progress was supplied by a fixture or API.

With the recovered player authenticated, automatic confirmation was enabled and then disabled through its checkbox. No target was selected during those toggles, and progress stayed at 0/6. Later, in round 32, the marked A target was selected and the visible Resolve button was clicked during its open signal. The UI reported “Outbreak resolved,” showed 1/6, and disabled repeat resolution.

In round 33, automatic confirmation was re-enabled with no current selection; progress remained 1/6. Deliberately selecting marked C during the open signal then produced the success message, 2/6, and a disabled Resolve button without a separate confirmation click. This verifies manual resolution after disabling and selected-target resolution after re-enabling, not a complete chapter or both-method matrix.

Several earlier attempts encountered changed rounds or stale accessibility IDs. They did not receive success feedback or increase progress. The successful steps above were based on a fresh visible warning marker and signal state. The capture taken just after the second success landed at the normal brag transition: [target-control-review-brag.jpg](../test-results/target-control-review-brag.jpg) shows Neighbor 1 with a chapter ranking metric of 2 and no qualifying prize recipient. It is not a screenshot of the target panel or a completed objective.

Remaining work includes an authenticated separate-session paused auto-confirm check, host/presentation coverage, and the session defect's fix and regression verification.
