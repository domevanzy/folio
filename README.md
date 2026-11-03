# Folio

Ein eigenständig gestalteter NotebookLM-inspirierter MVP: private Notebooks, PDF-Quellen und ein Gemini-RAG-Chat mit anklickbaren Dokument- und Seitenbelegen. Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui-Button (Radix/CVA), Supabase Auth/PostgreSQL/pgvector/Storage und Vercel AI SDK. Keine simulierten KI-Antworten, Beispieldokumente oder produktiven Mock-Quellen.

## Schnellstart

Voraussetzungen: Node.js **24 LTS** (mindestens 22.13), npm, ein Supabase-Projekt und ein Gemini API-Key aus Google AI Studio. Das Repository enthält keine Zugangsdaten.

```sh
npm ci
cp .env.example .env.local
# Die drei Zugangswerte in .env.local eintragen
npm run dev
```

Öffne http://localhost:3000. Ohne Supabase-Konfiguration zeigt die Anwendung die gestaltete Startseite mit Einrichtungshinweis und deaktivierter Anmeldung. Es wird keine Datenbank simuliert.

### 1. Supabase

1. Ein neues Supabase-Projekt anlegen.
2. `supabase/migrations/001_folio.sql` vollständig im SQL Editor ausführen (alternativ per Supabase CLI `supabase db push` nach Verknüpfung). Das SQL ist eine einmalige initiale Migration für ein leeres Projekt. Die Erweiterung `vector` muss im Schema `extensions` liegen; ein bereits anders eingerichtetes Projekt vorher prüfen.
3. Project URL und **Publishable Key** aus den Projekteinstellungen übernehmen. Ein älterer `anon`-Key ist ebenfalls verwendbar. **Keinen Service-Role-Key eintragen.** Die Anwendung benötigt ihn nicht.
4. In Authentication den Email-Provider und Benutzerregistrierung aktivieren. Die Anwendung nutzt **E-Mail und Passwort**. Die E-Mail-Bestätigung für neue Konten bleibt aktiv. Die Site URL lokal auf `http://localhost:3000` setzen; für Produktion später die tatsächliche HTTPS-Origin verwenden.
5. Unter Authentication → URL Configuration die vollständigen Rückleitungen erlauben:

```text
http://localhost:3000/auth/confirm
http://localhost:3000/auth/confirm?flow=signup
http://localhost:3000/auth/confirm?flow=recovery
http://127.0.0.1:3000/auth/confirm
http://127.0.0.1:3000/auth/confirm?flow=signup
http://127.0.0.1:3000/auth/confirm?flow=recovery
```

Für Produktion dieselben Pfade mit der eigenen HTTPS-Origin ergänzen. `localhost` und `127.0.0.1` haben unterschiedliche Cookies: während eines Bestätigungs-/Recovery-Vorgangs denselben Browser und dieselbe Origin verwenden.

6. Die Supabase-Standardvorlagen für **Confirm signup** und **Reset password** mit `{{ .ConfirmationURL }}` funktionieren über den PKCE-Codeaustausch der Callback-Route. Ein normaler Login verwendet `signInWithPassword` und benötigt keinen E-Mail-Link. Neue Konten bestätigen einmalig ihre Adresse; anschließend erfolgt der Login ausschließlich mit E-Mail und Passwort. Bestehende Konten aus dem früheren Magic-Link-Login können über „Passwort vergessen oder noch kein Passwort?“ ein Passwort festlegen.
7. Der Callback akzeptiert PKCE-Codes sowie signierte `token_hash`-Links für `signup`, `email` und `recovery`. Recovery leitet ausschließlich auf `/auth/password`, Bestätigung auf `/`. Freie `next`-URLs werden nicht übernommen. Fehler gelangen ohne Tokens oder Providerdetails zurück zur Anmeldung.
8. Für öffentliche Nutzung einen eigenen SMTP-Anbieter in Supabase konfigurieren. Der kostenlose Standard-E-Mail-Dienst ist eingeschränkt und unterstützt keine eigenen E-Mail-Vorlagen. Der Betrieb mit den Standardvorlagen ist vorgesehen; Registrierung und Passwort-Zurücksetzen unterliegen den Supabase-Sendelimits. Die App bietet verständliche Meldungen bei falschem Passwort, unbestätigter E-Mail und zu vielen Versuchen.

