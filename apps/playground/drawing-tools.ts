import {
  HorizontalLine,
  RectangleDrawing,
  TextDrawing,
  TrendLine,
  type DrawingFactory,
} from "@ardinsys/financial-charts";

export type DrawingTool =
  | "trendline"
  | "horizontal-line"
  | "rectangle"
  | "text";

export const drawingTools: Array<{
  id: DrawingTool;
  label: string;
  icon: string;
}> = [
  { id: "trendline", label: "Trend line", icon: "trendline" },
  { id: "horizontal-line", label: "Horizontal line", icon: "horizontal" },
  { id: "rectangle", label: "Rectangle", icon: "rectangle" },
  { id: "text", label: "Text", icon: "text" },
];

export function createDrawingFactory(tool: DrawingTool): DrawingFactory {
  return ({ anchors, paneId }) => {
    if (tool === "horizontal-line") {
      return new HorizontalLine({
        anchors,
        paneId,
        color: "#22ab94",
      });
    }

    if (tool === "rectangle") {
      return new RectangleDrawing({
        anchors,
        paneId,
        strokeColor: "#f0b90b",
        fillColor: "rgba(240, 185, 11, 0.12)",
      });
    }

    if (tool === "text") {
      return new TextDrawing({
        anchors,
        paneId,
        text: "Text",
        color: "#fde68a",
        backgroundColor: "rgba(15, 23, 42, 0.88)",
      });
    }

    return new TrendLine({
      anchors,
      paneId,
      color: "#4ea1ff",
    });
  };
}
