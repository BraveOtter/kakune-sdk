export interface CoreInfo {
  apiVersion: string;
  coreVersion: string;
  coreId: string;
  serverTime?: string;
  capabilities: string[];
}

export interface CoreSseEventEnvelope {
  eventVersion: "1.0";
  coreId: string;
  eventId: string;
  sequence: number;
  timestamp: string;
  type: string;
  resourceId: string;
  executionId?: string;
  spanId?: string;
  payload: unknown;
}

export type TraceSpanKind = "node" | "provider" | "tool";
export type TraceSpanStatus = "running" | "succeeded" | "failed" | "cancelled";
export type UsageCertainty = "reported" | "notReported";
export type CostCertainty = "providerReported" | "unknown";

/** Sanitized execution facts for graphical observability. Raw provider payloads are never public. */
export interface TraceSpan {
  id: string;
  parentSpanId?: string;
  kind: TraceSpanKind;
  nodeId?: string;
  name: string;
  attempt?: number;
  status: TraceSpanStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  attributes: Record<string, unknown>;
}

export interface TraceProviderInvocation {
  spanId?: string;
  nodeId: string;
  provider: string;
  modelRequested: string;
  modelReported?: string;
  usage?: Record<string, unknown> | Array<Record<string, unknown>>;
  usageCertainty: UsageCertainty;
  costCertainty: CostCertainty;
  createdAt: string;
}

export interface ProviderUsageSummary {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageCertainty: UsageCertainty;
  costCertainty: CostCertainty;
}

export interface TraceArtifactLink { nodeId: string; artifactId: string; }

export interface ExecutionTrace {
  execution: Record<string, unknown>;
  workflowRevision: string;
  workflowSource: string;
  planHash: string;
  spans: TraceSpan[];
  providerInvocations: TraceProviderInvocation[];
  providerUsage: ProviderUsageSummary[];
  artifacts: TraceArtifactLink[];
}

export interface WorkflowRevision { id: string; createdAt: string; }
export interface WorkflowRevisionSource extends WorkflowRevision { source: string; }
export interface WorkflowRevisionComparison { base: WorkflowRevisionSource; head: WorkflowRevisionSource; }

export interface ConnectionContextExport {
  format: "kakune-contexts/v1";
  exportedAt: string;
  activeContextId?: string;
  contexts: ConnectionContext[];
}

export interface ConnectionContext {
  id: string;
  name: string;
  endpoint: string;
  expectedCoreId?: string;
  color?: string;
  credentialRef?: string;
}

export type ProviderCapability =
  | "model-listing"
  | "text-generation"
  | "embeddings"
  | "streaming"
  | "tools"
  | "structured-output"
  | "vision"
  | "usage-reporting";

export type ModelCapability =
  | "text-generation"
  | "embeddings"
  | "streaming"
  | "tools"
  | "structured-output"
  | "vision"
  | "json-schema-output";

export interface ProviderModelCapabilities {
  apiVersion: "kakune.dev/v1";
  kind: "ProviderModelCapabilities";
  provider: ProviderCapabilities;
  models: ModelCapabilities[];
}

export interface ProviderCapabilities {
  id: string;
  displayName?: string;
  capabilities: ProviderCapability[];
}

/** A provider credential is always a Core secret reference, never a key value. */
export interface ProviderCredentialRef {
  provider: string;
  secret: string;
}

/** Provider quota is deliberately raw until MiniMax documents a stable schema. */
export interface TokenPlan {
  provider: "minimax";
  queriedAt: string;
  raw: Record<string, unknown>;
}

export interface ModelCapabilities {
  id: string;
  displayName?: string;
  capabilities: ModelCapability[];
  contextWindowTokens?: number;
  maxOutputTokens?: number;
}

export interface ApiProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code: string;
  message: string;
  details: unknown;
  retryable: boolean;
  requestId: string;
  traceId: string;
  [extension: string]: unknown;
}

export interface Workflow {
  apiVersion: "kakune/v1";
  kind: "Workflow";
  metadata: WorkflowMetadata;
  inputs?: Record<string, unknown>;
  triggers: WorkflowTrigger[];
  entry: string;
  nodes: WorkflowNode[];
  outputs?: Record<string, WorkflowBinding>;
  policy?: WorkflowPolicy;
  layout?: WorkflowLayout;
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
}

export interface WorkflowTrigger {
  id: string;
  type: string;
  with?: Record<string, unknown>;
  map?: Record<string, WorkflowBinding>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  with?: Record<string, unknown>;
  inputs?: Record<string, WorkflowBinding>;
  on?: Record<string, string>;
  branches?: Record<string, WorkflowSubgraph>;
  body?: WorkflowSubgraph;
}

/** An acyclic graph scoped to a structured flow node. */
export interface WorkflowSubgraph {
  entry: string;
  nodes: WorkflowNode[];
  outputs?: Record<string, WorkflowBinding>;
}

