import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const packages = [
  {
    directory: "packages/contracts",
    files: ["dist/index.js", "dist/index.d.ts", "schemas/core-info.schema.json", "openapi/core-api.openapi.json"]
  },
  { directory: "packages/client", files: ["dist/index.js", "dist/index.d.ts"] },
  { directory: "packages/sdk", files: ["dist/index.js", "dist/index.d.ts"] },
  { directory: "packages/create-plugin", files: ["dist/index.js", "dist/index.d.ts", "dist/cli.js"] },
  { directory: "packages/plugin-testkit", files: ["dist/index.js", "dist/index.d.ts"] },
  { directory: "examples/sample-typescript", files: ["dist/index.js", "dist/index.d.ts", "kakune.plugin.json"] }
];

for (const packageToCheck of packages) {
  const cwd = resolve(root, packageToCheck.directory);
  const output = execFileSync(npm, ["pack", "--dry-run", "--json"], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  const [{ files }] = JSON.parse(output);
  const packedFiles = new Set(files.map(({ path }) => path));

  for (const file of packageToCheck.files) {
    if (!packedFiles.has(file)) {
      throw new Error(`${packageToCheck.directory} tarball is missing ${file}`);
    }
  }

  await import(pathToFileURL(resolve(cwd, "dist/index.js")).href);
}

const exampleDirectory = resolve(root, "examples/sample-typescript");
const manifest = JSON.parse(await readFile(resolve(exampleDirectory, "kakune.plugin.json"), "utf8"));
if (manifest.runtime?.kind !== "process" || manifest.runtime.command !== "node" || manifest.runtime.args?.[0] !== "dist/index.js") {
  throw new Error("sample TypeScript plugin manifest must target the built process entrypoint");
}

const cli = spawnSync(process.execPath, [resolve(root, "packages/create-plugin/dist/cli.js")], { encoding: "utf8" });
if (cli.status !== 1 || !cli.stderr.includes("Usage: kakune-create-plugin")) {
  throw new Error("@kakune-ai/create-plugin CLI did not expose its usage message");
}
