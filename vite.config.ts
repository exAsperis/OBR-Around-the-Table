import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Owlbear Rodeo fetches the development manifest and embeds extension pages
  // from its HTTPS origin. Without this explicit CORS response, the manifest is
  // reachable in a browser tab but OBR reports only "Failed to fetch".
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
  build: { rollupOptions: { input: ["index.html", "extension.html", "background.html"] } },
});
