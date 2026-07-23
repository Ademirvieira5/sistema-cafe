const { cpSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync } = require("node:fs");
const path = require("node:path");

const aliasesRoot = path.resolve(__dirname, "..", ".next", "node_modules");

function materialize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    const stats = lstatSync(entryPath);
    if (stats.isSymbolicLink()) {
      const target = path.resolve(path.dirname(entryPath), readlinkSync(entryPath));
      rmSync(entryPath, { force: true });
      cpSync(target, entryPath, { recursive: true });
      console.log(`Alias materializado: ${path.relative(aliasesRoot, entryPath)}`);
      continue;
    }
    if (stats.isDirectory()) materialize(entryPath);
  }
}

mkdirSync(aliasesRoot, { recursive: true });
materialize(aliasesRoot);
