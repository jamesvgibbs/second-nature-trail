# Event operating runbook

Draft, 2026-11-09. Do not use the local demo credentials for an employee event. Release requires the evidence in [acceptance.md](acceptance.md), approved benefit content, named operators, a frozen ruleset, and tested production hosting.

## Before invitations

1. Confirm the event date/time zone, primary and backup operators, content approvers, budget, roster owner, and retention period.
2. Complete the browser, device, accessibility, recovery, capacity, and human rehearsals. Record the exact build and content version. Resolve all release-blocking failures.
3. Deploy one authoritative server with durable SQLite storage behind HTTPS. Configure two distinct strong operator credentials through the hosting secret manager. `DEMO` must be off, cookies secure, persistent storage writable, and restart/restore verified. Avoid multiple application replicas with independent databases.
4. Import only the authorized roster. Use stable employee IDs and display names. Give each employee their own private invitation through the agreed delivery method. Do not project invitations, employee emails, or operator credentials.
5. Freeze content and scoring before joining opens. Record the build identifier, ruleset version, tie seed, and backup location. Take a backup using SQLite's supported backup facility, not an unsafe live copy of only the database file while WAL is active.
6. Confirm the safe presentation route and two operator logins. Operators retain separate authenticated browser sessions. Keep meeting audio in the meeting application.

## Local development

Requires the Node version declared by the project. From the project directory, run the documented start command with `DEMO=1`. The default local server is `http://localhost:4173`; local invitations use `/?invite=demo-1` through `demo-20`. `/host` is the operator view and `/presentation` is the safe audience view. The development operator credentials are `local-host-one` and `local-host-two`. The separate read-only presentation credential is `local-presentation`; production must set a distinct strong `PRESENTATION_TOKEN`. These are public test fixtures, not production credentials.

Local SQLite state persists under `data/` by default. Roster import is offline only: stop the server before running it. The database lock prevents a second writer. After a crash, an existing lock is deliberately not removed automatically. Read its recorded PID, verify that process is gone and no server/import is using that database, then remove only that database’s `.lock` file before restarting. Never remove the lock of a live process. A fresh test event must use a new database path; never erase a live event to recover a player. Rejoining restores committed progress. Do not use development invitations for real employees.

## Meeting

| Time | Operator action |
| --- | --- |
| 3:15 | Open lobby, share safe presentation, show entry instructions. Check connected/setup/tutorial/ready counts privately. |
| 3:30 | Brief the mission, controls, one-prize rule, optional help, and breaks. Ask players to finish practice. |
| 3:35 | Confirm event name and player count, then start. Ten-second countdown is inside chapter one's five-minute window. |
| Every seven minutes | Let automatic transitions run. During each two-minute break, recognize the raw leader and eligible recipient; invite roughly thirty seconds of strategy commentary. |
| 4:31 | Confirm scoring snapshot is frozen; run home-repair finale. |
| 4:35 | Read whole-event awards in published order. Use recorded highlights and exported results. |
| 4:45 | Close, leaving five minutes for recovery buffer. |
| 4:50 | End meeting. |

Demonstrate only through the safe presentation view. A player's replacement preference cannot protect others watching that player's independent screen share. Insect visuals and sounds must never appear in the presentation.

## Recovery

| Situation | Action |
| --- | --- |
| Player refresh or brief outage | Let reconnect restore the same identity and server phase. Confirm committed score/inventory remain. Never grant compensatory points manually. |
| Invitation opened elsewhere | Use explicit takeover. The former connection must stop accepting play actions. |
| Host disconnect | Backup reconnects to the existing event. The schedule continues. Check latest control owner/action before intervening. |
| Stuck player | Use rescue for that employee, with a reason. Do not reset event state. |
| Broken chapter | Pause if investigation is needed; then skip with a reason. Explain that the whole chapter is unranked and its prize is unavailable. |
| General pause | Check scoring, movement, trades, and timers freeze together. Resume the stored phase/time remaining. |
| Schedule overrun | Consume the five-minute closing buffer first. Beyond that, explicitly shorten or skip a phase. Record the changed schedule. |
| Server restart | Restore durable committed state and verify authoritative phase. Do not restore an older backup during competition without declaring the scoring consequence. |
| Unsafe visuals, duplicated inventory, unauthorized host control, lost committed state, or unreconcilable score | Stop competitive release/play. Preserve evidence, investigate, and communicate the exception. |

Every intervention records operator, timestamp, and reason. An end-scoring action freezes the award inputs. Finale actions must not alter rankings.

## Results and handover

Export the immutable snapshot, award allocation, and audit log from the authenticated operator route. Verify fifteen distinct qualifying recipients in a normal successful run; after skipped chapters or missing qualifiers, report the unawarded prizes and reasons. Compare displayed winners to exported winners before distributing prizes.

Store exports and backups in the approved location. Apply the agreed retention period to invitations, sessions, event state, logs, and exports. Revoke operator credentials after handover. Retain source, frozen content, build instructions, deployment configuration, test evidence, and this runbook. Delivery and deletion dates remain unset until the organizer decides them.

## Backup and restore commands

Create a new backup file with the supplied SQLite backup helper. It supports a live WAL database, checks SQLite integrity, and refuses to overwrite an existing backup:

```sh
node scripts/backup.mjs data/event.sqlite /approved/private/location/event-backup.sqlite
```

For a restore rehearsal, stop the event server, preserve its existing files, and select the backup through a new `DB_PATH`. Start with the same frozen source/content version and verify progress before reopening access. A backup restore during competition requires an explicit explanation of any rollback to earlier scores.

After final export, stop the event service. Keep its database and backups only for the agreed retention period. Any later event should use a fresh database and new operator/display credentials. Changing environment tokens alone does not revoke existing session cookies stored in the old event database.
