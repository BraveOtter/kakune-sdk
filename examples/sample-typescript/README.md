# TypeScript Hello Process Plugin

`kakune.plugin.json` declares a `process` runtime that starts `node dist/index.js`. The static node definition is in `nodes/hello.node.json`; neither it nor the manifest executes code when inspected.

Build it with `pnpm install` followed by `pnpm build`. The process reads one JSON-RPC 2.0 message per stdin line and emits one JSON response or notification per stdout line. `node/execute` reads `params.inputs.name`, accepts optional `greeting`, and returns `{ route, outputs }`.
