# Local demo walkthrough

Use Node 24.20.0 from the repository:

```sh
npm run demo
```

This starts a fresh, one-player event on loopback port 4180. It uses an in-memory database and never opens the existing 4173/4175 saved games or an environment-provided `DB_PATH`. Quitting discards only this walkthrough. No scores, completed tasks or wins are preloaded.

The terminal prints a **player link on localhost** and a **host link on 127.0.0.1** plus fresh local operator tokens. These different hostnames keep browser sign-ins separate. Keep each role on its printed hostname. Open the host page with the printed primary token; its **Open safe presentation** link shares that sign-in. For multiple players, use separate browser profiles.

## Five-to-ten-minute presentation

1. Type `lobby`, then open the player link. Choose a character and visual preference; complete the five practice actions. Show that keyboard and pointer movement work.
2. Type `start`. The ordinary ten-second countdown runs; it counts toward the first five-minute play window.
3. At the moving depot, compare the four-slot cargo plans. Pack a load, choose a route, inspect its crossing and deliver. Show the resources and consequence feedback. For a concrete comparison, deliver a repair kit by the paved route (17 points), essentials by the shortcut (8 points), then a connection kit by the paved route (20 points). These are actual choices and consumption, for 45 delivery points before any quizzes or bonuses.
4. Use `pause` while explaining a decision, then `resume` to continue. For a shorter presentation, type `next` to end the chapter and show the brag break; another `next` opens the following chapter. Incomplete tasks remain incomplete.
5. Type `quit` when finished. Restart `npm run demo` for another fresh walkthrough.

The default roster contains one real demo participant, so their completed objective restores the whole district. This is the normal denominator calculation, not an altered score or a seeded repair. A group demo uses its actual invited roster count. One-player awards follow normal eligibility and duplicate-recipient rules; this walkthrough does not demonstrate fifteen winners.

`next` is an ordinary audited host advance. It may settle current rankings and removes remaining time from that phase. It is not evidence of normal event pacing. It cannot bypass the opening countdown. No clock offsets are used. The unchanged normal game schedule remains one hour.

## Controls and options

| Terminal command | Action |
| --- | --- |
| `lobby` | Open the draft event’s lobby |
| `start` | Start the normal ten-second countdown |
| `pause` / `resume` | Freeze or restore the current timed phase |
| `next` | Advance one phase with current real results; does not complete objectives |
| `status` | Print current phase, chapter, player count and remaining time |
| `quit` | Gracefully stop and discard this isolated walkthrough |

Closing stdin alone does not start, advance or terminate the event. Browser host controls remain available. SIGINT/Ctrl+C or SIGTERM also stops it gracefully.

```sh
npm run demo -- --players 3 --port 4181
```

`--players` accepts 1–20; each printed invitation represents one participant. `--port` defaults to 4180; choose another free port if occupied. This helper is local-only, uses disposable credentials and HTTP, and does not publish or replace any saved game.
