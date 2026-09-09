import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface CreatePluginOptions {
  directory: string;
  name: string;
  description?: string;
}

export async function createPlugin(options: CreatePluginOptions): Promise<void> {
  if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(options.name)) {
    throw new Error("Plugin name must use the form @scope/name with lowercase letters, digits, and hyphens.");
  }

  const manifestPath = join(options.directory, "kakune.plugin.json");
  const entrypointPath = join(options.directory, "src", "index.ts");
  const packagePath = join(options.directory, "package.json");
  await mkdir(dirname(entrypointPath), { recursive: true });

  for (const path of [manifestPath, entrypointPath, packagePath]) {
    try {
      await access(path);
      throw new Error(`Refusing to overwrite existing file: ${path}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const description = options.description ?? "A Kakune plugin.";
  await Promise.all([
    writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          apiVersion: "kakune.dev/v1",
          kind: "Plugin",
          metadata: { name: options.name, version: "0.1.0", description },
          entrypoint: { module: "./dist/index.js", export: "default" },
          capabilities: []
        },
        null,
        2
      )}\n`,
      "utf8"
    ),
    writeFile(
      packagePath,
      `${JSON.stringify(
        {
          name: options.name,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: { build: "tsc" },
          devDependencies: { typescript: "^5.8.3" }
        },
        null,
        2
      )}\n`,
      "utf8"
    ),
    writeFile(
      entrypointPath,
      "export default async function run(input: unknown): Promise<unknown> {\n  return input;\n}\n",
      "utf8"
    )
  ]);
}
