import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
type Props = ComponentProps<"input"> & { label: string; hint?: string };
export function FormField({ label, hint, id, ...props }: Props) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-medium">
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-describedby={hint ? inputId + "-hint" : undefined}
        className={cn(
          "h-11 w-full rounded-xl border border-[#dce2db] bg-white px-3 disabled:opacity-50",
          props.className,
        )}
      />
      {hint && (
        <p id={inputId + "-hint"} className="muted text-[11px] leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}
export function PasswordField({
  label,
  hint,
  id,
  ...props
}: Omit<Props, "type">) {
  const generated = useId();
  const inputId = id || generated;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <FormField
        {...props}
        id={inputId}
        label={label}
        hint={hint}
        type={visible ? "text" : "password"}
        className={cn("pr-12", props.className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-6"
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </Button>
    </div>
  );
}
