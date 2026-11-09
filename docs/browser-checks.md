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
