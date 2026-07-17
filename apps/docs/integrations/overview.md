# Integrations overview

`@ardinsys/financial-charts` only requires a real DOM element, a predictable
container size, and lifecycle hooks for cleanup. The official
`@ardinsys/financial-charts-vue` package provides those bindings for Vue 3;
other runtimes can integrate the imperative core directly.

## Integration checklist

- Create the chart inside the framework's mount hook (`useEffect`, `onMounted`, `ngAfterViewInit`).
- Store the instance so you can call `setData`, `updateData`, and `updateOptions` when props change.
- Treat an incoming array prop as a complete snapshot and pass it to `setData`.
  Use `updateData` only for a feed that explicitly delivers one newest candle.
- Dispose the chart during teardown (`useEffect` cleanup, `onBeforeUnmount`, `ngOnDestroy`).
- Keep the container height stable – the chart reacts to `ResizeObserver` events automatically.
- Custom `controllers` are added to the built-ins. Set `includeDefaultControllers: false` only when you need an exact controller set.
- For controller-level tree shaking, import `FinancialChart` from `@ardinsys/financial-charts/core` and controllers from their `@ardinsys/financial-charts/controllers/*` entry points.
- Attach plugins before restoring contributor state. Chart state can be restored
  before or after data; a pre-data visible window is applied by the next
  `setData()`.
- Instantiate the chart on the client. Formatter modules are SSR-safe, but the
  chart constructor requires a measurable element and browser APIs such as
  `ResizeObserver` and canvas contexts.

See [State and persistence](/guide/state-and-persistence) for resolver,
contributor, and restore-order details.
