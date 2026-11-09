// Isolated visual fixture only: preloaded repairs are not gameplay evidence.
import { createGameServer } from "../server.mjs";
const app = createGameServer({ dbPath: ":memory:", demo: true });
for (const type of ["lobby", "start"])
  app.engine.host("fixture-operator", {
    type,
    requestId: `fixture-${type}`,
    reason: "Isolated restoration and minimum-window UI fixture",
  });
const s = app.engine.state;
s.phase = "brag";
s.chapter = 0;
s.deadline = Date.now() + 30 * 60000;
s.contributions = [5, 10, 15, 20, 0, 0, 0, 0];
s.broadcast =
  "UI FIXTURE ONLY: repair counts are preloaded to inspect four restoration stages. No gameplay completion is claimed.";
const p = s.players["neighbor-2"];
p.setup = true;
p.insects = false;
p.settings = {
  textSize: 1,
  control: "keyboard",
  music: 0,
  effects: 0,
  reducedMotion: true,
};
app.server.listen(4174, "127.0.0.1", () =>
  console.log(
    "Synthetic restoration fixture: http://localhost:4174/?invite=demo-2",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
