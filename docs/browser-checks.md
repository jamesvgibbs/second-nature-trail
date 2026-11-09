# Browser checks

Date: 2026-11-09. Operator: automated native Safari interaction through the computer-use tool. Browser version read from Safari's About dialog: **Safari 27.2 (21625.2.8.18.4)**. This is a development smoke check on the available Mac, not the agreed lowest-spec laptop, a browser compatibility matrix, or a representative employee rehearsal.

The checks used isolated `scripts/preview-chapter.mjs` servers on localhost port 4174. Those previews intentionally advance the initial server clock to one chapter and mark earlier chapters unplayed. Normal chapter timers and server validation continue thereafter. The default server on 4173 and the capacity process were not changed by these checks. Screenshots were inspected in the tool transcript; no standalone screenshot artifact was saved.

## Chapter 5: Pest resistance

- Entry displayed both visual-preference radio buttons unselected. Selected “Replace with friendly robots,” then entered the world.
- Used the objective button to walk from Bragging Square to the Apartment block. The targeting panel opened at arrival.
- Inspected a screenshot containing three original robot targets and a warning marker. No insect imagery was present.
- Selected a live marked target by pointer and confirmed it. The confirmation button became disabled and the panel said the action was recorded until the next round.
- Used a numeric shortcut and Space for the next two correct targets. The visible result was score **60**, objective progress **3 / 3**, and district restoration **1**.
- Escape returned focus to the game map. Reopening with E worked.
- Temporarily saved the insect-enabled setting for this synthetic participant, then chose replacement and closed the settings dialog. Reopened targeting and inspected another screenshot: robot visuals remained through live state updates.
- Saved replacement, refreshed the page, and observed score 60 and progress 3 / 3 restored. Settings still showed replacement.

## Chapter 8: Reconnect humanity

- Started a fresh isolated chapter 8 preview and again selected replacement during setup.
- The objective button navigated to the Internet exchange and opened the routing board.
- The screenshot showed a labeled graph and a dashed broken link. The same broken link was explicitly identified in text and in the relevant node buttons.
- Used pointer controls for Exchange → North relay → Neighborhood hub → Home A. The server advanced the panel to Home B.
- Found a keyboard-focus defect: rebuilding the node buttons after Enter dropped focus to the page. Fixed the client to restore focus to the newly rendered node and expose its selected state with `aria-pressed`.
- Reloaded and retested with keyboard only: Tab selected South relay, Enter added it, and focus remained on that selected relay. Tab/Enter added Neighborhood hub and Home B; Tab/Enter confirmed the route. The server advanced to Home C.
- Completed Home C through North relay and Neighborhood hub. Observed score **60**, progress **3 / 3**, and Internet exchange restoration **1**. Closing the panel returned focus to the map.
- At the automatic brag break, observed a recorded highlight naming Neighbor 1 and metric **3 valid homes connected minus invalid attempts**, raw standings, and separate prize eligibility.

## Replacement persistence regression

The earlier local override alone did not satisfy persistence if replacement was selected and settings closed without Save. The client now immediately stores the replacement override locally and submits the visual preference to the server while preserving the other saved settings. A pending local override also applies before the first gameplay frame and retries when connected. Explicitly enabling insects still requires a successful Save.

Retested in Safari after the fix: saved the temporary insect-enabled test setting; selected “Replace with friendly robots”; pressed Escape without Save; refreshed; reopened Settings. The selected value was **Replace with friendly robots**. Three durable helper tests cover pending replacement across a new client read, explicit clearing, and blocked storage. Offline network loss itself was not exercised in Safari during this check.

## Limits

No claim is made here about the employee three-minute onboarding target, a 95-minute real-user rehearsal, all eight chapters completed with each input method, phone/tablet hardware checks, previous browser versions, representative network latency, or rendering performance. Those remain separate acceptance evidence.

## Finale spot check

The chapter 8 preview transitioned automatically from its brag break to the finale. Clicking Restore a home filled the contribution meter and produced a distinct map tile labeled YOUR REPAIR and a confirmation identifying repair 1. The client was then corrected to display the server-authored finale ending and disable the participant's contribution button once their repair is recorded. This is a UI change; award snapshot and server contribution rules were unchanged.

After reloading Safari, verified the authored success line was visible: “The neighborhood is back online. The AI has accepted a new job: labeling extension cords.” The button showed “✓ Your home is restored” and was disabled. The isolated preview remains on a safe game view.

