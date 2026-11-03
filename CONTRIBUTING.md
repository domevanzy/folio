# Entwicklungsworkflow

Verbindliche Reihenfolge: **Issue → PR → Tests → Merge**.

1. Zuerst ein Issue mit Problem/Ziel und überprüfbaren Akzeptanzkriterien anlegen.
2. Einen passenden Branch erstellen und früh einen Draft-PR mit `Closes #N` öffnen. Jeder PR löst genau ein primäres Issue; zusammengehörige Änderungen gehören in denselben PR.
3. Erst nach Eröffnung des PR die vollständigen Prüfungen ausführen: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Fehlgeschlagene Prüfungen im selben Branch korrigieren. Regressionstests bei Fehlerbehebungen ergänzen. Nach Codeänderungen die betroffenen Prüfungen erneut ausführen. Die Cloud-Integration benötigt separat eingerichtete Testkonten; übersprungene Tests ausdrücklich benennen.
4. Vor dem Merge den aktuellen PR-Diff prüfen, den PR auf bereit setzen und auf erfolgreiche GitHub-Prüfungen für den neuesten Commit warten. Anschließend per Squash mergen und den Branch löschen. Nicht auf `main` entwickeln oder direkt pushen.

Bei einem vollständig leeren Repository ist einmalig ein minimaler Start-Commit auf `main` nötig, um einen PR gegen diesen Branch eröffnen zu können. Dieser Commit enthält ausschließlich `.gitignore`; der Anwendungscode folgt über einen PR.

## Issues nach Staging-Merges

Nach einem Merge nach `staging` schließt GitHub Actions das primäre Issue,
wenn PR-Titel und `Closes #N` dieselbe Issue-Nummer enthalten.
Ein ohne Merge geschlossener PR lässt das Issue offen.

## Namensschema

| Gegenstand        | Schema                              | Beispiel                                               |
| ----------------- | ----------------------------------- | ------------------------------------------------------ |
| Fehler-Issue      | `[Bug] <konkretes Problem>`         | `[Bug] Chat bleibt beim Laden hängen`                  |
| Funktions-Issue   | `[Feature] <gewünschtes Verhalten>` | `[Feature] Notebook-Suche ergänzen`                    |
| Wartungs-Issue    | `[Task] <konkrete Aufgabe>`         | `[Task] Abhängigkeiten aktualisieren`                  |
| Fehler-PR         | `fix(#N): <Änderung>`               | `fix(#12): Chat-Timeout und Fehleranzeige korrigieren` |
| Funktions-PR      | `feat(#N): <Änderung>`              | `feat(#13): Notebook-Suche ergänzen`                   |
| Wartungs-PR       | `chore(#N): <Änderung>`             | `chore(#14): Abhängigkeiten aktualisieren`             |
| Dokumentations-PR | `docs(#N): <Änderung>`              | `docs(#15): Deployment beschreiben`                    |
| Branch            | `<typ>/<N>-<kurzer-kebab-name>`     | `fix/12-chat-timeout`                                  |

`N` bezeichnet immer die Issue-Nummer, nicht die PR-Nummer. Commit-Betreffzeilen folgen demselben Schema wie PRs. Namen sind kurz und konkret; Issue-Typ und PR-Typ müssen inhaltlich zusammenpassen. Issue-Titel und PR-Titel werden in CI geprüft.

## Wiederverwendung und Geheimnisse

Vor neuen Bausteinen bestehende Komponenten und Hilfsfunktionen prüfen. Gemeinsame Logik zentral halten, fachliche Module klar trennen. Zugangswerte bleiben in ignorierten lokalen Dateien oder den vorgesehenen Secret-Verwaltungen. `.env.example` enthält nur Platzhalter. Keine `.env.local`, Supabase-CLI-Zustände, Arbeitsdateien, Dokumente von Benutzern oder erzeugten Build-Dateien committen.