Der integrierte E-Mail-Dienst erlaubt nur zwei Auth-E-Mails pro Stunde für das gesamte Projekt. Registrierung, frühere Magic Links und Passwort-Zurücksetzen teilen dieses Kontingent. Ein Wechsel zum Passwort-Login setzt das E-Mail-Kontingent nicht zurück. Normale Passwort-Anmeldungen benötigen keinen E-Mail-Versand. Ist das Kontingent ausgeschöpft, die bereits erhaltene neueste E-Mail verwenden (sofern noch gültig), später erneut anfordern oder einen eigenen SMTP-Dienst konfigurieren. Die App nennt bei diesem Fehler keine unbestätigte Wartezeit.

Die Registrierung und das Setzen neuer Passwörter verlangen in der Oberfläche mindestens zwölf Zeichen und eine übereinstimmende Wiederholung. Bestehende kürzere Passwörter werden beim Login weiterhin akzeptiert. Supabase übernimmt Hashing, Prüfung, Sessions und Auth-Rate-Limits; die Anwendung speichert und protokolliert keine Passwörter. Zusätzliche Passwortanforderungen können im Supabase-Projekt aktiviert werden.

Die Migration legt den **privaten** Bucket `documents` mit 4 MiB Dateilimit und PDF-MIME-Typ an. Storage-Pfade sind `user_id/notebook_id/source_id.pdf`; es gibt keine öffentlichen URLs.

### 2. Gemini

In Google AI Studio einen API-Key erstellen, die Gemini API für das Projekt aktivieren und ausreichende Embedding- und Textgenerierungsquoten sicherstellen. Zugriff und Verfügbarkeit der konfigurierten Modelle im eigenen Projekt prüfen. Dokumenttext und Fragen werden an Google übertragen; dies vor Nutzung mit vertraulichen Dokumenten berücksichtigen.

| Variable                               | Sichtbarkeit | Bedeutung                                                  |
| -------------------------------------- | ------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Öffentlich   | Supabase-Projekt-URL                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Öffentlich   | Veröffentlichbarer Schlüssel; RLS ist die Zugriffsschranke |
| `GOOGLE_GENERATIVE_AI_API_KEY`         | Nur Server   | Gemini API-Key                                             |
| `GEMINI_CHAT_MODEL`                    | Nur Server   | Default `gemini-3.5-flash-lite`                                 |
| `GEMINI_EMBEDDING_MODEL`               | Nur Server   | Default `gemini-embedding-001`                             |

Modelle, Suchschwelle, Chunk-/Datei-/Seitenlimits und Embedding-Dimension stehen zentral in `src/lib/config.ts`. Query- und Dokument-Embeddings verwenden die jeweiligen Retrieval-Task-Typen. Es werden **768 Dimensionen** angefordert; SQL und HNSW-Index sind darauf abgestimmt. Bei Modell-/Dimensionswechsel alle Dokumente neu einlesen und ggf. das Schema migrieren. Embeddings unterschiedlicher Modelle nicht mischen.

## End-to-End verwenden

1. Registrieren und die E-Mail-Adresse einmalig bestätigen oder mit E-Mail und Passwort anmelden.
2. Notebook erstellen und öffnen.
3. Eine textbasierte PDF per Drag-and-Drop oder Dateiauswahl hinzufügen. Während der Verarbeitung bleibt die Quelle für den Chat gesperrt.
4. Gewünschte Quellen per Checkbox auswählen und eine Frage stellen.
5. Die Antwort erscheint absatzweise. Nach dem Speichern führen nummerierte Belege und Dokumentchips direkt zum PDF auf der belegten Seite. Die zitierte Textstelle ist zusätzlich aufklappbar.
6. Im Studio eine auszugbasierte Zusammenfassung erzeugen. Sie wird mit Belegen im Chat gespeichert.

Notebooks lassen sich im Dashboard suchen, umbenennen und samt Quellen löschen. Quellen können einzeln gelöscht werden. Auf schmalen Bildschirmen wechseln Tabs zwischen Quellen, Chat und Studio.

## Architektur

