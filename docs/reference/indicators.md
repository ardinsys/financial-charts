# Indicators

Indicators can be drawn either on top of the main price chart (overlay indicators) or inside dedicated panes stacked underneath (paneled indicators). Indicators implement the `ChartPlugin` lifecycle, so attachment, data updates, redraws, pointer-aware crosshair updates, and cleanup all flow through the same plugin contract.

## Base indicator API

```ts
import {
  Indicator,
  type DefaultIndicatorOptions
} from "@ardinsys/financial-charts/extensions";

abstract class MyIndicator extends Indicator<MyTheme, MyOptions> {
  static readonly ID = "my-indicator";

  public getDefaultOptions(): MyOptions {
    /* ... */
  }
  public getDefaultThemes(): Record<string, MyTheme> {
    /* ... */
  }
  public draw(): void {
    const { ctx, data, projectPoint } = this.getDrawingContext();
    /* render using ctx + projection helpers */
  }
  protected getLabelContent(dataTime?: number): IndicatorLabelContent {
    /* return detail/value segments for the label */
  }
}
```

### DefaultIndicatorOptions

Every indicator merges its supplied options with these defaults:

| Field      | Description                                                                |
| ---------- | -------------------------------------------------------------------------- |
| `labelKey` | Required stable label kind used by adapters and application UI.            |
| `names`    | Localized display names keyed by locale (`default` is used as a fallback). |

Chart data, visible data, ranges, options, and projection inputs supplied to an
indicator are borrowed readonly values. They may retain the same identity
across repeated reads and render calls. Do not mutate them; cache derived state
in the indicator and replace that state when its source changes. Use `toJSON()`
or an explicit application copy when an independent historical value is
required.

### Type, instance, and label identity

Indicator identity has three separate parts:

- The class's static `ID` is the stable type identifier used by factories and
  synchronization. Every indicator hierarchy must define it; subclasses may
  inherit the same type ID or override it when they represent a distinct type.
- `getInstanceId()` identifies one configured instance. The base generates an
  ID unless the constructor receives `{ instanceId }`, which is useful when
  restoring persisted state.
- `getLabelKey()` identifies the label kind and comes from `labelKey`. Multiple
  instances of one type normally share it.

Use `chart.getIndicatorById(instanceId)` for one instance and
`chart.getIndicatorsByType(typeId)` for every instance of a type. A chart
rejects duplicate instance IDs.

If a custom indicator declares its own constructor, accept
`IndicatorOptionsInput<MyOptions>` for the options argument and forward it to
`super(...)` so callers can supply `instanceId`.

### Serializable state

`toJSON()` returns an independent, versioned, JSON-safe `IndicatorState`
containing the type ID, instance ID, configurable options, and visibility. The
default option serializer excludes `names` and `labelKey`; themes, DOM state,
computed data, and other instance fields are not part of the snapshot.

Restore through an application-owned resolver. The resolver supplies the class
and any runtime dependencies; the library applies options, identity, and
visibility after checking the state:

```ts
import {
  MovingAverageIndicator,
  restoreIndicator
} from "@ardinsys/financial-charts";

const stored = JSON.stringify(indicator.toJSON());
const restored = restoreIndicator(JSON.parse(stored), ({ typeId }) => {
  if (typeId === MovingAverageIndicator.ID) {
    return new MovingAverageIndicator();
  }
});
```

There is no global indicator registry. Missing or malformed fields,
non-JSON-safe option values, unsupported versions, unknown types, and resolver
type mismatches throw descriptive errors.

Indicators with non-JSON option values or a custom serialized shape can
override the paired hooks:

```ts
import type { IndicatorStateOptions } from "@ardinsys/financial-charts/extensions";

protected serializeStateOptions(): Record<string, unknown> {
  return { symbol: this.options.symbol };
}

protected restoreStateOptions(options: IndicatorStateOptions): void {
  if (typeof options.symbol !== "string") {
    throw new Error("Indicator state requires a symbol.");
  }
  this.options = { ...this.options, symbol: options.symbol };
}
```

Functions and service objects should remain constructor dependencies or be
excluded by these hooks. The serializer rejects unsupported values rather than
silently dropping them.

The base class builds an `IndicatorLabelModel` from these options, the current label content, visibility, and localized action titles. The chart hands that model to the active `ChartDOMAdapter`.

The default adapter renders and wires:

- Show/hide toggles (`data-id="show"` / `"hide"`).
- Settings button (`indicator-settings-open` event).
- Remove button (`indicator-remove` event).

### Lifecycle hooks

- `attach(ctx)` is inherited from `Indicator`; the base class stores the focused
  `IndicatorContext` and creates the adapter-rendered label.
- Initial state is delivered after attachment in a fixed order:
  `onOptionsChanged(event)`, `onData(data)`, then
  `onVisibleRangeChanged(range)`. The initial options event has identical
  `previous`/`current` snapshots and an empty `changedKeys` array.
- `onData(data)` receives borrowed readonly mapped chart data. Cache derived
  indicator data here when recomputation should happen once per chart data
  update rather than once per render.
- `onPointer(event)` receives pointer events in visual stacking order; return `true` to stop delivery to lower extensions and consume the gesture.
- `onDrawingFinished(event)` receives completed drawing create and move operations.
- `draw()` runs on each indicator render pass. Call `getDrawingContext()` to
  access the indicator canvas, data, visible data, visible range,
  formatter/theme, and `projectTime` / `projectPrice` / `projectPoint` helpers
  without wiring canvas or scale plumbing yourself.
