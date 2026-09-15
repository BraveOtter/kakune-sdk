# Git Status Adapter

This is a standalone process plugin. It has no npm runtime dependencies: it uses Node.js standard-library modules and declares both `node` and `git` in `kakune.plugin.json` under `requires.executables`.

Copy the entire directory outside this repository before registering its manifest. The relative runtime command and the static node definition remain valid after copying:

```sh
cp -R examples/git-adapter ~/kakune-plugins/git-adapter
cd ~/kakune-plugins/git-adapter
printf '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n' | node git-adapter.mjs
```

The declared node type is `kakune.git.status@1`. A `node/execute` request receives Core's `params.inputs`; pass an optional `path` to select the repository. The plugin runs `git status --porcelain=v1 --branch` and returns a Core-compatible `{ route, outputs, message }` result. Protocol messages are newline-delimited JSON-RPC 2.0 on stdout; diagnostics never use stdout.
