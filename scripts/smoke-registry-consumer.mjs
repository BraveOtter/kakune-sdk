import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const versionIndex = process.argv.indexOf("--version");
const outIndex = process.argv.indexOf("--out");
const version = versionIndex >= 0 ? process.argv[versionIndex + 1] : undefined;
const output = resolve(root, outIndex >= 0 ? process.argv[outIndex + 1] : "release-artifacts");
if (!version || !output || (versionIndex >= 0 && !process.argv[versionIndex + 1])) throw new Error("Usage: node scripts/smoke-registry-consumer.mjs --version X.Y.Z [--out directory]");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packages = ["contracts", "client", "sdk", "create-plugin", "plugin-testkit"].map((name) => `@kakune-ai/${name}@${version}`);
const directory = await mkdtemp(resolve(tmpdir(), "kakune-registry-consumer-"));
try {
  await mkdir(resolve(directory, "consumer"));
  const consumer = resolve(directory, "consumer");
  execFileSync(npm, ["init", "--yes"], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });
  execFileSync(npm, ["install", "--ignore-scripts", "--registry=https://registry.npmjs.org", ...packages], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });
  const verification = [
    'await import("@kakune-ai/contracts");',
    'await import("@kakune-ai/client");',
    'await import("@kakune-ai/sdk");',
    'await import("@kakune-ai/plugin-testkit");',
  ].join("\n");
  execFileSync(process.execPath, ["--input-type=module", "--eval", verification], { cwd: consumer, stdio: "inherit" });
  const createPlugin = resolve(consumer, "node_modules", ".bin", process.platform === "win32" ? "kakune-create-plugin.cmd" : "kakune-create-plugin");
  execFileSync(createPlugin, [resolve(consumer, "generated-plugin"), "--id", "kakune.registry-smoke"], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });
  execFileSync(npm, ["audit", "signatures"], { cwd: consumer, stdio: "inherit", shell: process.platform === "win32" });

  const manifest = JSON.parse(await readFile(resolve(output, "release-manifest.json"), "utf8"));
  for (const artifact of manifest.artifacts) {
    const integrity = execFileSync(npm, ["view", `${artifact.name}@${artifact.version}`, "dist.integrity", "--registry=https://registry.npmjs.org"], { encoding: "utf8", shell: process.platform === "win32" }).trim();
    if (integrity !== artifact.integrity) throw new Error(`${artifact.name} integrity does not match the published tarball`);
  }
  const sbom = execFileSync(npm, ["sbom", "--sbom-format", "cyclonedx", "--omit", "dev"], { cwd: consumer, encoding: "utf8", shell: process.platform === "win32" });
  await cp(resolve(consumer, "package-lock.json"), resolve(output, "registry-install-package-lock.json"));
  await writeFile(resolve(output, "kakune-sdk.cdx.json"), sbom);
} finally {
  await rm(directory, { recursive: true, force: true });
}
