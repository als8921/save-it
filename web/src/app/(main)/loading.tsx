import { Inbox } from "lucide-react";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "@/lib/para";

export default function LibraryLoading() {
  return (
    <div
      className="space-y-3 p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <div className="grid grid-cols-2 gap-3">
        {PARA_ORDER.map((category) => {
          const token = PARA_TOKENS[category];
          return (
            <div
              key={category}
              className="flex flex-col gap-3 rounded-2xl p-4"
              style={{ backgroundColor: token.bg }}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white"
                style={{ backgroundColor: token.fg }}
                aria-hidden
              >
                {token.letter}
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {token.label}
                </div>
                <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-foreground/10" />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-3 rounded-2xl p-4"
        style={{ backgroundColor: UNASSIGNED_TOKEN.bg }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: UNASSIGNED_TOKEN.fg }}
          aria-hidden
        >
          <Inbox className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold">{UNASSIGNED_TOKEN.label}</div>
          <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-foreground/10" />
        </div>
      </div>
    </div>
  );
}
