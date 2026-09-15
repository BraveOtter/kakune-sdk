import { PassThrough } from "node:stream";
import { createPluginFailure, createPluginSuccess, isPluginJsonRpcRequest, runPluginStdio } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("runPluginStdio", () => {
  it("receives Core replies while the plugin handler awaits a host service", async () => {
    const input = new PassThrough(), output = new PassThrough();
    const messages: Record<string, unknown>[] = [];
    output.on("data", (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString()) as Record<string, unknown>;
      messages.push(message);
      if (message.method === "artifact/write") input.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { id: "artifact-1" } }) + "\n");
      if (message.id === 1) input.end();
    });
    const run = runPluginStdio(async (message, host) => {
      if (isPluginJsonRpcRequest(message)) return createPluginSuccess(message.id, await host.request("artifact/write", { text: "hello" }));
    }, { input, output });
    input.write('{"jsonrpc":"2.0","id":1,"method":"node/execute"}\n');
    await run;
    expect(messages[0]).toMatchObject({ id: "plugin:1", method: "artifact/write" });
    expect(messages[1]).toEqual({ jsonrpc: "2.0", id: 1, result: { id: "artifact-1" } });
  });

  it("rejects an oversized line even when no newline arrives", async () => {
    const input = new PassThrough(), output = new PassThrough();
    const run = runPluginStdio(() => undefined, { input, output, maxMessageBytes: 32 });
    input.end("x".repeat(33));
    await expect(run).rejects.toThrow("message limit exceeded");
  });
  it("handles newline-delimited requests and writes JSON-RPC responses", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let body = "";
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => { body += chunk; });

    const run = runPluginStdio((message) => {
      if (!isPluginJsonRpcRequest(message)) return;
      if (message.method === "initialize") return createPluginSuccess(message.id, { protocolVersion: "1.0" });
      return createPluginFailure(message.id, -32601, "Method not found");
    }, { input, output });

    input.end('{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","id":2,"method":"missing"}\n');
    await run;

    expect(body.trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { jsonrpc: "2.0", id: 1, result: { protocolVersion: "1.0" } },
      { jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } }
    ]);
  });

  it("returns JSON-RPC parse and invalid-request errors without invoking the handler", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let body = "";
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => { body += chunk; });
    const handler = () => { throw new Error("handler must not run"); };

    const run = runPluginStdio(handler, { input, output });
    input.end('{oops}\n{"jsonrpc":"2.0","method":42}\n');
    await run;

    expect(body.trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }
    ]);
  });
});
