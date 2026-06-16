import { cn } from "../../lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-default disabled:opacity-40",
        !checked && "bg-muted-foreground/30"
      )}
      style={
        checked
          ? { backgroundColor: "var(--color-para-project-fg)" }
          : undefined
      }
      {...rest}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}
