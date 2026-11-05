#!/usr/bin/env node
// Combines each page's stylesheets into one minified file in assets/build/.
// Pages load one CSS file instead of up to seven, which is faster on mobile.
// The source files stay the place to edit; run this script after changing any of them:
//   npm install --no-save lightningcss@1.30.1 && node scripts/build-css.mjs
// CI checks that every bundle matches its sources (see the "sources" hash on line 1).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "assets/build";
const THEME = "assets/theme/asyut-premium.css";

// Bundle name -> source stylesheets in cascade order. Pages are rewritten to use the bundle.
export const BUNDLES = {
  home: ["styles.css", "buyer.css", "sponsor.css", "ai.css", "companies.css", "marketplace.css", THEME],
  base: ["styles.css", THEME],
  companies: ["styles.css", "companies.css", THEME],
  directory: ["styles.css", "directory.css", THEME],
  property: ["styles.css", "property.css", THEME],
  listings: ["styles.css", "marketplace-page.css", "my-listings.css", THEME],
  info: [THEME, "assets/theme/info-pages.css"]
};

export function sourcesHash(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) hash.update(file + "\n" + fs.readFileSync(path.join(root, file), "utf8") + "\n");
  return hash.digest("hex").slice(0, 16);
}

// Rewrite relative url() references so they still resolve from assets/build/.
function rebase(css, file) {
  const fromDir = path.posix.dirname(file);
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
    if (/^(data:|https?:|\/\/|\/|#)/i.test(ref)) return match;
    const target = path.posix.normalize(path.posix.join(fromDir, ref));
    return `url("${path.posix.relative(OUT, target)}")`;
  });
}

async function main() {
  const { transform } = await import("lightningcss");
  fs.mkdirSync(path.join(root, OUT), { recursive: true });
  for (const [name, files] of Object.entries(BUNDLES)) {
    const combined = files.map(file => `/* ${file} */\n` + rebase(fs.readFileSync(path.join(root, file), "utf8"), file)).join("\n");
    const { code, warnings } = transform({ filename: name + ".css", code: Buffer.from(combined), minify: true, errorRecovery: true });
    for (const warning of warnings || []) console.warn(`${name}: ${warning.message}`);
    const header = `/* ASYUT AQAR ${name} bundle | sources:${sourcesHash(files)} | ${files.join(" + ")} */\n`;
    fs.writeFileSync(path.join(root, OUT, name + ".min.css"), header + code.toString() + "\n");
    console.log(`${name}.min.css  ${(combined.length / 1024).toFixed(0)} KB -> ${(code.length / 1024).toFixed(0)} KB`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
