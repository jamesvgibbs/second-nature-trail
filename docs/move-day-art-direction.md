# Move Day: the crossing

This representative chapter replaces the district directory as the primary Move Day view. It is an original illustrated journey inside the existing Canvas client, with the existing scoring, supplies, timings and authoritative movement. The other chapters are not being redesigned in this pass. The directory remains the explicit neighborhood overview.

## Composition and palette

A 1200×800 landscape uses one four-pixel drawing grid. A low horizon leaves room for a timber depot on the left, a large loaded handcart at the fork, and a single roadside home on the right. The paved detour bends well above the direct route; the damaged shortcut is narrower, angular earth with broken crossings. Both converge on a common home approach. Doors meet visible approach surfaces. Trees and the distant disconnected control tower are sparse, with no repeated pickup-like rubble or restoration beacons.

Ground is muted green `#789170`, shade `#647f65`, sky `#bcc9b1`. The wide paved road is slate `#64716d`, its shoulder `#c0b991`; the rough shortcut is earth `#9d7c59` with dark ruts `#665748`. Timber `#80654b`, dark roof `#304e50`, warm window `#f3d48b` and recovery mint `#b6d18f` carry the story. Three Canvas labels use 28px monospace, approximately 21px at a 900px-wide scene. The player’s cart carries a small amber YOU pennant. One NEXT marker identifies the chosen crossing or delivery approach during those stages, clear of home windows and the companion layby. Choice details and numeric outcomes live in accessible DOM controls, not tiny map labels.

Road scanline runs are calculated once at module initialization and reused during rendering. No external images, fonts, tracking, animation timers, shader effects or image-generation assets are required. Arcade defaults such as lives, coin insertion, CRT distortion, shooting and score-attract screens do not apply to this cooperative event.

## The player’s loop

Choose cargo → choose the existing paved or shortcut rule → travel to and inspect its crossing → bring supplies to the destination. Inline choices and a persistent travel journal keep the landscape visible. The original overview supports free movement and other activities. Canvas clicks use semantic objective/route hotspots; their coordinates are never submitted as world coordinates.

The cart is an illustration of authoritative task progress. Travel and delivery poses interpolate from the player’s actual position between the public task locations and selected public checkpoint. Poses are clamped to the illustrated route and never advance on a timer. The route-selection pose illustrates the fork; it is not a claim that the player has already moved to another world location. Returning an empty cart uses authoritative home-to-depot position. The illustration does not estimate distance, arrival time, route length or collisions in the simulation.

Inventory persists and chapter reserves remain separate. Loading selects a plan; delivery consumes supplies. No new scarcity, health, random damage, time penalty or scoring has been introduced. Shortcut damage is the existing deterministic rule. A home’s window warms only after a saved delivery (`progress[0].step > 0`). Shared recovery is separately derived from `event.contributions[0] / event.restoration.perDistrict`: completing all three deliveries contributes once. A proportional repaired cable and six coarse fence spans illustrate that ratio. Pixel quantization gives any positive contribution at least one 4px segment; these decorative segments are not additional repairs or awards. Exact totals remain in field notes.

## Crowd and interaction

The player’s cart is always the focal sprite. At most three other eligible, connected players within 220 world units are selected by stable ID order. Their reserved layby anchors are independent of their positions, away from both roads, fork, doors and crossing locations. Movement or input-array reordering cannot shuffle the same eligible group; entering or leaving the nearby radius can change membership. The model exposes nearby count separately from all other connected participants. Everyone remains discoverable through Neighbors and trade.

Names and emotes are absent from the Canvas. Deliberately selecting a nearby companion reveals the name in the DOM and adds a small sprite underline; unselected companions remain unnamed. Concentrating 100 participants at the square or depot cannot produce 100 overlaid avatars. The same cap applies to the chapter-one overview.

Paused chapter one retains its visual stage and disables scoring hotspots. The focused scene is unavailable in the tutorial, countdown, brag phase, other chapters and results. Existing projection ordering, request deduplication, phase guards, persistent saves and receipt provenance remain authoritative.

## Verification boundary

`test/move-day-scene.test.mjs` exercises the real Engine’s sanitized projections: first delivery versus three-trip shared credit, all stage and pause boundaries, public-position interpolation, connected road runs and doorway thresholds, nearby crowd caps under square/depot/spread distributions, input-order stability, opt-in names and isolation from learning/answer fields. `test/move-day-ui.test.mjs` covers the actual inline client adapter. Existing modal, overview scenery and paused-results tests remain active.

These are implementation checks, not art approval or a substitute for rendered laptop review. Root-owned browser review evaluates departure, route choice, accepted repair and concentrated crowd views. Prior approval of the district directory does not approve this new composition. No full-event capacity or platform claim is inferred from this representative chapter change.
