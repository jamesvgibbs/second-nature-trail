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

## Historical start of the control matrix (final activity revision)

This section records the earlier incomplete review; the dated chapter runs below subsequently complete the bounded 48-cell matrix. The later targeting revision requires six hits at each of three sites with a preparation signal; the later routing revision adds required relays and cable budgets. Earlier targeting/routing observations above describe the earlier versions and **do not certify these final revisions**. At that earlier point, rewards redemption and the optional selected-target automatic confirmation still needed browser checks; their later bounded observations are recorded below.

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


## Chapter 3 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached, frozen review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, at source **`f1218bf`**. It retained runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper, independently of later work in the main checkout. The run used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; the CSS viewport was not measured.

Fresh in-memory session **5044** used the waiting chapter-3 preview. Setup explicitly chose friendly robots and left the default Keyboard preference. The full normal **300-second** chapter window started after setup; the first accessibility observation showed **04:57**. **Every gameplay interaction after entry, including browser reload, used pointer input.** Session 5044 was stopped cleanly after the check.

At each of six homes, the reviewer selected and confirmed inspection, read the visible notice evidence, then selected and confirmed its verdict.

| Home / decision | Observed score | Chapter time remaining |
|---|---|---|
| Cedar: Verify through a known official channel | 10 | 04:37 |
| Willow: Legitimate channel; verify the request normally | 20 | 04:25 |
| Elm: Stop and independently verify | 30 | 03:39 |
| Oak: Verified notice; use the known portal to respond | 40 | 03:28 |
| Maple: Treat it as suspicious; report through the known channel | 50 | 03:09 |
| Juniper: Verified channel; confirm through the portal | 60; objective 6 of 6 | 02:54 |
| Q3.1: Verify using a trusted contact method, first answer correct | 70 | 02:37 |
| Q3.2: No; residents still need safe habits, first answer correct | 80 | 02:22 |
| Clicked browser reload, then reopened Learning encounters by pointer | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:14 |

Both legitimate and suspicious notices were handled correctly; no false accusation was observed. No native-input interruption, gameplay error, or penalty was observed. Artifacts: [chapter 3 pointer completion](../test-results/chapter3-pointer-complete.jpg) and [learning completion retained after refresh](../test-results/chapter3-pointer-learning-persisted.jpg).

This closes **M3 pointer**, **Q3.1 pointer**, and **Q3.2 pointer**, bringing the matrix to **21 of 48** cells. At the end of this pointer run, chapter 3 keyboard completion and input-method comparison remained pending; the later keyboard result is recorded below. These observations apply to the frozen review source, not automatically to later runtime changes. They do not establish human timing, the complete browser/device matrix, or the outstanding safety/network regressions.


## Chapter 3 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; the CSS viewport was not measured.

Fresh in-memory session **56135** used `scripts/preview-chapter.mjs 3 --wait-for-start` with **`tty: true`**. Setup selected friendly robots and the default Keyboard preference by pointer. After setup, the normal **300-second** chapter clock started explicitly; the first accessibility observation showed **04:57**. **All gameplay after entry used Tab, Return, and Escape; refresh used Cmd+R.** No pointer gameplay was used. The session was stopped cleanly after the check, and port 4174 was verified unoccupied.

At every home, the reviewer inspected and confirmed, read the notice, then selected and confirmed the verdict using the keyboard helper with fresh accessibility selection/focus checks.

| Home / decision | Observed score | Chapter time remaining |
|---|---|---|
| Cedar: Verify through a known official channel | 10 | 04:33 |
| Willow: Legitimate channel; verify the request normally | 20 | 04:02 |
| Elm: Stop and independently verify | 30 | 03:47 |
| Oak: Verified notice; use the known portal to respond | 40 | 03:34 |
| Maple: Treat it as suspicious; report through the known channel | 50 | 03:18 |
| Juniper: Verified channel; confirm through the portal | 60; objective 6 of 6 | 03:00 |
| Q3.1: Verify using a trusted contact method, first answer correct | 70 | 02:35 |
| Q3.2: No; residents still need safe habits, first answer correct | 80 | 02:16 |
| Cmd+R, then keyboard reopening of Learning encounters | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:10 |

No gameplay error, penalty, false accusation, or native-input interruption was observed. Artifacts: [chapter 3 keyboard completion](../test-results/chapter3-keyboard-complete.jpg) and [learning completion retained after refresh](../test-results/chapter3-keyboard-learning-persisted.jpg).

