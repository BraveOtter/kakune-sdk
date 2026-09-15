import {
  PluginJsonlParseError,
  createInMemoryPluginHost,
  isPluginJsonRpcMessage,
  parsePluginJsonl,
  validatePluginJsonRpcMessage
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("parsePluginJsonl", () => {
  it("parses every JSON-RPC 2.0 message kind and CRLF input", () => {
    const messages = parsePluginJsonl(
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\r\n' +
        '{"jsonrpc":"2.0","method":"operation/progress","params":[1]}\r\n' +
        '{"jsonrpc":"2.0","id":1,"result":null}\r\n' +
        '{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request"}}\r\n'
    );

    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({ method: "initialize" });
    expect(messages[3]).toMatchObject({ error: { code: -32600 } });
  });

  it("reports the line for blank lines, malformed JSON, and invalid messages", () => {
    expect(() => parsePluginJsonl("\n")).toThrow(PluginJsonlParseError);
    expect(() => parsePluginJsonl("{not json}\n")).toThrow(/line 1: invalid JSON/);
    expect(() => parsePluginJsonl('{"jsonrpc":"2.0","id":1,"result":true,"extra":true}\n')).toThrow(
      /unsupported properties/
    );
  });
});

describe("validatePluginJsonRpcMessage", () => {
  it("accepts valid contract-shaped messages", () => {
    const message = { jsonrpc: "2.0", id: "hello", method: "node/execute", params: { name: "Ada" } } as const;
    expect(validatePluginJsonRpcMessage(message)).toBe(message);
    expect(isPluginJsonRpcMessage(message)).toBe(true);
  });

  it("rejects invalid IDs, parameters, and error objects", () => {
    expect(() => validatePluginJsonRpcMessage({ jsonrpc: "2.0", id: 1.5, method: "hello" })).toThrow("integer");
    expect(() => validatePluginJsonRpcMessage({ jsonrpc: "2.0", method: "hello", params: null })).toThrow("params");
    expect(() => validatePluginJsonRpcMessage({ jsonrpc: "2.0", id: 1, error: { code: 1, message: "" } })).toThrow("error");
    expect(isPluginJsonRpcMessage({ jsonrpc: "1.0", method: "hello" })).toBe(false);
  });
});

describe("createInMemoryPluginHost", () => {
  it("transports messages in both directions without loading plugin code", async () => {
    const testHost = createInMemoryPluginHost();
    const request = { jsonrpc: "2.0", id: 1, method: "node/execute" } as const;
    const response = { jsonrpc: "2.0", id: 1, result: { greeting: "Hello" } } as const;

    testHost.host.send(request);
    await expect(testHost.plugin.receive()).resolves.toEqual(request);
    testHost.plugin.send(response);
    await expect(testHost.host.receive()).resolves.toEqual(response);
    expect(testHost.host.messages).toEqual([]);
  });

  it("queues messages and releases pending receivers when closed", async () => {
    const testHost = createInMemoryPluginHost();
    const notification = { jsonrpc: "2.0", method: "shutdown" } as const;

    testHost.host.send(notification);
    expect(testHost.plugin.messages).toEqual([notification]);
    await expect(testHost.plugin.receive()).resolves.toEqual(notification);

    const pending = testHost.host.receive();
    testHost.close();
    await expect(pending).resolves.toBeUndefined();
    expect(() => testHost.host.send(notification)).toThrow("closed");
  });
});
