# Audit of REVIEW_PLAN.md + SYNC_PERF_PLAN.md implementation — RESULTS

Audit of 16 commits `b2bb991..7cc3f53` (14 REVIEW_PLAN batches + 2 SYNC_PERF batches,
executed by Codex). Completed 2026-07-17. Method: four parallel deep audit tracks
(commit diffs vs plan batches, regression-test genuineness, new-bug review,
ARCHITECTURE.md rules, vocabulary) plus cross-cutting greps. Baseline re-verified:
typecheck clean, 270/270 tests, build gate (tree-shaking + export guards + consumer
fixtures) passes.

## Overall verdict

**High-quality implementation. Every batch of both plans is implemented; no plan item
was dropped.** Regression tests are overwhelmingly genuine (fail-before verified by
reading them against pre-fix code). The audit found **one new functional bug of
consequence, one perf regression, and two compile-breaking docs pages** — plus a tail
of minors/nits. Nothing requires reverting a commit; everything below is a targeted
follow-up.

Pre-checks (done earlier, unchanged): y-axis tick math is a genuine improvement (old
`toFixed` bug mangled 2.5-steps; micro-price clamp fixed); time-bucketing round/floor
asymmetry was intentional and preserved at every call site.

Cross-cutting: `dataScale`/`rightOffset`/`setVisibleIndexRange`/`applyThemeChrome`
fully gone; zero "chrome"/"extent"; test-indicator moved to `test/fixtures/`;
ARCHITECTURE.md updated for all five required deltas; icons **replaced** with
project-owned stroke SVGs (FA-suspect paths gone — legal item resolved by replacement).

## Findings — fix list (ranked)

### Major

1. **Cancelled drawing creation leaks phantom drawings to sync peers.**
   `drawing-manager.ts` `discardCreation` (~:872) + `chart-sync-plugin.ts` (~:272, :731).
   `updateCreationPreview` emits public `drawing-change` per frame; the sync plugin
   coalesces and broadcasts these and peers `upsertDrawing` unknown ids. Cancel paths
   (Escape, touch pointercancel, second-finger cancel, detach) remove the preview
   locally **without** `drawing-delete`, and the local pending buffer still flushes the
   last preview snapshot. Peers and module-global group state keep a phantom drawing.
   New desync (cancellation itself is new). Fix: suppress `drawing-change` emission
   while `interaction.type === "creating"` (announce only from `drawing-create` onward)
   — preferred; or emit a deletion signal from `discardCreation` when the preview was
   ever announced.
2. **Minute-tick generation perf regression on minute-bar datasets.**
   `time-ticks.ts` candidates (~:98-153) + `buildTicks` (no early abort). With the new
   `minute 1` candidate first in the ≤2-day bucket, a 1.5–2-day window of 1-minute bars
   formats ~3,800 Intl labels per generation, once per pan frame (frame cache misses
   while panning). Was ~48 pre-change. Fix: pass `targetTickCount` into `buildTicks`
   and abort a candidate once `ticks.length > targetTickCount`; and/or format labels
   only after a candidate is accepted.
3. **Two docs pages still import `DefaultDOMAdapter` from `/extensions` — no longer
   compiles** after contracts-only. `docs/reference/dom-adapter.md:5-6` and
   `docs/guide/design-system-adapter.md:71-79`. Fix: `DefaultDOMAdapter` from root,
   contract types from `/extensions` (mirror `scripts/consumer-fixtures/dom-adapter.ts`).

### Maintainer decisions — RESOLVED 2026-07-17 (baked into AUDIT_FIXES_PLAN.md)

#4 touch model **approved as implemented** (docs + device pass remain) · #5
`applyDrawingAnchors` **kept, fenced off** · #6 test-hook deletion **accepted** ·
#7 unplanned commit **acknowledged** · #8 candle bodies **revert to fill-only**.
Follow-up work now lives in `AUDIT_FIXES_PLAN.md` (batches F1–F6). Original items
kept below for reference:

4. **Touch gesture model was never surfaced (plan required it).** Implemented model:
   immediate single-touch dispatch — extension consumption arbitrates (consumed →
   drawing gesture with preventDefault; not consumed → pan as before); no long-press
   for drawings (500 ms long-press remains the crosshair toggle); a second finger
   cancels an in-flight gesture and pinch proceeds. **Approve or change.** Also
   outstanding: the plan-required manual pass on a real touch device; and zero
   touch-behavior documentation exists in the guides.
