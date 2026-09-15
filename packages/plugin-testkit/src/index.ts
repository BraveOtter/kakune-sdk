import type { JsonRpcError, JsonRpcId, PluginJsonRpcMessage } from "@kakune-ai/contracts";

type JsonObject = Record<string, unknown>;

export class PluginJsonlParseError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Invalid plugin JSONL message on line ${line}: ${message}`);
    this.name = "PluginJsonlParseError";
    this.line = line;
  }
}

/** Parses complete UTF-8 JSONL input without executing or importing plugin code. */
export function parsePluginJsonl(input: string): PluginJsonRpcMessage[] {
  const lines = input.split("\n");
  if (lines.at(-1) === "") lines.pop();

  return lines.map((rawLine, index) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.trim() === "") {
      throw new PluginJsonlParseError(index + 1, "messages must not be blank");
    }

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new PluginJsonlParseError(index + 1, "invalid JSON");
    }

    try {
      return validatePluginJsonRpcMessage(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid JSON-RPC 2.0 message";
      throw new PluginJsonlParseError(index + 1, message);
    }
  });
}

export function validatePluginJsonRpcMessage(value: unknown): PluginJsonRpcMessage {
  if (!isObject(value) || value.jsonrpc !== "2.0") {
    throw new Error('"jsonrpc" must equal "2.0"');
  }

  if ("method" in value) {
    validateMethod(value);
    if ("id" in value) {
      validateId(value.id);
      assertKeys(value, ["jsonrpc", "id", "method", "params"]);
      return value as unknown as PluginJsonRpcMessage;
    }
    assertKeys(value, ["jsonrpc", "method", "params"]);
    return value as unknown as PluginJsonRpcMessage;
  }

  if ("result" in value) {
    validateId(value.id);
    assertKeys(value, ["jsonrpc", "id", "result"]);
    return value as unknown as PluginJsonRpcMessage;
  }

  if ("error" in value) {
    validateId(value.id);
    validateError(value.error);
    assertKeys(value, ["jsonrpc", "id", "error"]);
    return value as unknown as PluginJsonRpcMessage;
  }

  throw new Error("message must be a request, notification, success, or failure");
}

export function isPluginJsonRpcMessage(value: unknown): value is PluginJsonRpcMessage {
  try {
    validatePluginJsonRpcMessage(value);
    return true;
  } catch {
    return false;
  }
}

export interface InMemoryPluginTransport {
  readonly messages: readonly PluginJsonRpcMessage[];
  send(message: PluginJsonRpcMessage): void;
  receive(): Promise<PluginJsonRpcMessage | undefined>;
  close(): void;
}

export interface InMemoryPluginHost {
  /** The Core-facing endpoint. Send requests here and receive plugin responses here. */
  host: InMemoryPluginTransport;
  /** The plugin-facing endpoint. No plugin module is loaded or executed by this transport. */
  plugin: InMemoryPluginTransport;
  close(): void;
}

export function createInMemoryPluginHost(): InMemoryPluginHost {
  const host = new MemoryTransport();
  const plugin = new MemoryTransport();
  host.connect(plugin);
  plugin.connect(host);

  return {
    host,
    plugin,
    close() {
      host.close();
      plugin.close();
    }
  };
}

class MemoryTransport implements InMemoryPluginTransport {
  #peer: MemoryTransport | undefined;
  #closed = false;
  #messages: PluginJsonRpcMessage[] = [];
  #waiters: Array<(message: PluginJsonRpcMessage | undefined) => void> = [];

  get messages(): readonly PluginJsonRpcMessage[] {
    return [...this.#messages];
  }

  connect(peer: MemoryTransport): void {
    this.#peer = peer;
  }

  send(message: PluginJsonRpcMessage): void {
    if (this.#closed) throw new Error("Cannot send through a closed plugin transport.");
    if (!this.#peer || this.#peer.#closed) throw new Error("Plugin transport peer is closed.");
    this.#peer.deliver(message);
  }

  receive(): Promise<PluginJsonRpcMessage | undefined> {
    const message = this.#messages.shift();
    if (message) return Promise.resolve(message);
    if (this.#closed) return Promise.resolve(undefined);
    return new Promise((resolve) => this.#waiters.push(resolve));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const resolve of this.#waiters.splice(0)) resolve(undefined);
  }

  private deliver(message: PluginJsonRpcMessage): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter(message);
      return;
    }
    this.#messages.push(message);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMethod(value: JsonObject): void {
  if (typeof value.method !== "string" || value.method.length === 0) {
    throw new Error('"method" must be a non-empty string');
  }
  if ("params" in value && !isObject(value.params) && !Array.isArray(value.params)) {
    throw new Error('"params" must be an object or array');
  }
}

function validateId(value: unknown): asserts value is JsonRpcId {
  if (value !== null && typeof value !== "string" && (!Number.isInteger(value) || typeof value !== "number")) {
    throw new Error('"id" must be a string, integer, or null');
  }
}

function validateError(value: unknown): asserts value is JsonRpcError {
  if (!isObject(value) || !Number.isInteger(value.code) || typeof value.message !== "string" || value.message.length === 0) {
    throw new Error('"error" must contain an integer code and non-empty message');
  }
  assertKeys(value, ["code", "message", "data"]);
}

function assertKeys(value: JsonObject, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("message contains unsupported properties");
  }
}
