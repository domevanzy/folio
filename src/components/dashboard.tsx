"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Plus,
  BookOpen,
  Search,
  FileText,
  Quote,
  ArrowRight,
  NotebookPen,
  MoreHorizontal,
  LayoutGrid,
  List,
  Loader2,
  X,
  Trash2,
  Pencil,
} from "lucide-react";
import { api, notebookUrl } from "@/lib/client/api";
import type { Notebook } from "@/lib/types";
import { Brand } from "./brand";
import { Auth, SignOut } from "./auth";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
export function Dashboard({
  notebooks,
  email,
  enabled,
  loadError,
  authError,
}: {
  notebooks: Notebook[];
  email?: string;
  enabled: boolean;
  loadError: boolean;
  authError: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [list, setList] = useState(false);
  const [dialog, setDialog] = useState<{
    kind: "create" | "rename" | "delete";
    notebook?: Notebook;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const showHero = !email || (!loadError && notebooks.length === 0);
  const LibraryHeading = showHero ? "h2" : "h1";
  const filtered = notebooks.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );
  function open(kind: "create" | "rename" | "delete", notebook?: Notebook) {
    setTitle(notebook?.title || "");
    setError("");
    setMenu(null);
    setDialog({ kind, notebook });
  }
  return (
    <>
      <header className="mx-auto flex h-24 max-w-[1380px] items-center justify-between px-6 md:px-12">
        <Brand />
        <div className="flex items-center gap-5">
          <span className="desktop-only text-xs muted">
            Dein persönlicher Wissensraum
          </span>
          {email ? (
            <>
              <SignOut />
              <span
                title={email}
                className="flex size-9 items-center justify-center rounded-full border border-[#d5dfce] bg-[#e8eedf] text-xs font-semibold"
              >
                {email.slice(0, 2).toUpperCase()}
              </span>
            </>
          ) : (
            <span className="rounded-full border border-[#dce3d6] px-3 py-1 text-xs">
              Research, reimagined
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1284px] px-6 pb-12 md:px-12">
        {showHero && (
          <section className="relative mt-7 overflow-hidden rounded-[28px] border border-[#dce4d3] bg-[#edf2e5] px-7 py-11 md:px-11 md:py-12">
            <div className="relative z-10 max-w-[650px]">
              <h1 className="serif text-[42px] leading-[1.1] md:text-[54px]">
                Aus Dokumenten
                <br />
                werden{" "}
                <span className="italic text-[#698254]">Erkenntnisse.</span>
              </h1>
              <p className="mt-5 max-w-[430px] text-sm leading-7 text-[#657160]">
                Ein Ort für deine Quellen, Fragen und nächsten Ideen.
                <br className="desktop-only" /> Entdecke, was in deinem Wissen
                steckt.
              </p>
              <Button
                className="mt-7"
                onClick={() =>
                  email
                    ? open("create")
                    : document
                        .getElementById("start")
                        ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {email ? <Plus size={17} /> : <ArrowRight size={17} />}{" "}
                {email ? "Notebook erstellen" : "Deinen Wissensraum öffnen"}
              </Button>
            </div>
            <div
              aria-hidden
              className="desktop-only absolute -right-4 top-0 flex h-full w-[40%] items-center justify-center"
            >
              <div className="dot-grid absolute inset-6 opacity-40" />
              <div className="absolute h-48 w-40 rotate-[-16deg] rounded-2xl border border-[#c6d2bb] bg-[#dce7cf]" />
              <div className="absolute h-48 w-40 rotate-[12deg] rounded-2xl border border-[#cdd7c3] bg-[#f8faf4] shadow-lg" />
              <div className="relative flex h-48 w-40 rotate-[-4deg] flex-col rounded-2xl border border-white bg-white px-6 py-6 shadow-xl shadow-[#41552c]/10">
                <span className="mb-6 text-[#7e9864]">
                  <BookOpen size={32} />
                </span>
                <div className="h-2 w-20 rounded bg-[#dfe7d4]" />
                <div className="mt-3 h-1.5 w-24 rounded bg-[#edf0e7]" />
                <div className="mt-2 h-1.5 w-16 rounded bg-[#edf0e7]" />
                <span className="mt-auto text-[9px] tracking-wider text-[#8c9784]">
                  IDEEN BEGINNEN HIER
                </span>
              </div>
              <span className="absolute right-12 top-10 flex size-12 items-center justify-center rounded-2xl bg-[#dae6cc] text-[#637b50]">
                <Quote size={21} />
              </span>
            </div>
          </section>
        )}
        <div
          id="start"
          className="mt-11 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <LibraryHeading className="serif text-3xl font-medium">
              Deine Notebooks{" "}
              <span className="ml-2 align-middle text-sm muted">
                {notebooks.length}
              </span>
            </LibraryHeading>
          </div>
          {email && (
            <div className="flex flex-wrap items-center gap-3">
              {!showHero && (
                <Button onClick={() => open("create")}>
                  <Plus size={17} /> Notebook erstellen
                </Button>
              )}
              <div className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e5dc] bg-white px-3">
                <Search size={14} className="muted" />
                <input
                  aria-label="Notebooks durchsuchen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen …"
                  className="w-28 bg-transparent text-xs"
                />
              </div>
              <div className="desktop-only flex gap-1">
                <Button
                  aria-label="Rasteransicht"
                  variant={list ? "ghost" : "outline"}
                  size="icon"
                  onClick={() => setList(false)}
                >
                  <LayoutGrid size={16} />
                </Button>
                <Button
                  aria-label="Listenansicht"
                  variant={list ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => setList(true)}
                >
                  <List size={17} />
                </Button>
              </div>
            </div>
          )}
        </div>
        {!email ? (
          <div className="mt-7 grid gap-8 md:grid-cols-[1fr_380px]">
            <div className="grid content-center gap-7 py-7">
              {[
                {
                  icon: FileText,
                  title: "Deine Quellen, an einem Ort",
                  text: "Lade PDFs hoch und behalte deine Recherche im Blick.",
                },
                {
                  icon: Quote,
                  title: "Antworten mit Belegen",
                  text: "Jede Quellenangabe führt direkt zur passenden PDF-Seite.",
                },
                {
                  icon: NotebookPen,
                  title: "Mehr Raum für Zusammenhänge",
                  text: "Frage nach, verbinde Gedanken und fasse Wichtiges zusammen.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div className="flex gap-4" key={title}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e1e5db] bg-white">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="muted mt-1.5 text-xs leading-relaxed">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Auth enabled={enabled} initialError={authError} />
          </div>
        ) : (
          <>
            {loadError && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-4 text-red-800"
              >
                Notebooks konnten nicht geladen werden. Bitte die
                Datenbank-Einrichtung prüfen und neu laden.
              </p>
            )}
            <div
              className={`mt-7 grid gap-4 ${list ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}
            >
              {filtered.map((n, i) => (
                <article
                  key={n.id}
                  className="panel relative min-h-48 p-6 transition-shadow hover:shadow-md"
                >
                  <Link
                    href={"/notebooks/" + n.id}
                    className="absolute inset-0 rounded-[20px]"
                    aria-label={`${n.title} öffnen`}
                  />
                  <div className="mb-6 flex items-start justify-between">
                    <span
                      className={`flex size-11 items-center justify-center rounded-xl ${["bg-[#eaf0e2]", "bg-[#f4eadd]", "bg-[#e5edf4]"][i % 3]}`}
                    >
                      <BookOpen size={22} />
                    </span>
                    <div className="relative">
                      <Button
                        aria-label={`Aktionen für ${n.title}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => setMenu(menu === n.id ? null : n.id)}
                      >
                        <MoreHorizontal size={19} />
                      </Button>
                      {menu === n.id && (
                        <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border bg-white p-1 shadow-lg">
                          <button
                            className="flex w-full items-center gap-2 rounded-lg p-2 text-xs hover:bg-stone-50"
                            onClick={() => open("rename", n)}
                          >
                            <Pencil size={13} />
                            Umbenennen
                          </button>
                          <button
                            className="flex w-full items-center gap-2 rounded-lg p-2 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => open("delete", n)}
                          >
                            <Trash2 size={13} />
                            Löschen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="truncate text-lg font-medium">{n.title}</h3>
                  <div className="mt-3 flex items-center justify-between text-[11px] muted">
                    <time>
                      {new Date(n.created_at).toLocaleDateString("de-DE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                    <ArrowUpRight size={15} />
                  </div>
                </article>
              ))}
            </div>
            {search && !filtered.length && (
              <p className="muted py-8 text-center">
                Keine Notebooks für „{search}“ gefunden.
              </p>
            )}
          </>
        )}
        <footer className="mt-14 flex items-center justify-between border-t border-[#e4e8df] pt-5 text-[10px] text-[#8a9487]">
          <span>FOLIO · EIN GUTER ORT FÜR GUTE FRAGEN.</span>
          <span>Mit Quellen. Mit Klarheit.</span>
        </footer>
      </main>
      {dialog && (
        <Modal
          titleId="dialog-title"
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (dialog.kind === "create") {
                  const n = await api<Notebook>("/api/notebooks", "POST", {
                    title,
                  });
                  router.push("/notebooks/" + n.id);
                } else {
                  await api(
                    notebookUrl(dialog.notebook!.id),
                    dialog.kind === "rename" ? "PATCH" : "DELETE",
                    dialog.kind === "rename" ? { title } : undefined,
                  );
                  router.refresh();
                }
                setDialog(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="flex justify-between">
              <h2 id="dialog-title" className="text-lg font-semibold">
                {dialog.kind === "delete"
                  ? "Notebook löschen?"
                  : dialog.kind === "rename"
                    ? "Notebook umbenennen"
                    : "Ein neuer Gedanke"}
              </h2>
              <Button
                type="button"
                aria-label="Schließen"
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                <X size={17} />
              </Button>
            </div>
            {dialog.kind === "delete" ? (
              <p className="my-5 leading-relaxed muted">
                „{dialog.notebook!.title}“ und alle zugehörigen Dokumente und
                Chats werden dauerhaft gelöscht.
              </p>
            ) : (
              <>
                <label className="mt-5 block text-xs" htmlFor="title">
                  Notebook-Titel
                </label>
                <input
                  autoFocus
                  id="title"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Worüber möchtest du mehr erfahren?"
                  className="my-3 h-11 w-full rounded-xl border px-3"
                />
              </>
            )}
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button className="mt-3 w-full" disabled={busy}>
              {busy && <Loader2 size={16} className="spinner" />}
              {dialog.kind === "delete"
                ? "Dauerhaft löschen"
                : dialog.kind === "rename"
                  ? "Speichern"
                  : "Notebook erstellen"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
