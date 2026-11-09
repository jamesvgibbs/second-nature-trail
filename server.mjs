import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import {
  readFileSync,
  mkdirSync,
  existsSync,
  openSync,
  closeSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
import { Engine } from "./engine.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const hash = (x) => createHash("sha256").update(x).digest("hex");
const token = () => randomBytes(32).toString("base64url");
export function createGameServer({
  dbPath = process.env.DB_PATH || resolve(root, "data/event.sqlite"),
  hostTokens = process.env.HOST_TOKENS?.split(","),
  demo = process.env.DEMO === "1",
  presentationToken = process.env.PRESENTATION_TOKEN,
  secure = process.env.COOKIE_SECURE === "1",
} = {}) {
  if (!hostTokens?.length) {
    if (!demo)
      throw Error(
        "Set HOST_TOKENS to two separate strong operator tokens, or DEMO=1 for local development.",
      );
    hostTokens = ["local-host-one", "local-host-two"];
  }
  if (hostTokens.length !== 2 || new Set(hostTokens).size !== 2)
    throw Error("Configure exactly two distinct operator credentials.");
  if (!demo && hostTokens.some((t) => t.length < 32))
    throw Error("Operator tokens must have at least 32 characters.");
  if (!presentationToken) {
    if (demo) presentationToken = "local-presentation";
    else
      throw Error(
        "Set PRESENTATION_TOKEN to a separate read-only display credential.",
      );
  }
  if (hostTokens.includes(presentationToken))
    throw Error(
      "Presentation credential must differ from operator credentials.",
    );
  if (!demo && presentationToken.length < 32)
    throw Error("Presentation token must have at least32 characters.");
  let lockPath, lockValue, db;
  const releaseLock = () => {
    if (
      lockPath &&
      existsSync(lockPath) &&
      readFileSync(lockPath, "utf8") === lockValue
    )
      unlinkSync(lockPath);
  };
  if (dbPath !== ":memory:") {
    dbPath = resolve(dbPath);
    mkdirSync(resolve(dbPath, ".."), { recursive: true });
    lockPath = dbPath + ".lock";
    lockValue = JSON.stringify({ pid: process.pid, nonce: token() });
    let fd;
    try {
      fd = openSync(lockPath, "wx", 0o600);
    } catch (e) {
      if (e.code === "EEXIST")
        throw Error(
          "Event database is locked. Stop its server before roster import. Recover stale locks offline after verifying their recorded process has exited.",
        );
      throw e;
    }
    try {
      writeFileSync(fd, lockValue);
    } finally {
      closeSync(fd);
    }
  }
  try {
    db = new DatabaseSync(dbPath);
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS game(id INTEGER PRIMARY KEY, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS invitations(hash TEXT PRIMARY KEY, player TEXT NOT NULL, name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, player TEXT, role TEXT NOT NULL, created INTEGER NOT NULL);",
    );
    const saved = db.prepare("SELECT state FROM game WHERE id=1").get();
    const engine = new Engine(saved ? { state: JSON.parse(saved.state) } : {});
    const persist = () =>
      db
        .prepare(
          "INSERT INTO game VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",
        )
        .run(JSON.stringify(engine.state));
    if (saved) persist();
    const mutate = (fn) => {
      const before = JSON.stringify(engine.state);
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        if (JSON.stringify(engine.state) !== before) persist();
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        engine.state = JSON.parse(before);
        throw e;
      }
    };
    if (!hostTokens?.length) {
      if (!demo)
        throw Error(
          "Set HOST_TOKENS to two separate strong operator tokens, or DEMO=1 for local development.",
        );
      hostTokens = ["local-host-one", "local-host-two"];
    }
    if (!demo && hostTokens.some((t) => t.length < 32))
      throw Error("Operator tokens must have at least 32 characters.");
    const addInvitation = (id, name, secret = token()) => {
      if (!["draft", "lobby"].includes(engine.state.phase))
        throw Error("Roster is frozen after event start");
      mutate(() => {
        engine.addPlayer(id, name);
        db.prepare("INSERT OR REPLACE INTO invitations VALUES(?,?,?)").run(
          hash(secret),
          id,
          name,
        );
      });
      return secret;
    };
    if (demo)
      for (let i = 1; i <= 20; i++)
        if (
          !db
            .prepare("SELECT 1 FROM invitations WHERE hash=?")
            .get(hash(`demo-${i}`))
        )
          addInvitation(`neighbor-${i}`, `Neighbor ${i}`, `demo-${i}`);
    let movementDirty = false,
      closing = false;
    const streams = new Map(),
      leases = new Map(),
      rates = new Map();
    const pending = [];
    let flushTimer = null;
    const flush = () => {
      flushTimer = null;
      if (!pending.length) return;
      const batch = pending.splice(0),
        before = structuredClone(engine.state),
        accepted = [];
      let began = false;
      try {
        db.exec("BEGIN IMMEDIATE");
        began = true;
        for (const command of batch) {
          // Recorded actions, audit, deduplication results and frozen awards are append-only.
          // Preserve those references instead of copying the entire event history per player.
          const { actions, audit, requests, snapshot, ...mutable } =
            engine.state;
          const checkpoint = {
            ...structuredClone(mutable),
            actions,
            audit,
            requests,
            snapshot,
          };
          const actionCount = actions.length,
            auditCount = audit.length;
          const priorRequest = command.requestKey
            ? requests[command.requestKey]
            : undefined;
          try {
            accepted.push({ command, result: command.fn() });
          } catch (e) {
            engine.state = checkpoint;
            actions.length = actionCount;
            audit.length = auditCount;
            if (command.requestKey) {
              if (priorRequest === undefined)
                delete requests[command.requestKey];
              else requests[command.requestKey] = priorRequest;
            }
            command.reject(e);
          }
        }
        persist();
        db.exec("COMMIT");
        for (const { command, result } of accepted) command.resolve(result);
      } catch (e) {
        if (began) db.exec("ROLLBACK");
        engine.state = before;
        for (const command of batch) command.reject(e);
      }
    };
    const enqueue = (fn, requestKey) =>
      new Promise((resolve, reject) => {
        pending.push({ fn, requestKey, resolve, reject });
        if (!flushTimer) flushTimer = setTimeout(flush, 8);
      });

    const cookie = (req) => {
      const m = (req.headers.cookie || "").match(/(?:^|; )trail=([^;]+)/);
      return m ? m[1] : null;
    };
    const session = (req) => {
      const c = cookie(req);
      return c
        ? db.prepare("SELECT * FROM sessions WHERE hash=?").get(hash(c))
        : null;
    };
    const requireSession = (req, role) => {
      const s = session(req);
      if (!s || (role && s.role !== role))
        throw Object.assign(
          Error("Please sign in with the correct invitation."),
          { status: 401 },
        );
      return s;
    };
    const send = (res, status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const stateFor = (s) =>
      s.role === "host"
        ? { ...engine.hostView(), connections: [...leases.keys()] }
        : engine.view(s.player);
    const broadcast = () => {
      for (const [key, v] of streams) {
        try {
          if (v.res.writableLength > 1024 * 1024) {
            v.res.destroy();
            streams.delete(key);
            continue;
          }
          v.res.write(
            `event: state\ndata: ${JSON.stringify(v.session ? stateFor(v.session) : engine.presentation())}\n\n`,
          );
        } catch {
          streams.delete(key);
        }
      }
    };
    const json = async (req) => {
      let raw = "";
      for await (const c of req) {
        raw += c;
        if (raw.length > 16384)
          throw Object.assign(Error("Request too large"), { status: 413 });
      }
      try {
        return JSON.parse(raw || "{}");
      } catch {
        throw Object.assign(Error("Invalid JSON"), { status: 400 });
      }
    };
    const server = http.createServer(async (req, res) => {
      try {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
        );
        const url = new URL(req.url, "http://localhost");
        if (req.method === "POST") {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host)
            throw Object.assign(Error("Cross-origin request rejected"), {
              status: 403,
            });
          if (!req.headers["content-type"]?.startsWith("application/json"))
            throw Object.assign(Error("JSON required"), { status: 415 });
          const key = cookie(req) || req.socket.remoteAddress,
            bucket = rates.get(key) || { at: Date.now(), n: 0 };
          if (Date.now() - bucket.at > 1000) {
            bucket.at = Date.now();
            bucket.n = 0;
          }
          bucket.n++;
          rates.set(key, bucket);
          if (bucket.n > 35)
            throw Object.assign(Error("Please slow down"), { status: 429 });
          const body = await json(req);
          if (url.pathname === "/api/join") {
            if (typeof body.token !== "string")
              throw Object.assign(Error("Invitation required"), {
                status: 401,
              });
            const invite = db
              .prepare("SELECT * FROM invitations WHERE hash=?")
              .get(hash(body.token));
            if (!invite)
              throw Object.assign(Error("Invalid invitation"), { status: 401 });
            const old = session(req),
              existing = db
                .prepare(
                  "SELECT * FROM sessions WHERE player=? AND role='player'",
                )
                .get(invite.player);
            if (existing && old?.hash !== existing.hash && !body.takeover)
              throw Object.assign(
                Error(
                  "This identity is already open. Choose Take over to move it here.",
                ),
                { status: 409 },
              );
            const secret = token();
            mutate(() => {
              engine.disconnect(invite.player);
              db.prepare(
                "DELETE FROM sessions WHERE player=? AND role='player'",
              ).run(invite.player);
              db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
                hash(secret),
                invite.player,
                "player",
                Date.now(),
              );
            });
            for (const [key, v] of streams)
              if (v.session?.player === invite.player) {
                v.res.write("event: takeover\ndata: {}\n\n");
                v.res.end();
                streams.delete(key);
              }
            leases.delete(invite.player);
            res.setHeader(
              "Set-Cookie",
              `trail=${secret}; HttpOnly; SameSite=Strict; Path=/${secure ? "; Secure" : ""}`,
            );
            send(res, 200, { ok: true, playerId: invite.player });
            return;
          }
          if (url.pathname === "/api/presentation/login") {
            if (
              typeof body.token !== "string" ||
              !timingSafeEqual(
                Buffer.from(hash(presentationToken)),
                Buffer.from(hash(body.token)),
              )
            )
              throw Object.assign(Error("Invalid presentation credential"), {
                status: 401,
              });
            const secret = token();
            db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
              hash(secret),
              null,
              "presentation",
              Date.now(),
            );
            res.setHeader(
              "Set-Cookie",
              `trail=${secret}; HttpOnly; SameSite=Strict; Path=/${secure ? "; Secure" : ""}`,
            );
            send(res, 200, { ok: true });
            return;
          }
          if (url.pathname === "/api/host/login") {
            const index = hostTokens.findIndex(
              (t) =>
                typeof body.token === "string" &&
                timingSafeEqual(
                  Buffer.from(hash(t)),
                  Buffer.from(hash(body.token)),
                ),
            );
            if (index < 0)
              throw Object.assign(Error("Invalid operator credential"), {
                status: 401,
              });
            const secret = token();
            db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
              hash(secret),
              `operator-${index + 1}`,
              "host",
              Date.now(),
            );
            res.setHeader(
              "Set-Cookie",
              `trail=${secret}; HttpOnly; SameSite=Strict; Path=/${secure ? "; Secure" : ""}`,
            );
            send(res, 200, { ok: true });
            return;
          }
          if (url.pathname === "/api/action") {
            const s = requireSession(req, "player");
            const lease = leases.get(s.player);
            if (!lease || lease.client !== req.headers["x-trail-client"])
              throw Object.assign(
                Error(
                  "Another tab controls this player. Take over before playing.",
                ),
                { status: 409 },
              );
            engine.setConnected?.([...leases.keys()]);
            const result =
              body.type === "move"
                ? engine.dispatch(s.player, body)
                : await enqueue(
                    () => {
                      engine.setConnected?.([...leases.keys()]);
                      const current = requireSession(req, "player");
                      if (
                        current.hash !== s.hash ||
                        leases.get(s.player)?.client !==
                          req.headers["x-trail-client"]
                      )
                        throw Object.assign(
                          Error("Session moved before action committed"),
                          { status: 409 },
                        );
                      return engine.dispatch(s.player, body);
                    },
                    s.player + ":" + body.requestId,
                  );
            if (body.type === "move") movementDirty = true;
            send(res, 200, {
              ok: true,
              result,
              ...(body.type === "move"
                ? { position: engine.get(s.player).position }
                : { patch: engine.actionView(s.player) }),
            });
            return;
          }
          if (url.pathname === "/api/host/action") {
            const s = requireSession(req, "host");
            engine.setConnected?.([...leases.keys()]);
            const result = await enqueue(
              () => {
                engine.setConnected?.([...leases.keys()]);
                return engine.host(s.player, body);
              },
              "host:" + s.player + ":" + body.requestId,
            );
            send(res, 200, { ok: true, result, state: stateFor(s) });
            return;
          }
          throw Object.assign(Error("Unknown endpoint"), { status: 404 });
        }
        if (req.method !== "GET")
          throw Object.assign(Error("Method not allowed"), { status: 405 });
        if (url.pathname === "/health") {
          send(res, 200, { ok: true });
          return;
        }
        if (url.pathname === "/api/lease") {
          const s = requireSession(req, "player");
          const lease = leases.get(s.player);
          send(res, 200, {
            otherClient:
              !!lease && lease.client !== url.searchParams.get("client"),
          });
          return;
        }
        if (url.pathname === "/api/state") {
          send(res, 200, stateFor(requireSession(req, "player")));
          return;
        }
        if (url.pathname === "/api/host/state") {
          send(res, 200, stateFor(requireSession(req, "host")));
          return;
        }
        if (url.pathname === "/api/host/export") {
          requireSession(req, "host");
          send(res, 200, engine.exportResults());
          return;
        }
        if (url.pathname === "/api/presentation") {
          const s = requireSession(req);
          if (!["presentation", "host"].includes(s.role))
            throw Object.assign(Error("Presentation credential required"), {
              status: 403,
            });
          send(res, 200, engine.presentation());
          return;
        }
        if (url.pathname === "/api/events") {
          const display = url.searchParams.get("presentation") === "1";
          const viewer = requireSession(req);
          if (display && !["presentation", "host"].includes(viewer.role))
            throw Object.assign(Error("Presentation credential required"), {
              status: 403,
            });
          if (!display && viewer.role === "presentation")
            throw Object.assign(Error("Display access only"), { status: 403 });
          const s = display ? null : viewer;
          const id = token(),
            client = url.searchParams.get("client") || id;
          if (s?.role === "player") {
            const old = leases.get(s.player);
            if (
              old &&
              old.client !== client &&
              url.searchParams.get("takeover") !== "1"
            )
              throw Object.assign(Error("Another tab is active"), {
                status: 409,
              });
            if (old) {
              mutate(() => engine.disconnect(s.player));
              const stream = streams.get(old.id);
              if (stream) {
                stream.res.write("event: takeover\ndata: {}\n\n");
                stream.res.end();
                streams.delete(old.id);
              }
            }
            leases.set(s.player, { id, client });
          }
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          streams.set(id, { res, session: s });
          res.write(
            `event: state\ndata: ${JSON.stringify(s ? stateFor(s) : engine.presentation())}\n\n`,
          );
          req.on("close", () => {
            streams.delete(id);
            if (!closing && s && leases.get(s.player)?.id === id) {
              leases.delete(s.player);
              try {
                mutate(() => engine.disconnect(s.player));
              } catch (e) {
                console.error("Disconnect persistence failed:", e.message);
              }
            }
          });
          return;
        }
        const path =
          url.pathname === "/" ||
          ["/host", "/presentation"].includes(url.pathname)
            ? "index.html"
            : url.pathname.slice(1);
        const full = resolve(root, "public", path);
        if (!full.startsWith(resolve(root, "public") + "/"))
          throw Object.assign(Error("Not found"), { status: 404 });
        if (!existsSync(full))
          throw Object.assign(Error("Not found"), { status: 404 });
        const mime =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".mjs": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".png": "image/png",
          }[extname(full)] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        });
        res.end(readFileSync(full));
      } catch (e) {
        if (!res.headersSent) send(res, e.status || 400, { error: e.message });
        else res.end();
      }
    });
    const timer = setInterval(() => {
      try {
        engine.setConnected?.([...leases.keys()]);
        mutate(() => engine.tick());
        if (movementDirty) {
          persist();
          movementDirty = false;
        }
        broadcast();
      } catch (e) {
        console.error("Schedule error:", e.message);
      }
    }, 250);
    timer.unref();
    const close = async () => {
      if (closing) return;
      closing = true;
      clearInterval(timer);
      if (flushTimer) {
        clearTimeout(flushTimer);
        flush();
      }
      for (const v of streams.values()) v.res.end();
      await new Promise((r) => server.close(r));
      try {
        mutate(() => engine.cancelTrades());
        persist();
      } finally {
        db.close();
        releaseLock();
      }
    };
    return { server, engine, db, addInvitation, close };
  } catch (e) {
    try {
      db?.close();
    } finally {
      releaseLock();
    }
    throw e;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createGameServer();
  const port = Number(process.env.PORT || 4173);
  app.server.listen(port, process.env.BIND || "127.0.0.1", () =>
    console.log(
      `Second Nature Trail: http://localhost:${port}${process.env.DEMO === "1" ? "/?invite=demo-1" : ""}`,
    ),
  );
  for (const sig of ["SIGINT", "SIGTERM"])
    process.on(sig, async () => {
      await app.close();
      process.exit(0);
    });
}
