# Prüfstatus — 2. November 2026

## Bestanden

- `npm run lint` — keine Fehler oder Warnungen.
- `npm run typecheck` — TypeScript strict ohne Fehler.
- `npm test` — **48 Tests bestanden**, ein zusätzlicher Supabase-Cloudtest übersprungen.
- Lokale PostgreSQL-/pgvector-Integration: unveränderte Migration erfolgreich ausgeführt; echte Datenbankrollen, RLS, Suchfilter, Fremdschlüssel, Storage-Regeln und atomare Limits geprüft.
- PDF-Extraktion mit echten generierten mehrseitigen PDF-Dateien; Seitenzuordnung, beschädigte Dateien, Größen- und Seitenlimits geprüft.
- Chunking, Überlappung und Quellenvalidierung geprüft.
- Request-Stream-Limits ohne Größen-Header und mit UTF-8-Inhalten geprüft.
- `npm run build` — Next.js 16.4.4 Produktions-Build mit Webpack erfolgreich.
- Produktionsserver gestartet; Startseite im Browser ohne Konsolenfehler geladen.
- Startseite bei 390 px Breite geprüft, kein horizontaler Überlauf.
- Vercel-Dateitracing enthält PDF.js-Worker und die lokale native Canvas-Laufzeit. Beim Linux-Deployment installiert `npm ci` die passende Plattformvariante.
- `npm audit --omit=dev` — keine gemeldeten Produktionslücken zum Prüfzeitpunkt.

- E-Mail-/Passwort-Anmeldung, Registrierung und Passwort-Zurücksetzen implementiert; gemeinsame Passwortvalidierung und Callback-Verarbeitung für PKCE-Codes und Token-Hashes geprüft.
- Lokale Auth-Rückleitungsadressen im verknüpften Supabase-Projekt eingerichtet; E-Mail-Bestätigung bleibt aktiv.
- Neue Registrierungsoberfläche im Browser ohne Konsolenfehler geprüft.

## Noch extern zu prüfen

- Der zusätzliche echte Supabase-REST/Auth-Integrationstest benötigt ein migriertes Testprojekt und zwei bestätigte Testkonten.
- Anmeldung mit echten Benutzerzugangsdaten, Registrierung/Recovery per E-Mail, Storage-Upload, echte Gemini-Embeddings/Antworten und PDF-Zugriff müssen nach dem Eintragen der Zugangswerte einmal vollständig durchgespielt werden.
- Die angemeldete dreispaltige Oberfläche konnte ohne Supabase-Sitzung nicht im Browser geprüft werden. Sie wurde durch Typecheck und Produktions-Build geprüft.
- Vercel-Deployment benötigt ein eigenes Projekt und die dokumentierten Umgebungsvariablen. Es wurde keine öffentliche Instanz veröffentlicht.

## Bekannte Audit-Befunde

Der vollständige Entwicklungs-Audit meldet 16 moderate Befunde im ESLint-/minimatch-Abhängigkeitsbaum. Die angebotene automatische Hauptversionsänderung wäre mit der gewählten Next.js-Lintkonfiguration inkompatibel; sie wurde nicht erzwungen. Die Produktionsabhängigkeiten waren ohne Befund. Details und funktionale Einschränkungen stehen in README.md.

## Chat-Fehleranalyse und GitHub-Workflow

Die beiden Beispielquellen im betroffenen Notebook sind bereit; vier Chunks und die gestellte Benutzerfrage wurden gespeichert. Der direkte Gemini-3.8-Test lieferte HTTP 503 (Anbieterüberlastung). Das Modell bleibt unverändert. Chat-Fehlerauswertung, Statusereignisse, Zeitlimits und Abbrechen sind implementiert. Regressionstests verwenden den echten AI-SDK-Stream mit dessen Test-Provider für 503, Teilantworten, ausbleibende Inhalte und Abbruch. Die erfolgreiche Live-KI-Antwort steht wegen der Anbieterüberlastung weiterhin aus.

Das private GitHub-Repository verwendet Issue → PR → Tests → Merge, dokumentierte Namen und automatisierte Prüfungen.
