import { createGameServer } from "../server.mjs";
let offset = 0;
const app = createGameServer({ dbPath: process.env.TEST_DB, demo: true });
app.engine.now = () => Date.now() + offset;
app.server.listen(0, "127.0.0.1", () =>
  process.send({ type: "ready", port: app.server.address().port }),
);
process.on("message", (message) => {
  if (message.type === "advance") {
    offset += message.ms;
    process.send({ type: "advanced", id: message.id });
  }
});
