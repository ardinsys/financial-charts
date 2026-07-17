import {
  Fragment,
  createElement,
  useEffect,
  useReducer,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import type {
  ReactIndicatorLabelEntry,
  ReactModelEntry,
  ReactPaneDividerEntry,
} from "./react-dom-adapter";
import { ReactDOMAdapter } from "./react-dom-adapter";

export interface ReactDOMPortalsProps {
  readonly adapter: ReactDOMAdapter;
}

export function ReactDOMPortals({
  adapter,
}: ReactDOMPortalsProps): ReactElement {
  useSubscription(adapter);

  return createElement(
    Fragment,
    null,
    ...adapter.indicatorLabelEntries.map((entry) =>
      createElement(IndicatorLabelPortal, {
        key: `label-${entry.key}`,
        entry,
      })
    ),
    ...adapter.paneDividerEntries.map((entry) =>
      createElement(PaneDividerPortal, {
        key: `divider-${entry.key}`,
        entry,
      })
    )
  );
}

function IndicatorLabelPortal({
  entry,
}: {
  readonly entry: ReactIndicatorLabelEntry;
}): ReactElement {
  const model = useSubscription(entry);
  return createPortal(
    createElement(entry.component, { model, actions: entry.actions }),
    entry.root,
    `label-${entry.key}`
  );
}

function PaneDividerPortal({
  entry,
}: {
  readonly entry: ReactPaneDividerEntry;
}): ReactElement {
  const model = useSubscription(entry);
  return createPortal(
    createElement(entry.component, { model }),
    entry.root,
    `divider-${entry.key}`
  );
}

function useSubscription(store: ReactDOMAdapter): void;
function useSubscription<T>(store: ReactModelEntry<T>): T;
function useSubscription<T>(
  store: ReactDOMAdapter | ReactModelEntry<T>
): T | void {
  const [, forceRender] = useReducer((version) => version + 1, 0);
  useEffect(() => store.subscribe(forceRender), [store]);
  if ("getModel" in store) return store.getModel();
}