## Pointer-only mystery entry

Added clickable discovered-clue letters, Backspace, and Clear answer while retaining the ordinary text field and the same server-validated reveal action. Helper-created buttons now explicitly use `type="button"`, so avatar, palette, and letter controls cannot accidentally submit enclosing forms. The disconnected action helper returns `null` consistently, preventing reconnect failures from being mistaken for successful setup or actions.

First tested with an ordinary isolated chapter 8 preview: walked to AI headquarters and actually discovered the chapter's R clue. Opened the mystery and clicked R, Backspace, R, R, and Clear answer. The answer field visibly changed through R, empty, RR, and empty without typing or unintended submission. Clicking Reveal with only the R clue was correctly rejected with “Find all eight clues first.” This exposed a dialog feedback issue: the toast was behind the modal and absent from the accessibility tree. Feedback now appears in a live region inside the open dialog; after reload, the same rejection was present in Safari's accessibility tree. Also verified that changing an avatar after choosing visual preferences stayed on setup instead of submitting it.

For the complete answer check, used **`scripts/preview-mystery.mjs`, a synthetic UI fixture** with all eight clues preloaded for Neighbor 1 in an in-memory database. The visible banner explicitly said: “UI FIXTURE ONLY: all eight clues are preloaded for Neighbor 1. They were not earned through gameplay.” This does not establish legitimate clue acquisition, balance, prize qualification, or an event result.

Clicked the eight visible clue buttons N, E, I, G, H, B, O, R in order. Safari's accessibility tree showed the answer field value **NEIGHBOR**. Clicked Reveal the message with the pointer. The dialog closed. Refreshed and observed **✓ Mystery solved**, confirming the server-saved discovery flag. No typing was used to enter or submit this complete answer. The real event and capacity processes were not changed.

## Restoration, first-use controls, and small-window layout

Used `scripts/preview-restoration.mjs`, an explicitly labeled in-memory visual fixture with preloaded completion counts `[5,10,15,20,0,0,0,0]` against the server's 20-person frozen roster. These counts were not earned through gameplay. Observed four district relay stages and progressive roadside debris removal, plus **50 completed objectives / 31% restored / 69% AI control**. The first brag break showed the next chapter's title, objective, and both locations. The first-use dialog described keyboard and pointer controls, dismissed with Tab/Enter, and returned focus to the map.

Resized a dedicated Safari window from approximately 1675×1134 to a screenshot size of **1030×703** (approximately 1030×651 page content, inferred from visible browser chrome; CSS viewport was not instrumented). No minimum-window banner appeared. At this size, the first-use dialog fit, the footer remained reachable, the mission sidebar scrolled, and all sixteen location names were readable in the Map menu. Canvas location labels are decorative and too small to read comfortably at this size; the Map menu supplies the same names as text. Saved Extra large text (24px), opened Map with the keyboard, and observed a visible focus outline and a scrollable dialog. The review window was restored to its prior approximate size. This is layout evidence only, not lowest-spec performance or measured FPS evidence.

## Remaining control matrix (final activity revision)

The later targeting revision requires six hits at each of three sites with a preparation signal; the later routing revision adds required relays and cable budgets. Earlier targeting/routing observations above describe the earlier versions and **do not certify these final revisions**. Rewards redemption and the optional selected-target automatic confirmation also still need browser checks.

A full eight-chapter × keyboard/pointer matrix was started but could not safely proceed: native Safari repeatedly reported that the user changed the application and switched back to the original 4173 window. A dedicated Chrome tab then showed unexpected typed text that this reviewer had not entered. Browser input was stopped to avoid competing with user activity. Direct Safari tab control and the isolated in-app browser were unavailable through the installed computer-use surface. No chapter-one gameplay was completed in this attempted matrix. The isolated chapter-one server was stopped. Source checks and pure route-cost, restoration, safe-preference, and device-policy tests are separate evidence; they do not replace the pending browser matrix.

## Post-c595925 failed-enable safety patch

Static inspection found a pre-acknowledgment assignment that could enable local insect rendering after a failed Settings save. The client now changes to insect rendering only after the explicit enable request succeeds; replacement remains immediate. Setup uses the same ordering. No backend/content/harness changes were made. Syntax and the existing three safe-override helper tests passed. The asynchronous failed-enable/offline browser sequence remains untested; [the controls matrix](controls-matrix.md) specifies the exact regression and separates all final-revision keyboard/pointer evidence.

