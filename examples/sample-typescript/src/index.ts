import { createPluginFailure, createPluginSuccess, isPluginJsonRpcRequest, runPluginStdio } from "@kakune-ai/sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

await runPluginStdio((message) => {
  if (!isPluginJsonRpcRequest(message)) return;
  if (message.method === "initialize") {
    return createPluginSuccess(message.id, { protocolVersion: "1.0", nodes: ["kakune.hello@1"] });
  }
  if (message.method === "shutdown") {
    return createPluginSuccess(message.id, { stopped: true });
  }
  if (message.method !== "node/execute") {
    return createPluginFailure(message.id, -32601, "Method not found", { method: message.method });
  }

  const inputs = isRecord(message.params) && isRecord(message.params.inputs) ? message.params.inputs : undefined;
  if (!inputs || typeof inputs.name !== "string" || inputs.name.trim() === "") {
    return createPluginFailure(message.id, -32602, "inputs.name must be a non-empty string");
  }
  if (inputs.greeting !== undefined && (typeof inputs.greeting !== "string" || inputs.greeting.trim() === "")) {
    return createPluginFailure(message.id, -32602, "inputs.greeting must be a non-empty string when provided");
  }

  return createPluginSuccess(message.id, {
    route: "success",
    outputs: { message: `${inputs.greeting ?? "Hello"}, ${inputs.name}!` }
  });
});
