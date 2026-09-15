import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contractFiles = [
  ...["core-info", "workflow", "plugin-manifest", "plugin-json-rpc-message", "core-sse-event", "connection-context-export", "provider-model-capabilities", "problem-details"].map((name) => `packages/contracts/schemas/${name}.schema.json`),
  "packages/contracts/openapi/core-api.openapi.json"
];
const base = process.argv[2] ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined);

if (!base) {
  console.log("No comparison base was supplied; compatibility check is deferred to CI pull requests.");
  process.exit(0);
}

function readAtRevision(file) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" }));
  } catch {
    return undefined;
  }
}

function compare(previous, next, path, failures) {
  if (previous === undefined || next === undefined) return;
  if (typeof previous !== "object" || previous === null || Array.isArray(previous) || typeof next !== "object" || next === null || Array.isArray(next)) {
    if (JSON.stringify(previous) !== JSON.stringify(next)) failures.push(`${path} changed from ${JSON.stringify(previous)} to ${JSON.stringify(next)}`);
    return;
  }
  const oldRequired = new Set(previous.required ?? []);
  for (const field of next.required ?? []) if (!oldRequired.has(field)) failures.push(`${path}.required adds ${field}`);
  if (Array.isArray(previous.enum) && Array.isArray(next.enum)) for (const value of previous.enum) if (!next.enum.includes(value)) failures.push(`${path}.enum removes ${JSON.stringify(value)}`);
  if (previous.additionalProperties !== false && next.additionalProperties === false) failures.push(`${path} now rejects additional properties`);
  for (const [key, direction] of [["minimum", 1], ["minLength", 1], ["minItems", 1], ["maximum", -1], ["maxLength", -1], ["maxItems", -1]]) {
    if (typeof previous[key] === "number" && typeof next[key] === "number" && (direction === 1 ? next[key] > previous[key] : next[key] < previous[key])) failures.push(`${path}.${key} became stricter`);
  }
  if (previous.pattern && next.pattern && previous.pattern !== next.pattern) failures.push(`${path}.pattern changed`);
  if ("const" in previous && JSON.stringify(previous.const) !== JSON.stringify(next.const)) failures.push(`${path}.const changed`);
  for (const [key, oldValue] of Object.entries(previous.properties ?? {})) {
    if (!(key in (next.properties ?? {}))) failures.push(`${path}.properties removes ${key}`);
    else compare(oldValue, next.properties[key], `${path}.properties.${key}`, failures);
  }
  for (const [key, oldValue] of Object.entries(previous.paths ?? {})) {
    if (!(key in (next.paths ?? {}))) failures.push(`${path}.paths removes ${key}`);
    else compare(oldValue, next.paths[key], `${path}.paths.${key}`, failures);
  }
}

const failures = [];
for (const file of contractFiles) {
  const currentPath = resolve(root, file);
  if (!existsSync(currentPath)) continue;
  const previous = readAtRevision(file);
  if (previous === undefined) continue;
  compare(previous, JSON.parse(readFileSync(currentPath, "utf8")), file, failures);
}
if (failures.length) {
  console.error(`Incompatible Kakune contract change(s) since ${base}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`No incompatible Kakune contract changes since ${base}.`);
