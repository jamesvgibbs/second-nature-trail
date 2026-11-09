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
