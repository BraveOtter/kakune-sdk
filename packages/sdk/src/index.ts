import { createKakuneClient } from "@kakune-ai/client";
import { stdin, stdout } from "node:process";
import type { Readable, Writable } from "node:stream";
import type {
  AuthScope,
  AuthTokenRecord,
  CoreInfo,
  CreatedAuthToken,
  InstalledPluginRecord,
  PreparedPluginInstallRecord,
  JsonRpcFailure,
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcSuccess,
  PluginInboundMessage,
  PluginManifest,
  PluginOutboundMessage,
  SecretRecord,
  Workflow
} from "@kakune-ai/contracts";
import type { KakuneClientOptions, SseEvent } from "@kakune-ai/client";

export interface KakuneSdkOptions extends KakuneClientOptions {}

export interface KakuneSdk {
  getCoreInfo(): Promise<CoreInfo>;
  getPluginManifest(name: string): Promise<PluginManifest>;
  listPlugins(): Promise<InstalledPluginRecord[]>;
  setPluginEnabled(id: string, enabled: boolean): Promise<{ id: string; status: string }>;
  removePlugin(id: string): Promise<void>;
  preparePlugin(source: string): Promise<PreparedPluginInstallRecord>;
  commitPluginInstallation(id: string, digest: string): Promise<InstalledPluginRecord>;
  listWorkflows(): Promise<WorkflowRecord[]>;
  analyzeWorkflow(source: string): Promise<WorkflowAnalysis>;
  createWorkflow(source: string): Promise<WorkflowRecord>;
  getWorkflowSource(id: string): Promise<WorkflowSource>;
  saveWorkflowSource(id: string, source: string, revision: string): Promise<WorkflowRecord>;
  setWorkflowEnabled(id: string, enabled: boolean): Promise<WorkflowStatus>;
  createExecution(workflowId: string, options?: { inputs?: Record<string, unknown>; idempotencyKey?: string }): Promise<ExecutionRecord>;
  cancelExecution(id: string): Promise<WorkflowStatus>;
  listExecutions(): Promise<ExecutionRecord[]>;
  getExecution(id: string): Promise<ExecutionDetail>;
  listAuthTokens(): Promise<AuthTokenRecord[]>;
  createAuthToken(request: CreateAuthTokenRequest): Promise<CreatedAuthToken>;
  revokeAuthToken(id: string): Promise<void>;
  listSecrets(): Promise<SecretRecord[]>;
  setSecret(name: string, value: string): Promise<SecretRecord>;
  deleteSecret(name: string): Promise<void>;
  events(): AsyncIterable<SseEvent>;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  status: "enabled" | "disabled";
  revision: string;
  updatedAt: string;
}

export interface WorkflowSource {
  id: string;
  source: string;
  revision: string;
}

export interface WorkflowAnalysis {
  workflow?: Workflow;
  diagnostics: WorkflowDiagnostic[];
}

export interface WorkflowDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  pointer?: string;
  range?: SourceRange;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourcePosition {
  line: number;
  utf8ByteColumn: number;
  utf16Column: number;
  byteOffset: number;
}

export interface WorkflowStatus {
  id: string;
  status: "enabled" | "disabled";
}

export interface ExecutionRecord {
  id: string;
  workflowName: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface ExecutionDetail {
  execution: ExecutionRecord;
  nodes: Array<{ nodeId: string; status: string; message?: string; result?: unknown; error?: string }>;
  result?: unknown;
}

export interface CreateAuthTokenRequest {
  name: string;
  scopes: AuthScope[];
  expiresAt?: string;
}

/** Returns a JSON-RPC success response for a request received over plugin stdio. */
export function createPluginSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

/** Returns a JSON-RPC failure response for a request received over plugin stdio. */
export function createPluginFailure(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data }
  };
}

/** Narrows a JSON-RPC plugin message to a request, including requests with a null ID. */
export function isPluginJsonRpcRequest(message: PluginInboundMessage): message is JsonRpcRequest {
  return "id" in message;
}

export interface PluginStdioOptions {
  input?: Readable;
  output?: Writable;
  maxMessageBytes?: number;
  maxInFlight?: number;
  requestTimeoutMs?: number;
}

/**
 * Handles newline-delimited JSON-RPC requests from stdin and writes plugin
 * responses and notifications to stdout. Keep diagnostics on stderr.
 */
export type PluginStdioHandler = (
  message: PluginInboundMessage,
  host: PluginHostServices
) => PluginOutboundMessage | readonly PluginOutboundMessage[] | undefined | Promise<PluginOutboundMessage | readonly PluginOutboundMessage[] | undefined>;