export type WorkflowBinding =
  | { literal: unknown }
  | { from: string }
  | { expr: Record<string, unknown> }
  | { secret: string };

export interface WorkflowPolicy {
  /** Maximum concurrent nodes in each graph scope (1-64). */
  maxParallelNodes?: number;
  timeout?: string;
  ai?: {
    /** Preventive output-token reservation; not a billed-currency claim. */
    budgetTokens?: number;
  };
  concurrency?: {
    maxRuns?: number;
    overflow?: "queue" | "reject";
    maxQueued?: number;
  };
}

export interface WorkflowLayout {
  nodes?: Record<string, { x: number; y: number }>;
}

export type AuthScope = "read" | "run" | "manage" | "admin";

export interface AuthTokenRecord {
  id: string;
  name: string;
  scopes: AuthScope[];
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

/** The raw token is returned only by token creation and must not be persisted by clients. */
export interface CreatedAuthToken extends AuthTokenRecord {
  token: string;
}

/** Values are accepted only on set and are never returned by Core reads. */
export interface SecretRecord {
  name: string;
  updatedAt: string;
}

/** A provider profile references a Core secret and never contains a credential value. */
export interface ProviderProfile {
  id: string;
  displayName: string;
  providerType: "codex" | "minimax";
  defaultModel: string;
  allowedModels: string[];
  capabilities: ProviderCapability[];
  auth: ProviderProfileAuth;
  config: Record<string, unknown>;
  diagnostic: ProviderProfileDiagnostic;
  createdAt: string;
  updatedAt: string;
}

export type ProviderProfileAuth =
  | { type: "apiKey"; secret_ref: string }
  | { type: "oauthSecret"; secret_ref: string };

export interface ProviderProfileDiagnostic {
  status: "unknown" | "available" | "unavailable";
  checkedAt?: string;
  message?: string;
  details?: unknown;
}

export interface McpHttpCallRequest {
  transport: { transport: "http"; endpoint: string; bearer_secret_ref?: string };
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpStdioCallRequest {
  transport: { transport: "stdio"; command: string; args?: string[]; current_dir?: string; environment_secret_refs?: Record<string, string> };
  toolName: string;
  arguments: Record<string, unknown>;
}

export type McpCallRequest = McpHttpCallRequest | McpStdioCallRequest;

export interface InstalledPluginRecord {
  id: string;
  name: string;
  version: string;
  manifestPath: string;
  installedAt: string;
  enabled: boolean;
  policy: Record<string, string[]> | null;
  digest: string;
  resolvedLock: Record<string, unknown>;
  provenance: Record<string, unknown>;
}

/** Staged, statically inspected package awaiting an explicit digest approval. */
export interface PreparedPluginInstallRecord {
  id: string;
  pluginId: string;
  pluginName: string;
  version: string;
  digest: string;
  stagedPath: string;
  preparedAt: string;
  policy: Record<string, string[]> | null;
  resolvedLock: Record<string, unknown>;
  provenance: Record<string, unknown>;
}

export interface PluginManifest {
  manifestVersion: "1.0";
  id: string;
  name: string;
  version: string;
  pluginProtocol: ">=1.0.0 <2.0.0";
  runtime: PluginProcessRuntime;
  author?: PluginAuthor;
  description?: Record<string, string>;
  license?: string;
  model?: string;
  requires?: PluginRequirements;
  contributes?: PluginContributions;
  permissions?: PluginPermissions;
}

export interface PluginProcessRuntime {
  kind: "process";
  command: string;
  args?: string[];
}

export interface PluginAuthor {
  name: string;
}

export interface PluginRequirements {
  executables?: PluginRequiredExecutable[];
}

export interface PluginRequiredExecutable {
  name: string;
  version: string;
  versionArgs?: string[];
}

export interface PluginContributions {
  nodes?: string[];
  triggers?: string[];
  providers?: string[];
  services?: string[];
}

export interface PluginPermissions {
  process?: string[];
  filesystem?: string[];
  network?: string[];
  secrets?: string[];
}

export interface PluginNodeDefinition {
  apiVersion: "kakune.dev/v1";
  kind: "NodeDefinition";
  type: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
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

export type PluginInboundMessage = JsonRpcRequest | JsonRpcNotification;
export type PluginOutboundMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcFailure;

/** Parameters sent by Core for a process-backed node invocation. */
export interface PluginNodeExecuteParams {
  executionId: string;
  nodeId: string;
  nodeType: string;
  operationId: string;
  inputs: Record<string, unknown>;
}

export interface PluginNodeExecuteResult {
  route?: string;
  outputs?: Record<string, unknown>;
  message?: string;
}

export interface PluginOperationCancelParams {
  operationId: string;
}

export interface PluginOperationProgressParams {
  operationId: string;
  progress: number;
  message?: string;
}
