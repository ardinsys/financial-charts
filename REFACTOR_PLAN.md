# financial-charts — v1.0 Remaining Work (batched for multi-agent execution)

The core architecture overhaul (index-based scales, data store, render pipeline,
panes, plugin lifecycle, drawing tools) is **already implemented and committed** on
`refactor/v1-architecture-overhaul`. This document covers only the **remaining
work before v1.0**, broken into **small, independently reviewable batches** — one
branch → one PR each, written to be handed to different agents.

> Read **§1 Shared context** and **§2 Working agreement** once. Then each agent
> only needs the single batch entry it is assigned.

Two streams plus release remain, run in order **N → U → Z**:
- **Stream N — public API naming migration.** The internal rename
  (`Extent`→`Scale`, `DataExtent`→`DataScaleModel`) was never carried through the
  *public* surface. Migrate the names — v1.0 is already breaking, so no aliases.
- **Stream U — framework integration.** Core keeps all **canvas** rendering and
  stays dependency-free. All **DOM chrome** moves behind a `ChartUIAdapter` seam
  with a default **web** adapter (current behavior), then first-party **Vue** and
  **React** packages in a pnpm **monorepo**. Svelte left adapter-ready as a
  follow-up.

---

## 1. Shared context (read once)

`@ardinsys/financial-charts` is a dependency-free, canvas-2D charting library.
`FinancialChart` (`src/chart/financial-chart.ts`) orchestrates the modules below;
per-type series drawing is delegated to `ChartController` subclasses.

**Module map (current):**

| Module | Responsibility |
|---|---|
| `src/data/` | `DataStore` — bar storage + index↔time binary search |
| `src/scales/` | `Scale`, index-based `TimeScale`, `PriceScale`, `DataScaleModel` |
| `src/scales/ticks/` | `PriceTickGenerator`, `TimeTickGenerator` (calendar ticks on real bars) |
| `src/render/` | `RenderPipeline` — ordered stages + `before/afterDraw`, rAF part-invalidation scheduler |
| `src/panes/` | `Pane` — N panes share one `TimeScale`, each owns a `PriceScale` + Y-axis |
| `src/plugin/` | `ChartPlugin`/`Drawable` lifecycle, `ChartContext`, registries, open `EventMap` |
| `src/drawings/` | `DrawingManager` + trendline / hline / rectangle / text |
| `src/indicators/` | `Indicator`/`PaneledIndicator` + `label-renderer.ts` (the current UI seam) |

**Locked decisions:** index-based X-axis only; breaking changes allowed (clean
v1.0 + migration guide); first-party **Vue + React** integration in a **monorepo**,
with a framework-agnostic **web adapter** retained as the default.

**Reuse, don't rebuild:** the rAF `requestRedraw` scheduler; the static registry
pattern `registerController`; `mergeThemes` (`src/chart/themes.ts`); `pixelRatio`
(`src/utils/screen.ts`); the existing `IndicatorLabelRenderer`
(`src/indicators/label-renderer.ts`) as the seed of the UI adapter.

**⚠️ Hot file:** `src/chart/financial-chart.ts` is edited by N1, N2, U1, U2.
Those batches are **serialized** (see §3) and must rebase before starting. New
packages / new files (U3–U6) are truly parallel where marked.

---

## 2. Working agreement (all agents)

- **One batch = one branch = one PR.** Branch `refactor/<batch-id>-<slug>`.
- **Gates before opening a PR:** `pnpm build` (`pnpm -r build` once the monorepo
  lands) green; `pnpm test` green; no new `// @ts-ignore` without a justifying
  comment; `tsc` strict clean.
- **Diff target:** < ~400 lines of meaningful change; split if larger and say so.
- **Public API changes** go into `MIGRATION.md` (already exists) + a "BREAKING"
  section in the PR body.
- **Stay in scope.** Each batch lists "Out of scope"; file follow-ups instead of
  drive-by changes.
- **Don't edit the hot file in parallel** — confirm no sibling batch in the same
  wave touches `financial-chart.ts`.
- **Framework packages** carry their own build + typecheck + a basic mount/unmount
  test; their framework dep is a **peerDependency**, never a core dependency.
- **Build tooling:** every publishable package is bundled with **tsdown** (ESM +
  CJS + `.d.ts`), replacing the current `vite build && tsc` in core. **vite** is
  used only for the dev **playgrounds/examples**, not for producing package output.

Per-batch format: **Depends on · Parallel-safe with · Goal · Changes ·
Out of scope · Acceptance · Size (S≈<150, M≈150-400, L≈400+ lines)**.

---

## 3. Dependency graph & dispatch waves

```
Wave 1 (sequential, hot file):   N1 → N2
Wave 2 (sequential, hot file):   U1 → U2                 (depend on N)
Wave 3 (infra):                  U3  monorepo split      (depends U2)
Wave 4 (2 parallel packages):    U4 (vue) ∥ U5 (react)   (depend U3)
Wave 5:                          U6  integration docs    (depends U4, U5)
Wave 6 (release):                Z1 → Z2                 (depends N2, U6)
```

