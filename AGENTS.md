# Repository guidance

## Commands and verification

- Use Node.js 22+ and the pinned pnpm 10.15.0 (`corepack enable`, then `corepack pnpm install --frozen-lockfile`). `.npmrc` enforces engines and strict peer dependencies.
- Run commands from the repository root. The contributor check sequence is `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm check:packages`; see `.github/workflows/ci.yml` for the broader CI checks.
- Root `pnpm typecheck` is `tsc -b`: it **emits** package `dist` files and builds project references. Run it before tests on a fresh checkout: workspace imports resolve through package exports to `dist`, even when tests import their own package's `src` directly.
- `pnpm test` runs Vitest followed by the Rust contract harness, so Cargo is required. Rust-only: `pnpm test:rust` (runs Cargo with `--locked`). CI installs Rust 1.98.1.
- TypeScript-only: `pnpm exec vitest run`. One package: `pnpm exec vitest run packages/sdk/test`. One test: `pnpm exec vitest run packages/sdk/test/plugin-stdio.test.ts -t "receives Core replies"`. Tests are discovered under `packages/*/test/**/*.test.ts`; packages have no individual test scripts.
- Root `typecheck` excludes examples and test files. `pnpm build` additionally builds `examples/sample-typescript`; use `pnpm typecheck:example` for its no-emit check after building its workspace dependencies.
- After building, `pnpm check:packages` checks packed file allowlists, imports built entrypoints, and checks CLI usage. `pnpm check:consumer` packs and installs the five public packages into a temporary external consumer.
- For a local compatibility comparison, use `node scripts/check-breaking-contracts.mjs <git-ref>`. `pnpm check:contracts` skips comparison unless `GITHUB_BASE_REF` or an explicit base is supplied.
- `pnpm check:generated` is literally `git diff --exit-code -- .`: unrelated unstaged tracked edits make it fail; it is not a code generator or a complete clean-tree check.

## Boundaries and contract changes

- Public entrypoints are `packages/*/src/index.ts`; the scaffolder binary starts at `packages/create-plugin/src/cli.ts`. `client` owns dependency-free Fetch/SSE transport; `sdk` wraps it with API methods **and** Node stdio plugin helpers. The SDK entrypoint imports `node:process`, so do not assume it has the client's browser portability.
- `plugin-testkit` depends on contract message types and supplies JSONL validation and in-memory endpoints; it does not execute plugin code. `examples/git-adapter` must remain copyable outside the workspace without npm runtime dependencies (covered by an SDK test).
- Within `packages/contracts/`, keep `src/index.ts`, `schemas/`, `fixtures/`, and `openapi/core-api.openapi.json` aligned manually; the build only compiles TypeScript. Schemas use draft 2020-12; the workflow schema validates parsed JSON-compatible data, not YAML text.
- When adding a schema, add valid/invalid fixtures, its explicit export in `packages/contracts/package.json`, and entries in both `packages/contracts/test/schemas.test.ts` and `packages/contracts/rust-harness/tests/fixtures.rs`. Also update the compatibility script's file list. Both language suites validate the same fixtures.
- Process-plugin stdout is reserved for newline-delimited JSON-RPC 2.0. Keep receiving Core replies while a handler awaits a host-service request; `plugin-stdio.test.ts` covers this concurrency requirement.

## Publishing and repository conventions

- Packages are ESM/NodeNext; relative TypeScript imports use `.js` extensions. Edit source, not ignored `dist` or Rust `target` output.
- Use `pnpm pack` for installable tarballs: it rewrites `workspace:` dependencies; `npm pack` preserves them. The `npm pack --dry-run` use in `check:packages` only checks file contents.
- Follow `CONTRIBUTING.md`, including `CHANGELOG.md` updates for user-visible changes. For versioning or publishing, read `RELEASE.md` and `.github/workflows/release.yml`: all five public packages share the tag version and stable publication uses protected `sdk-vX.Y.Z` tags with OIDC, not registry write tokens.