- `getLabelContent(dataTime?)` is invoked when the label is created or refreshed,
  including option, visibility, theme, locale, crosshair, and explicit
  invalidation updates. Return label detail text and optional value segments;
  do not mutate label DOM.
- `getModifier(visibleTimeRange)` lets you modify the price range. Return a `ScaleRangeModifier` when the indicator should influence automatic scaling (for example, Bollinger Bands).
- `invalidate(options?)` is the protected update path for indicator-owned external state. It is safe before attachment and after detachment. Labels, indicator drawing, and crosshair drawing are invalidated by default; pass `{ scale: true }` when `getModifier()` may have changed.
- `updateOptions(partial, { emit? })` merges new options, redraws affected chart
  layers, refreshes the label, and emits `indicator-change` by default. Use this
  method rather than mutating the value returned by `getOptions()`.
- `clone()` creates another indicator with the same themes, options, and visibility but a new instance ID. `copyFrom()` copies configurable state without changing the target's identity. Override `clone()` if your custom indicator has constructor dependencies beyond the standard `(themes, options)` shape.
- `indicatorContext.signal` is aborted before `detach()`. Subscriptions created
  with `indicatorContext.on()` and `indicatorContext.onRenderStage()` are also removed
  automatically. Chart-owned annotations and label cleanup always run, so an
  override does not call `super.detach()` merely to preserve base cleanup.

The base re-resolves `this.theme` and rebuilds the label before delivering a
theme change to `onOptionsChanged`. Changes to `timeRange` and `stepSize` are
included in that hook's `changedKeys`, allowing external-data indicators to
refetch against the current timeframe.

Non-pointer lifecycle delivery runs through overlay indicators, paneled
indicators, and ordinary plugins in attachment order. Pointer delivery reverses
visual stacking, starting with the last attached ordinary plugin. Extensions
removed during a callback are skipped for the rest of that notification pass.
Indicators are drawn only by the indicator render pass, not a second time as
ordinary plugins.

External services belong in constructor fields, not serializable options. Use
the application resolver to reinject them during state restoration, and
override `clone()` when the constructor does not have the standard
`(themes, options)` shape.

### Label model and DOM adapter

Indicators do not author DOM. Return label content from `getLabelContent()` and let the adapter render it:

```ts
protected getLabelContent(dataTime?: number): IndicatorLabelContent {
  return {
    detail: "20 close",
    segments: dataTime
      ? [{
          text: this.indicatorContext.getOptions().formatter.formatPrice(12.34),
          color: "#2962FF"
        }]
      : []
  };
}
```

`IndicatorLabelModel` exposes `instanceId`, `typeId`, and `labelKey` separately.
`DefaultDOMAdapter` renders the model with stable `fci-*` CSS classes,
`data-id` hooks, and `data-indicator-instance-id`, `data-indicator-type`, and
`data-indicator-label-key` identity hooks. Pass a custom `domAdapter` in
`ChartOptions` to render labels/actions through app-owned DOM or framework
components. See [Design-system adapter](/guide/design-system-adapter).

## Paneled indicators

`PaneledIndicator` extends `Indicator` and supplies its own container plus two canvases (main pane and Y axis). The chart creates a `Pane` for each paneled indicator and passes it in `InitParams`. Implement the following methods:

```ts
abstract class MyPaneledIndicator extends PaneledIndicator<MyTheme, MyOptions> {
  static readonly ID = "my-paneled-indicator";

  public createScale(): DataScaleModel {
    /* setup scale model */
  }
  protected drawPane(ctx: PaneledIndicatorDrawingContext): void {
    /* draw only pane content; background/grid/Y axis are handled by the base */
  }
  protected getLabelContent(): IndicatorLabelContent {
    /* return detail/value segments for the label */
  }
  public getCrosshairValue(time: number, relativeY: number): string {
    return "..."; // displayed next to the crosshair when hovering the panel
  }
}
```

- `init(params)` and `resize(params)` are handled by the chart.
- `draw()` is implemented by the base class. It clears the panel, paints the background, draws shared grid lines, syncs the pane price scale, draws the Y axis, and then calls `drawPane(context)` when the indicator is visible.
- `drawPane(context)` receives the pane canvas context, axis context, pane,
  indicator scale, dimensions, data, visible data, visible range,
  formatter/theme, and projection helpers.
- Implement `drawPane(context)` rather than overriding `draw()`, so pane
  background, grid, Y-axis, visibility, and scale synchronization remain owned
  by the base class.

## Indicator events

The base class emits events when users interact with the label, and the chart
emits add/remove/change events for programmatic updates:

| Event                          | Description                                |
| ------------------------------ | ------------------------------------------ |
| `indicator-add`                | Fired after an indicator is added.         |
| `indicator-change`             | Fired after `updateOptions()`.             |
| `indicator-visibility-changed` | Fired after show/hide buttons are toggled. |
| `indicator-settings-open`      | Fired when the settings button is pressed. |
| `indicator-remove`             | Fired after an indicator is removed.       |

Listen to these events via `chart.on(...)` to open modals, persist state, or synchronize UI.
Every indicator event includes `{ indicator }`; the visibility event also
includes `visible`. Read instance, type, and label identity from the indicator.

## Example

```ts
import { MovingAverageIndicator } from "@ardinsys/financial-charts";

const sma = new MovingAverageIndicator(null, {
  instanceId: "primary-sma",
  period: 20,
  source: "close"
});

chart.addIndicator(sma);
```

For more involved use cases, see [Custom indicators](/guide/custom-indicators) or inspect `src/indicators/simple/moving-average.ts` in the repository. It shows how to cache computed values, honor locales, and render on the shared indicator canvas.
