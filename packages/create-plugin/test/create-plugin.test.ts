import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlugin } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("createPlugin", () => {
  it("creates a process manifest, node definition, package, and stdio entrypoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kakune-plugin-"));
    try {
      await createPlugin({ directory, id: "acme.hello", name: "Hello plugin", description: "Hello plugin" });
      await expect(readFile(join(directory, "kakune.plugin.json"), "utf8")).resolves.toContain('"manifestVersion": "1.0"');
      await expect(readFile(join(directory, "kakune.plugin.json"), "utf8")).resolves.toContain('"id": "acme.hello"');
      await expect(readFile(join(directory, "package.json"), "utf8")).resolves.toContain('"@kakune-ai/sdk": "^0.1.0"');
      await expect(readFile(join(directory, "src", "index.ts"), "utf8")).resolves.toContain("runPluginStdio");
      await expect(readFile(join(directory, "nodes", "hello.node.json"), "utf8")).resolves.toContain('"kind": "NodeDefinition"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects IDs outside the process manifest convention", async () => {
    await expect(createPlugin({ directory: "unused", id: "invalid" })).rejects.toThrow("dot-separated");
  });
});