## Invitation homepage layout, 2026-11-09

Jim requested a homepage that fits without a scrollbar. The invitation screen now uses a viewport-filling three-row layout, a smaller responsive headline, compact spacing and footer, and a decorative canvas that does not impose its own minimum height. The character setup screen is unchanged.

Verified through native Safari on the current local preview: at a 1035×708 outer window (approximately 1035×656 page area), the complete invitation form and all three footer sections are visible and the accessibility tree has no scrollbar. The same check passed at a 1625×988 outer window. Two browser zoom-in steps add a scrollbar; scrolling reaches the form and complete footer. Zoom and window size were restored. Exact CSS viewport dimensions were not measured. This is homepage evidence only, not the full browser/device or gameplay matrix.

Screenshots: [before](../test-results/homepage-before-compact.png), [compact after](../test-results/homepage-after-compact.png), [enlarged content reachable](../test-results/homepage-enlarged-reachable.png), [desktop after](../test-results/homepage-after-desktop.png). These homepage-only changes follow the 10a674c frozen backend used by the concurrent capacity run; that run does not exercise the homepage rendering.


## Chapter 8 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check on source **`81953ca`**, with runtime **`10a674c`** and homepage/UI revision **`f012152`**. The fresh in-memory `scripts/preview-chapter.mjs 8` server used the verified NVM **Node v24.20.0** binary. Safari was **27.2 (21625.2.8.18.4)**, confirmed from its version metadata. The screenshot's outer window measured **1379×851**; the CSS viewport was not measured. This chapter preview skipped earlier chapters through its labeled initial clock offset. The immediate helper began chapter 8 **10 seconds into its phase**, leaving **290 seconds before tool/setup delays**; the chapter clock then ran without extension. Its owned session 42646 was stopped after the check.

Setup explicitly selected **Replace with friendly robots**. The control-preference setting remained **Keyboard**, but every gameplay interaction after entry used pointer/AX clicks only. The preference label does not classify the test: the actual inputs do. The review resumed from fresh native state and scrolled the offscreen Enter button into view before entry; there was no further interruption. Earlier interrupted attempts remain historical and are not counted as passes.

- Visited and completed all three current spatial network stations. The routes used costs **8/9**, **8/9**, and **12/12**, including each required relay and avoiding broken links.
- Observed objective progress **3/3** and main score **60**, with **02:49** remaining on the chapter clock. The clock time consumed includes the initial 10-second preview offset as well as setup.
- Opened Q8.1, clicked choice 1, and confirmed the first answer. It was recorded correct and the score increased to **70**.
- Opened Q8.2, clicked choice 2, and confirmed the first answer. It was recorded correct and the score increased to **80**, with **02:10** remaining.
- Clicked the browser reload control. Score **80** and objective progress **3/3** persisted. Reopened Learning encounters by pointer and observed both completion checkmarks after the refresh.
- No error or penalty was observed during this run.

Artifacts: [chapter 8 pointer completion](../test-results/chapter8-pointer-complete.jpg) and [learning completion retained after refresh](../test-results/chapter8-pointer-learning-persisted.jpg).

This closes only the **M8 pointer**, **Q8.1 pointer**, and **Q8.2 pointer** cells in [the controls matrix](controls-matrix.md). This pointer run alone establishes neither keyboard completion nor input-method comparison, representative human timing, a full browser/device matrix, the failed-enable/network-outage regressions, or final host/presentation rendering. The earlier Safari evidence likewise does not certify the later ordering and settings-race revisions or the other expanded activities.


## Chapter 8 keyboard-only, final revision, 2026-11-09

The root agent completed a separate automated native Safari run on **`81953ca`**, runtime **`10a674c`**, UI **`f012152`**, using the actual NVM **Node v24.20.0** binary and Safari **27.2 (21625.2.8.18.4)**. The outer window remained **1379×851**; CSS viewport dimensions were not measured. This was a fresh in-memory `scripts/preview-chapter.mjs 8` preview, owned session **30493**. Prior preview **65990** elapsed during a context interruption before any gameplay; it was stopped cleanly and contributes no completion evidence.

Setup used pointer input to choose friendly robots. **After Enter, all gameplay used only Tab, Shift+Tab, Return, and Escape; browser refresh used Cmd+R.** No pointer input was used for gameplay. The chapter clock was never paused or extended. The immediate helper's initial offset began chapter 8 **10 seconds into its phase**, so **290 seconds**, rather than a fresh 300 seconds, were available before tool/setup delays.

