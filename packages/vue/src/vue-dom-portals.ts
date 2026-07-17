import { Teleport, defineComponent, h, type PropType } from "vue";
import type {
  VueIndicatorLabelEntry,
  VuePaneDividerEntry,
} from "./vue-dom-adapter";
import { VueDOMAdapter } from "./vue-dom-adapter";

const IndicatorLabelPortal = defineComponent({
  name: "FinancialChartIndicatorLabelPortal",
  props: {
    entry: {
      type: Object as PropType<VueIndicatorLabelEntry>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(Teleport, { to: props.entry.root }, [
        h(props.entry.component, {
          model: props.entry.model.value,
          actions: props.entry.actions,
        }),
      ]);
  },
});

const PaneDividerPortal = defineComponent({
  name: "FinancialChartPaneDividerPortal",
  props: {
    entry: {
      type: Object as PropType<VuePaneDividerEntry>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(Teleport, { to: props.entry.root }, [
        h(props.entry.component, { model: props.entry.model.value }),
      ]);
  },
});

export const VueDOMPortals = defineComponent({
  name: "FinancialChartDOMPortals",
  props: {
    adapter: {
      type: Object as PropType<VueDOMAdapter>,
      required: true,
    },
  },
  setup(props) {
    return () => [
      ...props.adapter.indicatorLabelEntries.map((entry) =>
        h(IndicatorLabelPortal, { key: `label-${entry.key}`, entry })
      ),
      ...props.adapter.paneDividerEntries.map((entry) =>
        h(PaneDividerPortal, { key: `divider-${entry.key}`, entry })
      ),
    ];
  },
});
