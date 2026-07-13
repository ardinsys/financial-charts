# Integrations overview

`@ardinsys/financial-charts` does not need framework-specific bindings – it only requires a real DOM element, a predictable container size, and lifecycle hooks for cleanup. The patterns below apply to any SPA/runtime that can give you an element reference.

## Integration checklist

- Create the chart inside the framework's mount hook (`useEffect`, `onMounted`, `ngAfterViewInit`).
- Store the instance so you can call `draw`, `drawNextPoint`, and `updateCoreOptions` when props change.
- Prefer a single sorted `data` array. Call `drawNextPoint` for the newest candle and fall back to `draw` when correcting existing data.
- Dispose the chart during teardown (`useEffect` cleanup, `onBeforeUnmount`, `ngOnDestroy`).
- Keep the container height stable – the chart reacts to `ResizeObserver` events automatically.
- Custom `controllers` are added to the built-ins. Set `includeDefaultControllers: false` only when you need an exact controller set.
- For controller-level tree shaking, import `FinancialChart` from `@ardinsys/financial-charts/core` and controllers from their `@ardinsys/financial-charts/controllers/*` entry points.
- Instantiate the chart on the client: the default formatter uses `navigator` and the chart depends on real DOM APIs (`ResizeObserver`, `PointerEvent`), so guard SSR setups with `typeof window !== "undefined"`.
