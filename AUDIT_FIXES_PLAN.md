# Audit follow-up fix plan

Executor-ready plan resolving the findings in `REVIEW_AUDIT.md` (audit of the
REVIEW_PLAN.md + SYNC_PERF_PLAN.md implementation). All maintainer decisions are made
and baked in — **do not re-litigate**:

- Touch gesture model **approved as implemented** (immediate single-touch dispatch;
  no long-press-to-draw; second finger cancels into pinch). Follow-up is docs only.
- `DrawingManager.applyDrawingAnchors()` **stays, fenced off** (excluded from public
  docs, guarded against accidental documentation).
- Candle bodies **revert to fill-only** (stroke wicks only).
- Deleted `getGroupSizeForTest` hook: indirect coverage **accepted** — no action.
- Unplanned commit `19572fa`: acknowledged clean — no action.

**Ground rules: identical to REVIEW_PLAN.md** ("Ground rules for the executor": read
ARCHITECTURE.md ownership/snapshot rules first; one batch = one commit, single-line
conventional message; no push; stop for maintainer review after each batch; every
correctness fix adds a regression test that fails before and passes after; typecheck +
full suite green per batch; vocabulary: overlay/scale/logical; line numbers indicative,
file + symbol authoritative).

Finding numbers (#N) refer to REVIEW_AUDIT.md.

---

## Batch F1 — `fix: clean up cancelled drawing previews everywhere` (#1, #13)

**Constraint (maintainer decision, final): live preview on synced peers during
creation MUST be preserved.** Do NOT suppress `drawing-change` during creation —
per-frame preview events keep flowing to the sync plugin and peers exactly as today.
The fix is on the cancellation side:

1. **`discardCreation` must emit a deletion for an announced preview.** In
   `DrawingManager` (~drawing-manager.ts:872), track whether the in-flight creation
   preview has been publicly announced (it is, from its first `drawing-change`). Every
   cancel path (Escape, touch `pointercancel`, second-finger cancel, `detach`) must
   then emit the same public deletion event the normal remove path emits — without
   recording a history entry — so listeners are symmetric: anything that saw the
   preview sees its removal.
2. **Verify the sync plugin's existing delete handling closes the loop end-to-end**:
   the S1 ordering rule ("an immediate delete drops that drawing's pending
   `drawing-change` entry, then flushes the rest") must fire for this deletion so the
   local pending buffer can't resurrect the preview on the next flush frame, peers
   remove the drawing, and the module-global group stored state drops it (late
   joiners must not rehydrate a phantom). If any of those three don't happen through
   the existing path, fix in the plugin's deletion handler — not by special-casing
   previews.
3. Strengthen the upsert regression test (#13, drawing-manager.spec.ts ~:1024): after
   upserting the actively-dragged drawing, continue the drag and assert **no**
   `drawing-change`/`drawing-finished` events fire for the detached instance and no
   `"move"` history entry is recorded (`canUndo()` unchanged) — the current test
   passes even without the fix.

**Verify:** new tests — peer shows the drawing DURING creation (live preview
regression guard: assert the peer has the drawing before completion); cancelled
creation removes it from the peer, leaves no pending flush entry (advance
`nextAnimationFrame` after cancel and assert no resurrection), and a chart attaching
after the cancel does not rehydrate it; cancel leaves no history entry (`canUndo()`
false); completed creation unchanged; reworked upsert test fails against the pre-fix
behavior (temporarily revert to confirm).

## Batch F2 — `perf: abort oversized tick candidates early` (#2)

1. In `TimeTickGenerator` (src/scales/ticks/time-ticks.ts), pass the acceptance
   threshold into `buildTicks` and **abort a candidate as soon as
   `ticks.length` exceeds it** — the current code builds and formats a label for every
   visible bar before rejecting (a 2-day window of 1-minute bars ≈ 3,800 Intl
   `formatToParts` calls per generation, every pan frame; was ~48 pre-minute-kind).
2. Additionally (or alternatively if simpler): don't format label strings while
   *evaluating* candidates — format only after a candidate is accepted. Either
   mechanism is fine; the bound must hold regardless of candidate order.
3. Do not change which candidate wins: for every window size the selected step and the
   final labels must be identical to current behavior (only wasted work is removed).

**Verify:** regression test — spy the calendar-parts/format path on a 1.5–2-day window
of 1-minute bars and assert the total format calls are O(targetTickCount), not O(bars)
(fails today); existing time-ticks suite green and label snapshots unchanged for the
10/30/90-minute and day/hour windows.

## Batch F3 — `fix: harden sync suppression and resize dedupe` (#9, #10, #11, #12)

1. **#9** `suppressNextVisibleRangeChange` (chart-sync-plugin.ts ~:171, :627): replace
   the blind one-shot flag with a comparison of the incoming snapshot against the
   just-applied range (clear on match OR at the end of the commit that armed it). The
   bug: an arming path whose commit carries no visibleRange notification leaves the
   flag armed and it swallows the user's next genuine broadcast.
2. **#11** Resize dedupe (chart-renderer.ts `getObservedSize` ~:739 vs RO callback
   ~:158): both sides must compare the same box model — the DPR path snapshots
   `offsetWidth/Height` (border-box) while the RO path stores `contentRect`
   (content-box), so with container padding they never match. Derive both from one
   source.
3. **#10** Rework the DPR regression test (render-pipeline.spec.ts "handles a real
   resize after a device-pixel-ratio change") so it fails under the old one-shot-flag
   code: after the DPR change, dispatch the **changed-size** observer entry first and
   assert it is handled (the old code swallowed exactly that).
4. **#12** Store **aligned** x coordinates in `lastXGridCoords` (chart-renderer.ts
   ~:440 pushes unaligned `label.x` while the main pane strokes aligned) — or align at
   the paneled-indicator consumption site — so indicator-pane vertical grid lines are
   crisp and colinear with the main pane's.

**Verify:** regression tests for 1 (arm-without-notify then genuine broadcast goes
through), 3 (per above), 4 (paneled grid x equals main-pane aligned x); item 2 via the
reworked test in 3 plus a padded-container case if cheap.

## Batch F4 — `fix: restore fill-only candle bodies` (decision on #8)

1. In `CandlestickController` (src/controllers/candle-controller.ts), split body and
   wick into separate `Path2D`s per direction (the pattern hollow-candle already
   uses): **fill bodies only, stroke wicks only** — restoring the pre-refactor look
   where bodies were fill-only. Keep the two-path-per-frame batching (the perf win).
2. Confirm the Batch-12 doji minimum-height logic still produces a visible (≥1px)
   *filled* body without the stroke hairline that currently masks it.

**Verify:** test asserting body path receives `fill` and never `stroke`, wick path
`stroke` only (canvas-mock call inspection); doji test still renders a ≥1px body;
playground visual pass.

## Batch F5 — `docs: close audit documentation gaps` (#3, #4-docs, #5-fence, #14, #15, #16, #17)

1. **#3** Fix the two compile-broken examples: `docs/reference/dom-adapter.md:5-6` and
   `docs/guide/design-system-adapter.md:71-79` — `DefaultDOMAdapter` imports from the
   **root** entry, contract types from `/extensions` (mirror
   `scripts/consumer-fixtures/dom-adapter.ts`).
2. **#4** Document the approved touch gesture model in docs/guide/drawing-tools.md (+
   a line in docs/reference/drawings.md): single-touch dispatches to drawings —
   consumed → draw, else pan; long-press remains the crosshair toggle; second finger
   cancels the drawing gesture and pinch proceeds.
