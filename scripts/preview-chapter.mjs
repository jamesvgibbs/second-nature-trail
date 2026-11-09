// Local review helper. Uses normal phase transitions with an initial clock offset.
// This is a chapter preview, not a full-event timing or capacity test.
import { createInterface } from "node:readline";
import { createGameServer } from "../server.mjs";
import { RULES } from "../content.mjs";
const args = process.argv.slice(2);
const waitForStart = args.includes("--wait-for-start");
const positional = args.filter((arg) => arg !== "--wait-for-start");
const chapter = Number(positional[0] || 1);
if (positional.length > 1 || !Number.isInteger(chapter) || chapter < 1 || chapter > 8)
  throw Error("Usage: node scripts/preview-chapter.mjs [1–8] [--wait-for-start]");
const app = createGameServer({ dbPath: ":memory:", demo: true });
let offset = 0, started = false, closing = false, input;
app.engine.now = () => Date.now() + offset;
app.engine.host("preview-operator", {
  type: "lobby",
  requestId: "preview-lobby",
  reason: "Local chapter review",
});
function start() {
  if (started || closing) return;
  started = true;
  app.engine.host("preview-operator", {
    type: "start",
    requestId: "preview-start",
    reason: "Local chapter review",
  });
  // Preserve the original immediate preview's offset. Waiting previews start
  // later chapters at their actual opening; only chapter1 includes countdown.
  offset = (chapter - 1) * (RULES.chapterMs + RULES.breakMs) +
    (!waitForStart || chapter === 1 ? RULES.countdownMs : 0);
  app.engine.tick();
  app.engine.host("preview-operator", {
    type: "broadcast",
    message: "LOCAL CHAPTER PREVIEW: earlier chapters are intentionally unplayed.",
    requestId: "preview-label",
    reason: "Label chapter review",
  });
  console.log(`Chapter${chapter} preview started. Earlier chapters are intentionally unplayed.`);
  input?.close();
  if (waitForStart) process.stdin.pause();
}
if (!waitForStart) start();
const port = Number(process.env.PORT || 4174);
app.server.listen(port, "127.0.0.1", () => {
  console.log(`Chapter${chapter} preview: http://localhost:${app.server.address().port}/?invite=demo-1`);
  if (waitForStart) {
    console.log("WAITING IN LOBBY: finish character setup and practice in the browser, then press Enter in this terminal to start the selected chapter once. Earlier chapters will remain unplayed. Closing stdin does not start play.");
    input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
    input.once("line", start);
  }
});
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, async () => {
    if (closing) return;
    closing = true;
    input?.close();
    process.stdin.pause();
    await app.close();
    process.exit(0);
  });
