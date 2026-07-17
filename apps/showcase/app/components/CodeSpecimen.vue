<script setup lang="ts">
const { copy } = useSiteLocale();
const active = ref<"core" | "vue" | "react">("core");

type SyntaxToken =
  | "attribute"
  | "comment"
  | "keyword"
  | "literal"
  | "number"
  | "punctuation"
  | "string"
  | "tag"
  | "type";

const snippets = {
  core: `import { FinancialChart } from "@ardinsys/financial-charts";

const chart = new FinancialChart(host, {
  stepSize: 60_000,
  type: "candle",
  theme: "dark",
});

chart.setData(data);`,
  vue: `<script setup lang="ts">
import type { ChartData } from "@ardinsys/financial-charts";
import { FinancialChart } from "@ardinsys/financial-charts-vue";
import "@ardinsys/financial-charts/style.css";

defineProps<{ data: readonly ChartData[] }>();
const options = { stepSize: 60_000 };
<\/script>

<template>
  <FinancialChart
    style="height: 400px"
    :options="options"
    :data="data"
  />
</template>`,
  react: `import type { ChartData } from "@ardinsys/financial-charts";
import { FinancialChart } from "@ardinsys/financial-charts-react";
import "@ardinsys/financial-charts/style.css";

const options = { stepSize: 60_000 };

export function MarketView({ data }: { data: readonly ChartData[] }) {
  return (
    <FinancialChart
      style={{ height: 400 }}
      options={options}
      data={data}
    />
  );
}`,
};

const syntaxPattern =
  /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<tag><\/?[A-Za-z][\w.-]*)|(?<attribute>\bsetup\b|:[\w-]+(?==)|\b[\w-]+(?==))|(?<keyword>\b(?:const|export|from|function|import|new|readonly|return|type)\b)|(?<literal>\b(?:false|null|true|undefined)\b)|(?<number>\b\d[\d_]*(?:\.\d+)?\b)|(?<type>\b[A-Z][A-Za-z0-9]*\b)|(?<punctuation>[{}()[\],.;:=<>\/])/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightCode(source: string): string {
  let result = "";
  let lastIndex = 0;
  let insideTag = false;

  for (const match of source.matchAll(syntaxPattern)) {
    const index = match.index ?? 0;
    let token = Object.entries(match.groups ?? {}).find(
      ([, value]) => value !== undefined
    )?.[0] as SyntaxToken | undefined;

    if (token === "tag") {
      insideTag = true;
    } else if (
      insideTag &&
      token === "punctuation" &&
      (match[0] === "/" || match[0] === ">")
    ) {
      token = "tag";
      if (match[0] === ">") insideTag = false;
    }

    result += escapeHtml(source.slice(lastIndex, index));
    result += token
      ? `<span class="syntax-${token}">${escapeHtml(match[0])}</span>`
      : escapeHtml(match[0]);
    lastIndex = index + match[0].length;
  }

  return result + escapeHtml(source.slice(lastIndex));
}

const highlightedSnippet = computed(() =>
  highlightCode(snippets[active.value])
);
</script>

<template>
  <div class="code-specimen" data-reveal>
    <div class="code-topbar">
      <div class="window-dots"><i /><i /><i /></div>
      <div class="code-tabs" role="tablist">
        <button
          :class="{ active: active === 'core' }"
          type="button"
          @click="active = 'core'"
        >
          {{ copy.architecture.core }}
        </button>
        <button
          :class="{ active: active === 'vue' }"
          type="button"
          @click="active = 'vue'"
        >
          {{ copy.architecture.vue }}
        </button>
        <button
          :class="{ active: active === 'react' }"
          type="button"
          @click="active = 'react'"
        >
          {{ copy.architecture.react }}
        </button>
      </div>
      <span class="code-file mono"
        >market-view.{{
          active === "vue" ? "vue" : active === "react" ? "tsx" : "ts"
        }}</span
      >
    </div>
    <pre><code v-html="highlightedSnippet" /></pre>
    <div class="code-status mono">
      <span>● TYPES SAFE</span><span>0 WARNINGS</span>
    </div>
  </div>
</template>
