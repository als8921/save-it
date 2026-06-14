import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { PARA_TOKENS } from "../../lib/para";
import {
  extractVideoId,
  isYouTubeWatchUrl,
  pickYouTubeRecommendations,
} from "../../lib/youtube";
import type { Link, ParaCategory } from "../../lib/types";

export type YtLink = Link & {
  folders: { name: string; para_category: ParaCategory | null } | null;
};

const SELECT =
  "id, user_id, folder_id, url, title, description, priority, is_read, created_at, read_at, folders(name, para_category)";
const AUTO_COLLAPSE_MS = 5000;
const BRAND = "var(--color-para-project-fg)";

export function YouTubeRecommendWidget() {
  const auth = useAuth();
  const [url, setUrl] = useState(location.href);
  const urlRef = useRef(url);
  const [fullscreen, setFullscreen] = useState(false);
  const [allYt, setAllYt] = useState<YtLink[] | null>(null);

  const [mode, setMode] = useState<"expanded" | "collapsed">("collapsed");
  const suppressedRef = useRef(false); // 수동으로 접으면 세션 동안 자동 펼침 억제
  const timerRef = useRef<number | null>(null);

  // SPA 내비게이션 감지: yt-navigate-finish 이벤트 + location 폴링(보조)
  useEffect(() => {
    const update = () => {
      urlRef.current = location.href;
      setUrl(location.href);
    };
    update();
    document.addEventListener("yt-navigate-finish", update);
    const iv = window.setInterval(() => {
      if (location.href !== urlRef.current) update();
    }, 1000);
    return () => {
      document.removeEventListener("yt-navigate-finish", update);
      clearInterval(iv);
    };
  }, []);

  // 풀스크린(영상 전체화면)일 때는 숨긴다
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // 저장된 유튜브 링크 1회 로드(위젯 수명 동안 캐시)
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let active = true;
    supabase
      .from("links")
      .select(SELECT)
      .or("url.ilike.%youtube.com%,url.ilike.%youtu.be%")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("[save-it] youtube 추천 조회 실패:", error.message);
          return;
        }
        setAllYt((data ?? []) as unknown as YtLink[]);
      });
    return () => {
      active = false;
    };
  }, [auth.status]);

  const isWatch = isYouTubeWatchUrl(url);
  const currentVideoId = isWatch ? extractVideoId(url) : null;
  const recs = useMemo(
    () => (allYt ? pickYouTubeRecommendations(allYt, currentVideoId, 3) : []),
    [allYt, currentVideoId],
  );

  function cancelAutoCollapse() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // 영상이 바뀌고 추천이 있으면: 억제 안 됐을 때 자동 펼침 → 5초 후 접힘
  useEffect(() => {
    if (!isWatch || recs.length === 0) return;
    if (suppressedRef.current) {
      setMode("collapsed");
      return;
    }
    setMode("expanded");
    cancelAutoCollapse();
    timerRef.current = window.setTimeout(
      () => setMode("collapsed"),
      AUTO_COLLAPSE_MS,
    );
    return cancelAutoCollapse;
  }, [currentVideoId, recs.length, isWatch]);

  function collapse() {
    cancelAutoCollapse();
    suppressedRef.current = true;
    setMode("collapsed");
  }

  function expand() {
    cancelAutoCollapse();
    setMode("expanded");
  }

  function openLink(link: YtLink) {
    window.open(link.url, "_blank", "noopener,noreferrer");
    if (link.is_read) return;
    const readAt = new Date().toISOString();
    setAllYt((prev) =>
      prev
        ? prev.map((l) =>
            l.id === link.id ? { ...l, is_read: true, read_at: readAt } : l,
          )
        : prev,
    );
    supabase
      .from("links")
      .update({ is_read: true, read_at: readAt })
      .eq("id", link.id)
      .then(({ error }) => {
        if (error) console.warn("[save-it] 읽음 처리 실패:", error.message);
      });
  }

  if (auth.status !== "authenticated") return null;
  if (!isWatch || fullscreen) return null;
  if (recs.length === 0) return null;

  return (
    <div
      className="fixed font-sans"
      style={{ bottom: 20, right: 20, zIndex: 2147483647 }}
    >
      {mode === "collapsed" ? (
        <button
          type="button"
          onClick={expand}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pl-2 pr-3 text-[12px] font-semibold text-foreground shadow-lg transition-colors hover:bg-accent"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND }}
          >
            <Play className="h-3 w-3 text-white" />
          </span>
          저장한 영상 {recs.length}
        </button>
      ) : (
        <div
          onMouseEnter={cancelAutoCollapse}
          className="w-[300px] overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-xl motion-safe:animate-fade-up"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[12px] font-semibold">저장한 유튜브 영상</span>
            <span className="text-[11px] text-muted-foreground">{recs.length}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={collapse}
              aria-label="접기"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[280px] divide-y divide-border overflow-y-auto">
            {recs.map((link) => (
              <li key={link.id}>
                <RecCard link={link} onOpen={() => openLink(link)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecCard({ link, onOpen }: { link: YtLink; onOpen: () => void }) {
  const videoId = extractVideoId(link.url);
  const para = link.folders?.para_category ?? null;
  const token = para ? PARA_TOKENS[para] : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <Thumb videoId={videoId} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{link.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {token ? (
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-bold text-white"
              style={{ backgroundColor: token.fg }}
            >
              {token.letter}
            </span>
          ) : (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-muted text-[8px] font-bold text-muted-foreground">
              ·
            </span>
          )}
          {link.folders?.name && <span className="truncate">{link.folders.name}</span>}
          {!link.is_read && (
            <span
              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: BRAND }}
              aria-label="안 읽음"
            />
          )}
        </div>
      </div>
    </button>
  );
}

function Thumb({ videoId }: { videoId: string | null }) {
  const [err, setErr] = useState(false);
  if (!videoId || err) {
    return (
      <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-muted">
        <Play className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt=""
      className="h-9 w-16 shrink-0 rounded object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
    />
  );
}