This closes **M3 keyboard**, **Q3.1 keyboard**, and **Q3.2 keyboard**, bringing the matrix to **24 of 48** cells. The separate keyboard and pointer runs completed the same six inspected verdicts, answered both encounters correctly on the first attempt, and retained **80 points / 6 of 6 / both learning checkmarks** after refresh. This establishes observed outcome equivalence on the frozen source, not a timing or human-usability claim, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 4 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, with runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; the CSS viewport was not measured.

Fresh in-memory preview session **88901** used chapter 4 with `--wait-for-start`, starting the normal full **300-second** window after setup; the first chapter UI observation showed **04:55**. Both visual-choice radios were initially unselected. The reviewer explicitly chose friendly robots and left the Keyboard preference unchanged. **Every gameplay input after entry, including browser reload, used the pointer.** A navigation interruption before setup was recovered using a fresh accessibility observation and screenshot; there was no gameplay interruption. The owned preview was stopped with Ctrl+C and exited with code 0.

At each home, the reviewer inspected and confirmed, read the visible scenario, then selected and confirmed the decision below. Completing each site automatically began walking to the next objective.

| Home / selected decision | Observed score | Chapter time remaining |
|---|---|---|
| Maple: Inventory and photos (choice 1) | 10 | 04:40 |
| Juniper: Keep clear and use emergency support (choice 2) | 20 | 04:17 |
| Cedar: Document damage and consult the policy (choice 3) | 30 | 04:04 |
| Willow: Confirm safety and follow guidance (choice 1) | 40 | 03:54 |
| Elm: Inventory, photos, and records (choice 2) | 50 | 03:43 |
| Oak: Actual terms and documented loss (choice 3) | 60; objective 6 of 6 | 03:30 |
| Q4.1: No; coverage depends on policy terms (choice 1), first answer correct | 70 | 03:11 |
| Q4.2: The actual policy and provider (choice 2), first answer correct | 80 | 03:02 |
| Clicked browser reload, then reopened Learning encounters by pointer | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:58 |

No gameplay error or penalty was observed. Artifacts: [chapter 4 pointer completion](../test-results/chapter4-pointer-complete.jpg) and [learning completion retained after refresh](../test-results/chapter4-pointer-learning-persisted.jpg).

This closes **M4 pointer**, **Q4.1 pointer**, and **Q4.2 pointer**, bringing the matrix to **27 of 48** cells. At the end of this pointer run, chapter 4 keyboard completion and input-method comparison remained pending; the later keyboard result is recorded below. The observations apply to the frozen review source and do not establish human timing, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 4 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1379×851**; the CSS viewport was not measured.

Fresh in-memory preview session **64656** used chapter 4 with `--wait-for-start`, beginning the normal full **300-second** window after setup. The first chapter observation showed **04:56**. Setup used pointer input: both visual-choice radios were initially unselected, friendly robots were explicitly selected, and Keyboard remained the default. A URL typing error before setup was corrected by pasting the URL and had no gameplay effect. **After entry, gameplay used only keyboard input**, beginning with Tab, Tab, Enter from the page to activate the objective. No pointer input was used after entry. The owned preview was stopped with Ctrl+C and exited with code 0.

Each site was inspected and confirmed, its visible evidence read, then its decision selected and confirmed using the keyboard.

| Home / selected decision | Observed score | Chapter time remaining |
|---|---|---|
| Maple: Inventory and photos (choice 1) | 10 | 04:37 |
| Juniper: Keep clear and use emergency support (choice 2) | 20 | 04:23 |
| Cedar: Document damage and consult the policy (choice 3) | 30 | 04:07 |
| Willow: Confirm safety and follow guidance (choice 1) | 40 | 03:13 |
| Elm: Inventory, photos, and records (choice 2) | 50 | 03:00 |
| Oak: Actual terms and documented loss (choice 3) | 60; objective 6 of 6 | 02:47 |
| Q4.1: No; coverage depends on policy terms (choice 1), first answer correct | 70 | 02:30 |
| Q4.2: The actual policy and provider (choice 2), first answer correct | 80 | 02:17 |
| Cmd+R, then Tab three times and Enter to reopen Learning encounters | 80; objective 6 of 6; both completion checkmarks retained | Refresh at 02:14 |

