<script setup lang="ts">
import type { ControllerType } from "@ardinsys/financial-charts";

const { copy } = useSiteLocale();

const renderers = computed<
  Array<{
    type: ControllerType;
    label: string;
    code: string;
    seed: number;
  }>
>(() => [
  {
    type: "candle",
    label: copy.value.gallery.renderers.candle,
    code: "01",
    seed: 2,
  },
  {
    type: "area",
    label: copy.value.gallery.renderers.area,
    code: "02",
    seed: 9,
  },
  {
    type: "bar",
    label: copy.value.gallery.renderers.bar,
    code: "03",
    seed: 13,
  },
  {
    type: "hollow-candle",
    label: copy.value.gallery.renderers.hollow,
    code: "04",
    seed: 18,
  },
  {
    type: "stepline",
    label: copy.value.gallery.renderers.step,
    code: "05",
    seed: 23,
  },
  {
    type: "hlc-area",
    label: copy.value.gallery.renderers.hlc,
    code: "06",
    seed: 31,
  },
]);

const architectureItems = computed(() => [
  {
    number: "01",
    title: copy.value.architecture.labels,
    body: copy.value.architecture.labelsBody,
    icon: "component",
  },
  {
    number: "02",
    title: copy.value.architecture.plugins,
    body: copy.value.architecture.pluginsBody,
    icon: "plugin",
  },
  {
    number: "03",
    title: copy.value.architecture.state,
    body: copy.value.architecture.stateBody,
    icon: "state",
  },
]);

function copyInstallCommand() {
  if (import.meta.client) {
    void navigator.clipboard?.writeText(copy.value.cta.command);
  }
}

useSeoMeta({
  ogTitle: "ARDINSYS Charts — Financial data, drawn beautifully",
  ogDescription:
    "A canvas-first, extensible financial charting library by ARDINSYS.",
  ogType: "website",
});
</script>

