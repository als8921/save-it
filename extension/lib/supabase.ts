import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.WXT_PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing WXT_PUBLIC_SUPABASE_URL or WXT_PUBLIC_SUPABASE_ANON_KEY in extension/.env"
  );
}

const chromeStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await browser.storage.local.get(key);
    const value = result[key];
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: chromeStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
