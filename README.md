# Second Nature Trail

Original browser neighborhood adventure for one private Second Nature employee event. This is an implementation in progress against [the scope](docs/scope.md), not a release-approved event build.

Requires Node 24. No third-party runtime dependencies.

## Local preview

```sh
DEMO=1 npm start
```

Open http://localhost:4173/?invite=demo-1. There are twenty local test invitations, `demo-1` through `demo-20`. Open `/host` and use `local-host-one` or `local-host-two` for the two test operators. `/presentation` is the safe meeting display; its separate demo credential is `local-presentation`. These credentials are deliberately limited to demo mode. Never deploy with `DEMO=1`.

To review one chapter after completing setup, start a waiting local preview:

```sh
node scripts/preview-chapter.mjs 6 --wait-for-start
```

Open the printed invitation, finish setup/practice, then press Enter in that terminal. The selected chapter starts once; earlier chapters remain visibly unplayed. Later chapters receive their full five-minute clock. Chapter 1 retains the normal countdown within its five-minute window. Without the flag, the existing immediate preview behavior is unchanged. This helper is not full-event timing evidence.

```sh
npm test
```

## Event setup

Set `HOST_TOKENS` to two comma-separated independent random credentials of at least 32 characters. Set `PRESENTATION_TOKEN` to a separate random read-only credential of at least 32 characters. Store them in your hosting secret manager. Each authenticates a separately audited operator. Employee invitations never grant operator access. These operator tokens are an interim mechanism pending the organization's chosen sign-in provider.

Supply a JSON roster of `{ "id": "stable-employee-id", "name": "Display name" }` entries. Names are public to participants; email addresses are not required.

```sh
npm run roster -- /private/roster.json /private/invitations.json https://your-game-host
```

The output contains private bearer invitations. Distribute them through the organizer's approved channel. Reissuing a roster replaces its invitations. Keep roster and invitation output outside the source repository.

## Deployment shape

Run one Node process with a persistent local disk for `data/event.sqlite`, behind an HTTPS reverse proxy that permits streaming responses. Set `BIND=0.0.0.0`, `COOKIE_SECURE=1`, `HOST_TOKENS`, and `PRESENTATION_TOKEN`. A Dockerfile is included; mount persistent storage at `/app/data`. Do not run multiple replicas against independent databases. SQLite transactions commit accepted mutations before returning success.

Hosting is not yet selected or deployed. The Sites Cloudflare Worker runtime does not directly run this Node server. The production host must support this process and persistent storage, or the transport/storage layer must be ported and reverified.

## Release gates

See [acceptance evidence](docs/acceptance.md), [design decisions](docs/design.md), and [operator runbook](docs/runbook.md). Content is draft until approved by SN owners. Automated checks cannot establish employee usability, lowest-spec hardware performance, real-device compatibility, or the 95-minute dress rehearsal.

Implementation reference: [Node 24 SQLite API](https://nodejs.org/download/release/v24.20.0/docs/api/sqlite.html).
