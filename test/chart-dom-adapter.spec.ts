import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "./fixtures/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type {
  ChartDOMAdapter,
  ChartDOMOverlay,
  ChartDOMOverlayContext,
  IndicatorLabelActions,
  IndicatorLabelHandle,
  IndicatorLabelModel,
  PaneDividerActions,
  PaneDividerHandle,
  PaneDividerModel
} from "../src/ui/chart-dom-adapter";

const charts: FinancialChart[] = [];

class CustomDOMAdapter implements ChartDOMAdapter {
  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext
  ): ChartDOMOverlay {
    const indicatorLabelContainer = document.createElement("section");
    indicatorLabelContainer.className = "custom-label-region";
    indicatorLabelContainer.dataset.themeKey = context.themeKey;
    host.appendChild(indicatorLabelContainer);

    return {
      indicatorLabelContainer,
      update: (next) => {
        indicatorLabelContainer.dataset.themeKey = next.themeKey;
      },
      destroy: () => indicatorLabelContainer.remove()
    };
  }

  createIndicatorLabel(
    model: IndicatorLabelModel,
    _actions: IndicatorLabelActions
  ): IndicatorLabelHandle {
    const root = document.createElement("article");
    root.className = "custom-indicator-label";

    const update = (next: IndicatorLabelModel) => {
      root.dataset.instanceId = next.instanceId;
      root.dataset.typeId = next.typeId;
      root.dataset.labelKey = next.labelKey;
      root.dataset.themeKey = next.themeKey;
      root.textContent = [next.name, next.detail].filter(Boolean).join(" ");
    };

    update(model);

    return {
      root,
      update,
      destroy: () => undefined
    };
  }

  createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle {
    const root = document.createElement("div");
    root.className = "custom-pane-divider";
    root.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      actions.onPointerDown(event);
    });

    const update = (next: PaneDividerModel) => {
      root.dataset.key = next.key;
      root.dataset.themeKey = next.themeKey;
      root.dataset.beforePaneId = String(next.beforePaneId);
      root.dataset.afterPaneId = String(next.afterPaneId);
      root.style.top = next.y + "px";
    };

    update(model);

    return {
      root,
      update,
      destroy: () => root.remove()
    };
  }
}

function createChart(adapter: ChartDOMAdapter) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const start = Date.UTC(2024, 0, 1, 9);
  const chart = new FinancialChart(
    container,
    {
      timeRange: { start, end: start + 60_000 },
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US",
      domAdapter: adapter
    }
  );

  chart.setData([
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 }
  ]);
  charts.push(chart);

  return { chart, container };
}

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

describe("ChartDOMAdapter", () => {
  it("lets applications replace indicator labels and pane dividers", () => {
    const { chart, container } = createChart(new CustomDOMAdapter());
    const overlayIndicator = new MovingAverageIndicator();
    const paneIndicator = new TestIndicator();

    chart.addIndicator(overlayIndicator);
    chart.addIndicator(paneIndicator);

    const labels = container.querySelectorAll(".custom-indicator-label");
    const divider = container.querySelector(".custom-pane-divider");

    expect(container.querySelector(".custom-label-region")).toBeTruthy();
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toContain("Simple Moving Average");
    expect(labels[1].textContent).toContain("Test");
    expect(divider).toBeTruthy();
    expect((divider as HTMLElement).dataset.beforePaneId).toBe("0");
    expect((divider as HTMLElement).dataset.afterPaneId).toBe("1");
  });
});
