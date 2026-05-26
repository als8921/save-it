import { urlBase64ToUint8Array } from "./key";

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "permission_denied" | "subscribe_failed" | "post_failed" };

function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  return key;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPermissionState(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "default";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  // SW 미등록(첫 방문) 상태에선 ready가 영원히 pending이므로 getRegistration 사용.
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const vapid = getVapidPublicKey();
  if (!vapid) return { ok: false, reason: "subscribe_failed" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permission_denied" };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription: PushSubscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as Uint8Array<ArrayBuffer>,
    });
  } catch {
    return { ok: false, reason: "subscribe_failed" };
  }

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  if (!res.ok) {
    return { ok: false, reason: "post_failed" };
  }
  return { ok: true };
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: true };

  const existing = await getExistingSubscription();
  if (!existing) return { ok: true };

  const endpoint = existing.endpoint;
  await existing.unsubscribe();

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});

  return { ok: true };
}