```text
src/app/                         Server Components, Fehlerzustände, Auth-Callback und Passwort-Seite
src/lib/auth.ts                 Gemeinsame Auth-Validatoren, Fehlermeldungen, sichere Callback-Ziele
src/lib/client/auth.ts          E-Mail-/Passwort-Anmeldung, Registrierung und Recovery
src/app/api/notebooks/           Authentifizierte Route Handlers (CRUD, Upload, Chat, Studio)
src/components/                 Interaktive Oberfläche, Markdown, Quellen-/PDF-Ansicht
src/components/ui/              shadcn/ui-Komponentenbasis und gemeinsames Dialogverhalten
src/components/notebook/        PDF-Viewer, Studio, Chatnachrichten und gemeinsame Panel-Kopfzeilen
src/lib/client/api.ts           Browser-API-Aufrufe, JSON/Multipart, Fehler und Notebook-URLs
src/lib/chat-stream.ts          Gemeinsamer typisierter NDJSON-Vertrag und Stream-Parser
src/lib/validation.ts           Gemeinsame Notebook-Titel- und PDF-Dateiprüfung
src/lib/storage.ts              Gemeinsamer privater PDF-Speicherzugriff und Dateilöschung
src/lib/supabase/                Cookie-basierte Browser-/Server-Clients
src/proxy.ts                    Session-Refresh vor Seiten/API-Aufrufen
src/lib/http.ts                 Auth-/Notebook-Kontext, Eingabe-/Fehlerbehandlung, Limit-Aufruf
src/lib/rag/pdf.ts              Serverseitige PDF.js-Textextraktion je Seite
src/lib/rag/chunk.ts            Satz-/Absatzgrenzen, Ziel 1.800 Zeichen, 240 Zeichen Überlappung
src/lib/rag/model.ts            Google-Provider und Embeddings
src/lib/rag/retrieval.ts        pgvector-RPC, Kontext-IDs und Prompt
src/lib/rag/citations.ts        Prüfung der Quellenmarken und Absatzfreigabe
src/lib/rag/answer.ts           Retrieval → Gemini-Stream → Validierung → Persistenz
supabase/migrations/            Schema, Fremdschlüssel, RLS, Indizes, Funktionen, Storage
```

### Ingestion

Die Upload-Route begrenzt auch den tatsächlich gelesenen Request-Stream (einschließlich Anfragen ohne Content-Length; JSON bis 20 KiB, Multipart bis 4 MiB plus 100.000 Bytes Overhead) und validiert Authentifizierung, Notebook-Eigentümer, Anfrageursprung, Stundenlimit, Dateigröße, MIME-Typ, Endung und PDF-Magic-Bytes. PDF.js muss die Datei erfolgreich parsen. Passwortgeschützte, beschädigte, zu große oder textleere PDFs werden abgelehnt. Seiten werden einzeln extrahiert; Chunks überschreiten keine Seitengrenzen. Die Chunk-Indizes laufen pro Quelle fortlaufend.

Nach Extraktion wird ein `processing`-Datensatz angelegt, das Original privat gespeichert und in Batches von 24 Chunks eingebettet. Erst nach erfolgreicher Speicherung aller Chunks wird `ready` gesetzt. Bei Fehlern werden Chunks und Datei bestmöglich entfernt und die Quelle als `failed` markiert. Embedding-Aufrufe verwenden begrenzte Parallelität und Retries. Ingestion läuft synchron in einer Node.js-Function mit maximal 300 Sekunden.

### Retrieval und Antworten

Die Route akzeptiert ausschließlich Frage und ausgewählte Quellen-IDs, keine Client-Historie und keine Client-Kontexte. Alle IDs werden validiert; jede ausgewählte Quelle muss im eigenen Notebook und `ready` sein. Die Datenbankfunktion `match_document_chunks` ist **SECURITY INVOKER**: Sie filtert Benutzer, Notebook, Quellen, Status und Mindestähnlichkeit; RLS bleibt aktiv. Es werden maximal zehn passende Chunks verwendet. Die Benutzer-ID kann dem RPC nicht als Parameter untergeschoben werden.

Jeder Treffer erhält eine kurzlebige ID `[C1]` usw. mit serverseitig festgelegtem Dokument, Originalseite und Textstelle. Der Prompt behandelt Quellen inklusive Dateinamen und alte Nachrichten als nicht vertrauenswürdige Daten. Es gibt weder Websuche noch Tool-Ausführung. Alte Chatnachrichten dienen nur dem Gesprächskontext; ihre Quellenmarken werden nicht übernommen.

