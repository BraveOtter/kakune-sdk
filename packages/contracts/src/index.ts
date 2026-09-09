export interface CoreInfo {
  apiVersion: string;
  coreVersion: string;
  serverTime?: string;
  capabilities: string[];
}

export interface Workflow {
  apiVersion: "kakune/v1";
  kind: "Workflow";
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
  spec: {
    triggers: Record<string, Record<string, unknown>>;
    steps: WorkflowStep[];
  };
}

export interface WorkflowStep {
  id: string;
  plugin: string;
  with?: Record<string, unknown>;
  needs?: string[];
}

export interface PluginManifest {
  apiVersion: "kakune.dev/v1";
  kind: "Plugin";
  metadata: {
    name: string;
    version: string;
    description?: string;
  };
  entrypoint: {
    module: string;
    export?: string;
  };
  capabilities?: string[];
}

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcError;
}

export type PluginJsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcFailure;
