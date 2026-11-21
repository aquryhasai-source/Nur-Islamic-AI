// Downloads the 14 hadith edition files (English + Arabic for the 7 gradable collections) into ./data/hadith.
// Cross-platform (plain Node fetch, no curl). Skips files that are already present and valid.
//   node download.mjs [target-dir]
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BOOKS = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik"];
const BASE = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions";
const dir = process.argv[2] ?? "./data/hadith";
mkdirSync(dir, { recursive: true });

function valid(path) {
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(j.hadiths) && j.hadiths.length > 100;
  } catch { return false; }
}

let failed = 0;
for (const book of BOOKS) {
  for (const lang of ["eng", "ara"]) {
    const name = `${lang}-${book}.min.json`;
    const path = join(dir, name);
    if (existsSync(path) && valid(path)) { console.log(`✓ ${name} (already there)`); continue; }
    try {
      const res = await fetch(`${BASE}/${name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const j = JSON.parse(text);
      if (!Array.isArray(j.hadiths) || j.hadiths.length < 100) throw new Error("unexpected file contents");
      writeFileSync(path, text);
      console.log(`✓ ${name} (${j.hadiths.length} hadith, ${(text.length / 1e6).toFixed(1)} MB)`);
    } catch (e) {
      failed++;
      console.error(`✗ ${name}: ${e.message}`);
    }
  }
}
if (failed) { console.error(`\n${failed} file(s) failed — run the command again to retry just those.`); process.exit(1); }
console.log("\nAll 14 files are in place.");