Two native-input interruptions occurred at Willow. During inspection, the selection was already active; a fresh accessibility observation followed by Tab verified confirmation focus, then Enter completed it. The later decision interruption occurred before any key was sent and left heading focus; the reviewer read fresh accessibility state and the keyboard helper then succeeded. Neither recovery used pointer gameplay. No gameplay error or penalty was observed.

Artifacts: [chapter 4 keyboard completion](../test-results/chapter4-keyboard-complete.jpg) and [learning completion retained after refresh](../test-results/chapter4-keyboard-learning-persisted.jpg).

This closes **M4 keyboard**, **Q4.1 keyboard**, and **Q4.2 keyboard**, bringing the matrix to **30 of 48** cells. The separate keyboard and pointer runs completed the same six inspected decisions, answered both encounters correctly on the first attempt, and retained **80 points / 6 of 6 / both learning checkmarks** after refresh. These are identical observed outcomes on the frozen source, not a human timing or usability claim, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 7 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window had been resized to **1447×889**, as observed in the setup screenshot; the CSS viewport was not measured.

Fresh in-memory preview session **79849** used chapter 7 with `--wait-for-start`, beginning the normal full **300-second** window after setup. The first chapter observation showed **04:57**. Before entry, native input was interrupted on the first robot-choice click. A fresh accessibility observation and screenshot verified unchanged radios, after which selecting friendly robots and entering succeeded. Keyboard remained the preference, but **all gameplay after entry, including reload, used pointer input**. No gameplay interruption occurred. The owned preview was stopped with Ctrl+C and exited with code 0.

Each of the six jobs required inspection and confirmation, reading the visible work order, and selecting and confirming the decision.

| Job / selected decision | Observed score / earned tokens | Chapter time remaining |
|---|---|---|
| Elm: Cable (choice 2) | 10 / 2 | 04:39 |
| Oak: Repair parts (choice 1) | 20 / 4 | 04:26 |
| Maple: Food (choice 3) | 30 / 6 | 04:10 |
| Juniper: Support with repair parts (choice 1) | 40 / 8 | 03:57 |
| Cedar: Cable (choice 2) | 50 / 10 | 03:43 |
| Willow: Food and terms (choice 3) | 60 / 12; objective 6 of 7 | 03:27 |

The player automatically walked to Night market. Selecting the community garden (choice 1, cost 4) completed the main objective at **03:19**: **score 60 / 7 of 7 / balance 8**. The completion screenshot records this state. Opening Rewards showed the garden already funded and disabled, and the 12-token celebration unaffordable. Clicking the 8-token welcome station produced **balance 0 / earned 12**, with both funded projects checked and disabled and celebration still disabled. The rewards screenshot records those controls. Closing the panel at **02:56** showed score 60, progress 7 of 7, zero balance, and both funded-project texts.

- Q7.1: eligibility and redemption terms (choice 1), first answer correct; score **70** at **02:46**.
- Q7.2: fictional game rewards (choice 2), first answer correct; score **80** at **02:35**.
- Clicked browser reload at **02:31**: score **80**, progress **7 of 7**, zero balance, and both funded-project texts persisted. Reopened Learning encounters by pointer and verified both completion checkmarks.

No gameplay error or penalty was observed. Artifacts: [chapter 7 pointer main completion](../test-results/chapter7-pointer-complete.jpg), [reward redemption and disabled controls](../test-results/chapter7-pointer-rewards.jpg), and [learning completion retained after refresh](../test-results/chapter7-pointer-learning-persisted.jpg).

This closes **M7 pointer**, **Q7.1 pointer**, and **Q7.2 pointer**, bringing the matrix to **33 of 48** cells. At the end of this pointer run, chapter 7 keyboard completion and input-method comparison remained pending; the later keyboard result is recorded below. These observations apply to the frozen review source and do not establish human timing, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 7 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1447×889**; the CSS viewport was not measured.

Fresh in-memory session **3745** used chapter 7 with `--wait-for-start`, beginning the normal full **300-second** window after setup. Both visual-choice radios were initially unselected; setup explicitly chose friendly robots by pointer and retained the default Keyboard preference. The first chapter observation showed **04:56**. **All gameplay after entry used keyboard input**, beginning with Tab, Tab, Enter from the page to activate the objective. The owned preview was stopped with Ctrl+C and exited with code 0.

Each job was inspected and confirmed, its visible work order read, then its decision selected and confirmed.