| Observed action | Result | Chapter time remaining |
|---|---|---|
| Home A, valid route costing 8 of 9 | Score 20 | 04:11 |
| Home B, valid route costing 8 of 9 | Score 40 | 03:48 |
| Home C, valid route costing 12 of 12 | Score 60; objective 3/3 | 03:03 |
| Q8.1, choice 1, first answer correct | Score 70 | 02:45 |
| Q8.2, choice 2, first answer correct | Score 80 | 02:27 |
| Cmd+R, then keyboard reopening of Learning encounters | Score 80, objective 3/3, both completion checkmarks retained | Refresh at 02:24 |

Selected-node focus was restored after node-button redraws, with a visible outline. There was one native-input interruption before the first Home C node. A fresh accessibility observation showed the unchanged panel with Close focused; the reviewer inspected a screenshot and the subsequent Tab succeeded. This did not require pointer gameplay. No gameplay error or penalty was observed.

Artifacts: [chapter 8 keyboard completion](../test-results/chapter8-keyboard-complete.jpg) and [keyboard learning completion retained after refresh](../test-results/chapter8-keyboard-learning-persisted.jpg).

This closes **M8 keyboard**, **Q8.1 keyboard**, and **Q8.2 keyboard**. Together with the separate pointer run above, chapter 8 has observed equivalent outcomes: the same three valid routes, both first answers correct, score **80**, and progress/checkmarks retained after refresh. The timestamps describe these automated runs; they do not establish human performance or a speed advantage for either input method. At the end of that run, the other seven chapters, other browsers/devices, human rehearsal, final host/presentation rendering, and the outstanding safety/network regressions remained pending. Later chapter evidence is recorded separately below.


## Chapter 6 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari run on **`81953ca`**, runtime **`10a674c`**, UI **`f012152`**, with verified NVM **Node v24.20.0**, Safari **27.2 (21625.2.8.18.4)**, and the same **1379×851** outer window. CSS viewport dimensions were not measured. It used fresh in-memory chapter-6 preview session **59336**. The immediate helper began chapter 6 **10 seconds into its phase**, leaving **290 seconds before tool/setup delays**, and then ran the normal unextended chapter clock. Every interaction after entry, including browser reload, used pointer clicks. No gameplay error, penalty, or native-input interruption was observed.

- Entered with **04:37** left on the normal chapter clock. On arrival, cycle 1 had **13 seconds** until its deadline. Selected **Pay 60; save 40** with 10 seconds remaining, then confirmed with 7 seconds remaining.
- Cycle 2 displayed **income 90 + retained 40 = 130** and initially opened in 7 seconds. Selected **Pay 50; save 80**; Confirm was disabled while 4 seconds remained before opening. Once open, the panel displayed 43 seconds until due and the payment was confirmed.
- Cycle 3 displayed **income 80 + retained 80 = 160**, with 38 seconds before opening and Confirm disabled. This early-payment state was captured in a screenshot. Closed the panel and observed **score 40 / progress 2 of 3** at **04:04**.
- Q6.1: selected **No**, confirmed the first answer as correct, and observed score **50** at **03:45**.
- Q6.2: selected **Its actual reporting terms and eligibility**, confirmed the first answer as correct, and observed score **60** at **03:26**.
- Reopened cycle 3 with 37 seconds until due, selected **Pay 50; save 110**, and confirmed. Observed **score 80 / progress 3 of 3** at **03:14**. The final action explicitly selected saving 110; the completed screen did **not** independently display the final retained balance, so that balance is not claimed as a separately rendered observation.
- Clicked browser reload at **03:02**. Score **80**, progress **3 of 3**, and both learning completion checkmarks persisted; the Learning dialog was reopened by pointer to verify them.

Artifacts: [cycle-3 early payment disabled](../test-results/chapter6-pointer-early-payment-disabled.jpg), [chapter 6 pointer completion](../test-results/chapter6-pointer-complete.jpg), and [learning completion retained after refresh](../test-results/chapter6-pointer-learning-persisted.jpg).

This closes only **M6 pointer**, **Q6.1 pointer**, and **Q6.2 pointer**. At the end of this pointer run, chapter 6 keyboard completion and input-method comparison remained pending; the later keyboard result is recorded below. The observed timing describes this automated preview; it is not evidence of representative human performance, the complete browser/device matrix, or the outstanding safety/network regressions.


