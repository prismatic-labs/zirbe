import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

function publishMethodDocs(): void {
  const dest = resolve(root, "public/method-docs");
  mkdirSync(dest, { recursive: true });
  for (const name of ["METHOD.md", "SOURCES.md"]) {
    const from = resolve(root, "../docs", name);
    const to = resolve(dest, name);
    if (existsSync(from)) copyFileSync(from, to);
    else writeFileSync(to, "");
  }
}

publishMethodDocs();

export default defineConfig({
  // Relative paths, so the build runs from any folder or host.
  base: "./",
  // Poll for changes: file events were being missed in this folder, which left the dev server stale.
  server: { watch: { usePolling: true, interval: 300 } },
  plugins: [
    react(),
    {
      name: "zirbe-method-docs",
      buildStart() {
        publishMethodDocs();
      },
      configureServer() {
        publishMethodDocs();
      },
      closeBundle() {
        const index = resolve(root, "dist/index.html");
        if (!existsSync(index)) return;
        const dir = resolve(root, "dist/method");
        mkdirSync(dir, { recursive: true });
        copyFileSync(index, resolve(dir, "index.html"));
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
