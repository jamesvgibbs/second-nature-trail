import { writeFileSync } from "node:fs";
import { RULES, CHAPTERS } from "../content.mjs";
import { createHash } from "node:crypto";
const hash = createHash("sha256")
  .update(JSON.stringify({ rules: RULES, chapters: CHAPTERS }))
  .digest("hex");
const lines = [
  "# Benefit content review",
  "",
  "Status: draft, awaiting SN content-owner approval. Generated from server-only content; do not distribute this answer key to players before the event.",
  "",
  "Rules version: " + RULES.version,
  "",
  "Review reference SHA-256: `" + hash + "`",
  "",
  "Approver: pending. Approval date: pending. Event/build: pending.",
  "",
  "Confirm benefit names, factual claims, eligibility, explanations, and answer keys. The game makes no real insurance, credit, or financial determinations. Corrections must be made in `content.mjs`, then this sheet regenerated and tests rerun.",
  "",
  "All sixteen questions below are required first-submission scored encounters. Optional retries are unscored.",
];
for (const [i, c] of CHAPTERS.entries()) {
  lines.push(
    "",
    "## " + (i + 1) + ". " + c.title,
    "",
    "Chapter objective: " + c.objective,
  );
  for (const [j, q] of c.questions.entries()) {
    lines.push("", "### Question " + (i * 2 + j + 1), "", q.prompt, "");
    q.options.forEach((o, k) => lines.push(String(k + 1) + ". " + o));
    lines.push(
      "",
      "Correct answer: " + String(q.answer + 1) + ". " + q.options[q.answer],
      "",
      "Explanation: " + q.explanation,
      "",
      "Review: [ ] Approved  [ ] Revision needed",
      "Reviewer notes:",
    );
  }
}
lines.push(
  "",
  "## Approval record",
  "",
  "Record the actual reviewer and date here only after explicit review. A generated sheet or passing code test is not content approval. Set the release approval configuration only after the approved content is frozen.",
  "",
);
writeFileSync(
  new URL("../docs/content-review.md", import.meta.url),
  lines.join("\n"),
);
console.log(
  "Created docs/content-review.md with16 questions; approval remains pending.",
);
