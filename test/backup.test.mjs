import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("backup preserves committed WAL data and refuses to overwrite an existing backup", () => {
  const dir = mkdtempSync(join(tmpdir(), "trail-backup-")),
    source = join(dir, "event.sqlite"),
    destination = join(dir, "backup.sqlite");
  const db = new DatabaseSync(source);
  db.exec(
    "PRAGMA journal_mode=WAL;CREATE TABLE evidence(value TEXT);INSERT INTO evidence VALUES('committed');",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["scripts/backup.mjs", source, destination],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(
        copy.prepare("SELECT value FROM evidence").get().value,
        "committed",
      );
    } finally {
      copy.close();
    }
    const before = readFileSync(destination);
    db.exec("INSERT INTO evidence VALUES('later')");
    const retry = spawnSync(
      process.execPath,
      ["scripts/backup.mjs", source, destination],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" },
    );
    assert.notEqual(retry.status, 0);
    assert.deepEqual(readFileSync(destination), before);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
