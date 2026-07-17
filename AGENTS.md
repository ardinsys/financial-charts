# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository layout

pnpm workspace (`pnpm@10`, Node version from `.node-version` via fnm).

- `packages/core` — the published library `@ardinsys/financial-charts`. Canvas-based financial charting engine, framework agnostic, zero runtime dependencies.
- `packages/react`, `packages/vue` — first-class adapters (`-react`, `-vue` package suffixes) with a peer dependency on core.
- `apps/playground` — Vite + Vue sandbox for local development (`pnpm dev`).
- `apps/docs` — VitePress documentation site.
- `apps/showcase` — Nuxt marketing site. Depends on built package output, so workspace showcase scripts run `pnpm build` first.

## Commands

```bash
pnpm install                 # install workspace
pnpm build                   # build all packages (tsdown + package verification)
pnpm test                    # run all package tests (vitest)
pnpm typecheck               # tsc --noEmit across packages
pnpm format                  # oxfmt (config in .oxfmtrc.json)
pnpm dev                     # playground app
pnpm docs:dev                # docs site
pnpm showcase                # builds packages, then Nuxt showcase dev server
```

Single package / single test:

```bash
pnpm --filter @ardinsys/financial-charts test                 # core tests only
pnpm --filter @ardinsys/financial-charts exec vitest run test/chart-model.spec.ts
pnpm --filter @ardinsys/financial-charts exec vitest run -t "test name"
```

Tests live in `packages/*/test/*.spec.ts`, run in jsdom, and share `packages/core/test/chart-test-harness.ts`. CI (`.github/workflows/regression.yml`) runs build, typecheck, and tests on every push.

`pnpm build` in each package also runs `verify:package`: export-map verification, consumer TypeScript fixtures, and (core only) a tree-shaking check. If you change core's public exports or `package.json` `exports`, expect these to catch mismatches.

## Core architecture

Read `ARCHITECTURE.md` before changing core chart state, extension lifecycle, panes, interaction, or rendering — it defines module ownership and contracts, including a table mapping each area to its owning class and traces for common flows (data updates, pan/zoom, crosshair, render, restore, dispose). Highlights:

- Every public command flows through one pipeline: validate → mutate owned state → derive scales/panes/crosshair → notify extensions and listeners → invalidate render layers → render (coalesced per animation frame).
- `FinancialChart` is a facade and coordinator only; subsystem state lives in dedicated owners (`ChartModel`, `ChartOptionsState`, `ExtensionHost`, `PaneLayout`, `InteractionController`, `ChartRenderer`, `ChartStateController`, `ChartDOMAdapter`).
- Capability surfaces keep audiences at their boundary: application code gets `FinancialChart`; series controllers get `ChartControllerContext`; plugins/drawings get `ChartContext`; indicators get `IndicatorContext`. Never leak canvases, scales, or raw panes to application code.
- The X axis is **index based**: stored timestamps identify real bars, the visible range uses fractional bar indices, and `TimeScale` converts between logical positions, timestamps, and pixels. This is what removes weekend/holiday gaps.
- `ChartModel` keeps two stores: source (validated caller input at original timestamps) and mapped (bucketed/merged by `stepSize`), so a `stepSize` change can remap without data loss.
- Ownership rules: caller input is copied once at the boundary, every mutable value has one owner, and snapshots are cached until the owning state changes.

Entry points in `packages/core/src`: `index.ts` (all controllers registered), `core.ts` (tree-shakeable chart without controllers), `controllers/*` (individual controllers), `extensions.ts`, `engine.ts`. These map 1:1 to `package.json` export subpaths.

## Conventions

- Commit messages: `type(scope): summary` matching `^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip)(\(.+\))?: .{1,50}` (see CONTRIBUTING.md).
- No direct pushes to `main`; branch names like `feat/ticket/short_summary`, `fix/ticket/short_summary`.
- Terminology: use "overlay" for the DOM layer above the canvas (as in `ChartDOMAdapter` / "Overlay DOM"), not "chrome".
- `MIGRATION.md` documents the 0.9 → 1.0 breaking changes; keep it updated when changing public contracts.
