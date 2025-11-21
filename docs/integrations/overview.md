# Integrations overview

`@ardinsys/financial-charts` does not need framework-specific bindings – it only requires a real DOM element, a predictable container size, and lifecycle hooks for cleanup. The patterns below apply to any SPA/runtime that can give you an element reference.

## Integration checklist

- Create the chart inside the framework's mount hook (`useEffect`, `onMounted`, `ngAfterViewInit`).
- Store the instance so you can call `draw`, `drawNextPoint`, and `updateCoreOptions` when props change.
- Dispose the chart during teardown (`useEffect` cleanup, `onBeforeUnmount`, `ngOnDestroy`).
- Keep the container height stable – the chart reacts to `ResizeObserver` events automatically.
- Register controllers once at app startup to avoid duplicate registrations.

Use the framework-specific pages for concrete examples.
