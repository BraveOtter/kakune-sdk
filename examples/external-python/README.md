# External Python Process Plugin

`plugin.py` uses only Python's standard library. Its process manifest starts `python3 plugin.py`, and `nodes/hello.node.json` declares its static node. It reads one JSON-RPC 2.0 message per stdin line and writes one response or notification per stdout line; diagnostics go to stderr.

```sh
printf '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n' | python plugin.py
printf '{"jsonrpc":"2.0","id":2,"method":"node/execute","params":{"executionId":"run-1","nodeId":"hello","nodeType":"kakune.python-hello@1","operationId":"op-1","inputs":{"name":"Ada"}}}\n' | python plugin.py
```

The demonstrator supports `initialize`, `node/execute`, `operation/cancel`, `operation/progress`, JSON-RPC errors, and type validation. `node/execute` returns Core's `{ route, outputs, message? }` result shape. It does not require a package manager or third-party Python dependencies.
