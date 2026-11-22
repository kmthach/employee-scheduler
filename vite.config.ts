import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// cp-sat-wasm needs SharedArrayBuffer, which requires cross-origin isolation.
// The production host must send these headers too (see README.md).
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["cp-sat-wasm"],
    include: ["protobufjs"],
  },
  worker: { format: "es" },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
