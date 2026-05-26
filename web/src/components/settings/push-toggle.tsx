"use client";

import { useEffect, useState } from "react";
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

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        알림
      </h2>
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">매일 푸시 알림</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              iOS는 홈 화면에 추가 후에만 알림을 받을 수 있어요.
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={state === "loading" || state === "denied" || state === "unsupported"}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {state === "on" ? "ON" : state === "loading" ? "…" : "OFF"}
          </button>
        </div>

        {state === "denied" && (
          <div className="text-xs text-muted-foreground">
            브라우저 알림 권한이 차단됐어요. 브라우저 설정에서 허용 후 다시 시도하세요.
          </div>
        )}

        {state === "unsupported" && (
          <div className="text-xs text-muted-foreground">
            이 브라우저는 푸시 알림을 지원하지 않습니다.
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={state !== "on" || testing}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            지금 테스트 알림 보내기
          </button>
          {testMsg && (
            <span className="text-xs text-muted-foreground">{testMsg}</span>
          )}
        </div>
      </div>
    </section>
  );
}
