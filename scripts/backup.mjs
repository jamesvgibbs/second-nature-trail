import { DatabaseSync, backup } from "node:sqlite";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg)
  throw Error("Usage: node scripts/backup.mjs event.sqlite new-backup.sqlite");
const source = resolve(sourceArg),
  destination = resolve(destinationArg);
if (source === destination) throw Error("Backup must use a different file.");
const original = new DatabaseSync(source, { readOnly: true });
let created = false;
try {
  const fd = openSync(destination, "wx", 0o600);
  closeSync(fd);
  created = true;
  await backup(original, destination);
  const check = new DatabaseSync(destination, { readOnly: true });
  try {
    if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Backup integrity check failed.");
  } finally {
    check.close();
  }
  console.log("Backup created and SQLite integrity check passed.");
} catch (error) {
  if (created) unlinkSync(destination);
  throw error;
} finally {
  original.close();
}
