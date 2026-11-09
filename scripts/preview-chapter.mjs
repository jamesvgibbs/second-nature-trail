// Local review helper. Uses normal phase transitions with an initial clock offset.
// This is a chapter preview, not a full-event timing or capacity test.
import { createGameServer } from "../server.mjs";
import { RULES } from "../content.mjs";
const chapter = Number(process.argv[2] || 1);
if (!Number.isInteger(chapter) || chapter < 1 || chapter > 8)
  throw Error("Choose chapter1–8.");
const app = createGameServer({ dbPath: ":memory:", demo: true });
let offset = 0;
app.engine.now = () => Date.now() + offset;
app.engine.host("preview-operator", {
  type: "lobby",
  requestId: "preview-lobby",
  reason: "Local chapter review",
});
app.engine.host("preview-operator", {
  type: "start",
  requestId: "preview-start",
  reason: "Local chapter review",
});
offset = (chapter - 1) * (RULES.chapterMs + RULES.breakMs) + RULES.countdownMs;
app.engine.tick();
app.engine.host("preview-operator", {
  type: "broadcast",
  message:
    "LOCAL CHAPTER PREVIEW: earlier chapters are intentionally unplayed.",
  requestId: "preview-label",
  reason: "Label chapter review",
});
const port = Number(process.env.PORT || 4174);
app.server.listen(port, "127.0.0.1", () =>
  console.log(
    `Chapter${chapter} preview: http://localhost:${port}/?invite=demo-1`,
  ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