Das Vercel AI SDK streamt von Gemini. Die Route puffert jeweils bis zum Absatzende, entfernt unbekannte Quellenmarken und gibt nur Absätze mit einem bekannten Beleg frei. Unbelegte Absätze werden durch einen expliziten Hinweis ersetzt. Ohne Retrieval-Treffer entsteht eine direkte, persistierte Meldung über fehlende Quellenbasis, ohne LLM-Aufruf. Der Transport zum Browser ist ein kleiner NDJSON-Stream (`status`, `text`, `done`, `error`). Die Oberfläche unterscheidet Quellen-Suche, Modellgenerierung, Quellenprüfung und Speichern. Nach erfolgreichem Abschluss werden Antwort und tatsächlich verwendete Belege gespeichert; erst dann bestätigt `done` die Speicherung. Fehlerhafte Teilantworten werden im Browser entfernt. Die Chat-Anfrage hat ein Gesamtlimit von 90 Sekunden; der Browser begrenzt sie zusätzlich auf 100 Sekunden. Query-Embeddings haben ein Limit von 20 Sekunden. Die Generierung ist auf 60 Sekunden insgesamt, 25 Sekunden bis zum ersten Inhalt und 15 Sekunden zwischen Inhaltsblöcken begrenzt. Es gibt keine automatischen Generierungs-Retries bei Anbieterfehlern. Die Oberfläche bietet Abbrechen an; das Abbruchsignal wird an die Anfrage und das Modell weitergegeben. Gemini-503, Quotenfehler, Zeitüberschreitungen und unterbrochene Streams werden explizit behandelt. Für Gemini-3-Modelle wird die niedrige Denkstufe verwendet; das konfigurierte Modell bleibt unverändert.

**Grenze der Quellenprüfung:** Die Prüfung garantiert, dass jede freigegebene Quellen-ID auf eine wirklich abgerufene Textstelle mit korrektem Dokument und Seite verweist. Sie beweist nicht automatisch, dass jede Aussage semantisch vom Text gestützt wird. Prompt Injection und falsche Interpretation durch das Modell sind trotz Schutzprompt nicht vollständig ausgeschlossen. Belege lassen sich deshalb direkt nachlesen.

### Daten und Zugriff

- `notebooks`: privater Wissensraum mit Eigentümer.
- `sources`: Originaldatei, Status und Seitenanzahl.
- `document_chunks`: Text, Vektor, Notebook, Quelle, Seite und Index.
- `conversations`: ein persistentes Gespräch pro Notebook.
- `messages`: Benutzer-/Assistentennachrichten mit validierten Belegmetadaten.
- `request_limits`: atomare verteilte Stundenkontingente.

Ein zusätzliches Profil ist für diesen MVP nicht nötig; Supabase Auth verwaltet Identität und E-Mail. Zusammengesetzte Fremdschlüssel verhindern Quellen/Chunks/Gespräche über Benutzer- oder Notebook-Grenzen hinweg. Alle fachlichen Tabellen haben RLS. Die Clients verwenden ausschließlich den Publishable Key plus die jeweilige Benutzersession. Schreibrechte betreffen nur eigene Daten; ein Benutzer könnte seine eigenen Inhalte auch direkt über die Supabase-API verändern, aber keine fremden Inhalte lesen oder schreiben. KI-Schlüssel existieren ausschließlich im Serverprozess. Der Storage-Bucket erlaubt nur eigene Objekte. PDF-Zugriff erfolgt nach erneuter Notebook-/Quellenprüfung mit 120 Sekunden gültigen signierten URLs.

Die SECURITY-DEFINER-Limitfunktion hat einen leeren `search_path`, prüft `auth.uid()`, akzeptiert nur feste Operationsnamen und nutzt atomare Datenbank-Upserts. Direkter Zugriff auf die Zählertabelle ist gesperrt. Limits pro Benutzer und Stunde: 30 Chats, 8 Uploads, 8 Zusammenfassungen, 30 Notebook-Erstellungen. Schreibende App-Routen verlangen einen zur Anfrage passenden Origin-Header als CSRF-Schutz. Auth-E-Mail-Limits stellt Supabase separat bereit. Eigene Datenänderungen über Supabase umgehen App-Limits, ermöglichen jedoch keine kostenpflichtigen Gemini-Aufrufe ohne die geprüften App-Routen.

### Wartbarkeit

