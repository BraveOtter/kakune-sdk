# Contributing

Use Node.js 22 and the pnpm version pinned in `package.json`.

Before opening a pull request, run:

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm check:packages
```

Keep public API, schemas, fixtures, and tests aligned. Do not commit `dist` output or other ignored build artifacts. Update `CHANGELOG.md` for user-visible changes.

Pull requests must keep GitHub Actions permissions at their minimum required scope.