export function writePluginJsonRpcMessage(output: Writable, message: PluginOutboundMessage): void {
  output.write(`${JSON.stringify(message)}\n`);
}

export interface PluginHostServices {
  request(method: string, params?: Record<string, unknown>): Promise<unknown>;
  notify(method: string, params?: Record<string, unknown>): void;
}

export async function runPluginStdio(handler: PluginStdioHandler, options: PluginStdioOptions = {}): Promise<void> {
  const input = options.input ?? stdin, output = options.output ?? stdout;
  const limit = options.maxMessageBytes ?? 1024 * 1024, maxInFlight = options.maxInFlight ?? 32;
  const timeoutMs = options.requestTimeoutMs ?? 30_000;
  if (![limit,maxInFlight,timeoutMs].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid plugin transport limits");
  const active = new Set<Promise<void>>();
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  let sequence = 0, closed = false;
  const send = (message: PluginOutboundMessage) => {
    const encoded = JSON.stringify(message) + "\n";
    if (Buffer.byteLength(encoded) > limit || output.writableLength > limit * maxInFlight) throw new Error("Plugin protocol output limit exceeded");
    output.write(encoded);
  };
  const host: PluginHostServices = {
    request(method, params = {}) {
      if (closed || pending.size >= maxInFlight) return Promise.reject(new Error("Core service channel is closed or busy"));
      if (!method || method.startsWith("rpc.")) return Promise.reject(new Error("Invalid Core service method"));
      const id = "plugin:" + ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("Core service request timed out")); }, timeoutMs);
        pending.set(id,{resolve,reject,timer});
        try { send({jsonrpc:"2.0",id,method,params}); }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    },
    notify(method, params = {}) { send({jsonrpc:"2.0",method,params}); },
  };
  const dispatch = (line: string) => {
    let value: unknown;
    try { value = JSON.parse(line); }
    catch { send(createPluginFailure(null,-32700,"Parse error")); return; }
    if (isRecord(value) && value.jsonrpc === "2.0" && !("method" in value) && typeof value.id === "string") {
      const request = pending.get(value.id);
      if (!request) return;
      pending.delete(value.id); clearTimeout(request.timer);
      if ("result" in value && !("error" in value)) request.resolve(value.result);
      else request.reject(new Error(isRecord(value.error) && typeof value.error.message === "string" ? value.error.message : "Invalid Core service response"));
      return;
    }
    if (!isPluginInboundMessage(value)) { send(createPluginFailure(null,-32600,"Invalid Request")); return; }
    const message = value;
    if (active.size >= maxInFlight) { if (isPluginJsonRpcRequest(message)) send(createPluginFailure(message.id,-32000,"Plugin is busy")); return; }
    const task = (async () => {
      try {
        const response = await handler(message, host);
        if (response !== undefined) for (const item of Array.isArray(response) ? response : [response]) send(item);
      } catch (error) {
        if (isPluginJsonRpcRequest(message)) send(createPluginFailure(message.id,-32603,"Internal error",{detail:error instanceof Error ? error.message : String(error)}));
      }
    })();
    active.add(task);
    void task.then(() => active.delete(task), () => active.delete(task));
  };
  let buffered = Buffer.alloc(0);
  try {
    for await (const chunk of input) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let start = 0;
      for (let index = 0; index < bytes.length; index++) if (bytes[index] === 10) {
        if (buffered.length + index - start > limit) throw new Error("Plugin protocol message limit exceeded");
        dispatch(Buffer.concat([buffered,bytes.subarray(start,index)]).toString("utf8").replace(/\r$/, ""));
        buffered = Buffer.alloc(0); start = index + 1;
      }
      if (buffered.length + bytes.length - start > limit) throw new Error("Plugin protocol message limit exceeded");
      buffered = Buffer.concat([buffered,bytes.subarray(start)]);
    }
    if (buffered.length) throw new Error("Plugin protocol ended with an incomplete message");
  } finally {
    closed = true;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("Core service channel closed")); }
    pending.clear();
    await Promise.allSettled(active);
  }
}