| Job / selected choice | Observed score / earned tokens | Chapter time remaining |
|---|---|---|
| Elm: Cable (choice 2) | 10 / 2 | 04:23 |
| Oak: Repair parts (choice 1) | 20 / 4 | 04:10 |
| Maple: Food (choice 3) | 30 / 6 | 03:53 |
| Juniper: Support with repair parts (choice 1) | 40 / 8 | 03:40 |
| Cedar: Cable (choice 2) | 50 / 10 | 03:25 |
| Willow: Food and terms (choice 3) | 60 / 12; objective 6 of 7 | 02:46 |

One native-input interruption occurred at Willow after choice 3 was selected but before confirmation. A fresh accessibility observation and screenshot inspected the unchanged state without acting; Tab then verified Confirm focus, and Enter succeeded. Recovery required no pointer gameplay.

At Night market, selecting the community garden (choice 1, cost 4) produced **score 60 / 7 of 7 / balance 8** at **02:34**, recorded in the completion screenshot. From map focus, six Tab presses reached Rewards; focus was verified before Enter. The garden and 12-token celebration were disabled. Tab skipped the disabled garden and reached the 8-token welcome station; Enter redeemed it, producing **balance 0 / earned 12**, both funded projects checked and disabled, and celebration still disabled. The rewards screenshot records this state. Escape closed the panel at **02:16**, showing score 60, progress 7 of 7, and both funded-project texts.

- Q7.1: eligibility and redemption terms (choice 1), first answer correct; score **70** at **02:03**.
- Q7.2: fictional game rewards (choice 2), first answer correct; score **80** at **01:53**.
- Cmd+R at **01:48** retained score **80**, progress **7 of 7**, zero balance, and both funded-project texts. Three Tab presses and Enter reopened Learning encounters; both completion checkmarks were observed.

No gameplay error or penalty was observed. Artifacts: [chapter 7 keyboard main completion](../test-results/chapter7-keyboard-complete.jpg), [reward redemption and disabled controls](../test-results/chapter7-keyboard-rewards.jpg), and [learning completion retained after refresh](../test-results/chapter7-keyboard-learning-persisted.jpg).

This closes **M7 keyboard**, **Q7.1 keyboard**, and **Q7.2 keyboard**, bringing the matrix to **36 of 48** cells. Chapters **2, 3, 4, 6, 7, and 8** now have both-method evidence; chapters **1 and 5** remain pending. Chapter 7's separate runs produced the same completed jobs, garden and welcome station, zero remaining balance, both first-correct answers, and persisted **80 points / 7 of 7 / both learning checkmarks**. This is observed outcome equivalence on the frozen source, not a human timing or usability claim, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 1 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. Both saved artifacts measure **1447×889 pixels**, consistent with the observed outer window; the CSS viewport was not measured.

Fresh in-memory session **94352** used chapter 1 with `--wait-for-start`. Setup began with both visual-choice radios unselected; the reviewer explicitly selected friendly robots and left the Keyboard preference. The chapter-1 waiting helper advances its clock past the **10-second countdown**, then starts play with **290 seconds before tool delays**, with no extension. It does not render or wait through the countdown; these checks do **not** verify the countdown UI. The first observed play state showed **04:46**. **Every gameplay input after entry, including browser reload, used the pointer.** The owned preview was stopped with Ctrl+C and exited with code 0.

Each of three full trips loaded **Connection kit: two cables, four slots, useful value 12** (choice 3), selected the **protected paved route** (choice 1), traveled to Paved detour and inspected/confirmed, then traveled to Broken highway and delivered/confirmed. Completing each stage automatically began walking to its next site.

| Observed milestone | Score / progress | Chapter time remaining |
|---|---|---|
| Delivery 1 | 20 / 1 of 3 | 04:16 |
| Delivery 2 | 40 / 2 of 3 | 03:50 |
| Delivery 3 | 60 / 3 of 3 | 03:14 |
| Q1.1: Plan the essential services and supplies (choice 1), first answer correct | 70 | 03:04 |
| Q1.2: No; confirm the actual package (choice 2), first answer correct | 80 | 02:53 |
| Clicked reload, then reopened Learning encounters by pointer | 80 / 3 of 3; both completion checkmarks retained | Refresh at 02:50 |

Before trip 2, the visible inventory showed **one carried cable / reserve six**; before trip 3 it showed **zero carried cables / reserve five**. The total useful cargo value of 36 follows from three protected loads valued at 12 each; it was **not independently displayed after completion** and is recorded as an inference, not an additional rendered observation. No keyboard gameplay, native-input interruption, gameplay error, or penalty occurred.