<template>
  <div id="top" class="site-page">
    <AppHeader />

    <main>
      <section class="hero section-grid">
        <div class="hero-decor" aria-hidden="true">
          <span class="orbit orbit-one" /><span class="orbit orbit-two" />
          <span class="red-vector vector-one" /><span
            class="red-vector vector-two"
          />
          <span class="dot-matrix" />
        </div>
        <div class="shell hero-grid">
          <div class="hero-copy" data-reveal>
            <h1>
              {{ copy.hero.titleStart }}<br /><span>{{
                copy.hero.titleAccent
              }}</span>
            </h1>
            <p>{{ copy.hero.body }}</p>
            <div class="hero-actions">
              <a class="button button-primary" href="#examples"
                >{{ copy.hero.primary }} <span>↘</span></a
              >
              <a
                class="button button-ghost"
                href="https://docs.ardinsys.eu/financial-charts/guide/quick-start.html"
                >{{ copy.hero.secondary }} <span>→</span></a
              >
            </div>
            <div class="hero-notes">
              <span><i>✓</i>{{ copy.hero.note1 }}</span>
              <span><i>✓</i>{{ copy.hero.note2 }}</span>
              <span><i>✓</i>{{ copy.hero.note3 }}</span>
            </div>
          </div>

          <div class="hero-instrument" data-reveal>
            <div class="hero-instrument-backdrop" />
            <div class="hero-chart-frame instrument-panel">
              <div class="hero-chart-topbar">
                <div>
                  <span class="status-dot" /><strong>ARDIN / EUR</strong
                  ><small>· XETRA</small>
                </div>
                <span class="mono">15M</span>
              </div>
              <MarketChart live volume indicator :seed="4" />
              <div class="hero-quote">
                <small>{{ copy.hero.lastPrice }}</small
                ><strong>184.26</strong><span>+2.58 · 1.42%</span>
              </div>
              <div class="hero-chart-index mono">FIG. 01 — LIVE CANVAS</div>
            </div>
          </div>
        </div>
      </section>

      <section class="market-tape" aria-label="Market ticker">
        <div class="tape-track">
          <template v-for="repeat in 2" :key="repeat">
            <div
              v-for="quote in copy.tape"
              :key="`${repeat}-${quote[0]}`"
              class="tape-item"
            >
              <span>{{ quote[0] }}</span
              ><strong>{{ quote[1] }}</strong
              ><em :class="{ negative: quote[2].startsWith('−') }">{{
                quote[2]
              }}</em>
            </div>
          </template>
        </div>
      </section>

      <section id="examples" class="section section-grid lab-section">
        <div class="shell">
          <div class="section-intro split-intro" data-reveal>
            <div>
              <div class="kicker">{{ copy.lab.kicker }}</div>
              <h2>{{ copy.lab.title }}</h2>
            </div>
            <p>{{ copy.lab.body }}</p>
          </div>
          <ChartLab />
        </div>
      </section>

      <section class="section renderer-section">
        <div class="shell">
          <div class="section-intro renderer-intro" data-reveal>
            <div class="kicker">{{ copy.gallery.kicker }}</div>
            <h2>{{ copy.gallery.title }}</h2>
            <p>{{ copy.gallery.body }}</p>
          </div>
          <div class="renderer-grid">
            <article
              v-for="renderer in renderers"
              :key="renderer.type"
              class="renderer-card"
              data-reveal
            >
              <div class="renderer-card-head">
                <span class="mono">{{ renderer.code }}</span
                ><strong>{{ renderer.label }}</strong
                ><code>{{ renderer.type }}</code>
              </div>
              <MarketChart
                :type="renderer.type"
                compact
                :seed="renderer.seed"
              />
            </article>
          </div>
          <div class="seventh-renderer" data-reveal>
            <span class="mono">07</span>
            <div>
              <strong>{{ copy.gallery.lineTitle }}</strong>
              <p>{{ copy.gallery.lineBody }}</p>
            </div>
            <svg
              viewBox="0 0 620 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 64c40 0 52-42 98-34s72 34 112 12 63-8 91 3 63-39 103-25 60 42 99 6 75-12 117-18"
              />
            </svg>
            <code>line</code>
          </div>
        </div>
      </section>

      <section id="engine" class="section sync-section section-grid">
        <div class="shell sync-layout">
          <div class="section-intro sync-copy" data-reveal>
            <div class="kicker">{{ copy.sync.kicker }}</div>
            <h2>{{ copy.sync.title }}</h2>
            <p>{{ copy.sync.body }}</p>
            <div class="sync-data-flow mono">
              <span>{{ copy.sync.input }}</span
              ><i /><span>{{ copy.sync.coalesce }}</span
              ><i /><span>{{ copy.sync.peers }}</span>
            </div>
          </div>
          <SyncedCharts />
        </div>
      </section>

      <section id="frameworks" class="section architecture-section">
        <div class="shell">
          <div class="architecture-grid">
            <div class="section-intro architecture-copy" data-reveal>
              <div class="kicker">{{ copy.architecture.kicker }}</div>
              <h2>{{ copy.architecture.title }}</h2>
              <p>{{ copy.architecture.body }}</p>
              <div class="framework-pills">
                <span>TypeScript 7</span><span>Vue 3</span
                ><span>React 16.8+</span>
              </div>
            </div>
            <CodeSpecimen />
          </div>
          <div class="architecture-list">
            <article
              v-for="item in architectureItems"
              :key="item.number"
              data-reveal
            >
              <div class="architecture-number mono">{{ item.number }}</div>
              <div class="architecture-icon">
                <svg v-if="item.icon === 'component'" viewBox="0 0 24 24">
                  <path d="m8 3-5 5 5 5m8-2 5 5-5 5M14 2l-4 20" />
                </svg>
                <svg v-else-if="item.icon === 'plugin'" viewBox="0 0 24 24">
                  <path d="M8 3v4m8-4v4M5 7h14v4a7 7 0 0 1-7 7v3m-4 0h8" />
                </svg>
                <svg v-else viewBox="0 0 24 24">
                  <path
                    d="M4 7c0-2 3.6-4 8-4s8 2 8 4-3.6 4-8 4-8-2-8-4Zm0 0v5c0 2 3.6 4 8 4s8-2 8-4V7M4 12v5c0 2 3.6 4 8 4s8-2 8-4v-5"
                  />
                </svg>
              </div>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.body }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="section proof-section section-grid">
        <div class="shell">
          <div class="section-intro proof-intro" data-reveal>
            <div class="kicker">{{ copy.proof.kicker }}</div>
            <h2>{{ copy.proof.title }}</h2>
          </div>
          <div class="proof-rail">
            <div
              v-for="(stat, index) in copy.proof.stats"
              :key="stat[1]"
              data-reveal
            >
              <span class="mono">0{{ index + 1 }}</span
              ><strong>{{ stat[0] }}</strong>
              <p>{{ stat[1] }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section cta-section">
        <div class="shell">
          <div class="cta-panel" data-reveal>
            <div class="cta-orbit" aria-hidden="true" />
            <div class="kicker">{{ copy.cta.kicker }}</div>
            <h2>{{ copy.cta.title }}</h2>
            <p>{{ copy.cta.body }}</p>
            <div class="install-command mono">
              <span>$</span>{{ copy.cta.command
              }}<button
                type="button"
                aria-label="Copy install command"
                @click="copyInstallCommand"
              >
                ⌘C
              </button>
            </div>
            <div class="cta-actions">
              <a
                class="button button-primary"
                href="https://docs.ardinsys.eu/financial-charts/guide/quick-start.html"
                >{{ copy.cta.primary }} <span>→</span></a
              >
              <a
                class="button button-ghost"
                href="https://github.com/ardinsys/financial-charts"
                >{{ copy.cta.secondary }}</a
              >
            </div>
          </div>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>
