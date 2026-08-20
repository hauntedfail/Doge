# Agent Harness Design

Doge uses a repository-native harness: coding agents operate through the same
files, scripts, tests, and CI that human contributors can inspect and run. It
does not depend on a particular agent vendor or a hidden prompt bundle.

## Layers

1. **Orientation** — root and package-local `AGENTS.md` files provide a concise
   map, commands, and non-negotiable boundaries.
2. **Knowledge** — `docs/INDEX.md` routes agents to current product, protocol,
   operation, and verification sources.
3. **Durable state** — `Backlog.md` records only unfinished outcomes that must
   survive sessions. Git history records completed changes.
4. **Fast feedback** — focused Vitest and workspace type/build commands support
   short edit-test loops.
5. **Admission control** — `npm run verify` is the one baseline definition of
   done; `npm run verify:release` adds package and artifact checks.
6. **Independent enforcement** — GitHub Actions installs from the lockfile and
   invokes the same release verification command on a clean runner.
7. **Reproducible dependencies** — `.node-version` and `packageManager` pin the
   toolchain; `.npmrc` isolates npm cache data under the ignored `.cache/`
   directory so a broken machine-wide cache cannot poison a clean install.

## Why this shape

- Instructions stay short and progressively disclose deeper context.
- Correctness and security constraints are executable where practical, rather
  than relying on an agent remembering prose.
- A single command prevents local, agent, and CI verification paths from
  drifting apart.
- The harness distinguishes testable software outcomes from external evidence:
  an EHPK build, Hub upload, simulator run, and physical G2 run are not treated
  as interchangeable.
- The structure remains lightweight enough for this small monorepo. Add a new
  harness layer only after a measured failure shows that current tooling cannot
  express or enforce the needed behavior.

## Maintenance rule

When an agent fails in a repeatable way, fix the environment in this order:

1. Add or improve an observable test oracle.
2. Add a deterministic script or CI guardrail.
3. Make the relevant code or runtime state directly inspectable.
4. Update the smallest owning semantic document.
5. Add an `AGENTS.md` instruction only when the rule cannot be encoded
   mechanically.

Review this harness after major SDK, runtime, packaging, or model changes.
Remove assumptions that no longer improve outcomes.
