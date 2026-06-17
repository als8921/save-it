import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "SaveIt",
    permissions: ["storage", "alarms", "activeTab"],
    host_permissions: [
      "https://i-save-it.vercel.app/*",
      "https://*.supabase.co/*",
    ],
  },
});