Artifacts: [chapter 1 pointer completion](../test-results/chapter1-pointer-complete.jpg) and [learning completion retained after refresh](../test-results/chapter1-pointer-learning-persisted.jpg).

This closes **M1 pointer**, **Q1.1 pointer**, and **Q1.2 pointer**, bringing the matrix to **39 of 48** cells. At the end of this pointer run, chapter 1 keyboard and chapter 5 both methods remained pending; the later chapter-1 keyboard result is recorded below. These observations apply to the frozen review source and do not establish human timing, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 1 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1447×889**; the CSS viewport was not measured.

Fresh in-memory session **96864** used the waiting chapter-1 preview. Both visual-choice radios were initially unselected; setup explicitly chose friendly robots with pointer input and left Keyboard as the default. The chapter-1 waiting helper advances its clock past the **10-second countdown**, then starts play with **290 seconds before tool delays**, without extension. It does not render or wait through the countdown, so this check does **not** verify the countdown UI. The first observed play state showed **04:47**. **All gameplay after entry used the keyboard**, beginning with Tab, Tab, Enter from the page to activate the objective. The owned preview was stopped with Ctrl+C and exited with code 0.

Each of three complete trips selected the connection kit (choice 3: two cables, four slots, useful value 12), the protected paved route (choice 1), checkpoint inspection (choice 1), and delivery (choice 1), traveling between the required sites. Selections used Tab/Enter and confirmation focus was verified before activation.

| Observed milestone | Score / progress | Chapter time remaining |
|---|---|---|
| Delivery 1 | 20 / 1 of 3 | 04:09 |
| Delivery 2 | 40 / 2 of 3 | 03:40 |
| Delivery 3 | 60 / 3 of 3 | 03:11 |
| Q1.1: Plan the essential services and supplies (choice 1), first answer correct | 70 | 03:00 |
| Q1.2: No; confirm the actual package (choice 2), first answer correct | 80 | 02:45 |
| Cmd+R, then three Tab presses and Enter to reopen Learning encounters | 80 / 3 of 3; both completion checkmarks retained | Refresh at 02:42 |

Before trip 2, the visible inventory showed **one carried cable / reserve six**; before trip 3, **zero carried cables / reserve five**, matching the pointer run. Total useful cargo value 36 is inferred from three protected loads valued at 12 each; it was not independently displayed after completion. No gameplay error, penalty, native-input interruption, or pointer gameplay occurred.

Artifacts: [chapter 1 keyboard completion](../test-results/chapter1-keyboard-complete.jpg) and [learning completion retained after refresh](../test-results/chapter1-keyboard-learning-persisted.jpg).

This closes **M1 keyboard**, **Q1.1 keyboard**, and **Q1.2 keyboard**, bringing the matrix to **42 of 48** cells. Only chapter **5** remains pending for both methods. The separate chapter-1 runs completed identical delivery choices, recorded both knowledge answers correctly on the first attempt, and retained **80 points / 3 of 3 / both learning checkmarks** after refresh. This is observed outcome equivalence on the frozen source, not a human timing or usability claim, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 5 pointer-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1447×889**; the CSS viewport was not measured.

Fresh in-memory session **21198** used chapter 5 with `--wait-for-start`, beginning the normal full **300-second** window after setup. Both visual-choice radios were initially unselected; friendly robots were explicitly chosen and Keyboard remained the preference. The first chapter observation showed **04:52**. **All gameplay after entry used pointer input.** The owned preview was stopped with Ctrl+C and exited with code 0.

At the first outbreak, play began in round 4. The reviewer clicked warning-marked target B, verified **Signal open**, and manually clicked Resolve. The count became **1 of 6**, and Resolve was disabled after the hit. In round 5 all target choices reset to off and the count remained 1. In round 6, enabling the selected-target automatic-confirmation checkbox without choosing a target left the count unchanged.

The subsequent **17 hits** each required a deliberate pointer click on the currently visible warning-marked target, with the enabled alternative confirming that selected target when the signal was open. This run therefore verifies **one manual hit plus 17 selected auto-confirm hits**, not 18 manual confirmations. It does not establish that every target was selected before the preparation signal ended. Selection reset each round, the checkbox preference persisted, and the global one-action-per-round restriction carried across sites.