## Chapter 6 keyboard attempt excluded, 2026-11-09

Fresh preview **22315** was stopped without a payment or knowledge encounter being attempted. Setup and travel consumed a reported 32 seconds while the preview clock was already running; on arrival, the first payment deadline had elapsed. This immediate preview also began chapter 6 ten seconds into the phase. The attempt is excluded from completion evidence and does not establish an input-method failure: normal event setup precedes competitive play.

The next keyboard check was planned to use the optional preview `--wait-for-start` mode: finish setup first, then explicitly start the selected chapter at its proper opening with the normal 300-second window. This is a visible fixture-start boundary, not a hidden clock extension. No existing run was altered. The chapter-6 pointer pass on `81953ca` remains valid in its shorter, unextended preview window; M6/Q6.1/Q6.2 keyboard cells remained pending at this point; the successful fresh run is recorded below.


## Chapter 6 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check on source **`7cf4d16`**, a documentation-only successor to preview-helper revision **`2b20574`**, with unchanged runtime **`10a674c`** and UI **`f012152`**. It used the actual NVM **Node v24.20.0** binary and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; the CSS viewport was not measured.

Fresh in-memory preview session **19487** ran `scripts/preview-chapter.mjs 6 --wait-for-start` with **`tty: true`**. Setup finished before the explicit terminal start; the first chapter accessibility observation showed **04:57** remaining. The clock then ran normally without pause or extension. Earlier session **80485** had closed stdin, remained in the lobby, and never started gameplay; its owned process 74425 was stopped before the fresh run. It contributes no gameplay evidence. Session 19487 was stopped cleanly after the successful check.

After entry, all gameplay used **Tab, Return, and Escape**, with **Cmd+R** for refresh. There was no pointer gameplay.

| Observed action | Result / timing |
|---|---|
| Cycle 1 arrival with 32 seconds until due; selected Pay 60; save 40 with 28 seconds until due, then confirmed | Cycle 2 showed retained 40, opening in 23 seconds, with Confirm disabled. Closed panel: score 20 / progress 1 of 3 at 04:33. |
| Q6.1: No, first answer correct | Score 30 at 04:02. |
| Cycle 2 opened with 29 seconds until due; selected Pay 50; save 80 with 26 seconds until due, then confirmed | Cycle 3 showed retained 80 + income 80 = 160, opening in 21 seconds, with Confirm disabled. Closed panel: score 50 / progress 2 of 3 at 03:47. |
| Q6.2: Its actual reporting terms and eligibility, first answer correct | Score 60 at 03:26. |
| Cycle 3 opened with 38 seconds until due; selected Pay 50; save 110 with 35 seconds until due, then confirmed | Score 80 / progress 3 of 3 at 03:15. |
| Cmd+R at 03:07, then keyboard reopening of Learning encounters | Score 80 / progress 3 of 3 retained; both knowledge completion checkmarks observed. |

The final action selected saving 110; the completed screen did not independently display that balance. One native-input interruption occurred before opening Q6.1. A fresh accessibility observation showed unchanged state with Close focused, and subsequent Tab input succeeded. No pointer gameplay was needed. No gameplay error or penalty was observed.

Artifacts: [early payment disabled](../test-results/chapter6-keyboard-early-payment-disabled.jpg), [chapter 6 keyboard completion](../test-results/chapter6-keyboard-complete.jpg), and [learning completion retained after refresh](../test-results/chapter6-keyboard-learning-persisted.jpg).

This closes **M6 keyboard**, **Q6.1 keyboard**, and **Q6.2 keyboard**, bringing the matrix to **12 of 48** cells. The separate pointer and keyboard checks both completed the same three on-time payments and both first knowledge answers correctly, then retained **80 points / 3 of 3 / both learning checkmarks** after refresh. Their start conditions differed: pointer used the older immediate preview's 10-second offset, while keyboard completed setup before the full normal chapter window began. This establishes observed outcome parity only, not matched human timing, general usability, other chapters/browsers, or the outstanding safety/network regressions.


