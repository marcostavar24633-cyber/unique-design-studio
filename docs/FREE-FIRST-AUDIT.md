# Free-first optimization audit — 2026-11-16

## Scope and operating rules

This audit covers UNIQUE DESIGN STUDIO and its compatibility with Landing Studio. The target architecture is free-first: both studios remain useful without a paid AI API, API keys, or a separately managed application server. AI providers may be added later behind an optional adapter. Do not merge audit branches into `main` or change production deployment settings as part of this baseline.

## Repository baseline

- Repository: `marcostavar24633-cyber/unique-design-studio`
- Default branch: `main`
- Runtime: Node.js 20+
- Package scripts: `start`, `build`, `sync-core`, `test`, `test:e2e`
- README describes a dependency-free engine usable in Node.js and the browser.
- Main product layers: engine (`src/engine`), browser studio (`studio`), CLI (`bin/uds.js`), design system, examples and tests.
- Main workflow is concept-first: Design Brief → Design DNA → HTML → anti-template/accessibility/responsive checks.
- Existing README documents local generation and an optional external AI-assisted path. The local engine must remain the default, complete path.

## Live GitHub state observed during audit

- Open PR #10, `feature/dashboard-usability` → `main`: mobile/workspace usability improvements; mergeable; latest observed CI runs on its head commit succeeded.
- Open PR #9, `security/audit` → `main`: security/privacy report and regression tests; mergeable. The PR description reports 60/60 tests, but current head CI was not independently confirmed in this audit.
- Other feature branches exist; do not assume they are production-ready or merge them without comparing their base and tests.
- Default branch remains unchanged by this audit.

## Free-first assessment

### Already aligned
- Core generation can run locally without an AI API.
- A CLI and browser studio provide separate usage paths.
- Static HTML output can be hosted without an application server.
- The repository has dedicated unit/integration and responsive test scripts.

### Risks / work to verify
1. Confirm the current test suite and build from a clean Node 20 environment.
2. Review the optional AI path and ensure no API key or network provider is required for the primary generation flow.
3. Check generated HTML for external font/image/runtime dependencies and provide offline-safe fallbacks.
4. Verify browser storage/export/import behaviour and avoid silently storing customer data remotely.
5. Validate accessibility, responsive layouts, safe URL handling, HTML escaping and content sanitization.
6. Confirm the Landing Studio vendor bundle is synchronized to a known UDS commit and covered by integration tests.

## Optimization sequence

1. Baseline: run build, unit tests and responsive E2E tests; record exact results.
2. Security and privacy: review PR #9 and resolve any remaining findings.
3. Usability: review PR #10 and verify phone/tablet/desktop workflows.
4. Engine output: connect concept/DNA/architecture to a robust, self-contained HTML renderer and regression tests.
5. Integration contract: version the UDS engine bundle and add a deterministic sync/verification command in Landing Studio.
6. Optional AI boundary: keep provider calls outside the core engine; define a provider-neutral adapter only when needed.

## Acceptance criteria

- Core studio and CLI work without AI credentials or paid API calls.
- Build and all automated tests pass on Node.js 20+.
- Exported sites render as static HTML and have a clear offline-safe fallback.
- Landing Studio integration identifies the exact UDS engine version/commit.
- No secrets, customer records, or required runtime state are added to a third-party server.
- Production branch and deployment remain unchanged until a reviewed PR is explicitly merged.

## Audit status

Baseline created on `chore/free-first-audit`. This is a planning/audit artifact, not a claim that all checks above have already passed.
