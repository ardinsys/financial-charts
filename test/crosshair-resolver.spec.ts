import { describe, expect, it } from "vitest";
import { ChartModel } from "../src/chart/chart-model";
import { CrosshairResolver } from "../src/interaction/crosshair-resolver";
import { Pane } from "../src/panes/pane";
import type { PaneLayout } from "../src/panes/pane-layout";
import { DataScaleModel } from "../src/scales/data-scale-model";

function createResolver() {
  const model = new ChartModel();
  model.replaceData(
    [
      { time: 0, close: 10 },
      { time: 60, close: 20 },
      { time: 120, close: 15 }
    ],
    60
  );
  model.configureTimeRange("auto", 60, 3);
  model.configureScales(
    (data, timeRange) =>
      new DataScaleModel("simple", data, timeRange),
    "center"
  );
  model.refreshIndexBounds({ minimumVisibleSlots: 3, reset: true });
  model.recalculateVisibleScale([]);

  const mainPane = new Pane(0);
  mainPane.setRegion({ x: 0, y: 0, width: 300, height: 200 });
  mainPane.setPriceRange(
    model.getVisibleScale().getYMin(),
    model.getVisibleScale().getYMax()
  );
  const paneLayout = {
    getMainPane: () => mainPane,
    getPaneAtY: (y: number) => (y < 200 ? mainPane : undefined),
    getPaneById: () => mainPane
  } as unknown as PaneLayout;
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 200;
  const resolver = new CrosshairResolver(model, paneLayout, {
    normalizeTime: (point) => point.time,
    getMainCanvas: () => canvas,
    getDrawingWidth: () => 300,
    getPlotHeight: () => 200,
    getTimeAnchorAlignment: () => "center"
  });

  return { model, resolver };
}

describe("CrosshairResolver", () => {
  it("shares nearest-data resolution across pointer operations", () => {
    const { resolver } = createResolver();

    const state = resolver.resolvePointer(150, 250)!;
    const event = resolver.createPointerEvent("down", 150, 250);

    expect(state.time).toBe(60);
    expect(state.y).toBe(200);
    expect(event).toMatchObject({
      type: "down",
      time: 60,
      y: 200,
      dataPoint: state.dataPoint
    });
  });

  it("uses the visible time scale for click resolution", () => {
    const { model, resolver } = createResolver();
    model.setVisibleIndexRange({ from: 1, to: 3 });

    expect(resolver.resolveDataPoint(0, 100, "data")?.time).toBe(60);
    expect(resolver.resolveDataPoint(0, 100, "visible")?.time).toBe(60);
  });

  it("projects programmatic price and clamps explicit Y coordinates", () => {
    const { resolver } = createResolver();

    const projected = resolver.resolveProgrammatic({ time: 61, price: 20 })!;
    const clamped = resolver.resolveProgrammatic({ time: 61, y: 250 })!;

    expect(projected.time).toBe(60);
    expect(projected.y).toBeGreaterThanOrEqual(0);
    expect(projected.y).toBeLessThanOrEqual(200);
    expect(clamped.y).toBe(200);
  });

  it("rejects programmatic points outside the visible logical window", () => {
    const { model, resolver } = createResolver();
    model.setVisibleIndexRange({ from: 1, to: 2 });

    expect(resolver.resolveProgrammatic({ time: 0 })).toBeUndefined();
  });
});
