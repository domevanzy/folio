"use client";
import { config } from "@/lib/config";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Layers2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  PanelLeft,
} from "lucide-react";
import type {
  Citation,
  Message,
  Notebook,
  Source,
  SourcePreview,
} from "@/lib/types";
import { Button } from "./ui/button";
import { Brand } from "./brand";
import { api, requestApi, notebookUrl, sourceUrl } from "@/lib/client/api";
import { isValidPdfFile, PDF_UPLOAD_ERROR } from "@/lib/validation";
import {
  readChatEvents,
  type AnswerResult,
  type ChatStatus,
} from "@/lib/chat-stream";
import { PdfViewer, type PdfDocument } from "./notebook/pdf-viewer";
import { AddSourceDialog } from "./notebook/add-source-dialog";
import { StudioPanel } from "./notebook/studio-panel";
import { ChatMessage } from "./notebook/chat-message";
import { PanelHeader } from "./notebook/panel-header";
import { Modal } from "./ui/modal";

export function Workspace({
  notebook,
  initialSources,
  initialMessages,
}: {
  notebook: Notebook;
  initialSources: Source[];
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [previousSources, setPreviousSources] = useState(initialSources);
  if (previousSources !== initialSources) {
    setPreviousSources(initialSources);
    setSources(initialSources);
  }
  const [messages, setMessages] = useState(initialMessages);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initialSources.filter((s) => s.status === "ready").map((s) => s.id),
      ),
  );
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("retrieving");
  const chatController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      chatController.current?.abort();
    },
    [],
  );
  const [pendingSources, setPendingSources] = useState<
    { id: number; name: string }[]
  >([]);
  const sourceUploadInProgress = useRef(false);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const uploading = pendingSources.length > 0;
  const sourceCount = sources.length + pendingSources.length;
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [tab, setTab] = useState("chat");
  const [addingSource, setAddingSource] = useState(false);
  const [viewer, setViewer] = useState<PdfDocument | null>(null);
  const [writtenViewer, setWrittenViewer] = useState<{
    name: string;
    excerpt?: string;
    content: string;
    originalUrl: string | null;
  } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteSource, setDeleteSource] = useState<Source | null>(null);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const viewerSeq = useRef(0);
  const ready = sources.filter((s) => s.status === "ready");
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (uploading || !sources.some((s) => s.status === "processing")) return;
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [sources, router, uploading]);
  function upload(files: FileList) {
    void addSources(
      Array.from(files, (file) => ({ name: file.name, body: file })),
    );
  }

  async function addSources(entries: { name: string; body: object }[]) {
    if (!entries.length || sourceUploadInProgress.current || busy) return;
    sourceUploadInProgress.current = true;
    setAddingSource(false);
    setSourceErrors([]);
    setPendingSources(entries.map(({ name }, id) => ({ id, name })));
    try {
      for (const { name, body } of entries) {
        try {
          let payload = body;
          if (body instanceof File) {
            if (!isValidPdfFile(body)) throw new Error(PDF_UPLOAD_ERROR);
            const form = new FormData();
            form.set("file", body);
            payload = form;
          }
          const data = await api<Source>(
            notebookUrl(notebook.id, "/sources"),
            "POST",
            payload,
          );
          setSources((prev) =>
            prev.some((source) => source.id === data.id)
              ? prev
              : [...prev, data],
          );
          setSelected((prev) => new Set([...prev, data.id]));
        } catch (e) {
          const message = (e as Error).message;
          setSourceErrors((prev) => [...prev, `${name}: ${message}`]);
        } finally {
          setPendingSources((prev) => prev.slice(1));
        }
      }
      router.refresh();
    } finally {
      sourceUploadInProgress.current = false;
      if (input.current) input.current.value = "";
    }
  }
  const showSource = useCallback(
    async function showSource(
      sourceId: string,
      name: string,
      page = 1,
      excerpt?: string,
    ) {
      const seq = ++viewerSeq.current;
      setViewLoading(true);
      try {
        const preview = await api<SourcePreview>(
          sourceUrl(notebook.id, sourceId),
          "GET",
        );
        if (seq !== viewerSeq.current) return;
        if (preview.kind === "pdf")
          setViewer({ sourceId, name, page, url: preview.url });
        else setWrittenViewer({ name, excerpt, ...preview });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (seq === viewerSeq.current) setViewLoading(false);
      }
    },
    [notebook.id],
  );
  async function ask(text = question, summary = false) {
    if (busy || uploading || !selected.size || (!summary && !text.trim()))
      return;
    setBusy(true);
    setChatStatus("retrieving");
    const controller = new AbortController();
    chatController.current = controller;
    const deadline = AbortSignal.timeout(config.chatRequestTimeoutMs + 10000);
    const signal = AbortSignal.any([controller.signal, deadline]);
    setError("");
    setQuestion("");
    setTab("chat");
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const userMessage: Message = {
      id: userId,
      role: "user",
      content: summary ? "Fasse die ausgewählten Quellen zusammen." : text,
      citations: [],
    };
    let responseText = "";
    let done = false;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", citations: [] },
    ]);
    const update = (data: Partial<Message>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...data } : m)),
      );
    try {
      const response = await requestApi(
        notebookUrl(notebook.id, summary ? "/summary" : "/chat"),
        "POST",
        { question: summary ? undefined : text, sourceIds: [...selected] },
        { signal },
      );
      if (response.headers.get("content-type")?.includes("application/json")) {
        const data: AnswerResult = await response.json();
        update(data);
        done = true;
        return;
      }
      if (!response.body) throw new Error("Leere Serverantwort.");
      for await (const event of readChatEvents(response.body)) {
        if (event.type === "status") setChatStatus(event.stage);
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "text") {
          responseText += event.text;
          update({ content: responseText });
        }
        if (event.type === "done") {
          update({ citations: event.citations });
          done = true;
        }
      }
      if (!done)
        throw new Error(
          "Verbindung unterbrochen. Die Antwort wurde nicht gespeichert.",
        );
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(
        signal.aborted
          ? deadline.aborted
            ? "Die Antwort hat zu lange gedauert. Bitte erneut versuchen."
            : "Antwort abgebrochen."
          : (e as Error).message,
      );
      setQuestion(text);
    } finally {
      chatController.current = null;
      setBusy(false);
      router.refresh();
    }
  }
  const cite = useCallback(
    (c: Citation) => showSource(c.sourceId, c.name, c.page, c.excerpt),
    [showSource],
  );
  return (
    <>
      <header className="flex h-[89px] items-center justify-between gap-4 px-5 md:px-7">
        <div className="flex min-w-0 items-center gap-5">
          <div className="desktop-only">
            <Brand />
          </div>
          <span className="desktop-only text-[#bbc5d4]">/</span>
          <Link
            href="/"
            title="Alle Notebooks"
            className="rounded-lg p-2 hover:bg-black/5"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">
              {notebook.title}
            </h1>
            <p className="muted mt-1 text-[10px]">
              {sourceCount} Quellen · Privates Notebook
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="desktop-only flex items-center gap-1.5 text-[10px] muted">
            <Check size={12} /> Automatisch gespeichert
          </span>
          <Button
            aria-label="Inhalte aktualisieren"
            variant="outline"
            size="icon"
            disabled={busy || uploading}
            onClick={() => router.refresh()}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </header>
      <nav
        aria-label="Notebook-Bereiche"
        className="mb-3 flex justify-center gap-2 px-3 min-[1101px]:hidden"
      >
        {[
          ["sources", "Quellen"],
          ["chat", "Chat"],
          ["studio", "Studio"],
        ].map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            aria-pressed={tab === key}
            variant={tab === key ? "default" : "ghost"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <main className="workspace">
        <section
          className={`panel flex min-h-0 flex-col ${tab === "sources" ? "mobile-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
        >
          <PanelHeader icon={PanelLeft} title="Quellen">
            <span className="muted rounded-md bg-[#f2f4f6] px-2 py-0.5 text-[10px]">
              {sourceCount}
            </span>
          </PanelHeader>
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full rounded-full"
              disabled={uploading || busy}
              onClick={() => setAddingSource(true)}
            >
              <Plus size={16} /> Quelle hinzufügen
            </Button>
            <input
              ref={input}
              className="hidden"
              type="file"
              multiple
              accept="application/pdf,.pdf"
              aria-label="PDF hochladen"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
              }}
            />
          </div>
          {ready.length > 0 && (
            <label className="mx-5 mb-4 flex items-center justify-between text-[11px] muted">
              Alle Quellen auswählen
              <input
                type="checkbox"
                className="accent-[#3f4d63]"
                checked={ready.every((s) => selected.has(s.id))}
                disabled={busy}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? new Set(ready.map((s) => s.id))
                      : new Set(),
                  )
                }
              />
            </label>
          )}
          <div
            className={`min-h-0 flex-1 overflow-auto px-3 ${drag ? "bg-[#e6ebf3]" : ""}`}
          >
            {sources.length ? (
              sources.map((s) => (
                <div
                  key={s.id}
                  className="group mb-2 rounded-xl p-3 hover:bg-[#f4f6f8]"
                >
                  <div className="flex items-center gap-2.5">
                    {s.status === "processing" ? (
                      <Loader2
                        aria-hidden="true"
                        size={17}
                        className="shrink-0 text-blue-700 motion-safe:animate-spin"
                      />
                    ) : (
                      <FileText
                        size={17}
                        className={
                          s.status === "failed"
                            ? "text-red-600"
                            : "text-[#63799a]"
                        }
                      />
                    )}
                    <button
                      disabled={s.status !== "ready"}
                      onClick={(event) => {
                        event.currentTarget.focus();
                        void showSource(s.id, s.name);
                      }}
                      className="min-w-0 flex-1 wrap-anywhere text-left text-xs font-medium enabled:underline enabled:decoration-[#97a6bd] enabled:underline-offset-2"
                      title={s.name}
                    >
                      {s.name}
                    </button>
                    <input
                      type="checkbox"
                      aria-label={`${s.name} als Quelle auswählen`}
                      className="size-5 shrink-0 accent-[#3f4d63]"
                      disabled={s.status !== "ready" || busy}
                      checked={selected.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelected(next);
                      }}
                    />
                  </div>
                  <div className="ml-7 mt-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] ${s.status === "failed" ? "text-red-700" : "muted"}`}
                    >
                      {s.status === "ready"
                        ? s.kind === "pdf"
                          ? `${s.page_count} Seiten · Bereit`
                          : s.kind === "web"
                            ? "Webseite · Bereit"
                            : "Text · Bereit"
                        : s.status === "processing"
                          ? "Wird verarbeitet …"
                          : "Verarbeitung fehlgeschlagen"}
                    </span>
                    <button
                      aria-label={`${s.name} löschen`}
                      disabled={busy || uploading}
                      onClick={() => setDeleteSource(s)}
                      className="rounded p-1 text-[#8496b0] hover:text-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {s.error && (
                    <p className="mt-2 text-[10px] leading-relaxed text-red-700">
                      {s.error}
                    </p>
                  )}
                </div>
              ))
            ) : !uploading && !sourceErrors.length ? (
              <div className="flex h-full min-h-56 flex-col items-center justify-center px-5 pb-10 text-center">
                <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-dashed border-[#c0c9d7] bg-[#f2f4f8]">
                  <UploadCloud size={25} className="text-[#7488a6]" />
                </span>
                <h3 className="text-sm font-medium">
                  Alles beginnt mit einer Quelle.
                </h3>
                <p className="muted mt-3 text-xs leading-6">
                  Ziehe eine PDF hierher oder füge eine PDF, einen Text oder
                  eine Webseite hinzu.
                </p>
                <p className="mt-4 text-[10px] text-[#8193af]">
                  PDF · bis 4 MiB · bis 100 Seiten
                </p>
              </div>
            ) : null}
            {pendingSources.map(({ id, name }, index) => {
              const active = index === 0;
              const Icon = active ? Loader2 : Clock;
              return (
                <div key={id} role="status" className="mb-2 rounded-xl p-3">
                  <div className="flex items-center gap-2.5">
                    <Icon
                      aria-hidden="true"
                      size={17}
                      className={
                        active
                          ? "shrink-0 text-blue-700 motion-safe:animate-spin"
                          : "muted shrink-0 motion-safe:animate-pulse"
                      }
                    />
                    <span className="min-w-0 wrap-anywhere text-xs font-medium">
                      {name}
                    </span>
                  </div>
                  <p className="muted ml-7 mt-2 text-[10px]">
                    {active
                      ? "Quelle wird verarbeitet …"
                      : "Wartet auf Verarbeitung"}
                  </p>
                </div>
              );
            })}
            {sourceErrors.length > 0 && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800"
              >
                <ul className="min-w-0 flex-1 space-y-1 wrap-anywhere">
                  {sourceErrors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
                <button
                  aria-label="Fehlermeldungen schließen"
                  onClick={() => setSourceErrors([])}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[#eaecf0] p-4 text-[10px] leading-5 muted">
            Nur ausgewählte Quellen werden für deine Antworten verwendet.
          </div>
        </section>
        <section
          className={`panel flex min-h-0 flex-col overflow-hidden ${tab === "chat" ? "mobile-active" : ""}`}
        >
          <PanelHeader icon={MessageSquare} title="Chat">
            {" "}
            <span className="flex items-center gap-1.5 rounded-full bg-[#eceff4] px-2.5 py-1 text-[9px] text-[#546988]">
              <span className="size-1.5 rounded-full bg-[#7088ac]" />{" "}
              Quellenbasiert
            </span>
          </PanelHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-md flex-col items-start justify-center py-8">
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-[#e6eaf1] text-[#59739a]">
                  <Layers2 size={27} />
                </div>
                <p className="mb-3 text-[9px] font-semibold tracking-[.18em] text-[#7c8fac]">
                  DEIN WISSEN HAT ANTWORTEN.
                </p>
                <h2 className="serif text-[34px] leading-tight">
                  Was möchtest du
                  <br />
                  herausfinden?
                </h2>
                <p className="muted mt-4 text-xs leading-6">
                  {sources.length
                    ? "Stelle eine Frage zu deinen ausgewählten Quellen. Folio findet passende Textstellen und zeigt dir, woher die Antwort kommt."
                    : "Füge links dein erstes Dokument hinzu. Dann kannst du Fragen stellen, Details entdecken und Zusammenhänge verstehen."}
                </p>
                <div className="mt-6 w-full space-y-2">
                  {[
                    "Was sind die wichtigsten Kernaussagen?",
                    "Welche Fragen bleiben offen?",
                  ].map((t) => (
                    <button
                      key={t}
                      disabled={!selected.size || busy}
                      onClick={() => ask(t)}
                      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[#e2e5ea] px-4 py-3 text-left text-[11px] text-[#586c89] hover:bg-[#f1f3f7] disabled:opacity-50"
                    >
                      {t}
                      <ChevronRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  onCitation={cite}
                  status={chatStatus}
                />
              ))
            )}
            <div ref={bottom} />
          </div>
          <div className="px-4 pb-4 md:px-5">
            {error && (
              <div
                role="alert"
                className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800"
              >
                {error}
                <button
                  aria-label="Fehlermeldung schließen"
                  onClick={() => setError("")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="rounded-2xl border border-[#d3d9e2] bg-[#f8fafc] p-3 shadow-sm"
            >
              <textarea
                rows={2}
                aria-label="Frage zu deinen Quellen"
                maxLength={3000}
                value={question}
                disabled={busy}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder={
                  selected.size
                    ? "Stelle eine Frage zu deinen Quellen …"
                    : "Wähle zuerst eine Quelle aus …"
                }
                className="w-full resize-none rounded-md bg-transparent p-1 text-xs leading-6"
              />
              <div className="flex items-center justify-between">
                <span className="px-1 text-[10px] muted">
                  {selected.size} von {ready.length} Quellen ausgewählt
                </span>
                <Button
                  type={busy ? "button" : "submit"}
                  aria-label={busy ? "Antwort abbrechen" : "Frage senden"}
                  onClick={
                    busy ? () => chatController.current?.abort() : undefined
                  }
                  size="icon"
                  className="size-8 rounded-full"
                  disabled={
                    !busy && (uploading || !selected.size || !question.trim())
                  }
                >
                  {busy ? <X size={14} /> : <ArrowUp size={16} />}
                </Button>
              </div>
            </form>
            <p className="mt-2.5 text-center text-[9px] text-[#8092ae]">
              KI kann Fehler machen. Überprüfe wichtige Aussagen anhand der
              Quellen.
            </p>
          </div>
        </section>
        <StudioPanel
          active={tab === "studio"}
          disabled={busy || uploading || !selected.size}
          onSummarize={() => ask("", true)}
        />
      </main>
      {viewLoading && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 gap-2 rounded-full bg-[#232f41] px-5 py-3 text-xs text-white shadow-xl"
        >
          <Loader2 size={15} className="spinner" />
          Dokument wird geöffnet …
        </div>
      )}
      {addingSource && (
        <AddSourceDialog
          onClose={() => setAddingSource(false)}
          onPdf={() => {
            setAddingSource(false);
            input.current?.click();
          }}
          onAdd={(source) =>
            void addSources([
              {
                name: source.kind === "text" ? source.name : source.url,
                body: source,
              },
            ])
          }
        />
      )}
      {writtenViewer && (
        <Modal
          titleId="written-source-title"
          onClose={() => setWrittenViewer(null)}
        >
          <div className="flex items-start gap-3">
            <h2
              id="written-source-title"
              className="min-w-0 flex-1 wrap-anywhere text-lg font-semibold"
            >
              {writtenViewer.name}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Quelle schließen"
              onClick={() => setWrittenViewer(null)}
            >
              <X size={19} />
            </Button>
          </div>
          {writtenViewer.originalUrl && (
            <a
              href={writtenViewer.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              Webseite öffnen
            </a>
          )}
          <div className="mt-4 max-h-[60dvh] space-y-4 overflow-auto">
            {writtenViewer.excerpt && (
              <div className="rounded-lg bg-neutral-100 p-3">
                <h3 className="mb-1 font-semibold">Zitierter Auszug</h3>
                <p className="whitespace-pre-wrap wrap-anywhere">
                  {writtenViewer.excerpt}
                </p>
              </div>
            )}
            <p className="whitespace-pre-wrap wrap-anywhere">
              {writtenViewer.content}
            </p>
          </div>
        </Modal>
      )}
      {viewer && (
        <PdfViewer
          key={viewer.url}
          document={viewer}
          pageCount={
            sources.find((s) => s.id === viewer.sourceId)?.page_count || 100
          }
          onClose={() => {
            viewerSeq.current++;
            setViewer(null);
          }}
        />
      )}
      {deleteSource && (
        <Modal
          titleId="delete-source"
          busy={deleting}
          onClose={() => setDeleteSource(null)}
        >
          <h2 id="delete-source" className="text-lg font-semibold">
            Quelle löschen?
          </h2>
          <p className="muted my-4 leading-relaxed">
            „{deleteSource.name}“ und ihre Textstellen werden gelöscht. Frühere
            Zitate sind dann nicht mehr abrufbar.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteSource(null)}
            >
              Abbrechen
            </Button>
            <Button
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api(sourceUrl(notebook.id, deleteSource.id), "DELETE");
                  setSources((s) => s.filter((x) => x.id !== deleteSource.id));
                  setSelected((prev) => {
                    const next = new Set(prev);
                    next.delete(deleteSource.id);
                    return next;
                  });
                  setDeleteSource(null);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                  setDeleteSource(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting && <Loader2 className="spinner" size={14} />}Löschen
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