Dashboard und Notebook verwenden dieselbe Browser-API-Schicht. Uploads und normale JSON-Anfragen teilen sich die Fehlerbehandlung. PDF-Metadaten und Notebook-Titel werden über gemeinsame Validatoren geprüft; die tiefe PDF-Prüfung bleibt serverseitig. Der Chat-Stream hat einen gemeinsamen typisierten Vertrag für Server und Browser, inklusive Laufzeitvalidierung und sauberer Freigabe abgebrochener Streams. Modal-Dialoge teilen Fokusführung, Escape-Verhalten, Scroll-Sperre und Schließen über den Hintergrund. PDF-Viewer, Studio und Nachrichten sind eigene Komponenten; Authentifizierung und Notebook-Berechtigungsprüfung bleiben zentral. Query- und Dokument-Embeddings verwenden dieselbe Modellkonfiguration mit dem jeweiligen Retrieval-Task-Typ. Diese Regeln sind auch in `AGENTS.md` festgehalten.

## GitHub-Workflow

Privates Repository: https://github.com/domevanzy/folio. Verbindliche Reihenfolge: **Issue → PR → Tests → Merge**. Namensschema, Branches, Prüfungen und Merge-Regeln stehen in `CONTRIBUTING.md`. GitHub Actions prüft PR-/Issue-Namen, Verknüpfung, ESLint, Typecheck, Tests und Produktions-Build.

