import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputArgument = process.argv.indexOf("--out");
const output = resolve(root, outputArgument >= 0 ? process.argv[outputArgument + 1] : "release-artifacts");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const packageDirectories = ["contracts", "client", "sdk", "create-plugin", "plugin-testkit"];

if (outputArgument >= 0 && !process.argv[outputArgument + 1]) throw new Error("--out requires a directory");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const artifacts = [];
for (const directory of packageDirectories) {
  const cwd = resolve(root, "packages", directory);
  const packed = JSON.parse(execFileSync(pnpm, ["pack", "--json", "--pack-destination", output], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  }));
  const result = Array.isArray(packed) ? packed[0] : packed;
  const contents = await readFile(resolve(output, result.filename));
  artifacts.push({
    name: result.name,
    version: result.version,
    filename: result.filename,
    integrity: `sha512-${createHash("sha512").update(contents).digest("base64")}`,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

await writeFile(resolve(output, "release-manifest.json"), `${JSON.stringify({ artifacts }, null, 2)}\n`);
await writeFile(resolve(output, "SHA256SUMS"), artifacts.map((artifact) => `${artifact.sha256}  ${artifact.filename}`).join("\n") + "\n");