| Observed milestone | Score / progress | Chapter time remaining |
|---|---|---|
| Apartment block: six valid hits | 20 / 1 of 3 sites | 03:10 |
| Maple home: six valid hits | 40 / 2 of 3 sites | 02:15 |
| Elm home: six valid hits | 60 / 3 of 3 sites | 01:22 |
| Q5.1: A clear description and location (choice 1), first answer correct | 70 | 01:11 |
| Q5.2: No; confirm the package and service terms (choice 2), first answer correct | 80 | 01:02 |
| Clicked reload, then reopened Learning encounters by pointer | 80 / 3 of 3; both completion checkmarks retained | Refresh at 00:57 |

Two computer-use calls encountered invalid or stale element IDs: before the first objective click and during a rapidly changing target view. Fresh accessibility observations and newly derived indices resolved both. A helper guard also refused one call before the current round ended, without acting; play proceeded from fresh state. These were tool-control recoveries, not gameplay request errors. No gameplay request error, penalty, native-app interruption, or keyboard gameplay occurred.

The selected-auto-confirm screenshot was visually reviewed by the root agent: it shows three friendly robots, a warning icon, the checked alternative, round 10, all target choices off, and an unchanged **3 of 6** count while **Signal open** is displayed. It supports the observed requirement to select a target even when automatic confirmation is enabled.

Artifacts: [chapter 5 pointer completion](../test-results/chapter5-pointer-complete.jpg), [selected-only automatic confirmation](../test-results/chapter5-pointer-selected-auto-confirm.jpg), and [learning completion retained after refresh](../test-results/chapter5-pointer-learning-persisted.jpg).

This closes **M5 pointer**, **Q5.1 pointer**, and **Q5.2 pointer**, bringing the matrix to **45 of 48** cells. Chapter 5 keyboard remained pending at this point; its completed run is recorded below. This is a pointer completion pass using the available selected-target confirmation alternative, on the frozen review source. It does not establish human timing, certification of later runtime changes, or completion of the remaining browser/device and safety/network checks.


## Chapter 5 keyboard-only, final revision, 2026-11-09

The root agent completed this automated native Safari check from the detached review checkout **`/tmp/second-nature-trail-browser-f1218bf`**, frozen at **`f1218bf`**, retaining runtime **`10a674c`**, UI **`f012152`**, and the waiting preview helper. It used verified NVM **Node v24.20.0** and Safari **27.2 (21625.2.8.18.4)**. The outer window was **1447×889**; the CSS viewport was not measured.

Fresh in-memory session **69069** used chapter 5 with `--wait-for-start`, beginning the normal full **300-second** window after setup. Both visual-choice radios were initially unselected; setup explicitly chose friendly robots by pointer and left the Keyboard preference. The first chapter observation showed **04:56**. **All gameplay after entry used keyboard input**, beginning with Tab, Tab, Enter from the page to activate the objective. The owned preview was stopped with Ctrl+C and exited with code 0.

In round 2, warning-marked target A was visible. Key 1 selected it and Space, sent after **Signal open**, manually resolved the first hit: **1 of 6**, with Resolve disabled afterward. Close retained focus. Four Tab presses reached the unchecked automatic-confirmation checkbox, focus was verified, and Space toggled it on. With no target selected, the count remained 1. Four Shift+Tab presses returned to verified Close focus.

The remaining **17 hits** used number keys 1, 2, or 3, selected only from the warning marker in a fresh visible observation. The enabled alternative confirmed the selected target; it did not choose a target. In round 6, target C was selected during **Prepare** while the count was 2. With no further action, the next observation in round 7 showed **Prepare**, all target choices off, and count 3. That establishes completion between observations and selection reset; it does **not** directly observe the exact instant the earlier signal opened. The selected-auto-confirm artifact captures round 7, the reset choices, count 3, and the enabled checkbox.

| Observed milestone | Score / progress | Chapter time remaining |
|---|---|---|
| Apartment block: six valid hits, round 9 | 20 / 1 of 3 sites | 03:41 |
| Maple home: six valid hits, round 15 | 40 / 2 of 3 sites | 02:48 |
| Elm home: six valid hits, round 21 | 60 / 3 of 3 sites | 01:54 |
| Q5.1: A clear description and location (choice 1), first answer correct | 70 | 01:41 |
| Q5.2: No; confirm the package and service terms (choice 2), first answer correct | 80 | 01:31 |
| Cmd+R, then three Tab presses and Enter to reopen Learning encounters | 80 / 3 of 3; both completion checkmarks retained | Refresh at 01:27 |

