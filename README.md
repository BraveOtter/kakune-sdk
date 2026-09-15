# Kakune SDK Workspace

Independent pnpm workspace for the Kakune public TypeScript baseline. It publishes five packages:

- `@kakune-ai/contracts`: TypeScript protocol types and canonical JSON Schemas.
- `@kakune-ai/client`: dependency-free Fetch and Server-Sent Events transport.
- `@kakune-ai/sdk`: versioned Kakune API convenience methods.
- `@kakune-ai/create-plugin`: CLI and library for creating a plugin skeleton.
- `@kakune-ai/plugin-testkit`: JSONL protocol validation and in-memory plugin test transports.

## Requirements

- Node.js 22 or later
- Corepack (included with supported Node.js releases)

## Install, build, and test

```sh
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

Run static type checking with:

```sh
corepack pnpm typecheck
```

## Client and SDK

`@kakune-ai/client` uses only the standard Fetch API and SSE response streams. Provide a Fetch implementation explicitly when the runtime does not provide `globalThis.fetch`.

```ts
import { createKakuneSdk } from "@kakune-ai/sdk";

const sdk = createKakuneSdk({ baseUrl: "https://kakune.example" });
const info = await sdk.getCoreInfo();

for await (const event of sdk.events()) {
  console.log(event.event, event.data);
}
```

The canonical API paths include `GET /health/live`, `GET /health/ready`, `GET /api/v1/info`, `GET /api/v1/plugins/:name/manifest`, and `GET /api/v1/events`. The complete public OpenAPI 3.1.2 document is published at `@kakune-ai/contracts/openapi/core-api.openapi.json`.

### Workflows and executions

The canonical workflow is the JSON-compatible value parsed from YAML. It has `apiVersion: "kakune/v1"`, `kind: "Workflow"`, `metadata` with `id` and `name`, `triggers`, an `entry` node ID, and `nodes`; `inputs`, `outputs`, `policy`, and `layout` are optional.

```ts
const workflow: Workflow = {
  apiVersion: "kakune/v1",
  kind: "Workflow",
  metadata: { id: "nightly-report", name: "Nightly report" },
  triggers: [{ id: "manual", type: "kakune.trigger.manual@1" }],
  entry: "build-report",
  nodes: [{ id: "build-report", type: "kakune.report.build@1" }]
};
```

`@kakune-ai/sdk` provides typed helpers for `listWorkflows`, `analyzeWorkflow`, `createWorkflow`, `getWorkflowSource`, `saveWorkflowSource`, `setWorkflowEnabled`, `createExecution`, `listExecutions`, and `getExecution`. Source helpers accept YAML text; list helpers unwrap the canonical `{ items }` response envelope.

## Schemas

The published schema paths are:

```text
@kakune-ai/contracts/schemas/core-info.schema.json
@kakune-ai/contracts/schemas/workflow.schema.json
@kakune-ai/contracts/schemas/plugin-manifest.schema.json
@kakune-ai/contracts/schemas/core-sse-event.schema.json
@kakune-ai/contracts/schemas/connection-context-export.schema.json
@kakune-ai/contracts/schemas/provider-model-capabilities.schema.json
@kakune-ai/contracts/schemas/problem-details.schema.json
@kakune-ai/contracts/openapi/core-api.openapi.json
```

Schemas target JSON Schema draft 2020-12. `workflow.schema.json` validates the semantic JSON-compatible value produced after parsing workflow YAML; it does not parse YAML itself.

`core-sse-event.schema.json` defines the versioned JSON envelope carried in an SSE `data` field. `connection-context-export.schema.json` is the portable GUI/CLI connection export format and only permits credential references, never credentials. `provider-model-capabilities.schema.json` makes provider and model features explicit. `problem-details.schema.json` adds required Kakune request metadata to RFC 9457 Problem Details fields.

## Create a plugin

Build the workspace first, then invoke the local published-style binary:

```sh
corepack pnpm build
corepack pnpm --filter @kakune-ai/create-plugin exec kakune-create-plugin ./plugins/hello --id acme.hello --name "Example plugin" --description "Example plugin"
```

The command creates a process `kakune.plugin.json`, static `nodes/hello.node.json`, `package.json`, and a JSON-RPC stdio `src/index.ts`, and refuses to overwrite any of them.

Process manifests use `manifestVersion: "1.0"`, a dot-separated `id`, display `name`, semantic `version`, `pluginProtocol: ">=1.0.0 <2.0.0"`, and `runtime: { kind: "process", command, args }`. Optional metadata includes localized `description`, executable requirements, static contributions, and declared permissions. Process plugins receive newline-delimited JSON-RPC 2.0 requests on stdin and must reserve stdout for JSON-RPC messages.

## Plugin testkit

`@kakune-ai/plugin-testkit` parses and validates UTF-8 newline-delimited JSON-RPC 2.0 protocol messages using the `@kakune-ai/contracts` message types. `createInMemoryPluginHost` provides paired Core and plugin endpoints for unit tests; it only transports messages and never imports or executes plugin code.

```ts
import { createInMemoryPluginHost, parsePluginJsonl } from "@kakune-ai/plugin-testkit";

const testHost = createInMemoryPluginHost();
testHost.host.send(parsePluginJsonl('{"jsonrpc":"2.0","id":1,"method":"initialize"}\n')[0]);
const request = await testHost.plugin.receive();
```

## Plugin examples

`examples/sample-typescript` uses `runPluginStdio` from `@kakune-ai/sdk`. `examples/external-python` uses only Python's standard library. `examples/git-adapter` is a standalone, copyable adapter with no npm runtime dependencies; it declares Node.js and Git requirements and exposes `kakune.git.status@1`.

## Publishing

Release preparation and verification instructions are in [RELEASE.md](RELEASE.md). Each package has an explicit `files` allowlist, export map, repository metadata, and a trusted publisher. A protected `sdk-vX.Y.Z` tag publishes exact pre-verified tarballs with OIDC, checksums, a CycloneDX SBOM, and GitHub provenance. No registry write token is stored in CI.

```sh
npm install @kakune-ai/contracts@0.1.0 @kakune-ai/client@0.1.0 @kakune-ai/sdk@0.1.0
npm audit signatures
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development expectations and [SECURITY.md](SECURITY.md) for vulnerability reporting.
