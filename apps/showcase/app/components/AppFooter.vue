<script setup lang="ts">
const { copy } = useSiteLocale();
</script>

<template>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div class="footer-brand">
        <div class="brand">
          <ArdinsysLogo />
          <span class="brand-divider" />
          <span class="product-name">Charts<span>.</span></span>
        </div>
        <p>{{ copy.footer.summary }}</p>
      </div>
      <div>
        <h3>{{ copy.footer.product }}</h3>
        <a href="/#examples">{{ copy.nav.examples }}</a>
        <a href="/#engine">{{ copy.nav.engine }}</a>
        <a href="/#frameworks">{{ copy.nav.frameworks }}</a>
      </div>
      <div>
        <h3>{{ copy.footer.resources }}</h3>
        <a
          href="https://docs.ardinsys.eu/financial-charts/guide/quick-start.html"
          >{{ copy.nav.docs }}</a
        >
        <a href="https://github.com/ardinsys/financial-charts">GitHub</a>
        <a href="https://www.npmjs.com/package/@ardinsys/financial-charts"
          >npm</a
        >
      </div>
      <div>
        <h3>{{ copy.footer.company }}</h3>
        <a href="https://ardinsys.hu">ARDINSYS</a>
        <a href="https://codumentor.com">Codumentor</a>
      </div>
    </div>
    <div class="shell footer-bottom">
      <span>© {{ new Date().getFullYear() }} {{ copy.footer.copyright }}</span>
      <span class="mono">@ardinsys/financial-charts</span>
    </div>
  </footer>
</template>