Legend: `A → B` = B depends on A; `∥` = safe to run concurrently.

---

## 4. Batches

### Stream N — Public API naming migration

#### N1 — Rename `extent` → `scale` across the public API
- **Depends on:** —  · **Parallel-safe with:** — (hot file; do first)
- **Goal:** public vocabulary matches the internal model; no `extent` leftovers.
- **Changes:** `FinancialChart.getVisibleExtent()`→`getVisibleScale()` and public
  `recalculateVisibleExtent()`→`recalculateVisibleScale()`
  (`financial-chart.ts:222,2036`); `PaneledIndicator.createExtent()`→`createScale()`
  and `.extent`→`.scale` (`paneled-indicator.ts:28-190`); `Pane.extent`→`.scale`
  (`pane.ts:27,108-135`); `TestIndicator.createExtent()`→`createScale()`; update
  the plugin duck-type discriminator `createExtent`→`createScale`
  (`financial-chart.ts:554,562`). Fix all call sites; update the `MIGRATION.md`
  rename table.
- **Out of scope:** zoom/pan vocabulary (N2); behavior change.
- **Acceptance:** `grep -ri "xtent" src` returns nothing outside comments/migration
  notes; build/tests green; MIGRATION.md updated.
- **Size:** M

#### N2 — Migrate remaining legacy shims (zoom/pan vocabulary + audit)
- **Depends on:** N1  · **Parallel-safe with:** — (hot file)
- **Goal:** retire names that describe the old continuous-time / zoom-pan model.
- **Changes:** list the remaining shims in the PR body, chiefly
  `getZoomLevel()`/`getPanOffset()` (`financial-chart.ts:238,242`) — now derived
  over the index-range model → replace with `getVisibleLogicalRange()` /
  `getVisibleIndexRange()` returning `{ from, to, rightOffset }` (keep a real zoom
  API only if it maps to something meaningful). Audit `src/index.ts` exports for
  other internally-renamed-but-publicly-old names and align them. Update
  `App.vue`/docs call sites and `MIGRATION.md`.
- **Out of scope:** new capabilities; behavior change.
- **Acceptance:** public vocabulary consistent with the index-based model;
  build/tests green.
- **Size:** M

### Stream U — Framework integration

#### U1 — `ChartUIAdapter` seam + web adapter (indicator labels)
- **Depends on:** N2  · **Parallel-safe with:** — (hot file)
- **Goal:** introduce the UI-adapter abstraction with zero visible change.
- **Changes:** define `src/ui/chart-ui-adapter.ts` — a `ChartUIAdapter` interface.
  **Contract decided against the real indicator ecosystem** (`commons-js`
  `financial-charts-indicators`: SMA/Bollinger/RSI/MACD/orders/support-resistance):
  those indicators author labels as **HTML templates + imperative
  `updateLabel()` writing into `this.labelContainer.querySelector("[data-id=…]")`**,
  with rich per-color multi-segment content and even custom template sub-nodes
  (MACD). So **do NOT convert label content to a data model** — keep the
  `labelContainer`/`updateLabel`/`labelTemplate`/`data-id` contract intact. The
  adapter abstracts only the generic chrome currently hardcoded in
  `Indicator.setChart`: creating the label host, wiring show/hide/settings/remove,
  localized titles, visibility toggling, cleanup —
  `createIndicatorLabel(descriptor, actions) → { root, setActionTitles, setVisible,
  destroy }` where `root` becomes `indicator.labelContainer`. Provide `WebUIAdapter`
  reproducing today's HTML-string + `data-id`/button wiring **verbatim** (the
  default, keeps core dependency-free). Add `uiAdapter?` to `ChartOptions`
  (resolved once in the constructor, kept out of the deep theme merge) and expose
  it via `ChartContext.ui`. Refactor `indicator.ts` to delegate host/button wiring
  to the adapter; subclass-facing API (`labelContainer`, `updateLabel`,
  `renderLabel`) is unchanged.
- **Out of scope:** non-label chrome / composition (U2); framework packages;
  any change to the indicator content API (would break `commons-js`).
- **Acceptance:** with the default `WebUIAdapter`, labels/actions render and behave
  identically; button/host DOM creation removed from `indicator.ts` (confined to
  the adapter); `this.labelContainer` still a live element indicators can query;
  build/tests green.
- **Size:** L (split candidate: adapter interface + WebUIAdapter; then migrate the
  base `Indicator`).

#### U2 — Move remaining core chrome + composition hooks to the adapter
- **Depends on:** U1  · **Parallel-safe with:** —
- **Goal:** core owns only canvases; all chrome + composition goes through the adapter.
- **Changes:** route the root wrapper/container chrome the constructor builds
  (`financial-chart.ts`) through the adapter; define composition **regions/hooks**
  the adapter can populate — drawing toolbar, legend/OHLC controls, settings
  trigger (the pieces `App.vue` hand-rolls today). Confine
  `grep createElement|innerHTML` in core to `WebUIAdapter`.
