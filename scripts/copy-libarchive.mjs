import { cpSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "node_modules", "libarchive.js", "dist");
const dstDir = join(__dirname, "..", "public", "libarchive");

if (!existsSync(srcDir)) {
  console.warn(`[copy-libarchive] ${srcDir} not found — skipping.`);
  process.exit(0);
}

mkdirSync(dstDir, { recursive: true });
cpSync(join(srcDir, "worker-bundle.js"), join(dstDir, "worker-bundle.js"));
cpSync(join(srcDir, "libarchive.wasm"), join(dstDir, "libarchive.wasm"));
console.log(`[copy-libarchive] copied worker-bundle.js + libarchive.wasm to ${dstDir}`);
