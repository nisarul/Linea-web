// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // In dev, all API + auth traffic flows through the BFF on :8090.
      "/api":  { target: "http://localhost:8090", changeOrigin: true },
      "/auth": { target: "http://localhost:8090", changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
  },
});