function isPluginInboundMessage(value: unknown): value is PluginInboundMessage {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string" || value.method.length === 0) {
    return false;
  }
  if ("params" in value && !isRecord(value.params) && !Array.isArray(value.params)) return false;
  return !("id" in value) || isJsonRpcId(value.id);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || (typeof value === "number" && Number.isInteger(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createKakuneSdk(options: KakuneSdkOptions): KakuneSdk {
  const client = createKakuneClient(options);
  const json = async <T>(path: string, method: "POST" | "PUT", body?: unknown): Promise<T> => {
    const response = await client.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return response.json() as Promise<T>;
  };

  return {
    getCoreInfo: () => client.get<CoreInfo>("/api/v1/info"),
    getPluginManifest: (name) => client.get<PluginManifest>(`/api/v1/plugins/${encodeURIComponent(name)}/manifest`),
    async listPlugins() {
      return (await client.get<{ items: InstalledPluginRecord[] }>("/api/v1/plugins")).items;
    },
    setPluginEnabled: (id, enabled) => json(`/api/v1/plugins/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`, "POST"),
    async removePlugin(id) { await client.request(`/api/v1/plugins/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    preparePlugin: (source) => json<PreparedPluginInstallRecord>("/api/v1/plugins/prepare", "POST", { source }),
    commitPluginInstallation: (id, digest) => json<InstalledPluginRecord>(`/api/v1/plugin-installations/${encodeURIComponent(id)}/commit`, "POST", { digest }),
    async listWorkflows() {
      return (await client.get<{ items: WorkflowRecord[] }>("/api/v1/workflows")).items;
    },
    analyzeWorkflow: (source) => json<WorkflowAnalysis>("/api/v1/workflows/analyze", "POST", { source }),
    createWorkflow: (source) => json<WorkflowRecord>("/api/v1/workflows", "POST", { source }),
    getWorkflowSource: (id) => client.get<WorkflowSource>(`/api/v1/workflows/${encodeURIComponent(id)}/source`),
    async saveWorkflowSource(id, source, revision) {
      if (!revision || revision === "*" || /[\r\n]/.test(revision)) throw new Error("The revision originally read is required to save a workflow safely.");
      const response = await client.request(`/api/v1/workflows/${encodeURIComponent(id)}/source`, {
        method: "PUT",
        headers: { "content-type": "application/json", "if-match": revision },
        body: JSON.stringify({ source })
      });
      return response.json() as Promise<WorkflowRecord>;
    },
    setWorkflowEnabled: (id, enabled) => json<WorkflowStatus>(`/api/v1/workflows/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`, "POST"),
    async createExecution(workflowId, options = {}) {
      const headers: Record<string,string> = { "content-type":"application/json" };
      if (options.idempotencyKey !== undefined) {
        if (!/^[\x21-\x7e]{1,128}$/.test(options.idempotencyKey)) throw new Error("Invalid idempotency key");
        headers["Idempotency-Key"] = options.idempotencyKey;
      }
      const response = await client.request("/api/v1/executions", { method:"POST", headers, body:JSON.stringify({workflowId,...(options.inputs === undefined ? {} : {inputs:options.inputs})}) });
      return response.json() as Promise<ExecutionRecord>;
    },
    cancelExecution: (id) => json<WorkflowStatus>(`/api/v1/executions/${encodeURIComponent(id)}/cancel`, "POST"),
    async listExecutions() {
      return (await client.get<{ items: ExecutionRecord[] }>("/api/v1/executions")).items;
    },
    getExecution: (id) => client.get<ExecutionDetail>(`/api/v1/executions/${encodeURIComponent(id)}`),
    async listAuthTokens() {
      return (await client.get<{ items: AuthTokenRecord[] }>("/api/v1/auth/tokens")).items;
    },
    createAuthToken: (request) => json<CreatedAuthToken>("/api/v1/auth/tokens", "POST", request),
    async revokeAuthToken(id) {
      await client.request(`/api/v1/auth/tokens/${encodeURIComponent(id)}/revoke`, { method: "POST" });
    },
    async listSecrets() {
      return (await client.get<{ items: SecretRecord[] }>("/api/v1/secrets")).items;
    },
    setSecret: (name, value) => json<SecretRecord>("/api/v1/secrets", "POST", { name, value }),
    async deleteSecret(name) {
      await client.request(`/api/v1/secrets/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
    events: () => client.events("/api/v1/events")
  };
}

export type {
  AuthScope,
  AuthTokenRecord,
  CoreInfo,
  CreatedAuthToken,
  InstalledPluginRecord,
  PreparedPluginInstallRecord,
  JsonRpcFailure,
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcSuccess,
  PluginInboundMessage,
  PluginManifest,
  PluginOutboundMessage,
  SecretRecord,
  SseEvent,
  Workflow
};
