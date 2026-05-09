import fs from "fs";
import path from "path";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Many clients request /favicon.ico even when HTML links /favicon.svg; serve SVG bytes with correct MIME (dev + preview). */
function faviconIcoFallbackMiddleware(): Connect.NextHandleFunction {
  const svgPath = path.resolve(__dirname, "public/favicon.svg");
  return (req, res, next) => {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/favicon.ico") {
      next();
      return;
    }
    fs.readFile(svgPath, (err, buf) => {
      if (err) {
        next();
        return;
      }
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(buf);
    });
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "favicon-ico-fallback",
      configureServer(server) {
        server.middlewares.use(faviconIcoFallbackMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(faviconIcoFallbackMiddleware());
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Evita CJS re-exports con getters (Rollup no ve named exports estáticos en dist).
      "@theforge/business-rules": path.resolve(__dirname, "../../packages/business-rules/src/index.ts"),
      "@theforge/shared-types/markdown-repair": path.resolve(
        __dirname,
        "../../packages/shared-types/src/markdown-repair.ts",
      ),
      "@theforge/shared-types/mdd-pipeline-limits": path.resolve(
        __dirname,
        "../../packages/shared-types/src/mdd-pipeline-limits.ts",
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
