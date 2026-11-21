// Bundles ../../index.ts (Deno handler) for Node with stubbed jsr: imports so run.mjs can drive it offline.
// Usage: cd tests/e2e && npm i && node build.mjs && node run.mjs
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const SRC = fileURLToPath(new URL("../../index.ts", import.meta.url));
await build({
  entryPoints: [SRC], bundle: true, format: "esm", platform: "node", outfile: "./bundle.mjs", logLevel: "error",
  plugins: [{ name: "jsr", setup(b) {
    b.onResolve({ filter: /^jsr:@supabase\/functions-js/ }, () => ({ path: "edge", namespace: "stub" }));
    b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: "sb", namespace: "stub" }));
    b.onLoad({ filter: /^edge$/, namespace: "stub" }, () => ({ contents: "export {}" }));
    b.onLoad({ filter: /^sb$/, namespace: "stub" }, () => ({ contents: "export const createClient = (...a) => globalThis.__sb(...a);" }));
  }}],
  loader: { ".json": "json" },
});
console.log("built");
