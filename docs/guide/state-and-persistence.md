# State and persistence

`FinancialChart.toJSON()` produces one versioned, JSON-safe snapshot for chart
configuration, the precise visible window, pane layout, indicators, and
explicit state contributors. Market data and runtime services remain owned by
the application.

```ts
import {
  CHART_STATE_VERSION,
  DrawingManager,
  MovingAverageIndicator,
  type ChartState
} from "@ardinsys/financial-charts";

const drawingManager = new DrawingManager();
chart.addPlugin(drawingManager);

const state: ChartState = chart.toJSON({
  contributors: [drawingManager]
});
localStorage.setItem("chart", JSON.stringify(state));

console.assert(state.version === CHART_STATE_VERSION);
```

## Snapshot contents

`ChartState` contains:

- `version`: currently `CHART_STATE_VERSION`.
- `core`: controller type, configured `timeRange`, `stepSize`, `maxZoom`, and
  volume visibility.
- `visibleRange`: interpolated start/end timestamps that preserve the precise
  fractional pan and zoom window.
- `panes`: stable pane IDs, logical heights, and the instance ID of each
  pane-owning indicator.
- `indicators`: one versioned `IndicatorState` per attached indicator.
- `contributions`: optional JSON-safe values keyed by contributor `key`.

Data, symbol identity, theme, locale, formatter, DOM adapter, crosshair state,
and arbitrary plugin fields are not serialized. Restore those through normal
application configuration and services.

State versions are strict. Unsupported chart or indicator versions throw; the
library does not guess how to migrate an application snapshot. Migrate stored
values in application code before passing them to `restoreState()`.

## Restore indicators and dependencies

Indicators are reconstructed through an application-owned resolver. The state
contains configuration and identity, while the resolver injects classes and
runtime dependencies:

```ts
const indicatorResolver = ({ typeId }) => {
  switch (typeId) {
    case MovingAverageIndicator.ID:
      return new MovingAverageIndicator();
    case OrdersIndicator.ID:
      return new OrdersIndicator(orderService);
    default:
      return undefined;
  }
};

const stored = localStorage.getItem("chart");
if (stored) {
  chart.restoreState(JSON.parse(stored), {
    indicatorResolver,
    contributors: [drawingManager]
  });
}
```

There is no global indicator registry. The resolver must return an indicator
whose static type ID matches the stored `typeId`. Multiple indicators may share
one type ID; their distinct instance IDs preserve options, visibility, pane
ownership, and synchronization identity. Duplicate instance IDs are rejected.

The stored controller type must already be registered on the target chart.
Attach contributor plugins, such as `DrawingManager`, before restoration so
their rendering and lifecycle contexts are ready.

## Custom contributors

A plugin or application component can contribute JSON-safe state by exposing a
unique key and paired serialization methods:

```ts
import type { ChartStateContributor } from "@ardinsys/financial-charts";

type WatchlistState = {
  comparisonSymbol?: string;
};

let selectedComparison: string | undefined;
const watchlistState: ChartStateContributor<WatchlistState> = {
  key: "watchlist",
  toJSON: () => ({ comparisonSymbol: selectedComparison }),
  fromJSON: (state) => {
    selectedComparison = state.comparisonSymbol;
  }
};
```

Pass the contributor to both `toJSON()` and `restoreState()`. Contributor keys
must be non-empty and unique. Every stored contribution needs a matching
contributor during restoration. Functions, class instances, cycles,
`undefined`, and other non-JSON values are rejected instead of being silently
discarded.

`fromJSON()` is application code and should validate any domain-specific
requirements. Structural chart state and required dependencies are checked
before the chart is changed, but contributor application is not transactional;
an exception from `fromJSON()` is not rolled back.

## Restore ordering and events

On a successful restore, the chart:

1. removes existing indicators without intermediate public mutation events;
2. applies core options and the visible window;
3. reconstructs indicators and their pane IDs, then restores pane heights;
4. restores contributor state;
5. refreshes attached ordinary plugins with options, data, and visible range;
6. schedules one complete redraw and emits one `state-restored` event.

Intermediate indicator, option, and drawing mutations are suppressed. The
`state-restored` payload contains a newly normalized final snapshot.

Restoration may run before `setData()`. In that case, the precise visible window
is retained and resolved against the next dataset. Restoring after data is
loaded applies the window immediately. This allows either application startup
order:

```ts
chart.restoreState(state, restoreOptions);
chart.setData(data);
```

or:

```ts
chart.setData(data);
chart.restoreState(state, restoreOptions);
```

Call `dispose()` during application teardown; persisted snapshots do not retain
chart, DOM, service, or subscription references.