5. **`DrawingManager.applyDrawingAnchors()` was added as a public (`@internal`-tagged)
   method** — SYNC_PERF S2 said to fix invariants "not by widening the protocol".
   Decide: keep (then ensure it's excluded from public docs/export audit) or refactor
   the sync plugin to `drawing.setAnchors` + same-notification path.
6. **`getGroupSizeForTest` was deleted rather than moved to the spec**, dropping the
   direct group-membership-size assertions (now only indirectly covered). Confirm
   acceptable.
7. `19572fa` (base styles for custom themes) is an unplanned extra commit — audited
   clean, correct, tested, documented; acknowledge it existed outside the batch plan.
8. **Candle bodies are now fill+stroke** (were fill-only) after Path2D batching —
   bodies grow ~lineWidth; doji bodies gain a hairline. Same color so near-invisible,
   and it overlaps Batch 12's doji minimum-height work — confirm intended; if not,
   stroke only wick subpaths (hollow-candle already separates them).

### Minor

9. `suppressNextVisibleRangeChange` (sync plugin ~:171, :627) is a one-shot flag with
   no expiry — an arming path whose commit carries no visibleRange notification leaves
   it armed and it swallows the next genuine broadcast. Fix: compare incoming snapshot
   against the just-applied range, or clear the flag at end of the arming commit.
10. DPR regression test can't fail (`render-pipeline.spec.ts` "handles a real resize
    after a device-pixel-ratio change") — old flag code and new dedupe produce
    identical call counts for the tested sequence. Rework: DPR change → dispatch the
    changed-size entry first → assert handled.
11. Resize dedupe compares mixed box models (`offsetWidth/Height` snapshot vs RO
    `contentRect`) — with container padding/border they never match; one redundant
    resize pass after DPR change, worst-case a wrongly skipped real resize. Derive both
    from one box model.
12. Paneled-indicator vertical grid lines use the **unaligned** `label.x` pushed into
    `lastXGridCoords` while the main pane strokes aligned coords — indicator-pane
    lines stay blurry/0.5px off. Store aligned coords.
13. Upsert regression test can't fail for its target bug
    (`drawing-manager.spec.ts:1024`) — assert no stray `drawing-change`/
    `drawing-finished`/move-history after post-upsert drag instead.
14. Mouse vs touch `pointercancel` semantics diverge (mouse completes an in-flight
    creation, touch rolls back) and ARCHITECTURE.md claims unconditional rollback —
    align code or doc.
15. Flush-then-detach + frame-coalescing behavior of the sync plugin is undocumented
    (S1 required documenting the choice) — one sentence in docs/reference/plugins.md.
16. `ChartStateRestoredEvent` not exported from `/extensions` (payload of
    `state-restored`).
17. `projectTime` removed from public `/engine` controller context with no
    MIGRATION.md/CHANGELOG note — add a migration line for custom-controller authors.

### Nits (batch into one cleanup commit at will)

18. `addOhlcDataPoint`: duplicated consecutive `if (data.volume != null)` blocks.
19. `merge.ts`: `key in overrideValues` matches inherited props — `Object.hasOwn` safer.
20. Sync echo test asserts synchronously post-flush — add one `await nextAnimationFrame()`
    so a deferred echo could be caught; note one-frame-stale initial sync for mid-frame
    attachers.
21. First visible bar always gets a tick when scrolled to data start (boundary rule) —
    cosmetic, accepted.
22. Persistent calendar-parts cache is unbounded per formatter — accepted by plan; note
    for long streaming sessions.
23. Cached `canvasRect` goes stale on DOM shifts that fire neither resize nor scroll —
    plan-accepted residual; document nowhere → add a line to ARCHITECTURE.md interaction
    section if desired.
24. `initDrawing` writes `--fci-pane-border-color` via `style.setProperty` every frame —
    move to theme-change site or dedupe on value.
25. Kept-and-fixed no-pane `drawYAxis` branch still uses `theme.xAxis.font` as family;
    deadness question never recorded — delete the branch or note why it stays.
26. Internal `ChartModel` still says `visibleIndexRange` next to public "logical"
    naming — cosmetic.
27. `DrawingEvent`/`IndicatorEvent`/`IndicatorVisibilityChangedEvent` are module-private
    but referenced by public `ChartEventMap` — not nameable from any entry point
    (pre-existing).
28. Stale local `playground/dist` build artifact still contains old API names —
    gitignored, rebuild at will.

## What was verified good (no action)

- Batch 1 (dataScale removal), Batch 2 (scale hook), Batch 7 (all 9 API items,
  machine-checked export guards), Batch 8 (anchorCount protocol; bonus fixes for
  spurious click and preview leak on detach), Batch 10 (all 7 utils items), Batch 13
  (all 5), S1 echo-suppression/ordering/detach handled exactly per plan, S2 non-anchor
  change detection provably complete (`DrawingJSON` fully compared).
- Batch 6 chose the **root-cause** canvas→stage dependency flavor (documented in
  ARCHITECTURE.md rendering section) — the better option.
- Batch 12 implemented all three optional "consider X" items instead of skipping.
- Hoisted `refreshIndexBounds`: every caller audited, no broken mutation path.
- Path2D batching color/layering correct (modulo #8); gradient/memo/layout caches all
  have sound invalidation.

## Follow-up

Superseded by `AUDIT_FIXES_PLAN.md` (executor-ready batches F1–F6 with all decisions
baked in). Remaining maintainer-only item: real-device touch pass after F1 lands.
