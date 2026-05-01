import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["storage", "alarms", "activeTab"],
    host_permissions: [
      "https://save-it.vercel.app/*",
      "https://*.supabase.co/*",
    ],
  },
});
