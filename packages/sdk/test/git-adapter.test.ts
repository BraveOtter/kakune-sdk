import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("git adapter example", () => {
  it("runs after being copied outside the repository without npm dependencies", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kakune-git-adapter-"));
    const source = new URL("../../../examples/git-adapter/", import.meta.url);
    const pluginDirectory = join(directory, "git-adapter");
    const adapterPath = join(pluginDirectory, "git-adapter.mjs");

    try {
      await cp(source, pluginDirectory, { recursive: true });
      const response = await invoke(adapterPath, '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n');
      expect(JSON.parse(response.trim())).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: { protocolVersion: "1.0", nodes: ["kakune.git.status@1"] }
      });
      await expect(readFile(join(pluginDirectory, "kakune.plugin.json"), "utf8")).resolves.toContain('"name": "git"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function invoke(adapterPath: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [adapterPath], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `adapter exited with code ${code}`));
    });
    child.stdin.end(input);
  });
}