## Tests und Qualität

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
npm audit --omit=dev
```

Der Build verwendet Webpack, weil Turbopack in der Entwicklungsumgebung an einer lokalen Prozess-/Portbeschränkung scheiterte. Das ändert den Next.js App Router und das Vercel-Ziel nicht. Versionen sind in `package.json` und `package-lock.json` festgehalten.

Die Unit-Tests prüfen Seitentreue, leere Seiten, überlange Textstücke, Überlappung, Chunk-Grenzen, unbekannte/duplizierte Quellenmarken und Zurückhalten unbelegter Absätze. PDF-Tests erzeugen und parsen echte mehrseitige PDFs und prüfen ungültige Dateien sowie das Seitenlimit.

### Lokaler Datenbank-Integrationstest

`npm run test:db` führt die unveränderte SQL-Migration in einer lokalen PostgreSQL-Laufzeit (PGlite) mit echter pgvector-Erweiterung aus. Nur die Supabase-eigenen Auth-/Storage-Tabellen und `auth.uid()` werden als Testumgebung bereitgestellt. Die Tests wechseln echte Datenbankrollen und prüfen Retrieval, Notebook-/Quellenfilter, RLS über Benutzergrenzen, zusammengesetzte Fremdschlüssel, Storage-Policies und Stundenlimits. Dafür sind weder Docker noch externe Zugangsdaten nötig.

### Zusätzlicher Supabase-Retrieval-Integrationstest

Ein **isoliertes**, vollständig migriertes Supabase-Testprojekt und zwei verschiedene bestätigte Testkonten mit E-Mail/Passwort verwenden. Niemals Produktivdaten oder das normale Nutzerkonto verwenden. Die vier `TEST_USER_*`-Werte und die zwei Supabase-Werte in `.env.local` setzen. Diese Datei wird von Vitest geladen und ist ignoriert.

```sh
npm run test:integration
```

`npm run test:integration` führt sowohl den lokalen Datenbanktest als auch den optionalen Supabase-Test aus. Der Supabase-Test meldet sich als beide Nutzer an, legt temporäre Notebooks, Quellen und echte 768-dimensionale Vektoren an und prüft die reale Suchfunktion mit denselben Retrieval-Aufrufen wie die Anwendung: ausgewählte Quelle, anderes Notebook, `processing`-Quelle, fremder Benutzer, leere Auswahl, direkter RLS-Lesezugriff und gefälschte Eigentümerzuordnung. Testdaten werden im `finally` gelöscht. Es wird kein Gemini-Key verbraucht; feste orthogonale Suchvektoren prüfen Datenbankintegration und Isolation unabhängig vom Modell.

Fehlen Zugänge, wird nur der zusätzliche Supabase-Test **übersprungen**, nicht als bestandener Integrationstest ausgegeben. Die Auth-Tests prüfen Passwortvalidierung, Passwort-Anmeldung ohne E-Mail-Versand, Registrierung mit weiterhin erforderlicher E-Mail-Bestätigung, Recovery-Ziele und Callback-Token-/PKCE-Austausch. Ein echter Upload-/Gemini-/E-Mail-Test benötigt eingerichtete externe Dienste und muss vor öffentlicher Freigabe zusätzlich anhand des obigen End-to-End-Ablaufs erfolgen.

## Vercel-Deployment

1. Projekt in ein eigenes Git-Repository übernehmen und nach GitHub/GitLab/Bitbucket pushen.
2. In Vercel als Next.js-Projekt importieren, Node.js **24.x** wählen, Install `npm ci`, Build `npm run build`, Ausgabe automatisch.
3. Die fünf oben beschriebenen Variablen in Vercel unter Environment Variables setzen (mindestens URL, Publishable Key und Gemini-Key). Den Gemini-Key nur serverseitig ohne `NEXT_PUBLIC_`-Präfix setzen.
4. Supabase-Migration ausführen, Auth-/SMTP-Konfiguration abschließen und Site URL/Redirect-Allowlist auf die tatsächliche HTTPS-Domain setzen. Für Staging ein getrenntes Supabase-Projekt und einen getrennten Gemini-Key verwenden.
5. Deployen und den End-to-End-Ablauf mit zwei separaten Benutzerkonten prüfen. Cookies/API-Antworten dürfen nicht öffentlich gecacht werden. Die datentragenden Seiten sind dynamisch, Streams und signierte URLs verwenden `no-store`.
6. Sicherstellen, dass das gewählte Vercel-Angebot 300 Sekunden Function-Laufzeit unterstützt. Die Route deklariert `maxDuration=300`; ein kleineres Plattformlimit kann lange PDFs abbrechen. Der Multipart-Upload bleibt unter Vercels 4,5-MB-Requestlimit. Das 4-MiB-Dateilimit lässt Platz für Multipart-Overhead.

Kein Deployment wurde allein durch die lokale Implementierung veröffentlicht. Es sind ein eigenes Vercel-Projekt sowie echte Supabase-/Gemini-Zugangswerte erforderlich. Es gibt keinen automatischen Fallback auf eine andere Hostingplattform.

## Bekannte Einschränkungen und Betriebsgrenzen

- Nur textbasierte PDFs; keine OCR, Webseiten, Audio, Kollaboration oder öffentlichen Notebook-Freigaben.
- PDF-Limit 4 MiB, 100 Seiten, 400.000 extrahierte Zeichen und 240 Chunks. Einzelne PDFs können früher an Laufzeit-/Providerquoten scheitern.
- Keine dauerhafte Job-Queue und keine automatische Wiederaufnahme. Nach hartem Function-Abbruch kann eine Quelle `processing` bleiben; diese löschen und erneut hochladen. Regelmäßige Bereinigung verwaister Dateien/Datensätze ist für größeren Betrieb zu ergänzen.
- Upload/Dateilöschung und SQL-Schreibvorgänge sind keine verteilte Transaktion. Bei Storage-Ausfall wird die Löschung abgebrochen, bei einem späteren SQL-Ausfall ist ein Retry nötig.
- PDF-Anzeige verwendet den nativen Browser-Viewer mit `#page=`. Auf Geräten ohne PDF-Einbettung die Datei in einem neuen Tab öffnen. Signierte Links nach zwei Minuten durch erneuten Klick auf das Zitat erneuern. Keine grafische Textmarkierung, aber Originalauszug neben dem PDF.
- Zusammenfassungen nutzen maximal 40 über die ausgewählten Quellen verteilte Auszüge (bis zu fünf je Quelle, round-robin); sie sind ausdrücklich keine Vollständigkeitsgarantie.
- Pro Notebook ein Gespräch. UI lädt die letzten 100 Nachrichten, das Modell maximal acht vorherige Nachrichten mit je maximal 6.000 Zeichen. Kein Verlaufsexport und keine Verlaufspaginierung. Gleichzeitige Chats in mehreren Tabs können sich zeitlich überlappen; keine Gesprächssperre.
- Kosinus-Suche mit fester Schwelle 0,3; kein zusätzlicher Reranker und keine separate faktische Belegprüfung. Für andere Sprachen/Dokumenttypen anhand eigener Eval-Daten abstimmen.
- Keine globale Kostenobergrenze und kein Malware-Scanner. Für größeren öffentlichen Betrieb zusätzlich Provider-Budgets, Registrierungsschutz, Monitoring und gegebenenfalls eine Upload-Job-Queue einrichten.
- `npm audit --omit=dev` meldete bei der lokalen Prüfung keine bekannten Produktionslücken. Der vollständige Audit meldete 16 moderate Entwicklungsabhängigkeitsbefunde im ESLint-/minimatch-Baum. Ein erzwungenes Downgrade auf inkompatible ESLint-/Next-Konfiguration wurde nicht vorgenommen; vor späteren Dependency-Updates erneut prüfen.

