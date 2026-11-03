import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-10">
      <h1 className="serif text-3xl">Hier liegt kein Notebook.</h1>
      <p className="my-5 muted">
        Dieses Notebook existiert nicht oder ist für dich nicht zugänglich.
      </p>
      <Link href="/" className="underline">
        Zur Übersicht
      </Link>
    </main>
  );
}