## Chapter 2 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check on source **`f2ddb58`**, with unchanged runtime **`10a674c`** and UI **`f012152`**, using verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window measured **1379×851**; the CSS viewport was not measured. Fresh in-memory preview session **98047** used `scripts/preview-chapter.mjs 2 --wait-for-start` with **`tty: true`**. Setup completed before the explicit start of the normal **300-second** chapter window; the first accessibility observation showed **04:57**. The session was stopped cleanly after the check.

Setup explicitly selected friendly robots and left the control preference at its default Keyboard value. **Every gameplay interaction after entry, including browser reload, used pointer clicks.** The preference label does not classify the actual input method. The reviewer used batched native clicks, with a fresh accessibility observation between selecting a choice and confirming it; no API calls changed gameplay state.

At each home, the reviewer selected **Inspect this site**, confirmed, read the visible evidence, then selected and confirmed the decision below.

| Home / decision | Observed score | Chapter time remaining |
|---|---|---|
| Juniper: 16 × 20 | 10 | 04:31 |
| Cedar: Toward the unit | 20 | 04:18 |
| Willow: Install the matching clean filter | 30 | 04:03 |
| Elm: 20 × 25, arrow toward unit | 40 | 03:47 |
| Oak: Use one correctly sized filter as specified | 50 | 03:36 |
| Maple: A clean replacement matching the inspected equipment label | 60; objective 6 of 6 | 03:19 |
| Q2.1: The required size and airflow direction, first answer correct | 70 | 03:02 |
| Q2.2: No; the replacement still needs installation, first answer correct | 80 | 02:47 |
| Clicked browser reload, then reopened Learning encounters by pointer | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:41 |

No gameplay error, penalty, or native-input interruption was observed. Artifacts: [chapter 2 pointer completion](../test-results/chapter2-pointer-complete.jpg) and [learning completion retained after refresh](../test-results/chapter2-pointer-learning-persisted.jpg).

This closes **M2 pointer**, **Q2.1 pointer**, and **Q2.2 pointer**, bringing the matrix to **15 of 48** cells. At the end of this pointer run, chapter 2 keyboard completion and input-method comparison remained pending; the later keyboard result is recorded below. This automated preview does not establish human timing, the complete browser/device matrix, or the outstanding safety/network regressions.


## Chapter 2 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check on source **`5ccda41`**, with unchanged runtime **`10a674c`** and UI **`f012152`**, using verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; CSS viewport dimensions were not measured. Fresh in-memory session **85621** used `scripts/preview-chapter.mjs 2 --wait-for-start` with **`tty: true`**. Setup finished before the explicit start of the normal **300-second** chapter window; the first observation showed **04:57**. The session was stopped cleanly after the check.

Setup used pointer input to select friendly robots and left the default Keyboard preference. **After entry, all gameplay used Tab, Return, and Escape; refresh used Cmd+R.** No pointer input was used after entry. At every home, the reviewer inspected the site and confirmed the inspection, read the visible evidence, then selected and confirmed the decision using Tab/Return. The batched native-input helper read fresh accessibility selection/focus state before confirmation.

| Home / decision | Observed score | Chapter time remaining |
|---|---|---|
| Juniper: 16 × 20 | 10 | 04:37 |
| Cedar: Toward the unit | 20 | 04:25 |
| Willow: Install the matching clean filter | 30 | 03:54 |
| Elm: 20 × 25, arrow toward unit | 40 | 03:29 |
| Oak: Use one correctly sized filter as specified | 50 | 03:17 |
| Maple: A clean replacement matching the inspected equipment label | 60; objective 6 of 6 | 03:03 |
| Q2.1: The required size and airflow direction, first answer correct | 70 | 02:46 |
| Q2.2: No; the replacement still needs installation, first answer correct | 80 | 02:28 |
| Cmd+R, then keyboard reopening of Learning encounters | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:25 |

No native-input interruption, gameplay error, or penalty was observed. Artifacts: [chapter 2 keyboard completion](../test-results/chapter2-keyboard-complete.jpg) and [learning completion retained after refresh](../test-results/chapter2-keyboard-learning-persisted.jpg).

This closes **M2 keyboard**, **Q2.1 keyboard**, and **Q2.2 keyboard**, bringing the matrix to **18 of 48** cells. Chapter 2's separate keyboard and pointer runs completed the same six inspections and decisions, answered both encounters correctly on the first attempt, and retained **80 points / 6 of 6 / both learning checkmarks** after refresh. This is observed outcome parity, not a human-speed benchmark or evidence for other chapters/browsers or the outstanding safety/network regressions.