3. **#5** Fence `applyDrawingAnchors`: ensure it appears in no docs page, and extend
   `scripts/verify-package-exports.mjs`'s forbidden/documentation checks so it cannot
   be documented or re-exported accidentally. Keep the `@internal` tag.
4. **#14** Align ARCHITECTURE.md with actual cancel semantics: touch `pointercancel`
   rolls the preview back; mouse `pointercancel`/`lostpointercapture` completes an
   in-flight creation. Document the per-pointer-type difference (code stays as-is —
   the Batch 3 test asserts mouse behavior).
5. **#15** One sentence in docs/reference/plugins.md (sync section): range and drawing
   sync are coalesced to one flush per animation frame; a detaching chart flushes its
   pending state before leaving the group.
6. **#16** Export `ChartStateRestoredEvent` from `src/extensions.ts`.
7. **#17** MIGRATION.md: add a note that `projectTime` was removed from the `/engine`
   controller drawing context — custom controllers use `projectIndex(startIndex + i)`;
   include the one-line replacement recipe.

**Verify:** build gate green (consumer fixtures + verify-package-exports with the new
fence); grep proves `applyDrawingAnchors` absent from docs; the two fixed examples
compile (extend the consumer fixtures if they don't already cover the dom-adapter
import split — they do, so just keep them green).

## Batch F6 (optional) — `chore: audit nit sweep` (#18–#28, selective)

Take what's cheap, skip freely; no regression-test requirement except where noted:

- #18 fold the duplicated `if (data.volume != null)` blocks in `addOhlcDataPoint`.
- #19 `merge.ts`: `Object.hasOwn` instead of `key in`.
- #20 add `await nextAnimationFrame()` before the sync echo-test assertions; note the
  one-frame-stale initial sync for mid-frame attachers in plugins.md.
- #24 dedupe the per-frame `--fci-pane-border-color` `style.setProperty` (write only
  on value change).
- #25 no-pane `drawYAxis` branch: delete it if genuinely unreachable (record the
  determination in the commit); otherwise fix the remaining `theme.xAxis.font` family
  read.
- #26 rename internal `visibleIndexRange` → `visibleLogicalRange` in ChartModel
  (internal-only, mechanical).
- #27 export the `DrawingEvent`/`IndicatorEvent`/`IndicatorVisibilityChangedEvent`
  payload interfaces from event-emitter.ts (nameable event payloads).
- #28 nothing to do in-repo (stale local playground/dist — gitignored).

---

## Outside executor scope (maintainer checklist)

- **Real-device touch pass** (plan Batch 9 acceptance, still outstanding): create,
  drag, cancel-by-second-finger (verify the peer cleanup from F1), pinch-zoom,
  long-press crosshair on an actual touch device after F1 lands.
- Optional: rebuild `playground/dist` locally to clear stale old-API artifacts.
