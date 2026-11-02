"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-10">
      <h1 className="serif text-3xl">Das hat nicht geklappt.</h1>
      <p className="my-5 muted">
        Die Daten konnten nicht geladen werden. Bitte Verbindung und Einrichtung
        prüfen.
      </p>
      <Button onClick={reset}>Erneut versuchen</Button>
    </main>
  );
}
