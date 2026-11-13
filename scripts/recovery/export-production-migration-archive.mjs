#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const archivePath = path.join(
  repoRoot,
  "supabase/migration-source-archive/production-ledger-statements-2026-11-13.json"
);
const outputDir = path.join(
  repoRoot,
  "supabase/migration-source-archive/exported-sql"
);

function toSql(statements, version) {
  if (!Array.isArray(statements) || statements.length === 0) {
    throw new Error(\`Migration \${version} has no stored SQL statements.\`);
  }

  return statements.map((statement, index) => {
    if (typeof statement !== "string" || !statement.trim()) {
      throw new Error(\`Migration \${version} has an empty or invalid statement at index \${index}.\`);
    }
    const trimmed = statement.trimEnd();
    return trimmed.endsWith(";") ? trimmed : \`\${trimmed}\\n;\`;
  }).join("\\n\\n") + "\\n";
}

const archiveText = await readFile(archivePath, "utf8");
const archive = JSON.parse(archiveText);
if (archive.format !== "asyut-aqar-production-migration-source-archive-v1") {
  throw new Error("Unrecognized production migration archive format.");
}
if (!Array.isArray(archive.records) || archive.records.length !== archive.record_count) {
  throw new Error("Archive record count does not match its metadata.");
}

await mkdir(outputDir, { recursive: true });
for (const record of archive.records) {
  const version = String(record.version || "");
  const name = String(record.name || "");
  if (!/^\d{14}$/.test(version) || !/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(\`Unsafe migration filename metadata for version \${version}.\`);
  }
  const filePath = path.join(outputDir, \`\${version}_\${name}.sql\`);
  await writeFile(filePath, toSql(record.statements, version), { encoding: "utf8" });
}

console.log(\`Exported \${archive.records.length} archived migration sources to \${path.relative(repoRoot, outputDir)}.\`);
console.log("These files are archival only; do not move them into supabase/migrations or apply them to production.");
