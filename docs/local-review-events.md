# Local chapter review events

These are disposable, isolated memory events for reviewing the current build. They never open the saved demonstration databases. Progress is earned through the normal player API. The operator starts a normal ten-second countdown and advances past earlier chapters without playing them; this is not evidence of normal full-event pacing or award eligibility.

Run with Node 24:

```sh
node scripts/review-events.mjs
```

Open `http://127.0.0.1:4220`. The console provides separate single-player and 100-invitation events for chapters 3–8, a finale staging event, and an entry/practice event. Each uses a unique `.localhost` hostname so browser cookies do not replace another review identity. Solo events use ports 4193–4200; crowd events 4203–4210. The saved4173/4175 demos and earlier4186/4188/4192 reviews are separate.

**Play / resume** opens the invitation and resumes after the human player completes setup and establishes a live connection. Crowd Play then connects its99 simulated neighbors through normal setup and live sessions before resuming. This protects the first payment window during onboarding. It never resets progress. Chapter events start paused at their actual opening, with earlier chapters explicitly unplayed. Crowd entry Play connects99 neighbors after human setup while retaining the lobby. Entry events stay in the lobby for normal setup and practice; choose **Start from lobby** afterward. Pause retains the game’s actual time remaining.

Crowd events initially have no simulated connections. **Connect 99 neighbors** connects 99 real HTTP/SSE clients and completes only their normal character setup. Connecting a different crowd event disconnects the prior simulated clients, retaining their progress. **Gather at your position**, **Spread neighbors**, and **Meet at square** use real movement. If the event was paused, these commands briefly resume it for movement and pause again. Native human identities are never taken over. The human browser plus 99 simulated peers is 100 participants.

**Three neighbors complete this objective** plays the authored main activity with actual movement, timing, supplies and accepted actions. It uses authored correct answers as a developer oracle; it is not human play. Targeting and payment workers wait for real server windows. Pause/resume remains available while a worker waits. **Play / resume** on a finale preview waits for human setup, connects its 99 simulated neighbors when using crowd mode, verifies that every intended participant is set up and connected, then advances the chapter 8 staging event into the actual finale. This freezes the actual attendance-based repair target (60 for the 100-person preview). The launcher checks the resulting target; an attendance change during the transition is reported without refreezing or resetting the event. **Begin finale** remains a manual operator control; connect the intended participants before using it. Simulated finale contributions use the normal API. Unplayed chapters do not acquire invented winners.

**Restart this isolated preview** is an explicit reset of only that review event. It first archives the full event state and accepted-action journal under ignored `data/review-archives/`, then opens a fresh memory event at the same default URL. Other review events and saved games remain unchanged. No visit, refresh or Play button performs a reset. Quitting the runner discards its remaining memory events.

Host and safe-presentation credentials are written to a private mode 0600 file in the operating system’s temporary directory. Its path is printed at startup. The file is outside the gallery/webroot; do not publish it. Host URLs use another unique hostname so they do not replace the player cookie.

The gallery can post a form or JSON to the loopback console:

| Endpoint | Body | Effect |
| --- | --- | --- |
| `GET /status` | none | Public URLs, phase, time, connections and completion counts |
| `POST /launch` | `event=solo3` | Resume if paused, then redirect to its invitation |
| `POST /pause` or `/resume` | `event=solo3` | Normal operator action |
| `POST /crowd`, `/solo` | `event=crowd3` | Connect or disconnect simulated peers |
| `POST /stack`, `/spread`, `/square` | `event=crowd3` | Move existing peers |
| `POST /complete` | `event=crowd3&count=3` | Complete main objectives through normal actions |
| `POST /finale`, `/contribute` | `event=crowdfinale&count=1` | Normal finale transition/contributions |
| `POST /restart` | `event=solo3&confirm=reset-this-preview` | Archive and explicitly reset only this preview |

For populated historical awards, separately run:

```sh
node scripts/review-archive.mjs
```

Open `http://archive.localhost:4222/presentation`. This read-only wrapper verifies the retained f7ea6a8 normal 100-player export and journal independently, then displays its 15 actual recipients through the current frontend. Award records remain byte-identical; original evidence is not modified. Its event wrapper is reconstructed because the original temporary database was deleted. It has no live-player presence, accepts no mutations, and does not claim a newly played event. The frozen export did not retain the later finale outcome, so the wrapper marks that fact explicitly rather than inventing repairs or an ending. Fresh native finale reviews remain separate.

A separate fallback-ending review can run without changing either successful finale event:

```sh
node scripts/review-events.mjs --port-base 4217 --control-port 4224 --only solofinale --prefix fallback-
```

Its player URL is `http://fallback-solofinale.localhost:4223/?invite=fallback-solofinale-invite-1`; controls are at `http://127.0.0.1:4224`. Play waits for setup and enters the real finale. Advance without contributing to inspect the unmet-target ending. The prefix isolates browser identity as well as the memory event. No awards or repairs are assigned.
