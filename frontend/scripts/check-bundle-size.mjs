#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Enforces a hard bundle-size budget on the production build.
//
//   node scripts/check-bundle-size.mjs
//
// Fails if the entry JS chunk's gzipped size exceeds ENTRY_JS_GZIP_MAX,
// or if any single chunk's gzipped size exceeds CHUNK_GZIP_MAX.

import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const DIST = path.resolve(process.cwd(), "dist", "assets");
const ENTRY_JS_GZIP_MAX = 220 * 1024;
const CHUNK_GZIP_MAX = 260 * 1024;

const files = (await readdir(DIST)).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error("No JS chunks found under dist/assets — did you run `npm run build`?");
  process.exit(1);
}

let entryGzip = 0;
let maxChunk = { name: "", gzip: 0 };
const rows = [];

for (const f of files) {
  const p = path.join(DIST, f);
  const st = await stat(p);
  const raw = await readFile(p);
  const gz = gzipSync(raw).length;
  rows.push({ name: f, raw: st.size, gzip: gz });
  if (f.startsWith("index-") && gz > entryGzip) entryGzip = gz;
  if (gz > maxChunk.gzip) maxChunk = { name: f, gzip: gz };
}

rows.sort((a, b) => b.gzip - a.gzip);
console.log("Bundle sizes (sorted by gzip size):");
for (const r of rows) {
  console.log(`  ${kb(r.gzip).padStart(8)}  gz · ${kb(r.raw).padStart(8)}  raw  ${r.name}`);
}

const failures = [];
if (entryGzip > ENTRY_JS_GZIP_MAX) {
  failures.push(
    `entry JS gzip ${kb(entryGzip)} exceeds budget ${kb(ENTRY_JS_GZIP_MAX)}`,
  );
}
if (maxChunk.gzip > CHUNK_GZIP_MAX) {
  failures.push(
    `chunk "${maxChunk.name}" gzip ${kb(maxChunk.gzip)} exceeds per-chunk budget ${kb(CHUNK_GZIP_MAX)}`,
  );
}

if (failures.length > 0) {
  console.error("\nBundle-size budget exceeded:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nBundle-size budget OK.");

function kb(b) {
  return (b / 1024).toFixed(1) + " kB";
}
