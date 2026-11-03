import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Folio — Raum für deine Gedanken",
  description:
    "Dokumente verstehen. Wissen verbinden. Mit Antworten, die ihre Quellen zeigen.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
