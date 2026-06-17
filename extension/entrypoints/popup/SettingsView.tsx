import { Bookmark } from "lucide-react";
import type { ReactNode } from "react";
import { Switch } from "../../components/ui/switch";
import { useSyncedState } from "../../lib/useSyncedState";

function YouTubeLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#FF0000" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {description}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function SettingSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function SettingsView() {
  const [alwaysOn, setAlwaysOn] = useSyncedState("floating_always_on", true);
  const [ytEnabled, setYtEnabled] = useSyncedState("yt_widget_enabled", true);

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <SettingSection label="표시">
        <SettingRow
          icon={
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--color-para-project-fg)" }}
            >
              <Bookmark className="h-3.5 w-3.5 text-white" />
            </span>
          }
          title="화면에 상시 표시"
          description="끄면 확장 프로그램 아이콘을 눌렀을 때만 열려요."
          checked={alwaysOn}
          onCheckedChange={setAlwaysOn}
        />
      </SettingSection>

      <SettingSection label="추천">
        <SettingRow
          icon={<YouTubeLogo />}
          title="YouTube 추천 위젯"
          description="유튜브 시청 중 저장한 영상을 화면 구석에 추천해요."
          checked={ytEnabled}
          onCheckedChange={setYtEnabled}
        />
      </SettingSection>
    </div>
  );
}
