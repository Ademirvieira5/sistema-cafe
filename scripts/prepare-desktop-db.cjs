const { rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const templatePath = path.join(projectRoot, "electron", "template.db");
const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

rmSync(templatePath, { force: true });
writeFileSync(templatePath, "");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    DATABASE_URL: `file:${templatePath.replaceAll("\\", "/")}`,
  },
  stdio: "inherit",
});

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Banco inicial do aplicativo preparado com sucesso.");
