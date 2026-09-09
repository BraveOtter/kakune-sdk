# Kakune SDK Workspace

Independent pnpm workspace for the Kakune public TypeScript baseline. It publishes four packages:

- `@kakune/contracts`: TypeScript protocol types and canonical JSON Schemas.
- `@kakune/client`: dependency-free Fetch and Server-Sent Events transport.
- `@kakune/sdk`: versioned Kakune API convenience methods.
- `@kakune/create-plugin`: CLI and library for creating a plugin skeleton.

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

`@kakune/client` uses only the standard Fetch API and SSE response streams. Provide a Fetch implementation explicitly when the runtime does not provide `globalThis.fetch`.

```ts
import { createKakuneSdk } from "@kakune/sdk";

const sdk = createKakuneSdk({ baseUrl: "https://kakune.example" });
const info = await sdk.getCoreInfo();

for await (const event of sdk.events()) {
  console.log(event.event, event.data);
}
```

The baseline API paths are `GET /api/v1/info`, `GET /api/v1/plugins/:name/manifest`, and `GET /api/v1/events`.

## Schemas

The published schema paths are:

```text
@kakune/contracts/schemas/core-info.schema.json
@kakune/contracts/schemas/workflow.schema.json
@kakune/contracts/schemas/plugin-manifest.schema.json
@kakune/contracts/schemas/plugin-json-rpc-message.schema.json
```

Schemas target JSON Schema draft 2020-12. `workflow.schema.json` validates the semantic JSON-compatible value produced after parsing workflow YAML; it does not parse YAML itself.

## Create a plugin

Build the workspace first, then invoke the local published-style binary:

```sh
corepack pnpm build
corepack pnpm --filter @kakune/create-plugin exec kakune-create-plugin ./plugins/hello --name @acme/hello --description "Example plugin"
```

The command creates `kakune.plugin.json`, `package.json`, and `src/index.ts`, and refuses to overwrite any of them.

## Publishing

Each package has an explicit `files` allowlist and package export map. From an authenticated registry environment, publish packages in dependency order:

```sh
corepack pnpm --filter @kakune/contracts publish --access public
corepack pnpm --filter @kakune/client publish --access public
corepack pnpm --filter @kakune/sdk publish --access public
corepack pnpm --filter @kakune/create-plugin publish --access public
```
