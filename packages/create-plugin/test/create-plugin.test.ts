import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlugin } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("createPlugin", () => {
  it("creates a manifest, package, and entrypoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kakune-plugin-"));
    try {
      await createPlugin({ directory, name: "@acme/hello", description: "Hello plugin" });
      await expect(readFile(join(directory, "kakune.plugin.json"), "utf8")).resolves.toContain('"name": "@acme/hello"');
      await expect(readFile(join(directory, "package.json"), "utf8")).resolves.toContain('"name": "@acme/hello"');
      await expect(readFile(join(directory, "src", "index.ts"), "utf8")).resolves.toContain("export default");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects names outside the manifest convention", async () => {
    await expect(createPlugin({ directory: "unused", name: "invalid" })).rejects.toThrow("@scope/name");
  });
});
