// Runs the project-local Foundry binary (.tools/foundry) or any forge on PATH.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const local = resolve(".tools/foundry/forge.exe");
const bin = existsSync(local) ? local : "forge";
const r = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(r.status ?? 1);
