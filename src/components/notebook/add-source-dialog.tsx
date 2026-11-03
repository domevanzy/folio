import { useState } from "react";
import { maxSourceText, writtenSourceSchema } from "@/lib/validation";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import type { z } from "zod";

export function AddSourceDialog({
  onClose,
  kind,
  onAdd,
}: {
  onClose: () => void;
  kind: "text" | "web";
  onAdd: (source: z.infer<typeof writtenSourceSchema>) => void;
}) {
  const [error, setError] = useState("");
  const fieldClass =
    "w-full rounded-lg border border-[var(--border)] px-3 py-2";

  return (
    <Modal titleId="add-source-title" onClose={onClose}>
      <h2 id="add-source-title" className="text-lg font-semibold">
        {kind === "text" ? "Text einfügen" : "Webseite per URL"}
      </h2>
      <form
        key={kind}
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const source = writtenSourceSchema.safeParse(
            kind === "text"
              ? {
                  kind,
                  name: fields.get("name"),
                  content: fields.get("content"),
                }
              : { kind, url: fields.get("url") },
          );
          if (source.success) onAdd(source.data);
          else
            setError(
              kind === "text"
                ? "Bitte Titel und Text eingeben."
                : "Bitte eine öffentliche HTTP- oder HTTPS-Adresse eingeben.",
            );
        }}
      >
        {kind === "text" ? (
          <>
            <label className="grid gap-1">
              Titel
              <input
                name="name"
                required
                maxLength={180}
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1">
              Text
              <textarea
                name="content"
                required
                rows={7}
                maxLength={maxSourceText}
                className={fieldClass}
              />
            </label>
          </>
        ) : (
          <label className="grid gap-1">
            Webseitenadresse
            <input
              name="url"
              type="url"
              required
              placeholder="https://beispiel.de/artikel"
              className={fieldClass}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" className="justify-self-end">
          Hinzufügen
        </Button>
      </form>
    </Modal>
  );
}
