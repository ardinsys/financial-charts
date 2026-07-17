export type IndicatorKind = "moving-average" | "pane-marker";

export const indicatorCatalog: Array<{
  id: IndicatorKind;
  name: string;
  detail: string;
}> = [
  {
    id: "moving-average",
    name: "Moving Average",
    detail: "Overlay average with editable period and source"
  },
  {
    id: "pane-marker",
    name: "Pane Markers",
    detail: "Separate pane sample that follows the price series"
  }
];