One helper guard refused a call before round 15 because the previous selection was still active; it took no action, and play continued after a fresh accessibility observation. No native-input interruption, gameplay error, or decoy penalty occurred. There was no pointer gameplay.

Artifacts: [chapter 5 keyboard completion](../test-results/chapter5-keyboard-complete.jpg), [selected automatic confirmation and round reset](../test-results/chapter5-keyboard-selected-auto-confirm.jpg), and [learning completion retained after refresh](../test-results/chapter5-keyboard-learning-persisted.jpg).

This closes **M5 keyboard**, **Q5.1 keyboard**, and **Q5.2 keyboard**, completing **48 of 48** main-objective/knowledge keyboard/pointer cells on the frozen Safari review baseline. Both chapter-5 methods used **one manual hit plus 17 deliberately selected auto-confirm hits**, completed all three sites under the normal unextended clock, answered both encounters correctly on the first attempt, and retained **80 points / 3 of 3 / both learning checkmarks** after refresh. This is outcome parity for the supported alternative, not an 18-hit all-manual check or human-speed proof.

The full platform matrix, novice/human rehearsal, optional activities, social controls, safety sequences, and host/presentation review remain separate open gates. These browser observations do not automatically certify later runtime changes or the concurrent capacity run.


## Settings remapping and text-size checks, 2026-11-09

The root agent completed these bounded native Safari checks on the frozen **`f1218bf`** review checkout, retaining UI **`f012152`**, in isolated chapter-5 waiting-preview session **10296**. Safari was **27.2 (21625.2.8.18.4)** and the outer window was **1447×889**; the CSS viewport was not measured. These observations are separate from the 48 main-objective/knowledge cells. No main objective or scored activity was completed in this preview.

In the lobby, assigning **W** to both up and interact was rejected with the inline message **“Choose a different, non-empty key for every action.”** Settings stayed open. The reviewer then saved **up Z / interact F / inventory V / map N / help J**, leaving A/S/D unchanged. Canvas accessibility text and footer showed **ZASD / F**, and menu hints showed **V / N / J**. From map focus, J opened Help with matching controls; Escape then V opened the cart, and Escape then N opened Map. Cmd+R retained the updated hints.

With the canvas focused by Tab, holding Z for 900ms visibly moved the avatar upward and completed the tutorial's Move around step. Cmd+L followed by typing `jvnz` left those letters in the browser address field without opening any gameplay menu or navigating. This tests that browser-field context only, not every in-page input. An empty up binding was also rejected with the same inline message; Z was restored and saved.

The reviewer explicitly started the waiting chapter-5 preview with its normal 300-second play window, clicked a path to Apartment block, and used F to open Outbreak response. Escape then J opened Help again. Saving **left X / down C / right B** produced movement hints **ZXCB**. Separate 700ms holds of X, C, and B visibly moved the avatar left, down, and right. Cmd+R retained **ZXCB / F** and **V / N / J**; reopening Settings showed all eight correct fields. No scored target action was taken.

Text-size checks followed:

- Selected **Large** through the pointer dropdown and saved. The inspected screenshot showed visibly larger text and a scrolling sidebar, with the world and footer retained.
- Selected **Extra large** using Down/Enter in the popup and saved. The inspected screenshot showed sidebar wrapping without observed horizontal clipping. Scrolling one page exposed harder-challenge, secret, and mystery actions; the footer remained accessible.
- Cmd+R and reopening Settings explicitly showed **Extra large** retained.
- Restored all eight default keys **W/A/S/D, E/I/M/H** and **Standard** through Settings, then saved. Canvas accessibility text, footer, and menu hints were checked and showed the defaults.

Artifacts: [remapped Help with initial ZASD bindings](../test-results/settings-remapped-help.jpg), [all eight remapped bindings retained](../test-results/settings-all-bindings-persisted.jpg), [Large text](../test-results/settings-large-text.jpg), and [Extra large actions reachable](../test-results/settings-extra-large-actions.jpg).

Reduced motion remained checked, friendly robots remained selected, and audio stayed at zero throughout. Those unchanged settings do **not** constitute reduced-motion toggle, audio, or visual-preference race tests. These are narrow remapping, validation, hint consistency, layout, and persistence observations on the frozen Safari baseline, not a whole Settings pass or full remapped activity/platform matrix. No conclusion about novice usability or later runtime revisions follows from this check.
