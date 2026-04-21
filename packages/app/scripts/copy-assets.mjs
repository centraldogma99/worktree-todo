import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rendererSrc = path.join(root, "src", "renderer");
const rendererOut = path.join(root, "dist", "renderer");
const preloadOut = path.join(root, "dist", "preload");

await mkdir(rendererOut, { recursive: true });
await cp(path.join(rendererSrc, "index.html"), path.join(rendererOut, "index.html"));
await cp(path.join(rendererSrc, "settings.html"), path.join(rendererOut, "settings.html"));
await cp(path.join(rendererSrc, "style.css"), path.join(rendererOut, "style.css"));

// Override package.json scope so dist/preload/*.js runs as CommonJS
// (top-level package.json has "type": "module" which would otherwise
// interpret the compiled preload as ESM and break require()/exports).
await mkdir(preloadOut, { recursive: true });
await writeFile(
  path.join(preloadOut, "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n"
);

console.log("assets copied to", rendererOut);
console.log("preload CJS scope marker written to", preloadOut);
