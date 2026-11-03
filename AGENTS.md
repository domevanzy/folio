<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Wartbarkeit

- Vor neuen Komponenten oder Hilfsfunktionen vorhandene Bausteine prüfen und wiederverwenden.
- Gemeinsame Browser-API-Aufrufe in `src/lib/client/api.ts`, Validierung in `src/lib/validation.ts` und Chat-Streaming in `src/lib/chat-stream.ts` pflegen.
- Dialogverhalten zentral in `src/components/ui/modal.tsx` halten; Notebook-Bereiche in `src/components/notebook/` kapseln.
- Servercode und Geheimnisse aus Browser-Modulen fernhalten.
- Konkrete Wiederholungen zusammenführen; keine allgemeinen Abstraktionen ohne tatsächlichen zweiten Anwendungsfall einführen.

## GitHub-Workflow

- Verbindlich: Issue → PR → Tests → Merge. Details und Namensschema stehen in `CONTRIBUTING.md`.
- Issues: `[Bug] ...`, `[Feature] ...` oder `[Task] ...`.
- PRs und Commits: `fix(#N): ...`, `feat(#N): ...`, `chore(#N): ...` oder `docs(#N): ...`; N ist die Issue-Nummer.
- Branches: `<typ>/<N>-<kebab-name>`. Früh einen Draft-PR mit `Closes #N` eröffnen, danach die vollständigen Prüfungen ausführen.
- Erst nach erfolgreichen Prüfungen des aktuellen Commits und Diff-Prüfung per Squash mergen; kein direkter Anwendungscode-Push auf `main`.
