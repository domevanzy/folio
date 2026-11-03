import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const { pull_request: pr, repository } = JSON.parse(
  readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
);
const match = /^(feat|fix|chore|docs)\(#([1-9]\d*)\): .{8,120}$/u.exec(
  pr.title,
);
if (!match)
  throw new Error(
    "PR-Titel muss dem Schema feat|fix|chore|docs(#N): Beschreibung entsprechen.",
  );
const issueNumber = Number(match[2]);
if (!new RegExp(`\\bCloses\\s+#${issueNumber}\\b`, "i").test(pr.body || ""))
  throw new Error(`Der PR muss Closes #${issueNumber} enthalten.`);
const issue = JSON.parse(
  execFileSync(
    "gh",
    ["api", `repos/${repository.full_name}/issues/${issueNumber}`],
    { encoding: "utf8" },
  ),
);
if (issue.pull_request)
  throw new Error("N muss eine Issue-Nummer sein, keine PR-Nummer.");
if (!/^\[(Bug|Feature|Task)\] .{8,120}$/u.test(issue.title))
  throw new Error(
    "Issue-Titel muss [Bug], [Feature] oder [Task] plus konkrete Beschreibung enthalten.",
  );
if (new Date(issue.created_at) > new Date(pr.created_at))
  throw new Error("Das Issue muss vor dem PR angelegt werden.");
console.log(`Namensschema und Issue-Verknüpfung für #${issueNumber} gültig.`);
