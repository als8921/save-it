import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWebPush } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendOutcome {
  delivered: boolean;
  removed: boolean;
}

export async function sendToSubscription(
  supabase: SupabaseClient,
  row: SubscriptionRow,
  payload: PushPayload
): Promise<SendOutcome> {
  const webpush = getWebPush();

  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload)
    );
    await supabase
      .from("push_subscriptions")
      .update({ last_success_at: new Date().toISOString() })
      .eq("id", row.id);
    return { delivered: true, removed: false };
  } catch (err) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("id", row.id);
      return { delivered: false, removed: true };
    }

    console.error("[push] sendNotification failed:", err);
    return { delivered: false, removed: false };
  }
}
