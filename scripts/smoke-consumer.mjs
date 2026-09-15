import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packages = [
  resolve(root, "packages/contracts"),
  resolve(root, "packages/client"),
  resolve(root, "packages/sdk"),
  resolve(root, "packages/create-plugin"),
  resolve(root, "packages/plugin-testkit")
];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const directory = await mkdtemp(resolve(tmpdir(), "kakune-contract-consumer-"));

try {
  const tarballs = packages.map((directoryToPack) => {
    // pnpm resolves workspace: dependencies to their publishable semver ranges
    // while packing. npm pack preserves workspace: verbatim, yielding tarballs
    // that an external consumer cannot install.
    const { filename } = JSON.parse(execFileSync(pnpm, ["pack", "--json", "--pack-destination", directory], {
      cwd: directoryToPack,
      encoding: "utf8",
      shell: process.platform === "win32"
    }));
    return filename;
  });
  const consumer = resolve(directory, "consumer");
  await mkdir(consumer);
  await writeFile(resolve(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });
  const verification = [
    'await import("@kakune-ai/contracts");',
    'await import("@kakune-ai/client");',
    'await import("@kakune-ai/sdk");',
    'await import("@kakune-ai/plugin-testkit");',
    'const schema = await import("@kakune-ai/contracts/schemas/core-info.schema.json", { with: { type: "json" } });',
    'const fixture = await import("@kakune-ai/contracts/fixtures/core-info.valid.json", { with: { type: "json" } });',
    'if (schema.default.required?.includes("coreId") !== true || fixture.default.coreId == null) throw new Error("installed contracts are incomplete");'
  ].join("\n");
  execFileSync(process.execPath, ["--input-type=module", "--eval", verification], { cwd: consumer, stdio: "inherit" });
  const createPlugin = resolve(consumer, "node_modules", ".bin", process.platform === "win32" ? "kakune-create-plugin.cmd" : "kakune-create-plugin");
  execFileSync(createPlugin, [resolve(consumer, "generated-plugin"), "--id", "kakune.smoke"], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });
} finally {
  await rm(directory, { recursive: true, force: true });
}
