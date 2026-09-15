# Release

Releases are published only by `.github/workflows/release.yml` from a protected `sdk-vX.Y.Z` tag and the protected `npm-production` environment. The workflow uses npm trusted publishing/OIDC; it must not receive an `NPM_TOKEN` or other registry write token. Public packages use the `@kakune-ai` scope.

Before creating the tag, validate a clean, reviewed checkout with Node.js 22:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm check:packages
corepack pnpm check:generated
corepack pnpm check:release
```

All five public packages share the tag version. The workflow packs those exact tarballs, records SHA-512 integrities and `SHA256SUMS`, then publishes in dependency order: contracts, client, SDK, create-plugin, plugin-testkit. It performs a clean registry installation, compares npm `dist.integrity`, verifies npm signatures, creates a CycloneDX SBOM, attaches GitHub provenance, and creates the GitHub Release.

Configure each package's trusted publisher in npm before the first automated release: repository `BraveOtter/kakune-sdk`, workflow filename `release.yml`, environment `npm-production`, and permission for direct `npm publish`. The initial registry setup may require an organization administrator. After publication, verify `npm audit signatures`, inspect `release-manifest.json`, verify `SHA256SUMS`, and run `gh attestation verify <asset> --repo BraveOtter/kakune-sdk`.

## Registry bootstrap

The one-time `0.1.0-bootstrap.0` prerelease established the five `@kakune-ai` package records and has passed a clean registry installation with verified npm signatures. Trusted publishing is configured for all five packages. Do not republish the bootstrap version or use an interactive npm credential for a stable release; publish `0.1.0` only through the protected GitHub Actions workflow.

`check:generated` verifies that building has not changed tracked generated artifacts. Run it only after committing or stashing unrelated local changes.
