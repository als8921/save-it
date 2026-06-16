import { Play } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { useSyncedState } from "../../lib/useSyncedState";

export function SettingsView() {
  const [ytEnabled, setYtEnabled] = useSyncedState("yt_widget_enabled", true);

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        추천
      </span>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--color-para-project-fg)" }}
          aria-hidden
        >
          <Play className="h-3.5 w-3.5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">YouTube 추천 위젯</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            유튜브 시청 중 저장한 영상을 화면 구석에 추천해요.
          </div>
        </div>
        <Switch
          checked={ytEnabled}
          onCheckedChange={setYtEnabled}
          aria-label="YouTube 추천 위젯"
        />
      </div>
    </div>
  );
}
