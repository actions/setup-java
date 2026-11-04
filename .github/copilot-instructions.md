# Copilot instructions

## Build, test, and lint

Use Node.js 24 or later (`package.json` declares `>=24.0.0`).

- `npm ci` installs the locked dependencies.
- `npm test` runs Jest serially with coverage.
- `npm test -- --runTestsByPath __tests__/setup-java.test.ts` runs one test file.
- `npm test -- --runTestsByPath __tests__/setup-java.test.ts --testNamePattern="pattern"` filters that file to matching test names.
- `npm run lint` runs ESLint on TypeScript files.
- `npm run format-check` checks Prettier formatting; `npm run format` applies it.
- `npm run build` bundles the setup and post-job entrypoints into `dist/`.
- `npm run check` runs format check, lint, build, and the full test suite.

## Architecture

This repository implements a Node.js GitHub Action. `action.yml` defines its inputs and outputs and runs `dist/setup/index.js` as the main entrypoint and `dist/cleanup/index.js` as the post-job entrypoint. The TypeScript sources in `src/` are bundled with NCC; the committed `dist/` files are what the action executes.

The setup entrypoint parses inputs, resolves versions, and configures the action's shared features. `src/distributions/distribution-factory.ts` lazily selects a vendor installer. Vendor installers implement metadata lookup and archive handling on top of `JavaBase` in `src/distributions/base-installer.ts`, which centralizes version resolution, tool-cache/JDK-cache use, download verification, and Java environment setup. Package support and OS/architecture support are validated centrally in `package-types.ts` and `platform-types.ts`.

The setup flow also configures problem matchers, Maven authentication and arguments, and Maven toolchains. The post-job entrypoint removes any isolated GPG home and saves enabled caches when the job succeeds and cache saving is not read-only.

## Repository-specific conventions

- Keep TypeScript source imports ESM-compatible: relative imports include the `.js` extension, even when the source file is `.ts`.
- Distribution-specific download and metadata logic belongs in its installer under `src/distributions/`; reuse `JavaBase` rather than duplicating common resolution, caching, verification, or environment behavior.
- When adding or changing distribution support, keep the distribution enum, factory, package-capability map, platform-capability map, README support documentation, unit tests, and relevant end-to-end workflow coverage consistent.
- Unit tests live under `__tests__/` and use Jest/ts-jest. Distribution tests are grouped under `__tests__/distributors/`; use the corresponding test and fixture patterns when changing an installer. End-to-end coverage is defined in `.github/workflows/e2e-*.yml`.
- Rebuild and commit generated `dist/` bundles for runtime-affecting source or dependency changes; do not make the bundles the source of truth. `npm run check` includes the build.
- New npm dependencies need lockfile changes and corresponding license records under `.licenses/`, following `.licensed.yml` and the licensed workflow.

## Action behavior principles

- Treat `action.yml` inputs, outputs, defaults, and compatibility aliases as the public API. Keep implementation, README, and advanced-usage documentation aligned when behavior changes; preserve deprecated aliases unless a documented breaking change removes them.
- Do not assume version syntax, package variants, or platform/architecture support is uniform across distributions. Keep capability checks and vendor resolution behavior consistent with the documented support matrix. `latest` means the newest stable GA release, not an early-access build.
- Preserve selection semantics: a recognized vendor in a supported version file may supply the distribution; otherwise the caller must provide it. If both `java-version` and `java-version-file` are given, the explicit `java-version` takes precedence.
- Preserve install-state behavior for multiple JDKs. The last installed JDK becomes the default unless `set-default: false`; all installed JDKs remain available through their version-specific environment variables and Maven toolchains. Toolchain entries accumulate non-destructively, and custom IDs must correspond one-for-one with requested versions.
- Treat dependency, wrapper, and JDK caches as distinct features with distinct keys and save behavior. `cache` enables dependency caching and implicitly enables JDK caching unless `cache-jdk` overrides it; `cache-read-only` restores without saving. Keep changes to cache identity or lifecycle aligned with these documented contracts.
- Preserve download-integrity guarantees: verify authoritative checksums when published. Signature verification is distribution-specific; explicit `verify-signature: true` must enforce verification where supported and fail clearly where unsupported. Do not silently weaken verification or imply that a cached install was downloaded and reverified.
- Keep Maven credential inputs as environment-variable names, not secret values. Generated settings and custom repository behavior must respect the documented overwrite option, while toolchain merging remains non-destructive and independent of that option.

See `docs/CONTRIBUTING.md` for contribution and validation guidance, `README.md` for the public contract, and `docs/advanced-usage.md` for detailed behavior and examples.
