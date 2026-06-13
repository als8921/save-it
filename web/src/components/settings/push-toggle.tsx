"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isPushSupported,
  getPermissionState,
  getExistingSubscription,
  subscribePush,
  unsubscribePush,
} from "@/lib/push/client";

type State = "loading" | "off" | "on" | "denied" | "unsupported";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!isPushSupported()) {
        setState("unsupported");
        return;
      }
      const perm = await getPermissionState();
      if (perm === "denied") {
        setState("denied");
        return;
      }
      const existing = await getExistingSubscription();
      setState(existing ? "on" : "off");
    })();
  }, []);

  async function handleToggle() {
    if (state === "off") {
      setState("loading");
      const r = await subscribePush();
      if (r.ok) {
        setState("on");
      } else if (r.reason === "permission_denied") {
        setState("denied");
      } else {
        setState("off");
      }
    } else if (state === "on") {
      setState("loading");
      await unsubscribePush();
      setState("off");
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setTestMsg("알림을 보냈어요");
      } else {
        setTestMsg("잠시 후 다시 시도해주세요");
      }
    } catch {
      setTestMsg("잠시 후 다시 시도해주세요");
    } finally {
      setTimeout(() => setTesting(false), 5000);
    }
  }

  const on = state === "on";
  const switchDisabled =
    state === "loading" || state === "denied" || state === "unsupported";

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        알림
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">매일 푸시 알림</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              iOS는 홈 화면에 추가한 뒤에만 받을 수 있어요.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="매일 푸시 알림"
            onClick={handleToggle}
            disabled={switchDisabled}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
              on
                ? "bg-[color:var(--color-para-project-fg)]"
                : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                on ? "left-[1.375rem]" : "left-0.5"
              )}
            />
          </button>
        </div>

        {state === "denied" && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            브라우저 알림 권한이 차단됐어요. 브라우저 설정에서 허용한 뒤 다시
            시도하세요.
          </p>
        )}

        {state === "unsupported" && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            이 브라우저는 푸시 알림을 지원하지 않아요.
          </p>
        )}

        {on && (
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-sm transition-colors active:bg-accent disabled:opacity-60"
          >
            <span>지금 테스트 알림 보내기</span>
            <span className="text-xs text-muted-foreground">
              {testing ? "보내는 중…" : testMsg ?? ""}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
