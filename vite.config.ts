import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The site is served from a folder (GitHub Pages: /level-up-movement/), so every path is relative.
// The build goes to dist/; scripts/publish.sh puts that folder on the branch gh-pages, which is what is live.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