## Referenzen

- [Supabase: Cookie-basierte Server-Clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
- [Vercel AI SDK: Google-Provider und Embeddings](https://ai-sdk.dev/providers/ai-sdk-providers/google)
- [Gemini Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)

### Datenbankprüfung beim Staging-Deploy

GitHub Actions erstellt den Vercel-Preview-Build für den Staging-Commit.
Erst nach `Ready` folgen Migrationen, bei geänderten Funktionsdateien oder
geänderter Supabase-Konfiguration Edge Functions und die lesende Schemaprüfung.
Die Preview kann erreichbar sein, bevor die Datenbankschritte abgeschlossen
sind. Maßgeblich ist der erfolgreiche GitHub-Workflow **Staging release**.

Vor Aktivierung unter **GitHub → Settings → Secrets and variables → Actions**
die folgenden Repository-Einstellungen hinterlegen:

| Typ | Name | Wert |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | Token mit Zugriff auf das Folio-Projekt |
| Variable | `VERCEL_PROJECT_ID` | Vercel-Projekt-ID |
| Variable | `VERCEL_TEAM_ID` | ID des Vercel-Teams |
| Variable | `STAGING_SUPABASE_PROJECT_REF` | Ref des Staging-Projekts |
| Secret | `STAGING_DB_MIGRATION_URL` | Staging Session-Pooler-URL mit Benutzer `postgres.<staging-project-ref>` und Datenbankpasswort |
| Secret | `STAGING_SCHEMA_DATABASE_URL` | Staging Session-Pooler-URL für die lesende Rolle |
| Variable | `STAGING_SCHEMA_DATABASE_CA` | Vollständiger PEM-Inhalt des Staging-CA-Zertifikats |
| Secret | `STAGING_SUPABASE_ACCESS_TOKEN` | Erst bei Edge Functions erforderlich |

Vor dem ersten Lauf die Migrationshistorie abgleichen. Wenn `001_folio.sql`
bereits manuell eingespielt wurde, nach Prüfung des tatsächlichen Schemas die
Migration als angewendet eintragen. Bei leerem Schema spielt der Workflow sie
ein. Bei einem Abbruch kann der Workflow für den aktuellen Branch erneut
gestartet werden. Production wird separat umgestellt.

1. Im **Staging**-Supabase-Projekt im SQL Editor eine eigene Login-Rolle
   mit einem starken, eindeutigen Passwort anlegen:

   ```sql
   create role folio_schema_check login password '<eigenes starkes Passwort>';
   grant usage on schema extensions, storage to folio_schema_check;
   grant select (id, public, file_size_limit, allowed_mime_types)
     on storage.buckets to folio_schema_check;
   ```

   Die Rolle benötigt Sicht auf den Bucket `documents`. Falls für
   `storage.buckets` Row Level Security aktiv ist, erlaube dieser Rolle
   ausschließlich die Sicht auf diesen Bucket:

   ```sql
   create policy folio_schema_check_documents on storage.buckets
     for select to folio_schema_check using (id = 'documents');
   ```

2. In Supabase unter **Connect** den Host des **Session pooler** kopieren.
   In GitHub das Secret `STAGING_SCHEMA_DATABASE_URL` setzen. URL-encode Sonderzeichen im Passwort:

   ```text
   postgresql://folio_schema_check.<staging-project-ref>:<url-encoded-password>@<session-pooler-host>:5432/postgres
   ```

3. In Supabase unter **Database Settings → SSL Configuration** das
   CA-Zertifikat des Staging-Projekts herunterladen. Den vollständigen
   PEM-Inhalt inklusive `BEGIN CERTIFICATE` und `END CERTIFICATE` in GitHub
   als Variable `STAGING_SCHEMA_DATABASE_CA` speichern.
   Die Verbindung prüft das Zertifikat und den Hostnamen.

4. Unter **GitHub → Actions → Staging release** das Ergebnis prüfen.
