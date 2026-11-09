// Isolated UI fixture only. Preloaded clues are not gameplay or award evidence.
import { createGameServer } from "../server.mjs";
import { CHAPTERS, RULES } from "../content.mjs";
const app = createGameServer({ dbPath: ":memory:", demo: true });
let offset = 0;
app.engine.now = () => Date.now() + offset;
app.engine.host("fixture-operator", {
  type: "lobby",
  requestId: "fixture-lobby",
  reason: "Isolated pointer-entry UI fixture",
});
app.engine.host("fixture-operator", {
  type: "start",
  requestId: "fixture-start",
  reason: "Isolated pointer-entry UI fixture",
});
offset = 7 * (RULES.chapterMs + RULES.breakMs) + RULES.countdownMs;
app.engine.tick();
const participant = app.engine.state.players["neighbor-1"];
participant.clues = CHAPTERS.map((chapter, index) => ({
  chapter: index,
  letter: chapter.clue,
}));
participant.progress.forEach((p) => {
  p.secret = true;
});
app.engine.host("fixture-operator", {
  type: "broadcast",
  message:
    "UI FIXTURE ONLY: all eight clues are preloaded for Neighbor 1. They were not earned through gameplay.",
  requestId: "fixture-label",
  reason: "Clearly identify synthetic fixture data",
});
const port = Number(process.env.PORT || 4174);
app.server.listen(port, "127.0.0.1", () =>
  console.log(
    `Synthetic mystery UI fixture: http://localhost:${port}/?invite=demo-1`,
  ),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
