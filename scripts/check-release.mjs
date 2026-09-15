import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packages = ["contracts", "client", "sdk", "create-plugin", "plugin-testkit"];
const manifests = await Promise.all(packages.map(async (directory) => JSON.parse(await readFile(resolve(root, "packages", directory, "package.json"), "utf8"))));
const versions = [...new Set(manifests.map((manifest) => manifest.version))];
if (versions.length !== 1) throw new Error(`Publishable packages must share one version: ${versions.join(", ")}`);

const tag = process.argv.slice(2).find((argument) => argument !== "--");
if (tag && tag !== `sdk-v${versions[0]}`) throw new Error(`Tag ${tag} must equal sdk-v${versions[0]}`);
if (tag && versions[0].includes("-")) throw new Error("Prerelease versions are bootstrap-only and must not create an automated release tag");
console.log(versions[0]);
