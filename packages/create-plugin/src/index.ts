import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface CreatePluginOptions {
  directory: string;
  id: string;
  name?: string;
  description?: string;
}

export async function createPlugin(options: CreatePluginOptions): Promise<void> {
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(options.id)) {
    throw new Error("Plugin ID must contain at least two dot-separated alphanumeric or hyphen segments.");
  }

  const manifestPath = join(options.directory, "kakune.plugin.json");
  const entrypointPath = join(options.directory, "src", "index.ts");
  const nodeDefinitionPath = join(options.directory, "nodes", "hello.node.json");
  const packagePath = join(options.directory, "package.json");
  await mkdir(dirname(entrypointPath), { recursive: true });
  await mkdir(dirname(nodeDefinitionPath), { recursive: true });

  for (const path of [manifestPath, entrypointPath, nodeDefinitionPath, packagePath]) {
    try {
      await access(path);
      throw new Error(`Refusing to overwrite existing file: ${path}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const description = options.description ?? "A Kakune process plugin.";
  const name = options.name ?? options.id;
  await Promise.all([
    writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          manifestVersion: "1.0",
          id: options.id,
          name,
          version: "0.1.0",
          pluginProtocol: ">=1.0.0 <2.0.0",
          runtime: { kind: "process", command: "node", args: ["dist/index.js"] },
          description: { en: description },
          requires: { executables: [{ name: "node", version: ">=22.0.0", versionArgs: ["--version"] }] },
          contributes: { nodes: ["nodes/hello.node.json"] }
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
          dependencies: { "@kakune-ai/sdk": "^0.1.0" },
          devDependencies: { typescript: "^5.8.3" }
        },
        null,
        2
      )}\n`,
      "utf8"
    ),
    writeFile(
      entrypointPath,
      "import { createPluginFailure, createPluginSuccess, isPluginJsonRpcRequest, runPluginStdio } from \"@kakune-ai/sdk\";\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === \"object\" && value !== null && !Array.isArray(value);\n}\n\nawait runPluginStdio((message) => {\n  if (!isPluginJsonRpcRequest(message)) return;\n  if (message.method === \"initialize\") {\n    return createPluginSuccess(message.id, { protocolVersion: \"1.0\", nodes: [\"example.hello@1\"] });\n  }\n  if (message.method === \"shutdown\") {\n    return createPluginSuccess(message.id, { stopped: true });\n  }\n  if (message.method !== \"node/execute\") {\n    return createPluginFailure(message.id, -32601, \"Method not found\", { method: message.method });\n  }\n\n  const inputs = isRecord(message.params) && isRecord(message.params.inputs) ? message.params.inputs : undefined;\n  if (!inputs || typeof inputs.name !== \"string\" || inputs.name.trim() === \"\") {\n    return createPluginFailure(message.id, -32602, \"inputs.name must be a non-empty string\");\n  }\n  return createPluginSuccess(message.id, {\n    route: \"success\",\n    outputs: { message: `Hello, ${inputs.name}!` }\n  });\n});\n",
      "utf8"
    ),
    writeFile(
      nodeDefinitionPath,
      `${JSON.stringify(
        {
          apiVersion: "kakune.dev/v1",
          kind: "NodeDefinition",
          type: "example.hello@1",
          name: "Hello",
          description,
          inputSchema: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string", minLength: 1 } }
          },
          outputSchema: {
            type: "object",
            properties: { message: { type: "string" } }
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    )
  ]);
}
