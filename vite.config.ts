import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // The app uses query params only (no path routes), so disable Vite's SPA
  // html fallback — otherwise it intercepts worker routes like /docs in dev.
  appType: "mpa",
  plugins: [react(), tailwindcss(), cloudflare()],
});
