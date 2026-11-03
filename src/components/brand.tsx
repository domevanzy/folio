import { Layers2 } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label="Folio Startseite"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#232f41] text-[#dbe3ee]">
        <Layers2 size={21} />
      </span>
      <span className="text-2xl font-semibold tracking-[-1.2px]">
        folio<span className="text-[#7488a6]">.</span>
      </span>
    </Link>
  );
}
