#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function failure(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: "2.0", id, error });
}

function success(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function isRequest(message) {
  return message && typeof message === "object" && message.jsonrpc === "2.0" && typeof message.method === "string" && "id" in message;
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function gitStatus(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["status", "--porcelain=v1", "--branch"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `git status exited with code ${code}`));
    });
  });
}

async function handle(message) {
  if (!isRequest(message)) return;
  if (message.method === "initialize") {
    success(message.id, { protocolVersion: "1.0", nodes: ["kakune.git.status@1"] });
    return;
  }
  if (message.method === "shutdown") {
    return createPluginSuccess(message.id, { stopped: true });
  }
  if (message.method !== "node/execute") {
    failure(message.id, -32601, "Method not found", { method: message.method });
    return;
  }

  const inputs = isRecord(message.params) && isRecord(message.params.inputs) ? message.params.inputs : {};
  if (inputs.path !== undefined && (typeof inputs.path !== "string" || inputs.path.length === 0)) {
    failure(message.id, -32602, "inputs.path must be a non-empty string when provided");
    return;
  }

  try {
    const status = await gitStatus(inputs.path ?? process.cwd());
    const entries = status.split(/\r?\n/).filter(Boolean);
    success(message.id, {
      route: "success",
      outputs: { status, dirty: entries.slice(1).length > 0 },
      message: entries[0] ?? "Git status is empty"
    });
  } catch (error) {
    failure(message.id, -32603, "Git status failed", { detail: error instanceof Error ? error.message : String(error) });
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const message = JSON.parse(line);
    if (!isRequest(message)) {
      failure(null, -32600, "Invalid Request");
      continue;
    }
    await handle(message);
  } catch {
    failure(null, -32700, "Parse error");
  }
}
