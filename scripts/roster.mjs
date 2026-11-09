import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createGameServer } from "../server.mjs";
// Input deliberately uses JSON, avoiding ambiguous CSV identity parsing.
const [input, output, base] = process.argv.slice(2);
if (!input || !output || !base)
  throw Error(
    "Usage: npm run roster -- roster.json private/invitations.json https://game.example",
  );
const roster = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(roster) || roster.length > 100 || roster.length === 0)
  throw Error("Roster must contain 1–100 {id,name} entries.");
const seen = new Set();
for (const p of roster) {
  if (
    typeof p.id !== "string" ||
    !p.id ||
    seen.has(p.id) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 60
  )
    throw Error(
      "Each employee needs a unique nonempty id and a display name of 1–60 characters.",
    );
  seen.add(p.id);
}
const app = createGameServer();
try {
  const invitations = roster.map((p) => ({
    id: p.id,
    name: p.name,
    url: `${base.replace(/\/$/, "")}/?invite=${app.addInvitation(p.id, p.name)}`,
  }));
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, JSON.stringify(invitations, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    "Private invitation file created. Distribute through your approved channel.",
  );
} finally {
  await app.close();
}
