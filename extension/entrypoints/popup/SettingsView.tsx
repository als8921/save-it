import { Switch } from "../../components/ui/switch";
import { useSyncedState } from "../../lib/useSyncedState";

function YouTubeLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="#FF0000"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function SettingsView() {
  const [ytEnabled, setYtEnabled] = useSyncedState("yt_widget_enabled", true);

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        추천
      </span>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
          <YouTubeLogo />
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