- **Out of scope:** framework packages (U4/U5).
- **Acceptance:** chart still works with zero framework deps via `WebUIAdapter`;
  no direct DOM-chrome creation left in core outside the adapter; build/tests green.
- **Size:** M

#### U3 — Monorepo restructure (pnpm workspace)
- **Depends on:** U2  · **Parallel-safe with:** —
- **Goal:** real workspace so framework adapters ship as their own packages.
- **Changes:** move core into `packages/core` (published name
  `@ardinsys/financial-charts`); scaffold `packages/vue` + `packages/react` with
  peerDeps; add root `pnpm-workspace.yaml` globs, shared `tsconfig.base.json`.
  **Bundle every package with tsdown** (ESM + CJS + `.d.ts`) — migrate core off
  `vite build && tsc`. Add a `playground/` (or `examples/`) app per framework
  built with **vite** for local dev. Relocate docs/CI; keep root `pnpm -r build` /
  `pnpm -r test` green. No source behavior change.
- **Out of scope:** implementing the framework adapters (U4/U5).
- **Acceptance:** `pnpm -r build` + `pnpm -r test` green; core publishes an
  identical public API from its new location; CI updated.
- **Size:** L (infra)

#### U4 — Vue package (`@ardinsys/financial-charts-vue`)
- **Depends on:** U3  · **Parallel-safe with:** U5 (separate package)
- **Goal:** first-party Vue integration for all chrome.
- **Changes:** `VueUIAdapter` implementing `ChartUIAdapter` by rendering Vue
  components (teleport/render-to-region) for indicator labels + composition; a
  `<FinancialChart>` component + `useFinancialChart` composable wrapping
  construct/lifecycle/dispose; components for indicator label, drawing toolbar,
  settings slot. Thin over the shared headless binding. Vue as **peerDependency**.
- **Out of scope:** React (U5).
- **Acceptance:** a Vue example renders the chart with framework-native
  labels/toolbar (replacing the hand-rolled `App.vue` chrome); package builds +
  typechecks; basic mount/unmount test.
- **Size:** L

#### U5 — React package (`@ardinsys/financial-charts-react`)
- **Depends on:** U3  · **Parallel-safe with:** U4 (separate package)
- **Goal:** first-party React integration mirroring U4.
- **Changes:** `ReactUIAdapter` + `<FinancialChart>` component + `useFinancialChart`
  hook + label/toolbar/settings components. React as **peerDependency**.
- **Acceptance:** a React example renders with framework-native chrome; package
  builds + typechecks; basic mount/unmount test.
- **Size:** L

#### U6 — Integration docs
- **Depends on:** U4, U5  · **Parallel-safe with:** —
- **Goal:** document the three integration paths (web / Vue / React).
- **Changes:** fill in `docs/integrations/vue.md` + `react.md` (currently stubs);
  update `overview.md`; note in `svelte.md` that the adapter is ready and a Svelte
  package is a follow-up; refresh quick-start for the monorepo package names.
- **Acceptance:** `pnpm docs:build` green; each integration doc has a working example.
- **Size:** M

### Stream Z — Release

#### Z1 — Migration guide + reference docs
- **Depends on:** N2, U6
- **Goal:** consumers can upgrade 0.9 → 1.0 across core + framework packages.
- **Changes:** finalize `MIGRATION.md` (index-range replacing zoom/pan; the N
  naming renames; the `ChartUIAdapter` seam; new monorepo package names); update
  `docs/reference/*` + guides.
- **Acceptance:** guide covers every breaking change incl. naming + packaging;
  docs build.
- **Size:** M

#### Z2 — v1.0 release prep (multi-package)
- **Depends on:** Z1
- **Goal:** cut v1.0 for core + vue + react.
- **Changes:** aligned version bump across packages, changelogs, verify each
  package's `dist` types export its public API; publish order core → vue/react.
- **Acceptance:** clean `pnpm -r build`; published types include
  scales/plugin/drawings/adapter; framework packages resolve core as a dependency.
- **Size:** M

---

## 5. Verification
- **Naming (N):** `grep -ri "xtent" src` clean; a consumer using only the public
  API compiles against the new names; MIGRATION.md rename table complete.
- **Web adapter (U1/U2):** chart renders identically with zero framework deps;
  add/remove indicators repeatedly → no leaked listeners; no direct DOM-chrome
  creation in core outside `WebUIAdapter`.
- **Framework packages (U4/U5):** Vue and React examples render the chart with
  framework-native chrome; mount → interact → unmount leaves no orphaned
  listeners/DOM; core stays free of vue/react in its dependency tree.
- **Regression:** daily dataset spanning weekends + a holiday → contiguous bars,
  no blank gaps, crosshair on real bars (guards the index-based scale).
- Keep `pnpm -r build` green throughout; use the `run`/`verify` skills for visual
  and interaction checks.
