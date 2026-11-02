import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
export function PanelHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#eef0ea] px-5 py-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={16} />
        {title}
      </h2>
      {children}
    </div>
  );
}
